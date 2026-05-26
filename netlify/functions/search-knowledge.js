// GET /.netlify/functions/search-knowledge
// Full-text search across user's notes, saved articles, and collections.
// Uses TF-IDF inspired ranking from semantic-ranking.js — no vector DB.
//
// Query: ?email=&token=&q=&filter=all|notes|articles|collections&limit=20

const { Firestore }        = require('./_lib/firestore');
const { searchKnowledge }  = require('./_lib/retrieval-engine');
const { getUserNotes, getUserCollections } = require('./_lib/memory-engine');
const { logEvent }         = require('./_lib/engagement');
const log                  = require('./_lib/logger');
const crypto               = require('crypto');

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

async function getUserInteractions(db, email) {
  try {
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'salvos' }, { fieldPath: 'likes' }] },
      limit:  1,
    });
    if (!users.length) return { savedPmids: [], likedPmids: [] };
    const u = users[0];
    return {
      savedPmids: u.salvos || [],
      likedPmids: u.likes  || [],
    };
  } catch { return { savedPmids: [], likedPmids: [] }; }
}

async function getSavedArticles(db, savedPmids, likedPmids) {
  if (!savedPmids.length && !likedPmids.length) return [];
  const allPmids = [...new Set([...savedPmids.map(String), ...likedPmids.map(String)])];

  // Fetch in batches of 20
  const articles = [];
  for (let i = 0; i < allPmids.length && i < 200; i += 20) {
    const batch = allPmids.slice(i, i + 20);
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

  const { email, token, q, filter = 'all', limit: limitStr = '20' } = event.queryStringParameters || {};

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }
  if (!q || q.trim().length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Query must be at least 2 characters' }) };
  }
  if (!['all', 'notes', 'articles', 'collections'].includes(filter)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid filter' }) };
  }

  const limit = Math.min(parseInt(limitStr, 10) || 20, 50);

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const [interactions, notes, collections] = await Promise.all([
      getUserInteractions(db, email),
      filter === 'articles' ? Promise.resolve([]) : getUserNotes(db, email),
      filter === 'articles' ? Promise.resolve([]) : getUserCollections(db, email),
    ]);

    const articles = (filter === 'notes' || filter === 'collections')
      ? []
      : await getSavedArticles(db, interactions.savedPmids, interactions.likedPmids);

    const results = searchKnowledge(
      q.trim(),
      { notes, articles, collections },
      interactions,
      filter,
    ).slice(0, limit);

    logEvent(projectId, apiKey, {
      eventType: 'knowledge_search',
      email,
      pmid:     null,
      digestId: null,
      meta:     { query: q.trim().slice(0, 80), filter, resultCount: results.length },
    }).catch(() => {});

    log.debug('[search-knowledge] query', { email, q: q.trim(), filter, results: results.length });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        query:   q.trim(),
        filter,
        total:   results.length,
        results: results.map(r => {
          const { _score, ...rest } = r;
          return { ...rest, score: parseFloat((_score || 0).toFixed(2)) };
        }),
      }),
    };
  } catch (err) {
    log.warn('[search-knowledge] error', { email, q, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Search failed' }) };
  }
};
