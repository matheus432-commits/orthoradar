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

async function updatePreferences(projectId, apiKey, docId, especialidade, temas) {
  const espValues = especialidade.map(e => ({ stringValue: e }));
  const temasValues = temas.map(t => ({ stringValue: t }));
  const body = JSON.stringify({
    fields: {
      especialidade: { arrayValue: { values: espValues } },
      temas: { arrayValue: { values: temasValues } }
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const masks = 'updateMask.fieldPaths=especialidade&updateMask.fieldPaths=temas';
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

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, token, especialidade, temas } = body;
  if (!email || !token || !especialidade || !temas) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  if (!Array.isArray(especialidade) || especialidade.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selecione ao menos uma especialidade.' }) };
  }
  if (!Array.isArray(temas) || temas.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Selecione ao menos um tema.' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado.' }) };
    if (user.sessionToken !== token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão inválida.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão expirada.' }) };
    }
    const res = await updatePreferences(projectId, apiKey, user.docId, especialidade, temas);
    if (res.status !== 200) throw new Error('Firestore update failed: ' + res.body);
    console.log('Preferences updated for:', email, '| specs:', especialidade.join(','), '| temas:', temas.length);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Preferências atualizadas com sucesso!' }) };
  } catch (err) {
    console.error('Update preferences error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
