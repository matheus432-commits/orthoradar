// Firestore-based execution lock for the digest pipeline.
// Prevents two concurrent runs from processing the same users simultaneously.
//
// Collection : digest_lock
// Document   : current
//
// The lock uses createDoc (conditional write) for atomic acquisition.
// If the document already exists, we inspect it to distinguish:
//   - released lock   → safe to acquire
//   - expired lock    → safe to take over (previous run timed out)
//   - active lock     → abort, another run is in progress

const log = require('./logger');

const LOCK_DOC_ID  = 'current';
const LOCK_TTL_MS  = 28 * 60 * 1000; // 28 min — matches GitHub Actions job timeout

async function acquireLock(db, runId) {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS).toISOString();
  const lockData  = {
    runId,
    lockedAt:  now.toISOString(),
    expiresAt,
    status:    'active',
  };

  // Atomic creation — returns false if document already exists
  let created;
  try {
    created = await db.createDoc('digest_lock', LOCK_DOC_ID, lockData);
  } catch (err) {
    log.warn('[lock] createDoc threw, falling back to getDoc check', { err: err.message });
    created = false;
  }

  if (created !== false) {
    log.info('[lock] acquired (fresh)', { runId, expiresAt });
    console.log(`[LOCK ACQUIRED] runId=${runId} expires=${expiresAt}`);
    return true;
  }

  // Document exists — read it to decide what to do
  let existing;
  try {
    existing = await db.getDoc('digest_lock', LOCK_DOC_ID);
  } catch (err) {
    // Cannot read lock state — refuse to proceed (safety first)
    log.error('[lock] cannot read existing lock — aborting', { err: err.message });
    return false;
  }

  // Lock was released or belongs to this same run
  if (!existing || existing.status === 'released' || existing.runId === runId) {
    await db.setDoc('digest_lock', LOCK_DOC_ID, lockData);
    log.info('[lock] acquired (replaced released/own lock)', { runId, previous: existing?.runId });
    console.log(`[LOCK ACQUIRED] runId=${runId} (replaced stale)`);
    return true;
  }

  // Lock is expired — force takeover
  if (existing.expiresAt && existing.expiresAt < now.toISOString()) {
    await db.setDoc('digest_lock', LOCK_DOC_ID, lockData);
    log.warn('[lock] acquired (expired lock taken over)', {
      runId, expiredRun: existing.runId, expiredAt: existing.expiresAt,
    });
    console.log(`[LOCK ACQUIRED] runId=${runId} (expired lock from ${existing.runId})`);
    return true;
  }

  // Active lock — refuse
  log.warn('[lock] BLOCKED — active run in progress', {
    activeRun: existing.runId, expiresAt: existing.expiresAt,
  });
  console.log(`[LOCK BLOCKED] active run=${existing.runId} expires=${existing.expiresAt}`);
  return false;
}

async function releaseLock(db, runId) {
  try {
    const existing = await db.getDoc('digest_lock', LOCK_DOC_ID);
    if (existing && existing.runId === runId) {
      await db.setDoc('digest_lock', LOCK_DOC_ID, {
        runId,
        releasedAt: new Date().toISOString(),
        status:     'released',
      });
      log.info('[lock] released', { runId });
      console.log(`[LOCK RELEASED] runId=${runId}`);
    } else {
      log.warn('[lock] skipping release — lock owned by different run', {
        ours: runId, owner: existing?.runId,
      });
    }
  } catch (err) {
    log.warn('[lock] release failed (non-critical)', { runId, err: err.message });
  }
}

module.exports = { acquireLock, releaseLock, LOCK_TTL_MS };
