// GET /.netlify/functions/get-daily-briefing
// Returns a daily clinical briefing: recent articles summary + personalized insight.
// Response cached in Firestore for 1h per user.
//
// Query: ?email=&token=&specialty=&days=7

const { Firestore }         = require('./_lib/firestore');
const { getCachedBriefing } = require('./_lib/daily-briefing');
const { getProfile }        = require('./_lib/user-profile');
const { logEvent }          = require('./_lib/engagement');
const log                   = require('./_lib/logger');
const crypto                = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function validateAndGetUser(db, email, token) {
  if (!email || !token) return null;
  try {
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'especialidade' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const { email, token, specialty: specParam, days: daysStr = '7' } = event.queryStringParameters || {};
  const days = Math.min(parseInt(daysStr, 10) || 7, 30);

  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db   = new Firestore(projectId, apiKey);
  const user = await validateAndGetUser(db, email, token);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const profile   = await getProfile(email, db);
    const specialty = specParam || (Array.isArray(user.especialidade) ? user.especialidade[0] : user.especialidade) || null;

    const briefing = await getCachedBriefing(db, email, profile, specialty, days);

    logEvent(projectId, apiKey, {
      eventType: 'briefing_opened',
      email,
      pmid: null,
      digestId: null,
    }).catch(() => {});

    log.debug('[get-daily-briefing] served', { email, specialty, cached: !!briefing.generatedAt });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=3600' },
      body: JSON.stringify(briefing),
    };
  } catch (err) {
    log.warn('[get-daily-briefing] error', { email, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Briefing generation failed' }) };
  }
};
