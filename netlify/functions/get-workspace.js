// GET /.netlify/functions/get-workspace
// Returns the clinical workspace for a specific (email, pmid) pair.
//
// Query: ?email=&token=&pmid=

const { Firestore }    = require('./_lib/firestore');
const { getWorkspace } = require('./_lib/workspace-engine');
const log              = require('./_lib/logger');
const crypto           = require('crypto');

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

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const { email, token, pmid } = event.queryStringParameters || {};

  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  if (!pmid)            return { statusCode: 400, headers, body: JSON.stringify({ error: 'pmid required' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db    = new Firestore(projectId, apiKey);
  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    const workspace = await getWorkspace(db, email, String(pmid));
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        workspace: workspace || {
          email,
          pmid:       String(pmid),
          highlights: [],
          bookmarks:  [],
          quickNotes: [],
          snapshots:  [],
        },
      }),
    };
  } catch (err) {
    const status = err.message === 'Forbidden' ? 403 : 500;
    log.warn('[get-workspace] error', { email, pmid, err: err.message });
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
