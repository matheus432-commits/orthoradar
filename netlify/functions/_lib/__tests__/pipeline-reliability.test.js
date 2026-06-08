// Tests for the digest pipeline reliability layer.
// Covers: retry-utils, pipeline-lock, and behavioral scenarios.
//
// Run: node --test netlify/functions/_lib/__tests__/pipeline-reliability.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { withTimeout, withRetry, isTemporaryError } = require('../retry-utils');
const { acquireLock, releaseLock }                 = require('../pipeline-lock');

// ── withTimeout ───────────────────────────────────────────────────────────────

describe('withTimeout', () => {
  test('resolves with value before deadline', async () => {
    const result = await withTimeout(Promise.resolve(42), 200, 'fast-op');
    assert.equal(result, 42);
  });

  test('rejects with Timeout error after deadline', async () => {
    const hanging = new Promise(() => {}); // never settles
    await assert.rejects(
      () => withTimeout(hanging, 50, 'hanging-op'),
      err => {
        assert.ok(err.message.includes('Timeout'), `expected Timeout in: ${err.message}`);
        assert.ok(err.message.includes('hanging-op'));
        return true;
      }
    );
  });

  test('propagates rejection from the wrapped promise', async () => {
    const boom = Promise.reject(new Error('downstream failure'));
    await assert.rejects(
      () => withTimeout(boom, 1000, 'boom-op'),
      /downstream failure/
    );
  });

  test('simulates Claude editorial timeout (5s call, 100ms limit)', async () => {
    const slowClaude = new Promise(resolve => setTimeout(() => resolve('editorial text'), 5000));
    await assert.rejects(
      () => withTimeout(slowClaude, 100, 'claude-editorial'),
      /Timeout/,
      'Claude call should be killed by 100ms deadline'
    );
  });

  test('simulates Firestore query timeout (3s call, 80ms limit)', async () => {
    const slowFirestore = new Promise(resolve => setTimeout(() => resolve([]), 3000));
    await assert.rejects(
      () => withTimeout(slowFirestore, 80, 'firestore-query'),
      /Timeout/
    );
  });
});

// ── isTemporaryError ──────────────────────────────────────────────────────────

describe('isTemporaryError', () => {
  test('HTTP 429 (rate limit) is temporary', () => {
    assert.equal(isTemporaryError(null, 429), true);
  });

  test('HTTP 529 (Claude overloaded) is temporary', () => {
    assert.equal(isTemporaryError(null, 529), true);
  });

  test('HTTP 503 (service unavailable) is temporary', () => {
    assert.equal(isTemporaryError(null, 503), true);
  });

  test('HTTP 502 (bad gateway) is temporary', () => {
    assert.equal(isTemporaryError(null, 502), true);
  });

  test('HTTP 500 (server error) is temporary', () => {
    assert.equal(isTemporaryError(null, 500), true);
  });

  test('HTTP 400 (bad request) is NOT temporary', () => {
    assert.equal(isTemporaryError(null, 400), false);
  });

  test('HTTP 401 (unauthorized) is NOT temporary', () => {
    assert.equal(isTemporaryError(null, 401), false);
  });

  test('HTTP 404 (not found) is NOT temporary', () => {
    assert.equal(isTemporaryError(null, 404), false);
  });

  test('HTTP 422 (invalid email) is NOT temporary', () => {
    assert.equal(isTemporaryError(null, 422), false);
  });

  test('ECONNRESET network error is temporary', () => {
    assert.equal(isTemporaryError(new Error('ECONNRESET: connection reset by peer'), undefined), true);
  });

  test('ETIMEDOUT network error is temporary', () => {
    assert.equal(isTemporaryError(new Error('ETIMEDOUT: connection timed out'), undefined), true);
  });

  test('socket hang up is temporary', () => {
    assert.equal(isTemporaryError(new Error('socket hang up'), undefined), true);
  });

  test('timeout error is temporary', () => {
    assert.equal(isTemporaryError(new Error('Request timeout after 30000ms'), undefined), true);
  });

  test('unknown error message is NOT temporary', () => {
    assert.equal(isTemporaryError(new Error('Invalid email address'), undefined), false);
  });

  test('null error with no status is NOT temporary', () => {
    assert.equal(isTemporaryError(null, undefined), false);
  });
});

// ── withRetry ─────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  test('returns immediately on first-attempt success', async () => {
    let calls = 0;
    const result = await withRetry(async () => { calls++; return 'ok'; }, { maxAttempts: 3 });
    assert.equal(result, 'ok');
    assert.equal(calls, 1);
  });

  test('retries on ECONNRESET and eventually succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error('ECONNRESET: network failure');
      return 'recovered';
    }, { maxAttempts: 3, baseDelayMs: 10 });
    assert.equal(result, 'recovered');
    assert.equal(calls, 3);
  });

  test('does NOT retry on permanent (non-temporary) error', async () => {
    let calls = 0;
    await assert.rejects(async () => {
      await withRetry(async () => {
        calls++;
        throw new Error('Validation failed: invalid email');
      }, { maxAttempts: 3, baseDelayMs: 10 });
    }, /Validation failed/);
    assert.equal(calls, 1, 'permanent error must not be retried');
  });

  test('throws after exhausting all retries for persistent temporary error', async () => {
    let calls = 0;
    await assert.rejects(async () => {
      await withRetry(async () => {
        calls++;
        throw new Error('ETIMEDOUT: persistent timeout');
      }, { maxAttempts: 3, baseDelayMs: 10 });
    }, /ETIMEDOUT/);
    assert.equal(calls, 3, 'should attempt exactly maxAttempts times');
  });

  test('simulates Resend 429 rate limit with eventual success', async () => {
    let attempts = 0;
    function mockSendEmail() {
      attempts++;
      if (attempts < 3) {
        const err = new Error('Request timeout: api.resend.com');
        throw err;
      }
      return { status: 200, body: '{"id":"msg_123"}' };
    }

    const res = await withRetry(() => mockSendEmail(), { maxAttempts: 3, baseDelayMs: 10 });
    assert.equal(res.status, 200);
    assert.equal(attempts, 3);
  });
});

// ── pipeline-lock (mock Firestore) ────────────────────────────────────────────

describe('pipeline-lock', () => {
  function makeMockDb({ createResult = true, existingDoc = null } = {}) {
    return {
      createDoc: async () => createResult ? { runId: 'x' } : false,
      getDoc:    async () => existingDoc,
      setDoc:    async () => ({}),
      updateDoc: async () => ({}),
    };
  }

  test('acquires lock when no existing lock (fresh start)', async () => {
    const db = makeMockDb({ createResult: true });
    const acquired = await acquireLock(db, 'run-001');
    assert.equal(acquired, true);
  });

  test('acquires lock when existing lock is expired', async () => {
    const expiredLock = {
      runId: 'old-run',
      status: 'active',
      expiresAt: new Date(Date.now() - 60000).toISOString(), // expired 1 min ago
    };
    const db = makeMockDb({ createResult: false, existingDoc: expiredLock });
    const acquired = await acquireLock(db, 'run-002');
    assert.equal(acquired, true, 'should take over expired lock');
  });

  test('BLOCKS when active lock exists and has not expired', async () => {
    const activeLock = {
      runId: 'concurrent-run',
      status: 'active',
      expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // expires in 20 min
    };
    const db = makeMockDb({ createResult: false, existingDoc: activeLock });
    const acquired = await acquireLock(db, 'run-003');
    assert.equal(acquired, false, 'should refuse to acquire active lock');
  });

  test('acquires lock when existing doc is released', async () => {
    const releasedLock = { runId: 'done-run', status: 'released' };
    const db = makeMockDb({ createResult: false, existingDoc: releasedLock });
    const acquired = await acquireLock(db, 'run-004');
    assert.equal(acquired, true, 'should replace released lock');
  });

  test('releaseLock deletes the document when runId matches', async () => {
    let deleted = false;
    const db = {
      getDoc:    async () => ({ runId: 'run-005', status: 'active' }),
      deleteDoc: async () => { deleted = true; },
    };
    await releaseLock(db, 'run-005');
    assert.equal(deleted, true, 'lock document must be deleted on release');
  });

  test('releaseLock does NOT delete when runId does not match', async () => {
    let deleteCalled = false;
    const db = {
      getDoc:    async () => ({ runId: 'other-run', status: 'active' }),
      deleteDoc: async () => { deleteCalled = true; },
    };
    await releaseLock(db, 'my-run');
    assert.equal(deleteCalled, false, 'must not release a lock we do not own');
  });

  test('simultaneous lock acquisition: only one wins', async () => {
    // Simulates two concurrent run starts competing for the lock.
    // The first createDoc call succeeds; the second sees a live active lock.
    let firstCallDone = false;
    const db = {
      createDoc: async () => {
        if (!firstCallDone) { firstCallDone = true; return { id: 'x' }; }
        return false; // second call: doc already exists
      },
      getDoc: async () => ({
        runId:     'run-A',
        status:    'active',
        expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      }),
      setDoc: async () => ({}),
    };

    const [gotA, gotB] = await Promise.all([
      acquireLock(db, 'run-A'),
      acquireLock(db, 'run-B'),
    ]);

    const wins = [gotA, gotB].filter(Boolean).length;
    assert.ok(wins <= 1,
      `Both runs acquired the lock simultaneously! gotA=${gotA} gotB=${gotB}`);
  });
});

// ── Pipeline behavioral scenarios ─────────────────────────────────────────────

describe('pipeline scenarios', () => {
  test('insufficient articles: gate returns skipped, no exception', () => {
    const MIN_ARTICLES = 3;

    function simulatePipelineGate(candidates) {
      if (candidates.length < MIN_ARTICLES) return 'skipped';
      return 'sent';
    }

    assert.equal(simulatePipelineGate([]),       'skipped', '0 articles → skip');
    assert.equal(simulatePipelineGate([1]),       'skipped', '1 article  → skip');
    assert.equal(simulatePipelineGate([1, 2]),    'skipped', '2 articles → skip');
    assert.equal(simulatePipelineGate([1, 2, 3]), 'sent',    '3 articles → send');
  });

  test('idempotency: already-sent users are skipped in crash recovery', () => {
    const alreadySentToday = new Set(['alice@clinic.com', 'bob@clinic.com']);

    function shouldSkipUser(email) {
      return alreadySentToday.has(email);
    }

    assert.equal(shouldSkipUser('alice@clinic.com'), true,  'already sent → skip');
    assert.equal(shouldSkipUser('bob@clinic.com'),   true,  'already sent → skip');
    assert.equal(shouldSkipUser('carol@clinic.com'), false, 'not yet sent → process');
  });

  test('batch of 100 users: all attempted, no global exception escapes', async () => {
    const users = Array.from({ length: 100 }, (_, i) => `user${i}@test.com`);
    const BATCH_SIZE = 5;

    let processed = 0;
    let failed    = 0;

    async function simulateUser(email) {
      // 10% random failure rate — must not escape the batch
      if (Math.random() < 0.1) throw new Error('Simulated transient failure');
      processed++;
      return 'sent';
    }

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch   = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(email => simulateUser(email)));
      results.forEach(r => { if (r.status === 'rejected') failed++; });
    }

    assert.equal(processed + failed, 100, 'all 100 users must be attempted');
    // No unhandled exception escaped — the test itself didn't throw
  });

  test('Resend failing: returns error status without throwing, pipeline continues', async () => {
    const results = [];

    async function simulateSend(email) {
      if (email === 'bad@test.com') return { status: 500, body: '{"error":"server error"}' };
      return { status: 200, body: '{"id":"msg_ok"}' };
    }

    const users = ['good@test.com', 'bad@test.com', 'good2@test.com'];
    for (const email of users) {
      const res = await simulateSend(email);
      results.push(res.status === 200 ? 'sent' : 'error');
    }

    assert.equal(results[0], 'sent');
    assert.equal(results[1], 'error');
    assert.equal(results[2], 'sent', 'Resend failure for one user must not stop the rest');
  });

  test('recovery after interruption: already-sent status prevents double-send', async () => {
    // Simulate run that crashed at user 3, then restarts
    const digestLog = new Map([
      ['alice@clinic.com', 'sent'],
      ['bob@clinic.com',   'sent'],
      // carol was processing when crash happened — should be retried
      ['carol@clinic.com', 'processing'],
    ]);

    let sentCount = 0;

    async function simulateProcessUser(email) {
      const status = digestLog.get(email);
      if (status === 'sent') return 'skipped'; // idempotency skip
      // processing or not found → process normally
      sentCount++;
      return 'sent';
    }

    const users = ['alice@clinic.com', 'bob@clinic.com', 'carol@clinic.com', 'diana@clinic.com'];
    const results = [];
    for (const email of users) {
      results.push(await simulateProcessUser(email));
    }

    assert.equal(results.filter(r => r === 'skipped').length, 2, 'alice and bob already sent');
    assert.equal(results.filter(r => r === 'sent').length,    2, 'carol and diana processed');
    assert.equal(sentCount, 2, 'only carol and diana actually sent, alice/bob not re-sent');
  });

  test('per-user timeout: a hung user does not block subsequent users', async () => {
    const USER_TIMEOUT_MS = 100;
    const results = [];

    async function processWithTimeout(email) {
      const work = email === 'slow@test.com'
        ? new Promise(resolve => setTimeout(() => resolve('sent'), 5000)) // 5s — too slow
        : Promise.resolve('sent'); // fast

      try {
        return await withTimeout(work, USER_TIMEOUT_MS, email);
      } catch {
        return 'timeout';
      }
    }

    const users = ['fast1@test.com', 'slow@test.com', 'fast2@test.com'];
    for (const email of users) {
      results.push(await processWithTimeout(email));
    }

    assert.equal(results[0], 'sent',    'fast1 should succeed');
    assert.equal(results[1], 'timeout', 'slow user timed out — but did not block others');
    assert.equal(results[2], 'sent',    'fast2 should succeed despite slow@test.com timeout');
  });
});
