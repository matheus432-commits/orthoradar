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
  const f = doc.fields || {};
  return {
    docId: doc.name.split('/').pop(),
    sessionToken: (f.sessionToken && f.sessionToken.stringValue) || null,
    sessionExpiry: (f.sessionExpiry && f.sessionExpiry.stringValue) || null
  };
}

// Atomic Firestore array operation — no read-modify-write, no race condition
async function atomicArrayOp(projectId, apiKey, docId, field, op, value) {
  const body = JSON.stringify({
    writes: [{
      transform: {
        document: 'projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId,
        fieldTransforms: [{
          fieldPath: field,
          [op]: { values: [{ stringValue: value }] }
        }]
      }
    }]
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:commit?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status === 200;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) };
  }
  const { email, token, artId, action } = body;
  if (!email || !token || !artId || !action) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios: email, token, artId, action' }) };
  }
  if (!['mark', 'unmark'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action deve ser mark ou unmark' }) };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  try {
    const user = await getUser(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };
    if (!tokenEqual(user.sessionToken, token)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalido' }) };
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada' }) };
    }
    // appendMissingElements = arrayUnion, removeAllFromArray = arrayRemove — both atomic
    const op = action === 'mark' ? 'appendMissingElements' : 'removeAllFromArray';
    await atomicArrayOp(projectId, apiKey, user.docId, 'lidos', op, artId);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, artId, lido: action === 'mark' }) };
  } catch(err) {
    console.error('Toggle lido error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
