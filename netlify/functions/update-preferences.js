const { request, corsHeaders, preflight } = require('./_lib');
const crypto = require('crypto');

const ALLOWED_SPECS = new Set([
  'Ortodontia', 'Implantodontia', 'Periodontia', 'Dentística',
  'Bucomaxilofacial', 'Prótese', 'Endodontia', 'Odontopediatria',
  'DTM e Dor Orofacial', 'Radiologia'
]);

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
  const f = docs[0].document.fields || {};
  return {
    docId: docs[0].document.name.split('/').pop(),
    sessionToken: f.sessionToken?.stringValue || null,
    sessionExpiry: f.sessionExpiry?.stringValue || null
  };
}

async function updatePreferences(projectId, apiKey, docId, especialidade, temas, nome) {
  const espValues = especialidade.map(e => ({ stringValue: e }));
  const temasValues = temas.map(t => ({ stringValue: t }));
  const fields = {
    especialidade: { arrayValue: { values: espValues } },
    temas: { arrayValue: { values: temasValues } }
  };
  let masks = 'updateMask.fieldPaths=especialidade&updateMask.fieldPaths=temas';
  if (nome) {
    fields.nome = { stringValue: nome };
    masks += '&updateMask.fieldPaths=nome';
  }
  const body = JSON.stringify({ fields });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, token, especialidade, temas, nome } = body;
  if (!email || !token || !especialidade || !temas) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  if (nome !== undefined && (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 80)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nome inválido (2-80 caracteres).' }) };
  }
  const nomeTrimmed = nome ? nome.trim() : null;
  if (!Array.isArray(especialidade) || especialidade.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selecione ao menos uma especialidade.' }) };
  }
  const invalidSpec = especialidade.find(e => !ALLOWED_SPECS.has(e));
  if (invalidSpec) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Especialidade inválida: ' + invalidSpec }) };
  }
  if (!Array.isArray(temas) || temas.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selecione ao menos um tema.' }) };
  }
  const invalidTema = temas.find(t => typeof t !== 'string' || t.length < 3 || t.length > 120);
  if (invalidTema !== undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tema inválido.' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado.' }) };
    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão inválida.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão expirada.' }) };
    }
    const res = await updatePreferences(projectId, apiKey, user.docId, especialidade, temas, nomeTrimmed);
    if (res.status !== 200) throw new Error('Firestore update failed: ' + res.body);
    console.log('Preferences updated for:', email, '| specs:', especialidade.join(','), '| temas:', temas.length, nomeTrimmed ? '| nome: updated' : '');
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Preferências atualizadas com sucesso!' }) };
  } catch (err) {
    console.error('Update preferences error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
