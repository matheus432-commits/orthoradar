// Personalized article recommendations API.
// Returns articles ranked by the hybrid recommendation engine for a specific user.
//
// GET /.netlify/functions/get-recommendations?email={email}&limit={n}
// Authorization: Bearer {sessionToken}

const { Firestore }           = require('./_lib/firestore');
const { getProfile }          = require('./_lib/user-profile');
const { recommendArticles, explainScore } = require('./_lib/recommendation-engine');
const log                     = require('./_lib/logger');
const crypto                  = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function validateSession(db, email, token) {
  const users = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }] },
    limit: 1,
  });
  if (!users.length) return false;
  const user = users[0];
  if (!tokenEqual(user.sessionToken, token)) return false;
  if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) return false;
  return true;
}

// ── Candidate articles ────────────────────────────────────────────────────────

async function getCandidates(db, specialties, sentPmids, limit = 100) {
  const whereClause = specialties.length === 1
    ? {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'status'       }, op: 'EQUAL', value: { stringValue: 'active'        } } },
            { fieldFilter: { field: { fieldPath: 'especialidade'}, op: 'EQUAL', value: { stringValue: specialties[0]  } } },
          ],
        },
      }
    : {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL', value: { stringValue: 'active'  } } },
            { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'IN',    value: { arrayValue: { values: specialties.slice(0, 30).map(s => ({ stringValue: s })) } } } },
          ],
        },
      };

  try {
    const docs = await db.query('artigos', {
      where:   whereClause,
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit,
    });
    return docs.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
  } catch {
    const docs = await db.query('artigos', { where: whereClause, limit });
    return docs.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
  }
}

async function getRecentSentPmids(db, email) {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(); // last 30 days only
  try {
    const docs = await db.query('artigos_enviados', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL',                value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'data'  }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
          ],
        },
      },
      select: { fields: [{ fieldPath: 'pmid' }] },
      limit: 100,
    });
    return new Set(docs.map(d => String(d.pmid || '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs    = event.queryStringParameters || {};
  const email = qs.email;
  const limit = Math.min(parseInt(qs.limit || '10', 10), 30);
  const debug = qs.debug === '1';

  const authHeader = event.headers?.authorization || event.headers?.Authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email e token obrigatorios' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const authed = await validateSession(db, email, token);
  if (!authed) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
  }

  try {
    // Load profile + user specialties in parallel
    const [profile, userDocs] = await Promise.all([
      getProfile(email, db),
      db.query('cadastros', {
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
        select: { fields: [{ fieldPath: 'especialidade' }] },
        limit: 1,
      }),
    ]);

    const user         = userDocs[0] || {};
    const especialidades = Array.isArray(user.especialidade)
      ? user.especialidade.filter(Boolean)
      : user.especialidade ? [user.especialidade] : [];

    if (!especialidades.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ articles: [], profile_confidence: 0 }) };
    }

    const [sentPmids, candidates] = await Promise.all([
      getRecentSentPmids(db, email),
      getCandidates(db, especialidades, new Set(), limit * 3),
    ]);

    const freshCandidates = candidates.filter(a => !sentPmids.has(String(a.pmid || a.id || '')));
    const recommended     = recommendArticles(freshCandidates, profile, { maxArticles: limit, minArticles: 1 });

    const response = recommended.map(a => {
      const { abstract, _ps, ...safe } = a;
      return {
        ...safe,
        ...(debug ? { _debug: explainScore(a, profile) } : {}),
      };
    });

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, max-age=600' },
      body: JSON.stringify({
        articles:           response,
        total:              response.length,
        profile_confidence: profile ? parseFloat((require('./_lib/user-profile').profileConfidence(profile)).toFixed(2)) : 0,
        personalized:       !!profile && profile.totalInteractions > 3,
      }),
    };
  } catch (err) {
    log.error('[get-recommendations] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
