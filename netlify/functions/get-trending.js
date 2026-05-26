// Trending articles endpoint — returns top articles by composite engagement score.
// Used internally by daily-digest.js and publicly for the dashboard "em alta" section.
// GET /.netlify/functions/get-trending?specialty={name}&limit={n}

const { Firestore }          = require('./_lib/firestore');
const { computeCuratedScore } = require('./_lib/digest-ranking');
const log                    = require('./_lib/logger');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=1800', // 30-min cache
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs        = event.queryStringParameters || {};
  const specialty = qs.specialty || null;
  const limit     = Math.min(parseInt(qs.limit || '10', 10), 30);

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const where = specialty
      ? {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
              { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: specialty } } },
            ],
          },
        }
      : { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } };

    // Fetch candidates ordered by date, then re-rank by curated score
    const docs = await db.query('artigos', {
      where,
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit:   Math.min(limit * 3, 60), // oversample for re-ranking
    });

    const ranked = docs
      .map(d => ({ ...d, _cs: computeCuratedScore(d) }))
      .sort((a, b) => b._cs - a._cs)
      .slice(0, limit)
      .map(({ _cs, abstract, ...d }) => d); // strip internal fields + abstract

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ articles: ranked, total: ranked.length }) };
  } catch (err) {
    log.error('[get-trending] error', { err: err.message });
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
