// GET /.netlify/functions/get-guideline-alerts
// Returns recent high-evidence publications (meta-analyses, systematic reviews) as alerts.
//
// Query: ?specialty={name}&days={n}&limit={n}
// Public — no auth required.

const { Firestore }             = require('./_lib/firestore');
const { detectGuidelineAlerts } = require('./_lib/guideline-tracker');
const { logEvent }              = require('./_lib/engagement');
const log                       = require('./_lib/logger');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=3600',
};

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
  const maxDays   = Math.min(365, parseInt(qs.days  || '90', 10));
  const limit     = Math.min(20,  parseInt(qs.limit || '8',  10));

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const cutoff = new Date(Date.now() - maxDays * 24 * 3600 * 1000).toISOString();

    const where = specialty
      ? {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL',                value: { stringValue: 'active'   } } },
              { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL',                value: { stringValue: specialty  } } },
              { fieldFilter: { field: { fieldPath: 'data'          }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff    } } },
            ],
          },
        }
      : {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL',                value: { stringValue: 'active' } } },
              { fieldFilter: { field: { fieldPath: 'data'   }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff  } } },
            ],
          },
        };

    let articles;
    try {
      articles = await db.query('artigos', {
        where,
        orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
        limit:   120,
      });
    } catch {
      articles = await db.query('artigos', { where, limit: 120 });
    }

    const alerts = detectGuidelineAlerts(articles, limit, maxDays);

    // Track event (fire-and-forget, no email context available here)
    if (qs.email) {
      logEvent(projectId, apiKey, {
        eventType: 'guideline_alert_clicked',
        email:     qs.email,
        pmid:      null,
        digestId:  null,
      }).catch(() => {});
    }

    log.debug('[get-guideline-alerts]', { specialty, found: alerts.length });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        specialty:   specialty || null,
        periodDays:  maxDays,
        alerts,
        total:       alerts.length,
        generatedAt: new Date().toISOString(),
        disclaimer:  'Este conteúdo é destinado à atualização científica e não substitui avaliação clínica individualizada.',
      }),
    };
  } catch (err) {
    log.error('[get-guideline-alerts] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
