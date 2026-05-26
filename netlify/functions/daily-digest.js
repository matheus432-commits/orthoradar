// OdontoFeed Smart Digest — daily email dispatch with curated article selection.
//
// Replaces daily-articles.js as the active digest sender.
// Reads pre-enriched articles from the shared `artigos` Firestore collection,
// applies the curation algorithm, and sends a 3–5 article digest per user.
//
// Run: node netlify/functions/daily-digest.js
// Schedule: GitHub Actions daily-emails.yml at 10:00 UTC

const crypto                             = require('crypto');
const { Firestore }                      = require('./_lib/firestore');
const { curateDigest, computeCuratedScore } = require('./_lib/digest-ranking');
const { buildDigestEmail }               = require('./_lib/email-template');
const log                                = require('./_lib/logger');
const { request }                        = require('./_lib');

const BASE_URL     = process.env.SITE_URL || 'https://odontofeed.com.br';
const MIN_ARTICLES = 3;
const MAX_ARTICLES = 5;
const LOOKBACK_DAYS = 180; // how far back to check for already-sent articles
const CANDIDATE_LIMIT = 100; // max articles to fetch per user before curation

// ── Firestore helpers ─────────────────────────────────────────────────────────

async function getActiveUsers(db) {
  let users = [];
  let pageToken = null;

  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users = users.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);

  return users.filter(u => {
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
  }).filter(u => u.especialidades.length > 0);
}

async function getSentPmids(db, email) {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();

  // Primary: composite filter (requires index — see firestore.indexes.json)
  try {
    const docs = await db.query('artigos_enviados', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'data'  }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
          ],
        },
      },
      select: { fields: [{ fieldPath: 'pmid' }] },
      limit: 300,
    });
    return new Set(docs.map(d => String(d.pmid || '')).filter(Boolean));
  } catch (err) {
    log.warn('[digest] composite sentPmids failed, using fallback', { email, err: err.message });
  }

  // Fallback: email-only + client-side date filter
  try {
    const docs = await db.query('artigos_enviados', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'pmid' }, { fieldPath: 'data' }] },
      limit: 300,
    });
    return new Set(
      docs
        .filter(d => !d.data || d.data >= cutoff)
        .map(d => String(d.pmid || ''))
        .filter(Boolean)
    );
  } catch (err) {
    log.warn('[digest] sentPmids fallback failed', { email, err: err.message });
    return new Set();
  }
}

// Get active, enriched articles for a user's specialties.
// Tries ordered query first (needs composite index); falls back to client-side sort.
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

  // Try with orderBy data DESC (uses existing index)
  try {
    const docs = await db.query('artigos', {
      where:   whereClause,
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit:   CANDIDATE_LIMIT,
    });
    return docs;
  } catch (err) {
    log.warn('[digest] ordered query failed, retrying without orderBy', { err: err.message });
  }

  // Retry without orderBy — client-side sort below
  try {
    const docs = await db.query('artigos', { where: whereClause, limit: CANDIDATE_LIMIT });
    return docs.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
  } catch (err) {
    log.warn('[digest] getCandidates failed', { err: err.message });
    return [];
  }
}

// Trending fallback: fetch top-scoring active articles regardless of specialty
async function getTrendingArticles(db, limit = 20) {
  try {
    const docs = await db.query('artigos', {
      where:   { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit,
    });
    return docs.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  } catch {
    return [];
  }
}

// ── Email sending ─────────────────────────────────────────────────────────────

async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({
    from:    'OdontoFeed <artigos@odontofeed.com.br>',
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
      Authorization:  'Bearer ' + resendKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
}

// ── Save digest metadata ──────────────────────────────────────────────────────

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
  // Sequential to avoid hammering Firestore
  for (const art of articles) {
    await db.addDoc('artigos_enviados', {
      email,
      pmid:         art.pmid || art.id || '',
      especialidade: especialidade || '',
      data:         now,
      canal:        'email',
    }).catch(e => log.warn('[digest] saveSentLog failed', { err: e.message }));
  }
}

// ── Per-user processing ───────────────────────────────────────────────────────

function buildUnsubscribeToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET || 'unsub-default';
  return crypto.createHmac('sha256', secret).update(email).digest('hex');
}

async function processUser(user, db, resendKey) {
  const { email, nome, especialidades, especialidade } = user;
  log.info('[digest] processing user', { email, specialties: especialidades });

  // 1. Sent PMIDs anti-repeat
  const sentPmids = await getSentPmids(db, email);

  // 2. Candidate articles from shared collection
  let candidates = await getCandidates(db, especialidades);
  candidates = candidates.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));

  // 3. Trending fallback if candidates too few
  if (candidates.length < MIN_ARTICLES) {
    log.info('[digest] insufficient candidates, using trending fallback', { email, found: candidates.length });
    const trending = await getTrendingArticles(db, 30);
    const trendNew = trending.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
    // Merge, dedup
    const allIds  = new Set(candidates.map(a => a.pmid || a.id));
    const merged  = [...candidates, ...trendNew.filter(a => !allIds.has(a.pmid || a.id))];
    candidates    = merged;
  }

  if (!candidates.length) {
    log.warn('[digest] no articles available', { email });
    return 'skipped';
  }

  // 4. Curate selection
  const selected = curateDigest(candidates, MAX_ARTICLES, MIN_ARTICLES);
  if (!selected.length) {
    log.warn('[digest] curation returned empty', { email });
    return 'skipped';
  }

  // 5. Build email
  const digestId        = crypto.randomUUID();
  const unsubToken      = buildUnsubscribeToken(email);
  const { html, subject } = buildDigestEmail(
    { nome, email, especialidade },
    selected,
    { digestId, baseUrl: BASE_URL, unsubscribeToken: unsubToken }
  );

  // 6. Send via Resend
  const emailRes = await sendEmail(resendKey, email, subject, html);
  if (emailRes.status !== 200 && emailRes.status !== 201) {
    log.error('[digest] send failed', { email, status: emailRes.status, body: emailRes.body.slice(0, 200) });
    return 'error';
  }

  let resendMessageId = null;
  try { resendMessageId = JSON.parse(emailRes.body).id || null; } catch {}

  log.info('[digest] sent', {
    email,
    n:        selected.length,
    digestId,
    subject:  subject.slice(0, 80),
  });

  // 7. Persist digest + sent log (non-blocking)
  await Promise.allSettled([
    saveDigest(db, digestId, {
      email, especialidade, subject,
      pmids:           selected.map(a => a.pmid || a.id || ''),
      resendMessageId,
    }),
    saveSentLog(db, email, selected, especialidade),
  ]);

  return 'sent';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey)    { log.error('[digest] FIREBASE_API_KEY not set'); process.exit(1); }
  if (!resendKey) { log.error('[digest] RESEND_API_KEY not set');   process.exit(1); }

  const db    = new Firestore(projectId, apiKey);
  const start = Date.now();

  log.info('[digest] starting daily dispatch', { ts: new Date().toISOString() });

  let users;
  try {
    users = await getActiveUsers(db);
  } catch (err) {
    log.error('[digest] getActiveUsers failed', { err: err.message });
    return { error: err.message };
  }
  log.info('[digest] users found', { count: users.length });

  let sent = 0, errors = 0, skipped = 0;

  for (const user of users) {
    try {
      const result = await processUser(user, db, resendKey);
      if      (result === 'sent')    sent++;
      else if (result === 'skipped') skipped++;
      else                           errors++;
    } catch (err) {
      log.error('[digest] processUser threw', { email: user.email, err: err.message });
      errors++;
    }
    // Pause between users to avoid Firestore write bursts
    await new Promise(r => setTimeout(r, 300));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const result  = { sent, errors, skipped, total: users.length, elapsed_s: elapsed };
  log.info('[digest] dispatch complete', result);
  return result;
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
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
