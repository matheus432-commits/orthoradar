// GET /.netlify/functions/get-podcast?email=...  (Authorization: Bearer <token>)
//
// Gate Pro: valida a sessão E exige plano Pro. Só então devolve a URL do podcast
// do dia da especialidade do dentista. O áudio é servido DIRETO do Firebase
// Storage (não passa pelo Netlify → não consome banda da plataforma).

const { request } = require('./_lib');
const crypto = require('crypto');
const { isPro } = require('./_lib/plans');
const { specialtySlug } = require('./_lib/slug');
const { firebaseDownloadUrl } = require('./_lib/storage');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUser(projectId, apiKey, email) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'cadastros' }],
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1,
    },
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);
  if (res.status !== 200) return null;
  const docs = JSON.parse(res.body);
  const f = docs[0]?.document?.fields;
  if (!f) return null;
  const especialidade = f.especialidade?.arrayValue?.values
    ? f.especialidade.arrayValue.values.map(v => v.stringValue).filter(Boolean)
    : (f.especialidade?.stringValue ? [f.especialidade.stringValue] : []);
  return {
    plano:         f.plano?.stringValue || 'basico',
    ativo:         f.ativo?.booleanValue,
    sessionToken:  f.sessionToken?.stringValue || null,
    sessionExpiry: f.sessionExpiry?.stringValue || null,
    especialidade,
  };
}

async function getPodcastDoc(projectId, apiKey, slug) {
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/podcasts/' + slug + '?key=' + apiKey,
    method: 'GET',
  });
  if (res.status !== 200) return null;
  const f = JSON.parse(res.body).fields || {};
  return {
    objectPath:    f.objectPath?.stringValue || '',
    downloadToken: f.downloadToken?.stringValue || '',
    titulo:        f.titulo?.stringValue || '',
    especialidade: f.especialidade?.stringValue || '',
    geradoEm:      f.geradoEm?.stringValue || '',
  };
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
  const apiKey    = process.env.FIREBASE_API_KEY;
  const bucket    = process.env.GCS_BUCKET || (projectId + '.appspot.com');

  try {
    const user = await getUser(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };

    // ── Sessão ──────────────────────────────────────────────────────────────
    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida. Faca login novamente.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada. Faca login novamente.' }) };
    }

    // ── GATE PRO (plano Pro E conta ativa) ──────────────────────────────────
    if (!isPro(user) || user.ativo === false) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'pro_required', message: 'O podcast diário é exclusivo do plano Pro.' }) };
    }

    const esp = user.especialidade[0];
    if (!esp) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Nenhuma especialidade configurada.' }) };

    const doc = await getPodcastDoc(projectId, apiKey, specialtySlug(esp));
    if (!doc || !doc.objectPath || !doc.downloadToken) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'sem_podcast', message: 'O podcast de hoje ainda não está disponível.' }) };
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        url:           firebaseDownloadUrl(bucket, doc.objectPath, doc.downloadToken),
        titulo:        doc.titulo,
        especialidade: doc.especialidade || esp,
        geradoEm:      doc.geradoEm,
      }),
    };
  } catch (err) {
    console.error('get-podcast error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno. Tente novamente.' }) };
  }
};
