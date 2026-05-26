// GET /.netlify/functions/get-knowledge-graph
// Returns the user's personal knowledge graph:
//   specialty → tema → articles → notes hierarchy + collection nodes + related pairs.
//
// Query: ?email=&token=&specialty=

const { Firestore }        = require('./_lib/firestore');
const { buildGraph }       = require('./_lib/graph-builder');
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
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'salvos' }, { fieldPath: 'likes' }, { fieldPath: 'lidos' }, { fieldPath: 'perfil' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
}

async function getInteractedArticles(db, savedPmids, likedPmids) {
  if (!savedPmids.length && !likedPmids.length) return [];
  const allPmids = [...new Set([...savedPmids.map(String), ...likedPmids.map(String)])];

  const articles = [];
  for (let i = 0; i < allPmids.length && i < 300; i += 20) {
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

  const { email, token, specialty } = event.queryStringParameters || {};

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const user = await validateSession(db, email, token);
  if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const savedPmids = user.salvos || [];
    const likedPmids = user.likes  || [];
    const profile    = user.perfil  || null;

    const [articles, notes, collections] = await Promise.all([
      getInteractedArticles(db, savedPmids, likedPmids),
      getUserNotes(db, email),
      getUserCollections(db, email),
    ]);

    // Optional specialty filter
    const filteredArticles = specialty
      ? articles.filter(a => (a.especialidade || '').toLowerCase() === specialty.toLowerCase())
      : articles;

    const graph = buildGraph(filteredArticles, notes, collections, profile);

    logEvent(projectId, apiKey, {
      eventType: 'graph_opened',
      email,
      pmid:     null,
      digestId: null,
      meta:     { specialty: specialty || 'all', nodes: graph.nodes.length },
    }).catch(() => {});

    log.debug('[get-knowledge-graph] built', { email, nodes: graph.nodes.length, edges: graph.edges.length });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=300' },
      body: JSON.stringify(graph),
    };
  } catch (err) {
    log.warn('[get-knowledge-graph] error', { email, err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Graph build failed' }) };
  }
};
