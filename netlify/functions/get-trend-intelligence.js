// GET /.netlify/functions/get-trend-intelligence
// Returns Radar Científico — five trend signal buckets for a specialty.
//
// Query:
//   ?specialty={name}  — filter by specialty (required)
//   &limit={n}         — items per signal (default 5, max 10)
// Public endpoint — no auth required.

const { Firestore }       = require('./_lib/firestore');
const { classifyTrends }  = require('./_lib/trend-engine');
const log                 = require('./_lib/logger');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=1800', // 30 min
};

const ARTICLE_FIELDS = [
  'pmid', 'titulo', 'titulo_pt', 'journal', 'data', 'especialidade', 'tema',
  'nivel_evidencia', 'relevanceScore', 'resumo_pt', 'impacto_pratico',
  'curtidas', 'emailCliques', 'leituras', 'isOpenAccess', 'pubmedUrl',
];

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
  const limitEach = Math.min(10, parseInt(qs.limit || '5', 10));

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    // Fetch recent active articles for the given specialty (or global if none)
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
        select:  { fields: ARTICLE_FIELDS.map(f => ({ fieldPath: f })) },
        limit:   200,
      });
    } catch {
      articles = await db.query('artigos', {
        where,
        select: { fields: ARTICLE_FIELDS.map(f => ({ fieldPath: f })) },
        limit:  200,
      });
    }

    const signals = classifyTrends(articles, limitEach);

    // Strip fields not needed on the frontend
    const clean = (arr) => arr.map(a => ({
      pmid:            a.pmid || a.id || '',
      titulo:          a.titulo_pt || a.titulo || '',
      journal:         a.journal || '',
      data:            a.data || '',
      especialidade:   a.especialidade || '',
      tema:            a.tema || '',
      nivel_evidencia: a.nivel_evidencia || '',
      relevanceScore:  a.relevanceScore || 0,
      resumo:          (a.resumo_pt || '').substring(0, 280),
      impacto:         a.impacto_pratico || '',
      curtidas:        a.curtidas || 0,
      cliques:         a.emailCliques || 0,
      isOpenAccess:    a.isOpenAccess || false,
      pubmedUrl:       a.pubmedUrl || '',
    }));

    log.debug('[trend-intelligence]', {
      specialty: specialty || 'all',
      total:     articles.length,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        specialty:   specialty || null,
        generatedAt: new Date().toISOString(),
        signals: {
          emAlta:            clean(signals.emAlta),
          crescimentoRapido: clean(signals.crescimentoRapido),
          emergente:         clean(signals.emergente),
          consensoClinico:   clean(signals.consensoClinico),
          debateCientifico:  clean(signals.debateCientifico),
        },
      }),
    };
  } catch (err) {
    log.error('[trend-intelligence] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
