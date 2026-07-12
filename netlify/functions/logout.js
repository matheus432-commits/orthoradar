// Logout server-side: invalida a sessão no Firestore (limpa sessionToken).
// Sem isto, o token continuaria válido por até 30 dias mesmo após o usuário sair.

const { request } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUser(projectId, apiKey, email) {
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
  return {
    docId: doc.name.split('/').pop(),
    sessionToken: (doc.fields?.sessionToken && doc.fields.sessionToken.stringValue) || null
  };
}

async function clearSession(projectId, apiKey, docId) {
  const body = JSON.stringify({ fields: { sessionToken: { stringValue: '' }, sessionExpiry: { stringValue: '' } } });
  const buf = Buffer.from(body, 'utf8');
  const masks = 'updateMask.fieldPaths=sessionToken&updateMask.fieldPaths=sessionExpiry';
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
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const email = body.email;
  if (!email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email e token obrigatorios' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  try {
    const user = await getUser(projectId, apiKey, email);
    // Só limpa se o token confere — evita que terceiros derrubem a sessão de outrem.
    if (user && tokenEqual(user.sessionToken, token)) {
      await clearSession(projectId, apiKey, user.docId);
    }
    // Sempre responde sucesso (o cliente vai limpar o localStorage de qualquer forma).
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Logout error:', err.message);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  }
};
