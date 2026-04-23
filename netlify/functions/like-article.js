const https = require('https');

// HTTP helper
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

// Firestore: query user by email
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
  const doc = docs[0].document;
  const f = doc.fields || {};
  const curtidos = f.curtidos && f.curtidos.arrayValue && f.curtidos.arrayValue.values
    ? f.curtidos.arrayValue.values.map(v => v.stringValue || '')
    : [];
  return {
    docId: doc.name.split('/').pop(),
    magicToken: (f.magicToken && f.magicToken.stringValue) || null,
    magicTokenExpiry: (f.magicTokenExpiry && f.magicTokenExpiry.stringValue) || null,
    curtidos
  };
}

// Firestore: update curtidos array
async function updateCurtidos(projectId, apiKey, docId, curtidos) {
  const values = curtidos.map(id => ({ stringValue: id }));
  const body = JSON.stringify({
    fields: { curtidos: { arrayValue: { values } } }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
          '?updateMask.fieldPaths=curtidos&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status === 200;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) };
  }
  const { email, artigoId, action } = body;
  if (!email || !artigoId || !action || !token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios: email, artigoId, action' }) };
  }
  if (!['like', 'unlike'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action deve ser like ou unlike' }) };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };
    if (user.magicToken !== token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalido' }) };
    if (user.magicTokenExpiry && new Date(user.magicTokenExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada.' }) };
    }
    let curtidos = user.curtidos || [];
    if (action === 'like') {
      if (!curtidos.includes(artigoId)) curtidos.push(artigoId);
    } else {
      curtidos = curtidos.filter(id => id !== artigoId);
    }
    await updateCurtidos(projectId, apiKey, user.docId, curtidos);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, action, artigoId }) };
  } catch(err) {
    console.error('Like article error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
