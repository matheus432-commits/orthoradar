// Health check endpoint for the OdontoFeed digest pipeline.
// Returns the status of the last run, today's send counts, and lock state.
//
// GET /.netlify/functions/health-digest

const { Firestore } = require('./_lib/firestore');
const log           = require('./_lib/logger');

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 503,
      body: JSON.stringify({ error: 'FIREBASE_API_KEY not configured' }),
    };
  }

  const db    = new Firestore(projectId, apiKey);
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toISOString();

  try {
    // Fetch last 5 run records
    const runs = await db.query('digest_runs', {
      orderBy: [{ field: { fieldPath: 'startedAt' }, direction: 'DESCENDING' }],
      limit: 5,
    }).catch(() => []);

    // Current lock state
    const lock = await db.getDoc('digest_lock', 'current').catch(() => null);

    // Today's per-user log entries
    const todayLogs = await db.query('digest_logs', {
      where: {
        fieldFilter: {
          field: { fieldPath: 'date' },
          op:    'EQUAL',
          value: { stringValue: today },
        },
      },
      limit: 1000,
    }).catch(() => []);

    const byStatus = todayLogs.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    const runningLock = lock?.status === 'active' && lock?.expiresAt > now;

    const lastRun = runs[0] || null;

    const health = {
      status:    runningLock ? 'running' : (lastRun?.status || 'idle'),
      checkedAt: now,

      today: {
        date:       today,
        sent:       byStatus.sent       || 0,
        failed:     byStatus.error      || 0,
        skipped:    (byStatus.skipped   || 0) + (byStatus.blocked || 0),
        processing: byStatus.processing || 0,
        total:      todayLogs.length,
      },

      lock: lock ? {
        status:    lock.status,
        runId:     lock.runId,
        lockedAt:  lock.lockedAt,
        expiresAt: lock.expiresAt,
        active:    runningLock,
      } : null,

      lastRun: lastRun ? {
        runId:       lastRun.runId,
        date:        lastRun.dateStr,
        startedAt:   lastRun.startedAt,
        completedAt: lastRun.completedAt,
        status:      lastRun.status,
        sent:        lastRun.sent,
        failed:      lastRun.failed,
        skipped:     lastRun.skipped,
        total:       lastRun.totalUsers,
        elapsed_s:   lastRun.elapsed_s,
      } : null,

      recentRuns: runs.map(r => ({
        runId:     r.runId,
        date:      r.dateStr,
        status:    r.status,
        sent:      r.sent,
        failed:    r.failed,
        elapsed_s: r.elapsed_s,
      })),

      // Recent failures from today's logs for debugging
      recentFailures: todayLogs
        .filter(l => l.status === 'error')
        .slice(0, 10)
        .map(l => ({
          email:     l.email,
          specialty: l.specialty,
          failReason: l.failReason,
          startedAt:  l.startedAt,
        })),
    };

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify(health, null, 2),
    };
  } catch (err) {
    log.error('[health] health check failed', { err: err.message });
    return {
      statusCode: 500,
      body:       JSON.stringify({ error: err.message }),
    };
  }
};
