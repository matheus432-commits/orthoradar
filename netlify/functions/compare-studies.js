// POST /.netlify/functions/compare-studies
// Returns a structured comparison matrix for 2–4 articles identified by PMID.
// No auth required (articles are public).
//
// Body: { pmids: ["12345", "67890", ...] }

const { Firestore }       = require('./_lib/firestore');
const { compareStudies }  = require('./_lib/study-comparator');
const { buildSnapshot }   = require('./_lib/evidence-snapshot');
const { logEvent }        = require('./_lib/engagement');
const log                 = require('./_lib/logger');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const pmids = Array.isArray(body.pmids) ? body.pmids.filter(Boolean).map(String).slice(0, 4) : [];
  if (pmids.length < 2) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'At least 2 PMIDs required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    // Fetch each article by PMID (individual getDoc calls — PMIDs are doc IDs)
    const fetched = await Promise.all(
      pmids.map(pmid =>
        db.getDoc('artigos', pmid)
          .then(doc => doc || null)
          .catch(() => null)
      )
    );

    const articles = fetched.filter(Boolean);
    if (articles.length < 2) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Less than 2 articles found for the given PMIDs' }) };
    }

    const comparison = compareStudies(articles);

    // Attach snapshots to each article in the comparison
    const enrichedArticles = comparison.articles.map((meta, i) => ({
      ...meta,
      snapshot: buildSnapshot(articles[i] || {}),
    }));

    // Track usage (non-blocking, best-effort)
    logEvent(projectId, apiKey, {
      eventType: 'comparator_used',
      pmid:      pmids.join(','),
      email:     body.email || null,
      digestId:  null,
    }).catch(() => {});

    log.debug('[compare-studies]', { pmids, found: articles.length });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...comparison,
        articles: enrichedArticles,
        disclaimer: comparison.disclaimer,
      }),
    };
  } catch (err) {
    log.error('[compare-studies] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
