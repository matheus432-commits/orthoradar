// Personalized trending articles endpoint.
//
// For anonymous access: returns globally trending articles (sorted by engagement + recency).
// For authenticated access: re-ranks by behavioral affinity for the user.
//
// GET /.netlify/functions/get-trending-personalized
//   ?specialty={name}    — filter by specialty (optional)
//   &limit={n}           — max results (default 10, max 30)
//   &email={email}       — enables personalization (requires Authorization header)
// Authorization: Bearer {sessionToken}  — optional; enables personalization

const { Firestore }           = require('./_lib/firestore');
const { getProfile }          = require('./_lib/user-profile');
const { scoreArticleForUser } = require('./_lib/recommendation-engine');
const { computeCuratedScore } = require('./_lib/digest-ranking');
const log                     = require('./_lib/logger');
const crypto                  = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=900', // 15 min cache
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function tryGetProfile(db, email, token) {
  if (!email || !token) return null;
  try {
    const users = await db.query('cadastros', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }] },
      limit: 1,
    });
    if (!users.length) return null;
    const user = users[0];
    if (!tokenEqual(user.sessionToken, token)) return null;
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) return null;
    return await getProfile(email, db);
  } catch {
    return null;
  }
}

// Trending score = engagement signals + algorithmic quality
function globalTrendingScore(article) {
  const base      = computeCuratedScore(article);
  const clicks    = (article.emailCliques || 0) * 4;
  const curtidas  = (article.curtidas     || 0) * 3;
  const leituras  = (article.leituras     || 0) * 0.5;
  return base + Math.min(30, clicks + curtidas + leituras); // cap engagement bonus at 30
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs        = event.queryStringParameters || {};
  const specialty = qs.specialty  || null;
  const limit     = Math.min(parseInt(qs.limit || '10', 10), 30);
  const email     = qs.email      || null;

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    // Attempt personalization (non-blocking if auth fails)
    const [profile, articles] = await Promise.all([
      tryGetProfile(db, email, token),
      (async () => {
        const where = specialty
          ? {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL', value: { stringValue: 'active'    } } },
                  { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: specialty   } } },
                ],
              },
            }
          : { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } };

        const oversample = Math.min(limit * 4, 80);
        try {
          return await db.query('artigos', {
            where,
            orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
            limit:   oversample,
          });
        } catch {
          return await db.query('artigos', { where, limit: oversample });
        }
      })(),
    ]);

    const personalized = !!profile && profile.totalInteractions > 3;

    const ranked = articles
      .map(a => ({
        ...a,
        _score: personalized
          ? scoreArticleForUser(a, profile)
          : globalTrendingScore(a),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, abstract, ...rest }) => rest); // strip internal + abstract

    log.debug('[trending-personalized]', {
      count: ranked.length,
      specialty: specialty || 'all',
      personalized,
    });

    return {
      statusCode: 200,
      headers:    { ...headers, 'Cache-Control': personalized ? 'private, max-age=600' : 'public, max-age=900' },
      body: JSON.stringify({
        articles:     ranked,
        total:        ranked.length,
        personalized,
        specialty:    specialty || null,
      }),
    };
  } catch (err) {
    log.error('[trending-personalized] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
