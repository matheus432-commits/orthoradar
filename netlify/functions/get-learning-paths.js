// GET /.netlify/functions/get-learning-paths
// Returns personalized Trilhas Inteligentes (learning paths) for the authenticated user.
//
// Authorization: Bearer {sessionToken}
// Query: ?email={email}&specialty={name}&limit={n}

const { Firestore }           = require('./_lib/firestore');
const { getProfile }          = require('./_lib/user-profile');
const { buildLearningPaths }  = require('./_lib/learning-path-engine');
const log                     = require('./_lib/logger');
const crypto                  = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
  'Cache-Control':                'private, max-age=1800',
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function validateSession(db, email, token) {
  if (!email || !token) return null;
  try {
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'especialidade' }, { fieldPath: 'lidos' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
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
  const email     = qs.email     || '';
  const specialty = qs.specialty || null;
  const maxPaths  = Math.min(6, parseInt(qs.limit || '4', 10));

  const auth  = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const user = await validateSession(db, email, token);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

    const specs = Array.isArray(user.especialidade)
      ? user.especialidade.filter(Boolean)
      : user.especialidade ? [user.especialidade] : [];
    const targetSpec = specialty || specs[0] || null;

    const [profile, articles] = await Promise.all([
      getProfile(email, db),
      (async () => {
        if (!targetSpec) return [];
        const where = {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL', value: { stringValue: 'active'    } } },
              { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: targetSpec  } } },
            ],
          },
        };
        try {
          return await db.query('artigos', {
            where,
            orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
            limit:   200,
          });
        } catch {
          return await db.query('artigos', { where, limit: 200 });
        }
      })(),
    ]);

    // Attach user's read list to profile for progress tracking
    const profileWithReads = profile
      ? { ...profile, readPmids: Array.isArray(user.lidos) ? user.lidos : [] }
      : { readPmids: Array.isArray(user.lidos) ? user.lidos : [] };

    const paths = buildLearningPaths(articles, profileWithReads, maxPaths);

    log.debug('[learning-paths]', { email, specialty: targetSpec, paths: paths.length });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        specialty: targetSpec,
        paths,
        total: paths.length,
      }),
    };
  } catch (err) {
    log.error('[learning-paths] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
