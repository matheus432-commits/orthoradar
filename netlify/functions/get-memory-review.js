// GET /.netlify/functions/get-memory-review
// Returns articles ready for spaced-repetition resurfacing.
// Scored by evidence strength, publication age, and behavioral affinity.
//
// Query: ?email=&token=&limit=5&minScore=20

const { Firestore }    = require('./_lib/firestore');
const { selectResurfacingCandidates } = require('./_lib/resurfacing-engine');
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
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'salvos' }, { fieldPath: 'likes' }, { fieldPath: 'perfil' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
}

async function fetchArticlesBatch(db, pmids) {
  const articles = [];
  for (let i = 0; i < pmids.length && i < 200; i += 20) {
    const batch = pmids.slice(i, i + 20);
    const fetched = await Promise.all(
      batch.map(pmid => db.getDoc('artigos', pmid).catch(() => null))
    );
    articles.push(...fetched.filter(Boolean));
  }
  return articles;
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const { email, token, limit: limitStr = '5', minScore: minStr = '20' } = event.queryStringParameters || {};

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const limit    = Math.min(parseInt(limitStr, 10)  || 5,  20);
  const minScore = Math.min(parseInt(minStr, 10)    || 20, 80);

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const user = await validateSession(db, email, token);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const savedPmids = (user.salvos || []).map(String);
    const likedPmids = (user.likes  || []).map(String);
    const profile    = user.perfil  || null;

    const allPmids = [...new Set([...savedPmids, ...likedPmids])];
    if (!allPmids.length) {
      return {
        statusCode: 200,
        headers: { ...headers, 'Cache-Control': 'private, max-age=1800' },
        body: JSON.stringify({ candidates: [], total: 0, message: 'Salve artigos para ativar a revisão inteligente.' }),
      };
    }

    const articles  = await fetchArticlesBatch(db, allPmids);
    const candidates = selectResurfacingCandidates(articles, profile, { limit, minScore });

    log.debug('[get-memory-review] selected', { email, candidates: candidates.length });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=1800' },
      body: JSON.stringify({ candidates, total: candidates.length }),
    };
  } catch (err) {
    log.warn('[get-memory-review] error', { email, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Memory review failed' }) };
  }
};
