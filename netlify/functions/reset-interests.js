// Resets the user's learned interest profile.
// Clears clicksByTheme and badge data from user_engagement, and deletes the
// cached user_profile so it is rebuilt from scratch on the next digest run.
//
// POST /.netlify/functions/reset-interests
// Body: { email: string, token: string }

const crypto       = require('crypto');
const { Firestore } = require('./_lib/firestore');
const log           = require('./_lib/logger');

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, token } = body;
  if (!email || !token) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: 'Service unavailable' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const valid = await validateSession(db, email, token);
    if (!valid) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Invalid or expired session' }) };

    const ehash = crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);

    // Clear learned interest fields; keep streak and lastOpenDate intact
    await db.updateDoc('user_engagement', ehash, {
      clicksByTheme:          {},
      clicksByThemeThisMonth: {},
      badgesEarned:           [],
      newBadgesThisWeek:      [],
      newBadgesThisMonth:     [],
      totalArticlesRead:      0,
      totalArticlesThisMonth: 0,
      updatedAt:              new Date().toISOString(),
    }).catch(err => log.warn('[reset-interests] engagement update failed', { email, err: err.message }));

    // Delete cached user_profile so next digest run rebuilds it from scratch
    await db.deleteDoc('user_profiles', email)
      .catch(err => log.warn('[reset-interests] profile delete failed', { email, err: err.message }));

    log.info('[reset-interests] interests reset', { email });
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    log.error('[reset-interests] error', { err: err.message });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
