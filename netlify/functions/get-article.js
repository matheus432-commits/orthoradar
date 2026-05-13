const crypto = require('crypto');
const { request, corsHeaders, preflight } = require('./_lib');

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
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || ''
  };
}

async function getArticle(projectId, apiKey, id) {
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/artigos_enviados/' + encodeURIComponent(id) + '?key=' + apiKey,
    method: 'GET'
  }, null);
  if (res.status !== 200) return null;
  const doc = JSON.parse(res.body);
  const f = doc.fields || {};
  return {
    id,
    email: f.email?.stringValue || '',
    titulo: f.titulo?.stringValue || '',
    resumo: f.resumo?.stringValue || '',
    especialidade: f.especialidade?.stringValue || '',
    tema: f.tema?.stringValue || '',
    pubmedUrl: f.pubmedUrl?.stringValue || '',
    pmid: f.pmid?.stringValue || '',
    data: f.data?.stringValue || ''
  };
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, id } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !id || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUser(projectId, apiKey, email);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Nao autorizado' }) };
    if (!tokenEqual(user.sessionToken, token)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
    if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada' }) };
    }

    const article = await getArticle(projectId, apiKey, id);
    if (!article) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Artigo nao encontrado' }) };

    // Ensure article belongs to the authenticated user
    if (article.email !== email) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acesso negado' }) };

    const { email: _e, ...safeArticle } = article;
    return { statusCode: 200, headers, body: JSON.stringify(safeArticle) };
  } catch (err) {
    console.error('[GetArticle] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
