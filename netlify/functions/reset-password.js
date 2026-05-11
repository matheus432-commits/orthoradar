const { request } = require('./_lib');


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
  const f = docs[0].document.fields || {};
  return {
    docId: docs[0].document.name.split('/').pop(),
    resetToken: f.resetToken?.stringValue || null,
    resetTokenExpiry: f.resetTokenExpiry?.stringValue || null
  };
}

async function updatePassword(projectId, apiKey, docId, senhaHash) {
  const body = JSON.stringify({
    fields: {
      senhaHash: { stringValue: senhaHash },
      resetToken: { stringValue: '' },
      resetTokenExpiry: { stringValue: '' },
      loginAttempts: { stringValue: '0' },
      loginLockedUntil: { stringValue: '' }
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const masks = 'updateMask.fieldPaths=senhaHash&updateMask.fieldPaths=resetToken&updateMask.fieldPaths=resetTokenExpiry&updateMask.fieldPaths=loginAttempts&updateMask.fieldPaths=loginLockedUntil';
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, token, novaSenhaHash } = body;
  if (!email || !token || !novaSenhaHash) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado.' }) };
    if (!user.resetToken || user.resetToken !== token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Link inválido ou já utilizado.' }) };
    }
    if (!user.resetTokenExpiry || new Date(user.resetTokenExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Link expirado. Solicite um novo.' }) };
    }
    await updatePassword(projectId, apiKey, user.docId, novaSenhaHash);
    console.log('Password reset successful for:', email);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Senha atualizada com sucesso!' }) };
  } catch (err) {
    console.error('Reset password error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
