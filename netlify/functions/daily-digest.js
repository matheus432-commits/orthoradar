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
const { buildDigestEmail }                         = require('./_lib/email-template');
const { generateEditorial }                        = require('./_lib/editorial-generator');
const { recommendArticles }                        = require('./_lib/recommendation-engine');
const { runValidation }                            = require('./_lib/digest-validator');
const { pubmedFallbackArticles }                   = require('./_lib/pubmed');
const { acquireLock, releaseLock }                 = require('./_lib/pipeline-lock');
const { withTimeout }                              = require('./_lib/retry-utils');
const { getOrCreateAchadoSemana }                  = require('./_lib/achado-semana');
const log                                          = require('./_lib/logger');
const { request }                                  = require('./_lib');

const BASE_URL        = process.env.SITE_URL || 'https://odontofeed.com.br';
const MIN_ARTICLES    = 3;
const MAX_ARTICLES    = 3;   // Padrão fixo: 3 artigos regulares por dia (o Achado da Semana entra à parte, podendo elevar o total)
const LOOKBACK_DAYS   = 180;
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
function espSlug(esp) {
  return String(esp)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getEspDigestKey(esp, dateStr) {
  return `${espSlug(esp)}_${dateStr}`;
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

// Anti-repeat por especialidade: pmids já usados nos digests compartilhados
// recentes desta especialidade (o conteúdo é o mesmo para todos os inscritos,
// então o histórico também é por especialidade, não por usuário).
async function getRecentEspPmids(db, especialidade) {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  try {
    const docs = await db.query('digests_especialidade', {
      where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } },
      limit: 300,
    });
    const pmids = new Set();
    for (const d of docs) {
      if (d.date && d.date < cutoff) continue;
      for (const p of d.pmids || []) {
        if (p) pmids.add(String(p));
      }
    }
    return pmids;
  } catch (err) {
    log.warn('[digest] getRecentEspPmids failed', { especialidade, err: err.message });
    return new Set();
  }
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
      achadoSemana: cached.achadoSemana || null,
      editorial:    cached.editorial || null,
    };
  }

  log.info('[digest][ESP] building shared digest', { especialidade, key });

  // 1. Anti-repeat: pmids já usados nos digests recentes desta especialidade
  let t = Date.now();
  const sentPmids = await getRecentEspPmids(db, especialidade);
  log.info('[digest][ESP][STAGE antirepeat]', { especialidade, sentCount: sentPmids.size, ms: Date.now() - t });

  // 2. Candidate articles from shared collection
  t = Date.now();
  let candidates = await getCandidates(db, [especialidade]);
  candidates = candidates.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
  log.info('[digest][ESP][STAGE candidates]', { especialidade, count: candidates.length, ms: Date.now() - t });

  // 3. Trending Firestore fallback
  if (candidates.length < MIN_ARTICLES) {
    log.info('[digest][ESP] insufficient candidates, trying trending', { especialidade, found: candidates.length });
    const trending = await getTrendingArticles(db, 30);
    const trendNew = trending.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
    const allIds   = new Set(candidates.map(a => a.pmid || a.id));
    candidates     = [...candidates, ...trendNew.filter(a => !allIds.has(a.pmid || a.id))];
  }

  // 4. PubMed direct fallback
  if (candidates.length < MIN_ARTICLES) {
    log.info('[digest][ESP] Firestore sparse, falling back to PubMed direct', { especialidade, found: candidates.length });
    try {
      const needed  = MAX_ARTICLES + 2;
      const fbArts  = await pubmedFallbackArticles({ especialidade, temas: [] }, sentPmids, needed, anthropicKey);
      const allIds  = new Set(candidates.map(a => String(a.pmid || a.id)));
      const newArts = fbArts.filter(a => !allIds.has(String(a.pmid)));
      candidates    = [...candidates, ...newArts];
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

  // 6. Achado da Semana — gerado uma vez por especialidade por semana, cacheado no Firestore
  t = Date.now();
  const achadoSemana = await getOrCreateAchadoSemana(db, candidates, especialidade, anthropicKey)
    .catch(err => { log.warn('[digest][ESP] getOrCreateAchadoSemana threw', { err: err.message }); return null; });
  log.info('[digest][ESP][STAGE achado]', {
    especialidade,
    hasAchado: !!achadoSemana,
    id: achadoSemana?.pmid || achadoSemana?.articleId || null,
    ms: Date.now() - t,
  });

  // O Achado da Semana é exibido à parte, no topo do email. Removemos o artigo
  // correspondente da lista regular para não duplicar e, em seguida, completamos
  // de volta até o alvo diário (MAX_ARTICLES) com os próximos candidatos distintos.
  // Se não houver candidatos suficientes para manter o mínimo sem o achado, mantemos
  // a seleção original — o limite de 3 nunca deve BLOQUEAR o envio.
  if (achadoSemana) {
    const achadoKey = String(achadoSemana.pmid || achadoSemana.articleId || '');
    if (achadoKey) {
      const withoutAchado = selected.filter(a => String(a.pmid || a.id || '') !== achadoKey);
      const have = new Set(withoutAchado.map(a => String(a.pmid || a.id || '')));
      for (const c of candidates) {
        if (withoutAchado.length >= MAX_ARTICLES) break;
        const ck = String(c.pmid || c.id || '');
        if (!ck || ck === achadoKey || have.has(ck)) continue;
        have.add(ck);
        withoutAchado.push(c);
      }
      if (withoutAchado.length >= MIN_ARTICLES) selected = withoutAchado;
    }
  }

  // 7. Editorial via Claude — UMA chamada por especialidade (não por usuário);
  //    falls back to deterministic on failure.
  t = Date.now();
  const editorial = await generateEditorial(selected, especialidade, [])
    .catch(err => { log.warn('[digest][ESP] generateEditorial threw', { err: err.message }); return null; });
  log.info('[digest][ESP][STAGE editorial]', {
    especialidade, generated: !!editorial, chars: editorial?.length ?? 0, ms: Date.now() - t,
  });

  // 8. Persist shared digest (cache + anti-repeat history)
  const articles = selected.map(stripInternal);
  const pmids = [
    ...articles.map(a => a.pmid || a.id || ''),
    ...(achadoSemana ? [achadoSemana.pmid || achadoSemana.articleId || ''] : []),
  ].filter(Boolean);

  await db.setDoc('digests_especialidade', key, {
    especialidade,
    date:         dateStr,
    pmids,
    artigos:      articles,
    achadoSemana: achadoSemana || null,
    editorial:    editorial || null,
    criadoEm:     new Date().toISOString(),
    status:       'ready',
  }).catch(e => log.warn('[digest][ESP] cache save failed (continuing)', { especialidade, err: e.message }));

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

  // 1. Build email
  const digestId   = crypto.randomUUID();
  const unsubToken = buildUnsubscribeToken(email);

  let t = Date.now();
  const { html, subject } = buildDigestEmail(
    { nome, email, especialidade },
    selected,
    { digestId, baseUrl: BASE_URL, unsubscribeToken: unsubToken, editorial, achadoSemana }
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
      ].filter(Boolean),
      resendMessageId,
    }),
    saveSentLog(db, email, achadoSemana ? [...selected, achadoSemana] : selected, especialidade),
  ]);

  if (digestResult.status  === 'rejected') log.error('[digest][STAGE audit] saveDigest failed', { email, digestId, err: digestResult.reason?.message });
  if (sentLogResult.status === 'rejected') log.error('[digest][STAGE audit] saveSentLog failed', { email, digestId, err: sentLogResult.reason?.message });
  log.info('[digest][STAGE audit]', { email, digestId, ms: Date.now() - t });

  const totalMs = Date.now() - processStart;
  log.info('[digest] COMPLETE', { email, result: 'sent', digestId, totalMs });

  return 'sent';
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
