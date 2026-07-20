// Feedback do dentista sobre um artigo: "interessante" (util) ou "pouco
// relevante" (nao_util). Alimenta a curadoria via _lib/feedback-signal —
// agregado por padrões (tema/nível) com suavização; NUNCA exclui categorias.
//
// Dois modos:
//   GET  (1 clique no e-mail): ?p=<pmid>&e=<ehash16>&v=up|down[&d=<digestId>]
//        → grava e redireciona para a ÁREA DE MEMBRO (/dashboard.html?fb=ok).
//   POST (site, sessão):       { email, token, pmid, voto: 'util'|'nao_util' }
//
// Idempotente por dentista+artigo: doc artigo_feedback/{ehash}_{pmid} — votar
// de novo sobrescreve (o dentista pode mudar de ideia). Os atributos do padrão
// (especialidade/tema/nível) são congelados no doc no momento do voto, para a
// agregação não depender de joins.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const log = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';
const EHASH_RE = /^[a-f0-9]{16}$/;

function emailHash16(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}
function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function gravarVoto(db, { ehash, pmid, voto, digestId }) {
  // Atributos do artigo congelados no doc (para agregação por padrão)
  const art = await db.getDoc('artigos', pmid).catch(() => null);
  await db.setDoc('artigo_feedback', `${ehash}_${pmid}`, {
    emailHash:       ehash,
    pmid:            String(pmid),
    voto,
    especialidade:   art?.especialidade || '',
    tema:            art?.tema || '',
    nivel_evidencia: art?.nivel_evidencia || '',
    digestId:        digestId || '',
    data:            new Date().toISOString(),
  });
  log.info('[feedback] voto registrado', { pmid, voto, especialidade: art?.especialidade || '(?)' });
}

exports.handler = async (event) => {
  const jsonHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const db = new Firestore(projectId, process.env.FIREBASE_API_KEY);

  try {
    // ── GET: 1 clique do e-mail → grava e cai na área de membro ─────────────
    if (event.httpMethod === 'GET') {
      const qs   = event.queryStringParameters || {};
      const pmid = String(qs.p || '').trim();
      const eh   = String(qs.e || '').toLowerCase().trim();
      const voto = qs.v === 'up' ? 'util' : qs.v === 'down' ? 'nao_util' : null;
      // Redireciona SEMPRE (mesmo voto inválido): o clique nunca vira erro na cara do dentista
      const dest = `${BASE_URL}/dashboard.html?fb=${voto ? 'ok' : 'err'}&utm_source=email&utm_medium=feedback`;
      if (pmid && voto && EHASH_RE.test(eh)) {
        await gravarVoto(db, { ehash: eh, pmid, voto, digestId: qs.d || '' })
          .catch(err => log.warn('[feedback] gravação falhou (GET)', { err: err.message }));
      }
      return { statusCode: 302, headers: { Location: dest, 'Cache-Control': 'no-store' }, body: '' };
    }

    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: { ...jsonHeaders, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    // ── POST: site com sessão ────────────────────────────────────────────────
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'json_invalido' }) }; }
    const { email, token, pmid } = body;
    const voto = body.voto === 'util' ? 'util' : body.voto === 'nao_util' ? 'nao_util' : null;
    if (!email || !token || !pmid || !voto) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'campos_obrigatorios' }) };
    }

    const users = await db.query('cadastros', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1,
    });
    const user = users[0];
    if (!user || !tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: 'sessao_invalida' }) };
    }

    await gravarVoto(db, { ehash: emailHash16(email), pmid: String(pmid), voto, digestId: body.digestId || '' });
    return { statusCode: 200, headers: { ...jsonHeaders, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({ ok: true, voto }) };
  } catch (err) {
    log.error('[feedback] erro', { err: err.message });
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
