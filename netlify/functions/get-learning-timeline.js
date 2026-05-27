// GET /.netlify/functions/get-learning-timeline
// Returns the user's longitudinal learning timeline grouped by week and month.
//
// Query: ?email=&token=&days=90

const { Firestore }    = require('./_lib/firestore');
const { buildTimeline } = require('./_lib/timeline-engine');
const { getUserNotes, getUserCollections } = require('./_lib/memory-engine');
const { logEvent }     = require('./_lib/engagement');
const log              = require('./_lib/logger');
const crypto           = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function validateSession(db, email, token) {
  if (!email || !token) return false;
  try {
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }] },
      limit:  1,
    });
    if (!users.length) return false;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return false;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return false;
    return true;
  } catch { return false; }
}

async function loadMetrics(db, email, limitDays) {
  const cutoff = new Date(Date.now() - limitDays * 24 * 3600 * 1000).toISOString();
  try {
    return await db.query('digest_metrics', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL',                value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'ts'    }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'ts' }, direction: 'DESCENDING' }],
      limit: 200,
    });
  } catch {
    // Fallback: no orderBy, client-side filter
    const all = await db.query('digest_metrics', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 200,
    }).catch(() => []);
    return all.filter(m => m.ts && m.ts >= cutoff);
  }
}

async function buildArticleMeta(db, pmids) {
  if (!pmids.length) return {};
  const meta = {};
  for (let i = 0; i < pmids.length && i < 100; i += 20) {
    const batch = await Promise.all(
      pmids.slice(i, i + 20).map(pmid =>
        db.getDoc('artigos', pmid)
          .then(doc => doc ? [pmid, doc] : null)
          .catch(() => null)
      )
    );
    batch.filter(Boolean).forEach(([pmid, doc]) => { meta[pmid] = doc; });
  }
  return meta;
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const { email, token, days: daysStr = '90' } = event.queryStringParameters || {};
  const days = Math.min(parseInt(daysStr, 10) || 90, 180);

  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db    = new Firestore(projectId, apiKey);
  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const [notes, collections, metrics] = await Promise.all([
      getUserNotes(db, email),
      getUserCollections(db, email),
      loadMetrics(db, email, days),
    ]);

    // Collect all PMIDs referenced
    const pmidSet = new Set();
    notes.forEach(n => n.pmid && pmidSet.add(String(n.pmid)));
    metrics.forEach(m => m.pmid && pmidSet.add(String(m.pmid)));
    const articleMeta = await buildArticleMeta(db, [...pmidSet]);

    const timeline = buildTimeline({ notes, collections, metrics }, articleMeta, days);

    logEvent(projectId, apiKey, {
      eventType: 'timeline_opened',
      email,
      pmid: null,
      digestId: null,
    }).catch(() => {});

    log.debug('[get-learning-timeline] built', { email, totalEvents: timeline.totalEvents });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=900' },
      body: JSON.stringify(timeline),
    };
  } catch (err) {
    log.warn('[get-learning-timeline] error', { email, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Timeline build failed' }) };
  }
};
