// GET /.netlify/functions/get-scientific-profile
// Returns the authenticated user's Scientific Intelligence Profile:
//   scientificScore, score breakdown, reading streak, theme/evidence distribution.
//
// Authorization: Bearer {sessionToken}
// Query: ?email={email}

const { Firestore }               = require('./_lib/firestore');
const { getProfile }              = require('./_lib/user-profile');
const { computeScientificScore, computeReadingStreak, topEntries } = require('./_lib/scientific-score');
const log                         = require('./_lib/logger');
const crypto                      = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
  'Cache-Control':                'private, max-age=600',
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

async function loadRecentDigests(db, email) {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  try {
    return await db.query('digests', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email'     }, op: 'EQUAL',                value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'enviadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'enviadoEm' }, direction: 'DESCENDING' }],
      limit: 90,
    });
  } catch {
    try {
      const docs = await db.query('digests', {
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
        limit: 90,
      });
      return docs.sort((a, b) => (b.enviadoEm || '') > (a.enviadoEm || '') ? 1 : -1);
    } catch { return []; }
  }
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs    = event.queryStringParameters || {};
  const email = qs.email || '';
  const auth  = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const valid = await validateSession(db, email, token);
    if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

    const [profile, recentDigests] = await Promise.all([
      getProfile(email, db),
      loadRecentDigests(db, email),
    ]);

    const score         = computeScientificScore(profile);
    const readingStreak = computeReadingStreak(recentDigests);

    const openedDigests   = recentDigests.filter(d => (d.aberturas || 0) > 0).length;
    const clickedDigests  = recentDigests.filter(d => (d.cliques   || 0) > 0).length;

    const payload = {
      scientificScore:    score.total,
      scoreBreakdown:     score,
      readingStreak,
      totalInteractions:  profile?.totalInteractions  || 0,
      totalDigestsSent:   profile?.totalDigestsSent   || recentDigests.length,
      digestsOpened:      openedDigests,
      digestsClicked:     clickedDigests,
      openRate:           profile?.openRate           || 0,
      ctr:                profile?.ctr                || 0,
      engagementScore:    profile?.engagementScore    || 0,
      favoriteThemes:     topEntries(profile?.favoriteThemes    || {}, 8),
      evidenceProfile:    topEntries(profile?.preferredEvidence || {}, 6),
      topJournals:        topEntries(profile?.preferredJournals || {}, 5),
      fatigueAction:      profile?.fatigueAction      || 'send_daily',
      idealDigestSize:    profile?.idealDigestSize    || 5,
      updatedAt:          profile?.updatedAt          || null,
    };

    log.debug('[scientific-profile]', { email, score: score.total, streak: readingStreak });

    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (err) {
    log.error('[scientific-profile] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
