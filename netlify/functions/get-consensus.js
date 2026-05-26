// GET /.netlify/functions/get-consensus
// Returns per-tema consensus analysis for a specialty.
// Results are cached in Firestore (consensus_cache/{specialty-hash}) for 6 hours.
//
// Query: ?specialty={name}&nocache=1
// Public — no auth required.

const { Firestore }        = require('./_lib/firestore');
const { analyzeConsensus } = require('./_lib/consensus-engine');
const { buildSnapshot }    = require('./_lib/evidence-snapshot');
const log                  = require('./_lib/logger');
const crypto               = require('crypto');

const CACHE_TTL_MS  = 6 * 60 * 60 * 1000;  // 6 hours
const CACHE_COL     = 'consensus_cache';
const MIN_ARTICLES  = 60;                    // over-sample for better grouping

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=3600',
};

function cacheKey(specialty) {
  return crypto.createHash('md5').update(specialty || 'all').digest('hex').slice(0, 16);
}

async function loadFromCache(db, specialty) {
  try {
    const key  = cacheKey(specialty);
    const doc  = await db.getDoc(CACHE_COL, key);
    if (!doc) return null;
    if (Date.now() - new Date(doc.generatedAt || 0).getTime() > CACHE_TTL_MS) return null;
    return doc.data;
  } catch { return null; }
}

async function saveToCache(db, specialty, data) {
  try {
    const key = cacheKey(specialty);
    await db.setDoc(CACHE_COL, key, { generatedAt: new Date().toISOString(), data });
  } catch (err) {
    log.warn('[get-consensus] cache write failed', { err: err.message });
  }
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
  const specialty = qs.specialty || null;
  const nocache   = qs.nocache === '1';

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  // Cache check
  if (!nocache) {
    const cached = await loadFromCache(db, specialty);
    if (cached) {
      log.debug('[get-consensus] cache hit', { specialty });
      return { statusCode: 200, headers, body: JSON.stringify({ ...cached, fromCache: true }) };
    }
  }

  try {
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

    let articles;
    try {
      articles = await db.query('artigos', {
        where,
        orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
        limit:   MIN_ARTICLES,
      });
    } catch {
      articles = await db.query('artigos', { where, limit: MIN_ARTICLES });
    }

    const consensus = analyzeConsensus(articles, 2).slice(0, 10);

    // Strip heavy fields from topArticles to keep response lean
    const cleaned = consensus.map(c => ({
      ...c,
      topArticles: c.topArticles.map(a => ({
        pmid:            a.pmid || a.id || '',
        titulo:          a.titulo_pt || a.titulo || '',
        journal:         a.journal || '',
        data:            a.data || '',
        nivel_evidencia: a.nivel_evidencia || '',
        impacto:         a.impacto_pratico || '',
        pubmedUrl:       a.pubmedUrl || '',
        snapshot:        buildSnapshot(a),
      })),
    }));

    const payload = {
      specialty: specialty || null,
      generatedAt: new Date().toISOString(),
      temas: cleaned,
      totalArticlesAnalyzed: articles.length,
      disclaimer: 'Este conteúdo é destinado à atualização científica e não substitui avaliação clínica individualizada.',
    };

    await saveToCache(db, specialty, payload);

    log.debug('[get-consensus]', { specialty, temas: cleaned.length, articles: articles.length });

    return { statusCode: 200, headers, body: JSON.stringify({ ...payload, fromCache: false }) };
  } catch (err) {
    log.error('[get-consensus] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
