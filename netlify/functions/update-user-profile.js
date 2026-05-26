// Scheduled profile updater — computes behavioral profiles for all active users
// and persists them to Firestore user_profiles/{email}.
//
// Run daily via GitHub Actions after the ingest pipeline (daily-ingest.yml).
// Also detects engagement fatigue and marks users for adjusted delivery.
//
// node netlify/functions/update-user-profile.js

const { Firestore }   = require('./_lib/firestore');
const { buildProfile, saveProfile } = require('./_lib/user-profile');
const { shouldSendToday }           = require('./_lib/fatigue-detection');
const log             = require('./_lib/logger');

const CONCURRENCY = 5; // users processed in parallel (each does ~3 Firestore queries)

// ── Fetch all active users ────────────────────────────────────────────────────

async function getAllUsers(db) {
  let users = [], pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users      = users.concat(docs);
    pageToken  = nextPageToken;
  } while (pageToken);

  return users.filter(u => u.email && u.ativo !== false).map(u => {
    const especialidades = Array.isArray(u.especialidade)
      ? u.especialidade.filter(Boolean)
      : u.especialidade ? [u.especialidade] : [];
    return { ...u, especialidades, especialidade: especialidades[0] || '' };
  });
}

// ── Process one user ──────────────────────────────────────────────────────────

async function processUser(user, db) {
  try {
    const profile = await buildProfile(user, db);
    await saveProfile(profile, db);

    log.debug('[update-profile] saved', {
      email:         user.email,
      engagement:    profile.engagementScore,
      fatigue:       profile.fatigueAction,
      interactions:  profile.totalInteractions,
      digest_size:   profile.idealDigestSize,
    });
    return { ok: true, shouldSend: profile.shouldSend };
  } catch (err) {
    log.error('[update-profile] failed for user', { email: user.email, err: err.message });
    return { ok: false };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[update-profile] FIREBASE_API_KEY not set'); process.exit(1); }

  const db    = new Firestore(projectId, apiKey);
  const start = Date.now();

  log.info('[update-profile] starting');

  const users = await getAllUsers(db);
  log.info('[update-profile] users loaded', { count: users.length });

  let done = 0, errors = 0, paused = 0;

  // Process in parallel batches of CONCURRENCY
  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch   = users.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(u => processUser(u, db)));

    for (const r of results) {
      if (r.status === 'fulfilled') {
        done++;
        if (!r.value.shouldSend) paused++;
      } else {
        errors++;
      }
    }

    // Brief pause between batches to avoid Firestore rate limits
    if (i + CONCURRENCY < users.length) await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const result  = { done, errors, paused, total: users.length, elapsed_s: elapsed };
  log.info('[update-profile] complete', result);
  return result;
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async () => {
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[update-profile] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
