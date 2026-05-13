const { request, corsHeaders, preflight } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUserByEmail(projectId, apiKey, email) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'cadastros' }],
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) return null;
  const docs = JSON.parse(res.body);
  if (!docs[0] || !docs[0].document) return null;
  const doc = docs[0].document;
  const f = doc.fields || {};
  return {
    docId: doc.name.split('/').pop(),
    senhaHash: f.senhaHash?.stringValue || '',
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || ''
  };
}

async function updatePassword(projectId, apiKey, docId, novaSenhaHash) {
  const body = JSON.stringify({ fields: { senhaHash: { stringValue: novaSenhaHash } } });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?updateMask.fieldPaths=senhaHash&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) throw new Error('Firestore patch failed: ' + res.status);
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, senhaHashAtual, novaSenhaHash } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token || !senhaHashAtual || !novaSenhaHash) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  if (senhaHashAtual === novaSenhaHash) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'A nova senha deve ser diferente da atual' }) };
  }
  // Expect 64-char hex SHA-256 hash
  if (!/^[a-f0-9]{64}$/.test(novaSenhaHash)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Formato de senha invalido' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };

    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada' }) };
    }
    if (!tokenEqual(user.senhaHash, senhaHashAtual)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Senha atual incorreta' }) };
    }

    await updatePassword(projectId, apiKey, user.docId, novaSenhaHash);
    console.log('[ChangePassword] Updated for:', email);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Senha alterada com sucesso.' }) };
  } catch (err) {
    console.error('[ChangePassword] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
