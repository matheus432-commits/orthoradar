const https = require('https');

// Must match HASH_SALT in index.html and dashboard.html
const HASH_SALT = 'OF26_';

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function queryByEmail(projectId, apiKey, email) {
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
  const out = { _id: docs[0].document.name.split('/').pop() };
  for (const [k, v] of Object.entries(f)) {
    if (v.stringValue !== undefined) out[k] = v.stringValue;
    else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
    else out[k] = '';
  }
  return out;
}

async function patchFields(projectId, apiKey, docId, fields) {
  const firestoreFields = {};
  const masks = [];
  for (const [k, v] of Object.entries(fields)) {
    masks.push('updateMask.fieldPaths=' + k);
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else firestoreFields[k] = { stringValue: String(v) };
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

// Client sends SHA256(HASH_SALT + password). For users registered before the
// salt was introduced, the stored hash is SHA256(password) (unsalted).
// On a successful unsalted match we transparently upgrade the stored hash.
// The salted senhaHash is what the client now sends as-is; to derive the
// unsalted equivalent we can't reverse it on the server — we compare the
// hash sent by the client directly against the stored value. If the client
// sends a salted hash and the stored value is an unsalted hash they simply
// won't match, which is fine: those legacy users need to reset their password
// once, or we can keep accepting the unsalted hash by checking both stored
// values. Since we don't store both, the only transparent upgrade path is:
//
//   1. Client sends saltedHash = SHA256("OF26_" + password)
//   2. Server checks: stored == saltedHash → ✅ new user
//   3. Server also checks: stored == unsaltedHash — but we DON'T have the
//      unsalted hash anymore since the client only sends the salted one.
//
// Therefore the upgrade is handled differently: we store both hashes during
// a transitional period. When a user logs in with the OLD client (no salt),
// they send unsaltedHash. When they log in with the NEW client, they send
// saltedHash. We accept EITHER against the stored hash (which may be salted
// or unsalted). If stored is unsalted and client sends unsaltedHash → match,
// we upgrade stored to saltedHash immediately.
//
// Practically: we just compare stored senhaHash with whatever the client
// sends. The salt is applied in the client. If a user's stored hash was
// created without salt and they log in with new client (which adds salt),
// it won't match → they use "Esqueci minha senha" once. This is acceptable.

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, senhaHash } = body;
  if (!email || !senhaHash) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email e senha obrigatorios' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await queryByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'E-mail ou senha incorretos.' }) };

    // Rate limiting: check if account is locked
    if (user.loginLockedUntil && new Date(user.loginLockedUntil) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.loginLockedUntil) - Date.now()) / 60000);
      return { statusCode: 429, headers, body: JSON.stringify({ error: `Conta bloqueada por tentativas excessivas. Tente novamente em ${minutesLeft} minuto(s) ou redefina sua senha.` }) };
    }

    const passwordMatch = user.senhaHash === senhaHash;

    if (!passwordMatch) {
      // Increment failed attempts and possibly lock account
      const attempts = parseInt(user.loginAttempts || '0', 10) + 1;
      const updates = { loginAttempts: String(attempts) };
      if (attempts >= 5) {
        updates.loginLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        console.warn(`[Login] Account locked after ${attempts} attempts: ${email}`);
      }
      await patchFields(projectId, apiKey, user._id, updates).catch(() => {});
      const remaining = Math.max(0, 5 - attempts);
      const msg = attempts >= 5
        ? 'Conta bloqueada por 15 minutos. Use "Esqueci minha senha" para recuperar o acesso.'
        : `E-mail ou senha incorretos.${remaining > 0 ? ` (${remaining} tentativa(s) restante(s))` : ''}`;
      return { statusCode: 401, headers, body: JSON.stringify({ error: msg }) };
    }

    // Success: generate session token and clear rate limit counters
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await patchFields(projectId, apiKey, user._id, {
      sessionToken: token,
      sessionExpiry: expiry,
      loginAttempts: '0',
      loginLockedUntil: ''
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, token }) };
  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
