// OdontoFeed Smart Digest — daily email dispatch with per-specialty shared content.
//
// Run: node netlify/functions/daily-digest.js
// Schedule: GitHub Actions daily-pipeline.yml at 10:00 UTC
//
// Content model:
//   O digest é montado UMA VEZ por especialidade (curadoria + Achado da Semana +
//   editorial via Claude) e cacheado em `digests_especialidade/<esp>_<data>`.
//   Todos os inscritos da especialidade recebem o MESMO conteúdo — só variam a
//   saudação, o link de descadastro e o pixel de tracking (por usuário).
//   Custo de IA e de leituras deixa de crescer com o nº de usuários: cresce com
//   o nº de especialidades (~10).
//
// Reliability architecture:
//   - Execution lock (digest_lock)     → prevents concurrent duplicate runs
//   - Per-specialty digest cache       → crash/re-run nunca refaz chamadas de IA
//   - Per-user idempotency (digest_logs) → prevents double-send on crash/recovery
//   - Concurrent batch processing      → throughput with controlled parallelism
//   - Per-user timeout (90s)           → a hanging user never stalls the full run
//   - Resend retry on 429              → handles rate limits transparently
//   - Run audit record (digest_runs)   → full observability of every execution

const crypto   = require('crypto');
const { Firestore }                                = require('./_lib/firestore');
const { buildDigestEmail, emailHash }              = require('./_lib/email-template');
const { generateEditorial }                        = require('./_lib/editorial-generator');
const { recommendArticles }                        = require('./_lib/recommendation-engine');
const { runValidation }                            = require('./_lib/digest-validator');
const { pubmedFallbackArticles }                   = require('./_lib/pubmed');
const { acquireLock, releaseLock }                 = require('./_lib/pipeline-lock');
const { withTimeout }                              = require('./_lib/retry-utils');
// (Achado da Semana cancelado em 19/07/2026 — módulo não é mais usado.)
const { generateResumoCompleto, isResumoEstruturado } = require('./_lib/claude');
const { aggregateStats, feedbackMultiplier, personalTemaAffinity } = require('./_lib/feedback-signal');
const { isUnfinishedStudy }                         = require('./_lib/scoring');
const { espDigestSlug }                            = require('./_lib/slug');
const { buildEdicaoUrl }                           = require('./_lib/edicao-token');
const { isPremium }                                = require('./_lib/plans');
const { getActiveAd }                              = require('./_lib/ads');
const log                                          = require('./_lib/logger');
const { request }                                  = require('./_lib');

const BASE_URL        = process.env.SITE_URL || 'https://odontofeed.com';
const MIN_ARTICLES    = 3;
const MAX_ARTICLES    = 3;   // Padrão fixo: 3 artigos regulares por dia (o Achado da Semana entra à parte, podendo elevar o total)
// Anti-repetição efetivamente permanente: um artigo já enviado a uma especialidade
// nunca volta. Com o acervo ampliado (busca de 15 anos), há candidatos novos de
// sobra, então não há motivo para "esquecer" o que já foi enviado.
const LOOKBACK_DAYS   = 15 * 365;
const CANDIDATE_LIMIT = 120;

// Reliability constants
const BATCH_SIZE      = 5;     // users processed concurrently per batch
const BATCH_PAUSE_MS  = 500;   // pause between batches (ms)
const USER_TIMEOUT_MS = 90000; // max time per user before hard abort (ms)
const RESEND_RETRIES  = 3;     // max attempts for Resend 429 rate limit

// ── Date helpers ──────────────────────────────────────────────────────────────

function getDateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

// Stable document ID for a user's log entry on a given day.
// Used for both idempotency (skip if already sent) and crash recovery.
function getUserLogKey(email, dateStr) {
  const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 16);
  return `${hash}_${dateStr}`;
}

// Stable document ID for a specialty's shared digest on a given day.
// Slug centralizado em _lib/slug.js — o get-edicao lê pela mesma chave.
function getEspDigestKey(esp, dateStr) {
  return `${espDigestSlug(esp)}_${dateStr}`;
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function getActiveUsers(db) {
  let users = [];
  let pageToken = null;

  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users = users.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);

  const mapped = users.filter(u => {
    if (!u.email) return false;
    if (u.ativo === false) return false;
    if (u.emailFrequencia === 'nunca') return false;
    if (u.bounced) return false;
    return true;
  }).map(u => {
    const especialidades = Array.isArray(u.especialidade)
      ? u.especialidade.filter(Boolean)
      : u.especialidade
        ? [u.especialidade]
        : [];
    return { ...u, especialidades, especialidade: especialidades[0] || '' };
  });

  const noSpecialty = mapped.filter(u => u.especialidades.length === 0);
  if (noSpecialty.length) {
    log.warn('[digest] users skipped — no specialty set', {
      count:  noSpecialty.length,
      emails: noSpecialty.map(u => u.email),
    });
  }
  return mapped.filter(u => u.especialidades.length > 0);
}

// ── Identidade de artigo para anti-repetição ─────────────────────────────────
// Um mesmo estudo pode entrar na base por fontes diferentes (PubMed, Europe
// PMC, OpenAlex) com ids distintos — comparar só o pmid deixa repetido passar.
// Cada artigo é comparado por TRÊS chaves: pmid/id, DOI e título normalizado.
function normDoi(doi) {
  const d = String(doi || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  return d ? 'doi:' + d : null;
}
function normTitle(t) {
  const s = String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return s.length >= 20 ? 'tt:' + s : null; // títulos muito curtos dariam falso positivo
}
function articleKeys(a) {
  const pmid = String(a.pmid || a.id || '');
  return [pmid || null, normDoi(a.doi), normTitle(a.titulo), normTitle(a.titulo_pt)].filter(Boolean);
}
function isRepeated(a, hist) { return articleKeys(a).some(k => hist.has(k)); }

// Especialidades renomeadas: o histórico antigo foi gravado com o nome da época
// e precisa continuar contando para a anti-repetição.
const LEGACY_ESP_ALIASES = {
  'Bucomaxilofacial':    ['Cirurgia'],
  'DTM e Dor Orofacial': ['DTM'],
};

// Anti-repeat por especialidade: chaves (pmid + doi + título) de tudo que já
// saiu nos digests compartilhados E no log por-usuário da era anterior.
// FAIL-CLOSED: se o histórico não puder ser lido, LANÇA — quem chama pula a
// especialidade hoje. Um dia sem e-mail é melhor que conteúdo repetido.
async function getEspHistory(db, especialidade) {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  const nomes = [especialidade, ...(LEGACY_ESP_ALIASES[especialidade] || [])];
  const hist = new Set();

  const queryWithRetry = async (collection, esp) => {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await db.query(collection, {
          where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: esp } } },
          limit: 2000,
        });
      } catch (err) {
        lastErr = err;
        log.warn('[digest] history query failed, retrying', { collection, esp, attempt, err: err.message });
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
    throw lastErr;
  };

  for (const nome of nomes) {
    // 1. Digests compartilhados (era atual) — pmids + doi/título dos artigos cacheados
    const docs = await queryWithRetry('digests_especialidade', nome);
    for (const d of docs) {
      if (d.date && d.date < cutoff) continue;
      for (const p of d.pmids || []) if (p) hist.add(String(p));
      for (const a of d.artigos || []) for (const k of articleKeys(a)) hist.add(k);
      if (d.achadoSemana) for (const k of articleKeys(d.achadoSemana)) hist.add(k);
    }
    // 2. Log por-usuário da era anterior (artigos_enviados) — só pmid disponível.
    //    Best-effort: se falhar, seguimos só com o histórico principal (acima).
    try {
      const sent = await db.query('artigos_enviados', {
        where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: nome } } },
        limit: 2000,
      });
      for (const s of sent) if (s.pmid) hist.add(String(s.pmid));
    } catch (err) {
      log.warn('[digest] artigos_enviados history read failed (continuing with main history)', { esp: nome, err: err.message });
    }
  }
  return hist;
}

async function getCandidates(db, specialties) {
  const whereClause = specialties.length === 1
    ? {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: specialties[0] } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
          ],
        },
      }
    : {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'IN', value: { arrayValue: { values: specialties.slice(0, 30).map(s => ({ stringValue: s })) } } } },
            { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
          ],
        },
      };

  try {
    const docs = await db.query('artigos', {
      where:   whereClause,
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit:   CANDIDATE_LIMIT,
    });
    return docs;
  } catch (err) {
    log.debug('[digest] ordered query failed, retrying without orderBy', { err: err.message });
  }

  try {
    const docs = await db.query('artigos', { where: whereClause, limit: CANDIDATE_LIMIT });
    return docs.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
  } catch (err) {
    log.warn('[digest] getCandidates failed', { err: err.message });
    return [];
  }
}

async function getTrendingArticles(db, limit = 20) {
  try {
    const docs = await db.query('artigos', {
      where:   { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit,
    });
    return docs.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  } catch (err) {
    log.warn('[digest] getTrendingArticles failed', { err: err.message });
    return [];
  }
}

// ── Email sending ─────────────────────────────────────────────────────────────

async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({
    from:    'OdontoFeed <artigos@odontofeed.com>',
    to,
    subject,
    html,
    headers: {
      'List-Unsubscribe': `<${BASE_URL}/.netlify/functions/unsubscribe?email=${encodeURIComponent(to)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID': to,
    },
  });
  return request({
    hostname: 'api.resend.com',
    path:     '/emails',
    method:   'POST',
    headers:  {
      Authorization:    'Bearer ' + resendKey,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
}

// Wraps sendEmail with retry on HTTP 429 (Resend rate limit).
// Does NOT retry on other HTTP errors (400, 422, 500) to avoid duplicate sends.
async function sendEmailWithRetry(resendKey, to, subject, html) {
  for (let attempt = 0; attempt < RESEND_RETRIES; attempt++) {
    const res = await sendEmail(resendKey, to, subject, html);
    if (res.status === 200 || res.status === 201) return res;

    if (res.status === 429 && attempt < RESEND_RETRIES - 1) {
      const delay = 8000 * Math.pow(2, attempt); // 8s, 16s
      log.warn('[digest] Resend rate limited, retrying', { to, attempt: attempt + 1, delay_ms: delay });
      console.log(`[RETRY ${attempt + 1}] Resend 429 — waiting ${delay}ms before retry`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    return res; // non-429 errors or exhausted retries
  }
  return sendEmail(resendKey, to, subject, html);
}

// ── Persist digest metadata ───────────────────────────────────────────────────

async function saveDigest(db, digestId, data) {
  await db.setDoc('digests', digestId, {
    email:           data.email,
    especialidade:   data.especialidade,
    pmids:           data.pmids,
    assunto:         data.subject,
    enviadoEm:       new Date().toISOString(),
    resendMessageId: data.resendMessageId || null,
    aberturas:       0,
    cliques:         0,
    status:          'sent',
  });
}

async function saveSentLog(db, email, articles, especialidade) {
  const now = new Date().toISOString();
  for (const art of articles) {
    await db.addDoc('artigos_enviados', {
      email,
      pmid:          art.pmid || art.id || '',
      especialidade: especialidade || '',
      data:          now,
      canal:         'email',
    }).catch(e => log.warn('[digest] saveSentLog failed for article', { email, err: e.message }));
  }
}

// ── Per-specialty shared digest ───────────────────────────────────────────────

function buildUnsubscribeToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET nao configurado');
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

// Remove campos internos de scoring antes de persistir os artigos no cache.
function stripInternal(article) {
  const { _ps, ...rest } = article;
  return rest;
}

// Monta (ou recarrega do cache) o digest compartilhado de uma especialidade
// para o dia: curadoria + Achado da Semana + editorial via Claude, UMA vez.
// Retorna { articles, achadoSemana, editorial } ou null se não há conteúdo
// suficiente (todos os usuários da especialidade são pulados nesse caso).
async function buildEspDigest(db, especialidade, anthropicKey, dateStr) {
  const key = getEspDigestKey(especialidade, dateStr);

  // ── CACHE: reuso em re-execução/crash recovery — nunca refaz chamadas de IA ─
  let cached;
  try {
    cached = await db.getDoc('digests_especialidade', key);
  } catch (err) {
    log.warn('[digest] esp digest cache check failed, rebuilding', { especialidade, err: err.message });
  }
  if (cached?.status === 'ready' && Array.isArray(cached.artigos) && cached.artigos.length >= MIN_ARTICLES) {
    log.info('[digest][ESP] reusing cached digest', { especialidade, key, articles: cached.artigos.length });
    return {
      articles:     cached.artigos,
      achadoSemana: null, // função cancelada — mesmo docs antigos com achado não o exibem mais
      editorial:    cached.editorial || null,
    };
  }

  log.info('[digest][ESP] building shared digest', { especialidade, key });

  // 1. Anti-repeat: chaves (pmid+doi+título) de tudo já enviado à especialidade.
  //    FAIL-CLOSED: sem histórico legível, não montamos digest hoje — enviar às
  //    cegas é o que gera e-mail repetido.
  let t = Date.now();
  let hist;
  try {
    hist = await getEspHistory(db, especialidade);
  } catch (err) {
    log.error('[digest][ESP] BLOCKED — anti-repeat history unreadable, skipping specialty today', {
      especialidade, err: err.message,
    });
    return null;
  }
  log.info('[digest][ESP][STAGE antirepeat]', { especialidade, histKeys: hist.size, ms: Date.now() - t });

  // 2. Candidate articles from shared collection
  t = Date.now();
  let candidates = await getCandidates(db, [especialidade]);
  candidates = candidates.filter(a => !isRepeated(a, hist));
  // Rede de segurança para o acervo já existente: protocolos/estudos em
  // andamento que porventura tenham ficado 'active' antes do gate de ingestão
  // são barrados aqui também — o OdontoFeed só envia estudos com resultados.
  candidates = candidates.filter(a => {
    if (isUnfinishedStudy(a.titulo || a.title || a.titulo_pt || '', a.abstract || '', a.journal || '')) {
      log.info('[digest][ESP] estudo não concluído descartado', { especialidade, id: a.pmid || a.id, titulo: (a.titulo || a.titulo_pt || '').slice(0, 70) });
      return false;
    }
    return true;
  });
  // Dedup interno: o mesmo estudo pode aparecer 2x na base (fontes diferentes).
  const seenKeys = new Set();
  candidates = candidates.filter(a => {
    const ks = articleKeys(a);
    if (ks.some(k => seenKeys.has(k))) return false;
    ks.forEach(k => seenKeys.add(k));
    return true;
  });
  log.info('[digest][ESP][STAGE candidates]', { especialidade, count: candidates.length, ms: Date.now() - t });

  // 3. Trending Firestore fallback — SÓ artigos da MESMA especialidade.
  // Sem este filtro, um digest escasso completava com artigos de outras áreas
  // (ex.: odontopediatria dentro do digest de Prótese).
  if (candidates.length < MIN_ARTICLES) {
    log.info('[digest][ESP] insufficient candidates, trying trending', { especialidade, found: candidates.length });
    const trending = await getTrendingArticles(db, 30);
    const trendNew = trending.filter(a =>
      a.especialidade === especialidade &&
      !isRepeated(a, hist) &&
      !articleKeys(a).some(k => seenKeys.has(k)));
    trendNew.forEach(a => articleKeys(a).forEach(k => seenKeys.add(k)));
    candidates = [...candidates, ...trendNew];
  }

  // 4. PubMed direct fallback
  if (candidates.length < MIN_ARTICLES) {
    log.info('[digest][ESP] Firestore sparse, falling back to PubMed direct', { especialidade, found: candidates.length });
    try {
      const needed  = MAX_ARTICLES + 2;
      const fbArts  = await pubmedFallbackArticles({ especialidade, temas: [] }, hist, needed, anthropicKey);
      const newArts = fbArts.filter(a => !isRepeated(a, hist) && !articleKeys(a).some(k => seenKeys.has(k)));
      newArts.forEach(a => articleKeys(a).forEach(k => seenKeys.add(k)));
      candidates = [...candidates, ...newArts];
      log.info('[digest][ESP] PubMed fallback added', { especialidade, added: newArts.length, total: candidates.length });
    } catch (err) {
      log.warn('[digest][ESP] PubMed fallback failed', { especialidade, err: err.message });
    }
  }

  // ── GATE 1: minimum articles ────────────────────────────────────────────────
  if (candidates.length < MIN_ARTICLES) {
    log.warn('[digest][ESP] BLOCKED — insufficient articles after all fallbacks', {
      especialidade, found: candidates.length, minimum: MIN_ARTICLES,
    });
    return null;
  }

  // 4b. Sinal de feedback dos dentistas (👍/👎 por artigo): ajusta o ranking
  // por PADRÕES agregados (tema/nível, suavizados, janela 90d) — multiplicador
  // limitado a ±15%, NUNCA exclusão (ver _lib/feedback-signal.js). Best-effort.
  try {
    const fbDocs = await db.query('artigo_feedback', {
      where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } },
      limit: 1500,
    });
    const fbStats = aggregateStats(fbDocs);
    if (fbStats.total > 0) {
      let ajustados = 0;
      for (const art of candidates) {
        const mult = feedbackMultiplier(art, fbStats);
        if (mult !== 1) { art.relevanceScore = (art.relevanceScore || 50) * mult; ajustados++; }
      }
      log.info('[digest][ESP][STAGE feedback]', { especialidade, votos: fbStats.total, ajustados });
    }
  } catch (err) {
    log.warn('[digest][ESP] sinal de feedback indisponível — seguindo sem', { especialidade, err: err.message });
  }

  // 5. Curated selection (shared — sem perfil individual)
  t = Date.now();
  let selected = recommendArticles(candidates, null, {
    maxArticles: MAX_ARTICLES,
    minArticles: MIN_ARTICLES,
  });
  log.info('[digest][ESP][STAGE curation]', {
    especialidade, selected: selected.length, candidatesIn: candidates.length, ms: Date.now() - t,
  });

  // ── GATE 2: hard minimum after curation ─────────────────────────────────────
  if (selected.length < MIN_ARTICLES) {
    log.warn('[digest][ESP] BLOCKED — curation returned fewer than minimum', {
      especialidade, selected: selected.length, minimum: MIN_ARTICLES,
    });
    return null;
  }

  // ── GATE 3: specialty coherence ─────────────────────────────────────────────
  const artEspecialidades = selected.map(a => a.especialidade).filter(Boolean);
  const wrongEsp = artEspecialidades.filter(e => e !== especialidade);
  if (wrongEsp.length === selected.length && selected.length > 0) {
    log.warn('[digest][ESP] BLOCKED — all articles have wrong specialty', {
      especialidade, artEsp: [...new Set(wrongEsp)],
    });
    return null;
  }

  // 6. Achado da Semana — FUNÇÃO CANCELADA (decisão de produto 19/07/2026).
  // Não geramos, não enviamos e não exibimos mais o achado em lugar nenhum.
  const achadoSemana = null;

  // 7. Editorial via Claude — UMA chamada por especialidade (não por usuário);
  //    falls back to deterministic on failure.
  t = Date.now();
  const editorial = await generateEditorial(selected, especialidade, [])
    .catch(err => { log.warn('[digest][ESP] generateEditorial threw', { err: err.message }); return null; });
  log.info('[digest][ESP][STAGE editorial]', {
    especialidade, generated: !!editorial, chars: editorial?.length ?? 0, ms: Date.now() - t,
  });

  // 7b. Resumo completo de CADA artigo da edição (botão "Ler o resumo" no
  // site). Cacheado no artigo e salvo no doc do digest; best-effort: sem
  // resumo, o card mostra só o essencial. ORÇAMENTO PRÓPRIO de tempo: o
  // buildEspDigest inteiro tem 180s (USER_TIMEOUT_MS×2) — esta etapa nunca
  // pode consumi-lo e derrubar o envio da especialidade inteira; passou do
  // orçamento, os artigos restantes seguem sem resumo rico (amanhã completa).
  const RESUMO_STAGE_BUDGET_MS = 100000;
  t = Date.now();
  for (const art of selected) {
    if (Date.now() - t > RESUMO_STAGE_BUDGET_MS) {
      log.warn('[digest][ESP][STAGE resumos] orçamento de tempo esgotado — restantes sem resumo rico hoje', {
        especialidade, msDecorridos: Date.now() - t,
      });
      break;
    }
    await ensureResumoCompleto(db, art);
  }
  log.info('[digest][ESP][STAGE resumos]', {
    especialidade, comResumo: selected.filter(a => a.resumo_completo).length,
    total: selected.length, ms: Date.now() - t,
  });

  // 8. Persist shared digest (cache + anti-repeat history)
  const articles = selected.map(stripInternal);
  const pmids = [
    ...articles.map(a => a.pmid || a.id || ''),
    ...(achadoSemana ? [achadoSemana.pmid || achadoSemana.articleId || ''] : []),
  ].filter(Boolean);

  // FAIL-CLOSED: o histórico anti-repetição É este documento. Se não conseguirmos
  // gravá-lo, enviar mesmo assim garante repetição amanhã — então não enviamos.
  let persisted = false;
  for (let attempt = 1; attempt <= 3 && !persisted; attempt++) {
    try {
      await db.setDoc('digests_especialidade', key, {
        especialidade,
        date:         dateStr,
        pmids,
        artigos:      articles,
        achadoSemana: achadoSemana || null,
        editorial:    editorial || null,
        criadoEm:     new Date().toISOString(),
        status:       'ready',
      });
      persisted = true;
    } catch (e) {
      log.warn('[digest][ESP] history save failed', { especialidade, attempt, err: e.message });
      if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  if (!persisted) {
    log.error('[digest][ESP] BLOCKED — could not persist anti-repeat history, skipping specialty today', { especialidade });
    return null;
  }

  return { articles, achadoSemana, editorial };
}

// ── Per-user send pipeline ────────────────────────────────────────────────────

// Renders and sends the SHARED specialty digest to one user. Only the greeting,
// unsubscribe link and tracking ids are per-user; content is identical for
// everyone in the specialty. Does NOT handle idempotency or logging; those are
// in processUser() below.
async function _sendUserDigest(user, espDigest, db, resendKey) {
  const { email, nome, especialidade } = user;
  const processStart = Date.now();
  const { articles: selected, achadoSemana, editorial } = espDigest;

  // 1. Curadoria Premium: +2 artigos pelas preferências (assinantes; best-effort)
  let premiumExtras = [];
  if (isPremium(user)) {
    if (Array.isArray(espDigest.premiumPool) && espDigest.premiumPool.length) {
      try {
        premiumExtras = await pickPremiumExtras(db, user, espDigest.premiumPool);
        for (const extra of premiumExtras) await ensureResumoCompleto(db, extra);
        log.info('[digest][PREMIUM] extras selected', {
          email, count: premiumExtras.length,
          temas: premiumExtras.map(e => e._premiumTema || '(recente)'),
        });
        if (!premiumExtras.length) {
          log.warn('[digest][PREMIUM] assinante SEM extras (pool tinha candidatos)', {
            email, especialidade, poolLen: espDigest.premiumPool.length,
            causa: 'todos os candidatos do pool já foram enviados como extra a este assinante, ou histórico pessoal ilegível',
          });
        }
      } catch (err) {
        log.warn('[digest][PREMIUM] extras failed — base email proceeds', { email, err: err.message });
        premiumExtras = [];
      }
    } else {
      // Sem pool nenhum: o assinante paga por 5 e vai receber 3 — isso PRECISA
      // aparecer no log com a causa (incidente 19/07: aconteceu em silêncio).
      log.warn('[digest][PREMIUM] assinante SEM extras — pool vazio para a especialidade', { email, especialidade });
    }
  }

  // 2. Build email
  const digestId   = crypto.randomUUID();
  const unsubToken = buildUnsubscribeToken(email);

  let t = Date.now();
  const { html, subject } = buildDigestEmail(
    { nome, email, especialidade },
    selected,
    { digestId, baseUrl: BASE_URL, unsubscribeToken: unsubToken, editorial, achadoSemana,
      edicaoUrl: buildEdicaoUrl(BASE_URL, email),
      premiumExtras,
      // Publicidade contextual só para o plano Gratuito — Premium não vê anúncio
      anuncio: isPremium(user) ? null : (espDigest.anuncio || null) }
  );
  log.info('[digest][STAGE render]', { email, htmlBytes: html?.length ?? 0, ms: Date.now() - t });

  // ── PRE-SEND VALIDATION ─────────────────────────────────────────────────────
  const validationPassed = runValidation(
    { user, articles: selected, editorial, html },
    digestId
  );
  if (!validationPassed) {
    return 'blocked';
  }

  // 2. Send via Resend (with retry on 429)
  t = Date.now();
  const emailRes = await sendEmailWithRetry(resendKey, email, subject, html);
  if (emailRes.status !== 200 && emailRes.status !== 201) {
    log.error('[digest][STAGE send] FAILED', {
      email, status: emailRes.status, body: emailRes.body.slice(0, 400),
    });
    return 'error';
  }

  let resendMessageId = null;
  try {
    resendMessageId = JSON.parse(emailRes.body).id || null;
  } catch {
    log.warn('[digest] could not parse Resend response body', { email });
  }

  log.info('[digest][STAGE send] OK', {
    email, n: selected.length, digestId,
    subject: subject.slice(0, 80), msgId: resendMessageId, ms: Date.now() - t,
  });

  // 3. Persist digest + sent log
  t = Date.now();
  const [digestResult, sentLogResult] = await Promise.allSettled([
    saveDigest(db, digestId, {
      email, especialidade, subject,
      pmids: [
        ...selected.map(a => a.pmid || a.id || ''),
        ...(achadoSemana ? [achadoSemana.pmid || achadoSemana.articleId || ''] : []),
        ...premiumExtras.map(a => a.pmid || a.id || ''),
      ].filter(Boolean),
      resendMessageId,
    }),
    saveSentLog(db, email, achadoSemana ? [...selected, achadoSemana] : selected, especialidade),
    // Extras vão para o histórico PESSOAL (coleção própria) — nunca para o
    // histórico compartilhado da especialidade.
    savePremiumSentLog(db, email, premiumExtras, especialidade),
  ]);

  if (digestResult.status  === 'rejected') log.error('[digest][STAGE audit] saveDigest failed', { email, digestId, err: digestResult.reason?.message });
  if (sentLogResult.status === 'rejected') log.error('[digest][STAGE audit] saveSentLog failed', { email, digestId, err: sentLogResult.reason?.message });
  log.info('[digest][STAGE audit]', { email, digestId, ms: Date.now() - t });

  const totalMs = Date.now() - processStart;
  log.info('[digest] COMPLETE', { email, result: 'sent', digestId, totalMs });

  return 'sent';
}

// ── Curadoria Premium: +2 artigos pelas preferências do assinante ─────────────
// O assinante recebe os MESMOS 3 artigos (com áudio) do plano Gratuito, mais
// 2 extras escolhidos pelos TEMAS dele, com resumo aprofundado (Sonnet) e
// layout distinto no e-mail. O áudio continua por especialidade (invariante de
// custo) — a personalização Premium é em texto.
const PREMIUM_EXTRAS = 2;

// Pool por especialidade (calculado UMA vez por grupo): candidatos frescos que
// NÃO saíram no digest de hoje nem em nenhum anterior. Best-effort: sem pool,
// o e-mail base segue normal (extras são bônus, nunca bloqueiam o envio).
async function buildPremiumPool(db, especialidade) {
  try {
    const hist = await getEspHistory(db, especialidade); // inclui o digest de HOJE (já persistido)
    const brutos = await getCandidates(db, [especialidade]);
    let pool = brutos.filter(a => !isRepeated(a, hist));
    const aposHistorico = pool.length;
    const seen = new Set();
    pool = pool.filter(a => {
      const ks = articleKeys(a);
      if (ks.some(k => seen.has(k))) return false;
      ks.forEach(k => seen.add(k));
      return true;
    });
    // Diagnóstico SEMPRE logado — um pool vazio deixa assinantes sem os 2
    // extras e precisa ser visível no log do pipeline (incidente 19/07:
    // assinante Premium recebeu só 3 artigos sem nenhum rastro do motivo).
    log.info('[digest][PREMIUM] pool construído', {
      especialidade, candidatosBrutos: brutos.length, aposHistorico, poolFinal: pool.length,
    });
    if (!pool.length) {
      log.warn('[digest][PREMIUM] POOL VAZIO — assinantes desta especialidade ficarão sem extras hoje', {
        especialidade, candidatosBrutos: brutos.length,
        causa: brutos.length === 0 ? 'sem candidatos ativos' : 'todos os candidatos já enviados (histórico)',
      });
    }
    return pool.slice(0, 40);
  } catch (err) {
    log.warn('[digest][PREMIUM] pool build failed — extras skipped today', { especialidade, err: err.message });
    return [];
  }
}

function normTema(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Pontua um artigo contra os temas do assinante: match exato de tema pesa mais;
// sobreposição de termos do tema com título/resumo completa.
function scoreForTemas(article, temas) {
  const texto = normTema((article.titulo_pt || article.titulo || '') + ' ' + (article.resumo_pt || '') + ' ' + (article.tema || ''));
  let best = 0, bestTema = '';
  for (const tema of temas) {
    let s = 0;
    const nt = normTema(tema);
    if (article.tema && normTema(article.tema) === nt) s += 5;
    for (const w of nt.split(/[^a-z0-9]+/).filter(w => w.length > 3)) {
      if (texto.includes(w)) s += 1;
    }
    if (s > best) { best = s; bestTema = tema; }
  }
  return { score: best, tema: bestTema };
}

// Escolhe os extras do usuário: pelos temas quando há match; completa com os
// mais recentes do pool. Exclui o que ESTE assinante já recebeu como extra.
async function pickPremiumExtras(db, user, pool) {
  if (!pool.length) return [];

  let jaRecebidas = new Set();
  try {
    const sent = await db.query('artigos_enviados_premium', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: user.email } } },
      limit: 1000,
    });
    for (const s of sent) for (const k of s.keys || [s.pmid].filter(Boolean)) jaRecebidas.add(String(k));
  } catch (err) {
    // Fail-closed no que depende de histórico: sem ler o histórico pessoal,
    // não arriscamos repetir — o assinante fica sem extras só hoje.
    log.warn('[digest][PREMIUM] personal history unreadable — extras skipped', { email: user.email, err: err.message });
    return [];
  }

  const disponiveis = pool.filter(a => !articleKeys(a).some(k => jaRecebidas.has(k)));
  const temas = Array.isArray(user.temas) ? user.temas.filter(Boolean) : [];

  // Afinidade PESSOAL por tema dos votos 👍/👎 DESTE dentista (limitada a ±4.5
  // por tema — reordena a curadoria pessoal, nunca exclui). Best-effort.
  let afinidade = {};
  try {
    const meusVotos = await db.query('artigo_feedback', {
      where: { fieldFilter: { field: { fieldPath: 'emailHash' }, op: 'EQUAL', value: { stringValue: emailHash(user.email) } } },
      limit: 300,
    });
    afinidade = personalTemaAffinity(meusVotos);
  } catch { /* sem afinidade hoje */ }

  const ranked = disponiveis
    .map(a => {
      const m = scoreForTemas(a, temas);
      m.score += afinidade[String(a.tema || '').trim()] || 0;
      return { a, m };
    })
    .sort((x, y) => y.m.score - x.m.score || ((y.a.data || '') > (x.a.data || '') ? 1 : -1));

  const extras = [];
  for (const { a, m } of ranked) {
    if (extras.length >= PREMIUM_EXTRAS) break;
    extras.push({ ...a, _premiumTema: m.score > 0 ? m.tema : '' });
  }
  return extras;
}

// Resumo aprofundado (Sonnet + validador numérico) com cache no próprio artigo:
// gerado no máximo UMA vez por artigo, reutilizado por todos. Usado para os
// artigos da EDIÇÃO (botão "Ler o resumo" na /edicao.html) e para os extras
// Premium. Diretriz 19/07/2026 (v2): PROSA FLUIDA cobrindo objetivo, materiais
// e métodos, resultados e relevância clínica — sem títulos de seção. Resumos
// da janela curta em formato com títulos são regenerados uma única vez aqui
// (custo limitado a ~5 artigos/especialidade/dia); prosa existente permanece.
// Se a regeneração falhar, o texto antigo fica (melhor com títulos que nada).
async function ensureResumoCompleto(db, article) {
  if (article.resumo_completo && !isResumoEstruturado(article.resumo_completo)) return article;
  try {
    const texto = await generateResumoCompleto(article);
    if (texto) {
      article.resumo_completo = texto; // atualiza o objeto do pool (reuso no mesmo run)
      const docId = String(article.id || article.pmid || '');
      if (docId) {
        await db.updateDoc('artigos', docId, { resumo_completo: texto })
          .catch(e => log.warn('[digest] resumo_completo cache save failed', { id: docId, err: e.message }));
      }
    }
  } catch (err) {
    log.warn('[digest] generateResumoCompleto failed', { pmid: article.pmid, err: err.message });
  }
  return article; // sem resumo rico, o card usa o resumo_pt normal
}

// Registra os extras no histórico pessoal do assinante (coleção separada — o
// histórico COMPARTILHADO da especialidade não é poluído, senão um extra de um
// assinante sumiria do digest de todos).
async function savePremiumSentLog(db, email, extras, especialidade) {
  const now = new Date().toISOString();
  for (const art of extras) {
    await db.addDoc('artigos_enviados_premium', {
      email,
      pmid:          String(art.pmid || art.id || ''),
      keys:          articleKeys(art),
      especialidade: especialidade || '',
      data:          now,
    }).catch(e => log.warn('[digest][PREMIUM] savePremiumSentLog failed', { email, err: e.message }));
  }
}

// ── Reliability wrapper ───────────────────────────────────────────────────────

// Wraps _sendUserDigest with:
//   1. Idempotency check  — skip if already sent today (crash recovery)
//   2. Processing marker  — update digest_logs before and after
//   3. Per-user timeout   — 90s hard limit; hanging user never stalls the run
async function processUser(user, espDigest, db, resendKey, runId, dateStr) {
  const { email, especialidade } = user;
  const logKey = getUserLogKey(email, dateStr);

  // ── IDEMPOTENCY: skip if already successfully sent today ──────────────────
  let existingLog;
  try {
    existingLog = await db.getDoc('digest_logs', logKey);
  } catch (err) {
    log.warn('[digest] digest_logs check failed, proceeding', { email, err: err.message });
  }

  if (existingLog?.status === 'sent') {
    log.info('[digest] SKIP (idempotent) — already sent today', { email, logKey });
    console.log(`[SKIP IDEMPOTENT] ${email}`);
    return 'skipped';
  }

  // ── MARK PROCESSING ────────────────────────────────────────────────────────
  await db.setDoc('digest_logs', logKey, {
    email,
    date:       dateStr,
    runId,
    specialty:  especialidade || '',
    status:     'processing',
    startedAt:  new Date().toISOString(),
    retryCount: existingLog?.retryCount ? (existingLog.retryCount + 1) : 0,
    failReason: null,
    duration:   null,
  }).catch(e => log.warn('[digest] markProcessing failed', { email, err: e.message }));

  const t0 = Date.now();

  try {
    // ── PER-USER TIMEOUT ─────────────────────────────────────────────────────
    const result = await withTimeout(
      _sendUserDigest(user, espDigest, db, resendKey),
      USER_TIMEOUT_MS,
      email
    );

    const duration = Date.now() - t0;

    await db.updateDoc('digest_logs', logKey, {
      status:      result,
      completedAt: new Date().toISOString(),
      duration,
    }).catch(e => log.warn('[digest] finalizeLog failed', { email, err: e.message }));

    return result;
  } catch (err) {
    const duration = Date.now() - t0;
    await db.updateDoc('digest_logs', logKey, {
      status:      'error',
      completedAt: new Date().toISOString(),
      duration,
      failReason:  err.message.slice(0, 500),
    }).catch(() => {});
    throw err;
  }
}

// ── Run record helpers ────────────────────────────────────────────────────────

async function createRunRecord(db, runId, dateStr, totalUsers, totalEspecialidades) {
  await db.setDoc('digest_runs', runId, {
    runId, dateStr,
    startedAt:  new Date().toISOString(),
    completedAt: null,
    status:     'running',
    totalUsers,
    especialidades: totalEspecialidades,
    sent:       0,
    failed:     0,
    skipped:    0,
    elapsed_s:  null,
  }).catch(e => log.warn('[digest] createRunRecord failed', { err: e.message }));
}

async function finalizeRunRecord(db, runId, summary) {
  await db.updateDoc('digest_runs', runId, {
    status:      'completed',
    completedAt: new Date().toISOString(),
    ...summary,
  }).catch(e => log.warn('[digest] finalizeRunRecord failed', { err: e.message }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId   = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey      = process.env.FIREBASE_API_KEY;
  const resendKey   = process.env.RESEND_API_KEY;
  if (!apiKey)    { log.error('[digest] FIREBASE_API_KEY not set'); process.exit(1); }
  if (!resendKey) { log.error('[digest] RESEND_API_KEY not set');   process.exit(1); }
  if (!process.env.UNSUBSCRIBE_SECRET) { log.error('[digest] UNSUBSCRIBE_SECRET not set'); process.exit(1); }

  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!anthropicKey) log.warn('[digest] ANTHROPIC_API_KEY not set — editorial uses deterministic fallback');

  const db      = new Firestore(projectId, apiKey);
  const runId   = crypto.randomUUID();
  const dateStr = getDateStr();
  const start   = Date.now();

  console.log(`\n[START RUN] runId=${runId} date=${dateStr} ts=${new Date().toISOString()}`);
  log.info('[digest] starting daily dispatch', { runId, dateStr, claude: !!anthropicKey });

  // ── LOCK ACQUISITION ────────────────────────────────────────────────────────
  const locked = await acquireLock(db, runId);
  if (!locked) {
    log.error('[digest] run aborted — lock not acquired');
    console.log('[ABORT] Another run is already in progress. Exiting safely.\n');
    return { aborted: true, reason: 'lock_active' };
  }

  let sent = 0, errors = 0, skipped = 0;

  try {
    // ── LOAD USERS ─────────────────────────────────────────────────────────────
    let users;
    try {
      users = await getActiveUsers(db);
    } catch (err) {
      log.error('[digest] getActiveUsers failed — aborting', { runId, err: err.message });
      throw err;
    }

    console.log(`[USERS] ${users.length} active users found`);
    log.info('[digest] users found', { runId, count: users.length });

    // ── GROUP BY SPECIALTY ───────────────────────────────────────────────────
    // Cada usuário recebe o digest da sua especialidade principal (a primeira,
    // para cadastros antigos com mais de uma).
    const groups = new Map();
    for (const user of users) {
      const esp = user.especialidade;
      if (!groups.has(esp)) groups.set(esp, []);
      groups.get(esp).push(user);
    }

    console.log(`[GROUPS] ${groups.size} specialties: ${[...groups.keys()].map(e => `${e} (${groups.get(e).length})`).join(', ')}`);
    log.info('[digest] specialty groups', {
      runId,
      count: groups.size,
      groups: [...groups.entries()].map(([esp, us]) => ({ esp, users: us.length })),
    });

    await createRunRecord(db, runId, dateStr, users.length, groups.size);

    // ── PER-SPECIALTY PROCESSING ─────────────────────────────────────────────
    for (const [especialidade, groupUsers] of groups) {
      console.log(`\n[ESP] ${especialidade} — ${groupUsers.length} users`);

      // Build the shared digest ONCE per specialty (cached across re-runs)
      let espDigest = null;
      try {
        espDigest = await withTimeout(
          buildEspDigest(db, especialidade, anthropicKey, dateStr),
          USER_TIMEOUT_MS * 2,
          `esp:${especialidade}`
        );
      } catch (err) {
        log.error('[digest][ESP] buildEspDigest failed', { especialidade, err: err.message });
      }

      if (!espDigest) {
        console.log(`[ESP SKIP] ${especialidade} — no digest content, ${groupUsers.length} users skipped`);
        skipped += groupUsers.length;
        continue;
      }

      // Publicidade contextual da especialidade (1 consulta por grupo; best-effort)
      espDigest.anuncio = await getActiveAd(db, 'email', especialidade).catch(() => null);

      // Pool da Curadoria Premium — UMA vez por especialidade, e só se o grupo
      // tem pelo menos um assinante (evita queries à toa).
      espDigest.premiumPool = groupUsers.some(u => isPremium(u))
        ? await buildPremiumPool(db, especialidade)
        : [];
      if (espDigest.premiumPool.length) {
        console.log(`[PREMIUM] ${especialidade} — pool de ${espDigest.premiumPool.length} candidatos para extras`);
      }

      // ── BATCH PROCESSING within the specialty ──────────────────────────────
      const batches = [];
      for (let i = 0; i < groupUsers.length; i += BATCH_SIZE) {
        batches.push(groupUsers.slice(i, i + BATCH_SIZE));
      }

      for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        const batch    = batches[bIdx];
        const batchNum = bIdx + 1;
        console.log(`[BATCH ${batchNum}/${batches.length}] ${especialidade} — ${batch.length} users`);

        // Process batch users concurrently — each isolated from the others
        const results = await Promise.allSettled(
          batch.map(user => processUser(user, espDigest, db, resendKey, runId, dateStr))
        );

        for (let i = 0; i < results.length; i++) {
          const r     = results[i];
          const email = batch[i].email;

          if (r.status === 'rejected') {
            log.error('[digest] user threw uncaught error', { email, err: r.reason?.message });
            console.log(`[FAILED] ${email} — ${r.reason?.message?.slice(0, 100)}`);
            errors++;
          } else if (r.value === 'sent') {
            console.log(`[SEND OK] ${email}`);
            sent++;
          } else if (r.value === 'skipped' || r.value === 'blocked') {
            console.log(`[SKIP] ${email} (${r.value})`);
            skipped++;
          } else {
            console.log(`[FAILED] ${email} — result=${r.value}`);
            errors++;
          }
        }

        // Snapshot progress into run record
        await db.updateDoc('digest_runs', runId, { sent, failed: errors, skipped })
          .catch(() => {});

        // Pause between batches (not after the last one)
        if (bIdx < batches.length - 1) {
          await new Promise(r => setTimeout(r, BATCH_PAUSE_MS));
        }
      }
    }
  } finally {
    // ── FINALIZE — always runs, even on exception ─────────────────────────────
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const summary = {
      sent, failed: errors, skipped,
      total:     sent + errors + skipped,
      elapsed_s: Number(elapsed),
    };

    await finalizeRunRecord(db, runId, summary);
    await releaseLock(db, runId);

    console.log(`\n[RUN COMPLETE] runId=${runId}`);
    console.log(`[STATS] sent=${sent} failed=${errors} skipped=${skipped} elapsed=${elapsed}s`);
    log.info('[digest] dispatch complete', { runId, ...summary });
  }

  return { sent, failed: errors, skipped, total: sent + errors + skipped };
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async () => {
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[digest] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('\nDone:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
