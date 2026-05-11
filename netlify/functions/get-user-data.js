const { request } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function queryByField(projectId, apiKey, collectionId, field, value, limit) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId }],
      where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
      limit: limit || 200
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) return [];
  const docs = JSON.parse(res.body);
  return docs.filter(d => d.document).map(d => {
    const f = d.document.fields || {};
    const out = { id: d.document.name.split('/').pop() };
    for (const [k, v] of Object.entries(f)) {
      if (v.stringValue !== undefined) out[k] = v.stringValue;
      else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
      else if (v.integerValue !== undefined) out[k] = parseInt(v.integerValue);
      else if (v.arrayValue !== undefined) out[k] = (v.arrayValue.values || []).map(i => i.stringValue || i.integerValue || i.booleanValue || '');
      else out[k] = '';
    }
    return out;
  });
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const email = event.queryStringParameters && event.queryStringParameters.email;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email e token obrigatorios' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const users = await queryByField(projectId, apiKey, 'cadastros', 'email', email, 1);
    if (!users.length) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };
    const user = users[0];

    // Validate session token (from login.js)
    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida. Faca login novamente.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada. Faca login novamente.' }) };
    }

    let artigos = [];
    try {
      artigos = await queryByField(projectId, apiKey, 'artigos_enviados', 'email', email, 200);
      artigos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
      artigos = artigos.slice(0, 50);
    } catch(e) { console.warn('Could not fetch artigos:', e.message); }

    let amigos = [];
    try {
      const specs = Array.isArray(user.especialidade) ? user.especialidade.filter(Boolean) : (user.especialidade ? [user.especialidade] : []);
      if (specs.length) {
        const whereClause = specs.length === 1
          ? { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'ARRAY_CONTAINS', value: { stringValue: specs[0] } } }
          : { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'ARRAY_CONTAINS_ANY', value: { arrayValue: { values: specs.map(s => ({ stringValue: s })) } } } };
        const body = JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'cadastros' }],
            where: whereClause,
            limit: 50
          }
        });
        const buf = Buffer.from(body, 'utf8');
        const res = await request({
          hostname: 'firestore.googleapis.com',
          path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
        }, buf);
        if (res.status === 200) {
          const docs = JSON.parse(res.body);
          amigos = docs
            .filter(d => d.document)
            .map(d => {
              const f = d.document.fields || {};
              return {
                nome: f.nome?.stringValue || '',
                especialidade: f.especialidade?.arrayValue?.values
                  ? f.especialidade.arrayValue.values.map(v => v.stringValue || '').filter(Boolean)
                  : f.especialidade?.stringValue || '',
                _selfEmail: f.email?.stringValue || ''
              };
            })
            .filter(u => u._selfEmail && u._selfEmail !== email)
            .map(({ _selfEmail: _, ...rest }) => rest)
            .slice(0, 20);
        }
      }
    } catch(e) { console.warn('Could not fetch amigos:', e.message); }

    const temas = user.temas ? (typeof user.temas === 'string' ? user.temas.split(',') : user.temas) : [];
    const especialidade = user.especialidade ? (typeof user.especialidade === 'string' ? user.especialidade.split(',') : user.especialidade) : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        nome: user.nome || '',
        email: user.email || '',
        especialidade,
        temas,
        criadoEm: user.criadoEm || '',
        artigos,
        curtidos: user.curtidos || [],
        lidos: user.lidos || [],
        amigos
      })
    };
  } catch(err) {
    console.error('Get user data error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
