const { request, corsHeaders, preflight, stripeRequest } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getAuthUser(projectId, apiKey, email, token) {
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
  const user = {
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || '',
    stripeCustomerId: f.stripeCustomerId?.stringValue || ''
  };
  if (!tokenEqual(user.sessionToken, token)) return null;
  if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) return null;
  return user;
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getAuthUser(projectId, apiKey, email, token);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
    if (!user.stripeCustomerId) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Nenhuma assinatura encontrada.' }) };
    }

    const siteUrl = process.env.SITE_URL || 'https://odontofeed.com';
    const portalRes = await stripeRequest('/v1/billing_portal/sessions', 'POST', {
      customer: user.stripeCustomerId,
      return_url: siteUrl + '/dashboard.html'
    });

    if (portalRes.status !== 200) throw new Error('Stripe portal creation failed: ' + portalRes.status);
    const session = JSON.parse(portalRes.body);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('[Portal] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
