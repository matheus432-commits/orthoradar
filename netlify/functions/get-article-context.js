// GET /.netlify/functions/get-article-context
// Returns a contextual knowledge bundle for a given article.
// Pulls related notes, articles, collections, consensus, and guidelines
// from the authenticated user's knowledge base.
//
// Query: ?pmid=&email=&token=

const { Firestore }          = require('./_lib/firestore');
const { buildContextBundle } = require('./_lib/context-retrieval');
const { adaptSummary }       = require('./_lib/reading-context-engine');
const { getUserNotes, getUserCollections } = require('./_lib/memory-engine');
const { getProfile }         = require('./_lib/user-profile');
const { logEvent }           = require('./_lib/engagement');
const log                    = require('./_lib/logger');
const crypto                 = require('crypto');

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
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'salvos' }, { fieldPath: 'likes' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
}

async function getSavedArticles(db, savedPmids, likedPmids) {
  const allPmids = [...new Set([...savedPmids.map(String), ...likedPmids.map(String)])];
  if (!allPmids.length) return [];
  const articles = [];
  for (let i = 0; i < allPmids.length && i < 150; i += 20) {
    const batch = await Promise.all(
      allPmids.slice(i, i + 20).map(pmid => db.getDoc('artigos', pmid).catch(() => null))
    );
    articles.push(...batch.filter(Boolean));
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

  const { pmid, email, token } = event.queryStringParameters || {};

  if (!pmid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'pmid required' }) };
  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db   = new Firestore(projectId, apiKey);
  const user = await validateAndGetUser(db, email, token);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const [article, notes, collections, profile] = await Promise.all([
      db.getDoc('artigos', String(pmid)),
      getUserNotes(db, email),
      getUserCollections(db, email),
      getProfile(email, db),
    ]);

    if (!article) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Article not found' }) };

    const savedArticles = await getSavedArticles(db, user.salvos || [], user.likes || []);
    const bundle = await buildContextBundle(article, notes, savedArticles, collections, db, profile);
    const readingCtx = adaptSummary(article, profile);

    logEvent(projectId, apiKey, {
      eventType: 'context_opened',
      email,
      pmid:     String(pmid),
      digestId: null,
    }).catch(() => {});

    log.debug('[get-article-context] bundle built', { email, pmid, confidence: bundle.confidence });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=300' },
      body: JSON.stringify({ ...bundle, readingContext: readingCtx }),
    };
  } catch (err) {
    log.warn('[get-article-context] error', { email, pmid, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Context build failed' }) };
  }
};
