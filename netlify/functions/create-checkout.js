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
    id: docs[0].document.name.split('/').pop(),
    nome: f.nome?.stringValue || '',
    email: f.email?.stringValue || '',
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || '',
    stripeCustomerId: f.stripeCustomerId?.stringValue || '',
    plano: f.plano?.stringValue || 'free'
  };
  if (!tokenEqual(user.sessionToken, token)) return null;
  if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) return null;
  return user;
}

async function patchUser(projectId, apiKey, docId, fields) {
  const firestoreFields = {};
  const masks = [];
  for (const [k, v] of Object.entries(fields)) {
    masks.push('updateMask.fieldPaths=' + k);
    firestoreFields[k] = { stringValue: String(v) };
  }
  const body = JSON.stringify({ fields: firestoreFields });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks.join('&') + '&key=' + apiKey,
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

  const { email, plano } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token || !plano) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  if (!['convencional', 'premium'].includes(plano)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plano invalido' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getAuthUser(projectId, apiKey, email, token);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };

    const priceId = plano === 'premium'
      ? process.env.STRIPE_PRICE_PREMIUM
      : process.env.STRIPE_PRICE_CONVENCIONAL;
    if (!priceId) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Plano nao configurado. Tente novamente em breve.' }) };

    // Create Stripe customer if not exists yet
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const custRes = await stripeRequest('/v1/customers', 'POST', {
        email: user.email,
        name: user.nome,
        'metadata[firestoreId]': user.id
      });
      if (custRes.status !== 200) throw new Error('Stripe customer creation failed: ' + custRes.status);
      customerId = JSON.parse(custRes.body).id;
      await patchUser(projectId, apiKey, user.id, { stripeCustomerId: customerId });
    }

    const siteUrl = process.env.SITE_URL || 'https://odontofeed.com';
    const sessionRes = await stripeRequest('/v1/checkout/sessions', 'POST', {
      customer: customerId,
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: siteUrl + '/dashboard.html?checkout=success',
      cancel_url: siteUrl + '/dashboard.html?checkout=cancelled',
      'metadata[plano]': plano,
      'metadata[email]': user.email
    });

    if (sessionRes.status !== 200) throw new Error('Stripe checkout session failed: ' + sessionRes.status + ' ' + sessionRes.body.substring(0, 200));
    const session = JSON.parse(sessionRes.body);

    console.log('[Checkout] Session created for', user.email, '| plano:', plano);
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
  } catch (err) {
    console.error('[Checkout] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
