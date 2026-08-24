// ACERVO do dentista — /biblioteca no site (deploy 07/08).
//
// Tudo que a plataforma já produziu DESDE O INÍCIO (diretriz 22/07: nada é
// apagado): artigos resumidos COM podcast + todos os episódios de áudio.
// Regra do fundador (07/08): entram na biblioteca os artigos que têm podcast
// — os diários novos sobem automaticamente porque o catálogo deriva das
// coleções de episódios (quente + arquivo permanente + salvos).
//
// GET ?email=...&action=catalogo   (Authorization: Bearer <sessionToken>)
//   → { artigos:[{pmid,titulo,especialidade,data,nivel,journal,year,tema,
//        resumo,audioUrl,secs,lido}], episodios:[...], especialidades, temas }
// GET ?email=...&action=artigo&id=PMID
//   → detalhe: resumo completo + relevância clínica + link PubMed + áudio.
//     Registra 'context_opened' no tracking existente (alimenta o "já lido").
//
// Auth: sessão do site (mesma do get-user-data) — qualquer conta ativa
// (o podcast/acervo é benefício de TODOS os planos).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { audioUrlDe } = require('./_lib/storage');
const { resolveArticleUrl } = require('./_lib/email-template');
const { logEvent } = require('./_lib/engagement');
const { mapearLista, ehIdValido, labelDe } = require('./_lib/taxonomia');
const { isPremium } = require('./_lib/plans');
const log = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';
const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUser(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  return docs[0] || null;
}

// Mapa pmid → { url, secs, date, especialidade } com TODOS os áudios já
// produzidos (mesma cobertura do get-arquivo: arquivo permanente + coleção
// quente + preservados). URL SEMPRE a persistida (incidente 05/08).
async function mapaDeAudios(db, bucket) {
  const map = new Map();
  for (const coll of ['podcast_arquivo', 'podcast_episodios']) {
    const eps = await db.query(coll, {
      select: sel('artigoId', 'objectPath', 'downloadToken', 'url', 'secs', 'date', 'especialidade', 'tipo', 'titulo'),
      limit: 5000,
    }).catch(() => []);
    for (const e of eps) {
      if (e.tipo === 'completo') continue;
      const k = String(e.artigoId || '');
      const url = audioUrlDe(e, bucket);
      if (k && url) map.set(k, { url, secs: Number(e.secs) || 0, date: e.date || '', especialidade: e.especialidade || '', titulo: e.titulo || '' });
    }
  }
  const salvos = await db.query('podcast_salvos', {
    select: sel('objectPath', 'downloadToken', 'url', 'secs'), limit: 5000,
  }).catch(() => []);
  for (const s of salvos) {
    const url = audioUrlDe(s, bucket);
    if (s.id && url && !map.has(String(s.id))) {
      map.set(String(s.id), { url, secs: Number(s.secs) || 0, date: '', especialidade: '', titulo: '' });
    }
  }
  return map;
}

// PMIDs que este dentista já abriu — tracking de cliques existente
// (digest_metrics: click no e-mail, context_opened no site).
async function pmidsLidos(db, email) {
  try {
    const evs = await db.query('digest_metrics', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: sel('eventType', 'pmid'),
      limit: 5000,
    });
    const lidos = new Set();
    for (const ev of evs) {
      if ((ev.eventType === 'click' || ev.eventType === 'context_opened') && ev.pmid) lidos.add(String(ev.pmid));
    }
    return lidos;
  } catch (err) {
    log.warn('[acervo] leitura de eventos falhou — sem marcação de lidos', { err: err.message });
    return new Set();
  }
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const _rl = rateLimited(event, 'acervo', { max: 120, windowMs: 60000 }); if (_rl) return _rl;

  const qs = event.queryStringParameters || {};
  const email = String(qs.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');

  try {
    const user = await getUser(db, email);
    if (!user || !tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada' }) };
    }
    if (user.ativo === false) return { statusCode: 403, headers, body: JSON.stringify({ error: 'conta_inativa' }) };
    // DIRETRIZ DO FUNDADOR (07/08): a Biblioteca é EXCLUSIVA do plano Premium
    // (hoje todos estão na cortesia Premium, então ninguém perde acesso agora;
    // após o downgrade seletivo, vira benefício pago).
    if (!isPremium(user)) {
      return { statusCode: 403, headers, body: JSON.stringify({
        error: 'premium_required',
        message: 'A Biblioteca completa de artigos e podcasts é exclusiva do plano Premium.',
      }) };
    }

    const action = String(qs.action || 'catalogo');

    // ── Detalhe de um artigo (resumo completo + relevância + PubMed) ────────
    if (action === 'artigo') {
      const id = String(qs.id || '').trim();
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id obrigatorio' }) };
      const a = await db.getDoc('artigos', id).catch(() => null);
      if (!a) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
      // Alimenta o tracking existente — a marcação "lido" do acervo e os
      // números do painel usam a MESMA fonte (digest_metrics).
      logEvent(projectId, apiKey, { eventType: 'context_opened', email, pmid: id, digestId: null }).catch(() => {});
      return {
        statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' },
        body: JSON.stringify({
          pmid: id,
          titulo:          a.titulo_pt || a.titulo || '',
          resumo:          a.resumo_pt || '',
          resumo_completo: a.resumo_completo || '',
          impacto:         a.impacto_pratico || '',
          nivel:           a.nivel_evidencia || '',
          especialidade:   a.especialidade || '',
          journal:         a.journal || '', year: a.year || '', data: a.data || '',
          tema:            a.tema || '',
          url:             resolveArticleUrl(a, BASE_URL),
        }),
      };
    }

    // ── Catálogo completo (leve) ────────────────────────────────────────────
    const [audios, lidos] = await Promise.all([mapaDeAudios(db, bucket), pmidsLidos(db, email)]);
    const arts = await db.query('artigos', {
      select: sel('pmid', 'titulo_pt', 'especialidade', 'data', 'nivel_evidencia', 'journal', 'year', 'tema', 'temas', 'resumo_pt', 'status'),
      limit: 5000,
    }).catch(() => []);

    const artigos = [];
    for (const a of arts) {
      const pmid = String(a.pmid || a.id || '');
      const au = audios.get(pmid);
      // Regra do fundador (07/08): a biblioteca lista os artigos COM podcast;
      // artigo cru (sem título PT) nunca vira card ("Sem título", 30/07).
      if (!au || a.status !== 'active') continue;
      if (String(a.titulo_pt || '').trim().length < 10) continue;
      artigos.push({
        pmid,
        titulo:        a.titulo_pt,
        especialidade: a.especialidade || au.especialidade || '',
        // Só a DATA (alguns docs guardam timestamp ISO completo — o badge
        // exibia "07T05:09:11.433Z/08/2026", incidente 08/08).
        data:          String(a.data || au.date || '').slice(0, 10),
        nivel:         a.nivel_evidencia || '',
        journal:       a.journal || '', year: a.year || '',
        tema:          a.tema || '',
        // TEMAS CANÔNICOS (Fase 5 da spec 24/08): ids do artigo já migrado,
        // ou o legado `tema` mapeado por sinônimo NA HORA — o filtro novo
        // funciona antes mesmo de a migração retroativa rodar.
        temas:         (Array.isArray(a.temas) && a.temas.length)
                         ? a.temas.filter(id => ehIdValido(id, a.especialidade || au.especialidade || ''))
                         : mapearLista(a.tema, a.especialidade || au.especialidade || ''),
        resumo:        String(a.resumo_pt || '').slice(0, 400), // busca + prévia do card
        audioUrl:      au.url, secs: au.secs,
        lido:          lidos.has(pmid),
      });
    }
    artigos.sort((x, y) => String(y.data).localeCompare(String(x.data)));

    // Seção de PODCASTS: todos os episódios individuais, mais recentes antes.
    const episodios = [...audios.entries()]
      .filter(([, e]) => e.date) // salvos sem data ficam só nos cards de artigo
      .map(([pmid, e]) => ({ pmid, titulo: e.titulo, especialidade: e.especialidade, date: e.date, url: e.url, secs: e.secs }))
      .sort((x, y) => String(y.date).localeCompare(String(x.date)));

    return {
      statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        total: artigos.length,
        artigos,
        episodios,
        especialidades: [...new Set(artigos.map(a => a.especialidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        temas:          [...new Set(artigos.map(a => a.tema).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        // id → label para os chips de tema (só os ids presentes no acervo).
        temasCatalogo:  Object.fromEntries([...new Set(artigos.flatMap(a => a.temas))].map(id => [id, labelDe(id)])),
      }),
    };
  } catch (err) {
    log.error('[acervo] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
