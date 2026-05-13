const { request, corsHeaders, preflight } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getSessionUser(projectId, apiKey, email, token) {
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
  const user = { sessionToken: f.sessionToken?.stringValue || '', sessionExpiry: f.sessionExpiry?.stringValue || '' };
  if (!tokenEqual(user.sessionToken, token)) return null;
  if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) return null;
  return user;
}

async function getArticle(projectId, apiKey, articleId, email) {
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/artigos_enviados/' + articleId + '?key=' + apiKey,
    method: 'GET'
  }, null);
  if (res.status !== 200) return null;
  const doc = JSON.parse(res.body);
  const f = doc.fields || {};
  // Only return article if it belongs to this user
  if (f.email?.stringValue !== email) return null;
  return {
    id: doc.name.split('/').pop(),
    titulo: f.titulo?.stringValue || '',
    resumo: f.resumo?.stringValue || '',
    pubmedUrl: f.pubmedUrl?.stringValue || '',
    especialidade: f.especialidade?.stringValue || '',
    tema: f.tema?.stringValue || '',
    pmid: f.pmid?.stringValue || '',
    data: f.data?.stringValue || ''
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const { id, email } = event.queryStringParameters || {};
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!id || !email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parametros obrigatorios: id, email + Authorization header' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getSessionUser(projectId, apiKey, email, token);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };

    const article = await getArticle(projectId, apiKey, id, email);
    if (!article) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Artigo nao encontrado' }) };

    return { statusCode: 200, headers, body: JSON.stringify(article) };
  } catch (err) {
    console.error('[GetArticle] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
