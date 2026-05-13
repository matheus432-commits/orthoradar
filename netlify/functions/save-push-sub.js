const { request, corsHeaders, preflight } = require('./_lib');
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
  const f = docs[0].document.fields || {};
  return {
    docId: docs[0].document.name.split('/').pop(),
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || ''
  };
}

async function saveSub(projectId, apiKey, docId, subJson) {
  const body = JSON.stringify({ fields: { pushSubscription: { stringValue: subJson } } });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
      '?updateMask.fieldPaths=pushSubscription&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

async function clearSub(projectId, apiKey, docId) {
  const body = JSON.stringify({ fields: { pushSubscription: { nullValue: null } } });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
      '?updateMask.fieldPaths=pushSubscription&key=' + apiKey,
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

  const { email, subscription } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUser(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };
    if (!tokenEqual(user.sessionToken, token)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
    if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada' }) };
    }

    if (subscription) {
      // Validate subscription object shape
      if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Subscription invalida' }) };
      }
      await saveSub(projectId, apiKey, user.docId, JSON.stringify(subscription));
      console.log('[PushSub] Saved for:', email);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'saved' }) };
    } else {
      // subscription: null → remove
      await clearSub(projectId, apiKey, user.docId);
      console.log('[PushSub] Cleared for:', email);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, action: 'cleared' }) };
    }
  } catch (err) {
    console.error('[PushSub] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
