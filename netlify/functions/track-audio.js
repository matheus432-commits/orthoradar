// MÉTRICA DE ÁUDIO NO SITE (pedido do fundador 15/08: "quantos audios abriram").
//
// POST { email, pmid } (Authorization: Bearer <sessionToken>)
//   → registra 'audio_play' em digest_metrics — MESMA fonte dos demais eventos,
//     então o painel /admin-uso.html agrega sem coleção nova.
//
// Chamado pelo cliente no PRIMEIRO 'playing' de cada faixa (dashboard,
// biblioteca e edição), com dedupe por elemento/faixa no navegador —
// aqui é fire-and-forget: melhor perder um evento do que travar o player.
//
// Auth: sessão do site (mesmo padrão do acervo). PRIVACIDADE: email/pmid
// nunca vão para log algum — o dado só sai pelo get-uso (ADMIN_SECRET).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { logEvent } = require('./_lib/engagement');
const log = require('./_lib/logger');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  // Um dentista ouvindo o dia inteiro não passa de dezenas de plays/h — 60/min
  // segura abuso sem nunca atrapalhar uso real.
  const _rl = rateLimited(event, 'track-audio', { max: 60, windowMs: 60000 }); if (_rl) return _rl;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue vazio */ }
  const email = String(body.email || '').trim().toLowerCase();
  const pmid = String(body.pmid || '').trim().slice(0, 40) || null;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const docs = await db.query('cadastros', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1,
    });
    const user = docs[0] || null;
    if (!user || !tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada' }) };
    }

    await logEvent(projectId, apiKey, { eventType: 'audio_play', email, pmid, digestId: null });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    log.error('[track-audio] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
