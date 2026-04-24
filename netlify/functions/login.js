const https = require('https');

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

async function updateField(projectId, apiKey, docId, fieldName, fieldValue) {
  const body = JSON.stringify({ fields: { [fieldName]: { stringValue: fieldValue } } });
  const buf = Buffer.from(body, 'utf8');
  const path = '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
    '?updateMask.fieldPaths=' + fieldName + '&key=' + apiKey;
  return request({
    hostname: 'firestore.googleapis.com',
    path,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

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
    if (user.senhaHash !== senhaHash) return { statusCode: 401, headers, body: JSON.stringify({ error: 'E-mail ou senha incorretos.' }) };

    // Generate session token
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // Save token to Firestore
    await updateField(projectId, apiKey, user._id, 'sessionToken', token);
    await updateField(projectId, apiKey, user._id, 'sessionExpiry', expiry);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, token }) };
  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
