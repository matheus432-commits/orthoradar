const crypto = require('crypto');
const { request } = require('./_lib');

function verifyStripeSignature(rawBody, sigHeader, secret) {
  const parts = {};
  for (const chunk of sigHeader.split(',')) {
    const idx = chunk.indexOf('=');
    if (idx > 0) parts[chunk.slice(0, idx)] = chunk.slice(idx + 1);
  }
  if (!parts.t || !parts.v1) return false;
  // Reject events older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - parseInt(parts.t, 10)) > 300) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(parts.t + '.' + rawBody, 'utf8')
    .digest('hex');
  try {
    const a = Buffer.from(parts.v1, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

async function queryUser(projectId, apiKey, field, value) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'cadastros' }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
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
  return { id: docs[0].document.name.split('/').pop() };
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
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks.join('&') + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) console.warn('[Webhook] patchUser failed:', docId, res.status);
}

function priceToPlano(priceId) {
  if (priceId && priceId === process.env.STRIPE_PRICE_PREMIUM) return 'premium';
  if (priceId && priceId === process.env.STRIPE_PRICE_CONVENCIONAL) return 'convencional';
  return null;
}

async function handleCheckoutCompleted(projectId, apiKey, session) {
  if (session.mode !== 'subscription' || session.payment_status !== 'paid') return;
  const email = session.metadata?.email || session.customer_details?.email;
  const plano = session.metadata?.plano;
  if (!email || !plano) { console.warn('[Webhook] Missing metadata in session:', session.id); return; }

  const user = await queryUser(projectId, apiKey, 'email', email);
  if (!user) { console.warn('[Webhook] User not found:', email); return; }

  await patchUser(projectId, apiKey, user.id, {
    plano,
    stripeCustomerId: session.customer || '',
    stripeSubscriptionId: session.subscription || '',
    planoValidoAte: ''
  });
  console.log('[Webhook] checkout.completed →', email, 'plano:', plano);
}

async function handleSubscriptionUpdated(projectId, apiKey, subscription) {
  const customerId = subscription.customer;
  const priceId = subscription.items?.data?.[0]?.price?.id;
  const plano = priceToPlano(priceId);
  const status = subscription.status;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : '';

  const user = await queryUser(projectId, apiKey, 'stripeCustomerId', customerId);
  if (!user) { console.warn('[Webhook] User not found for customer:', customerId); return; }

  const updates = { stripeSubscriptionId: subscription.id, planoValidoAte: periodEnd };
  if (status === 'past_due' || status === 'unpaid' || status === 'canceled') {
    updates.plano = 'free';
  } else if (plano) {
    updates.plano = plano;
  }

  await patchUser(projectId, apiKey, user.id, updates);
  console.log('[Webhook] subscription.updated → customer:', customerId, 'plano:', updates.plano || '(unchanged)', 'status:', status);
}

async function handleSubscriptionDeleted(projectId, apiKey, subscription) {
  const customerId = subscription.customer;
  const user = await queryUser(projectId, apiKey, 'stripeCustomerId', customerId);
  if (!user) { console.warn('[Webhook] User not found for customer:', customerId); return; }

  await patchUser(projectId, apiKey, user.id, { plano: 'free', stripeSubscriptionId: '', planoValidoAte: '' });
  console.log('[Webhook] subscription.deleted → downgrade to free:', customerId);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) { console.error('[Webhook] STRIPE_WEBHOOK_SECRET not set'); return { statusCode: 500, body: 'Misconfigured' }; }
  if (!sig || !verifyStripeSignature(event.body, sig, webhookSecret)) {
    console.warn('[Webhook] Signature verification failed');
    return { statusCode: 400, body: 'Invalid signature' };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(projectId, apiKey, stripeEvent.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(projectId, apiKey, stripeEvent.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(projectId, apiKey, stripeEvent.data.object);
        break;
      default:
        // Acknowledge unhandled events without error
        break;
    }
  } catch (err) {
    console.error('[Webhook] Error handling', stripeEvent.type, ':', err.message);
    return { statusCode: 500, body: 'Handler error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
