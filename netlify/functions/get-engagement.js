// Dashboard engagement API — returns streak, badges, and top themes for a user.
// Endpoint: GET /.netlify/functions/get-engagement?e={emailHash}
//
// The emailHash is sha256(email).slice(0, 16), computed client-side or from the
// email template (same formula as emailHash() in email-template.js).
// No auth required — the ehash is opaque and non-reversible.

const { Firestore } = require('./_lib/firestore');
const log           = require('./_lib/logger');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type':                 'application/json',
  'Cache-Control':                'private, max-age=60',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const ehash = (event.queryStringParameters?.e || '').toLowerCase().trim();

  // Validate: must be exactly 16 lowercase hex characters
  if (!/^[a-f0-9]{16}$/.test(ehash)) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid e parameter' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Service unavailable' }) };
  }

  const db = new Firestore(projectId, apiKey);

  try {
    const eng = await db.getDoc('user_engagement', ehash);

    if (!eng) {
      return {
        statusCode: 200,
        headers:    CORS_HEADERS,
        body:       JSON.stringify({ streak: 0, badgesEarned: [], topThemes: [], totalArticlesRead: 0 }),
      };
    }

    // Top 5 all-time themes
    const topThemes = Object.entries(eng.clicksByTheme || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tema, count]) => ({ tema, count }));

    const payload = {
      streak:            eng.streak            || 0,
      badgesEarned:      eng.badgesEarned      || [],
      topThemes,
      totalArticlesRead: eng.totalArticlesRead || 0,
      totalArticlesThisMonth: eng.totalArticlesThisMonth || 0,
    };

    log.debug('[get-engagement] served', { ehash });
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(payload) };
  } catch (err) {
    log.warn('[get-engagement] Firestore error', { ehash, err: err.message });
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
