// POST /.netlify/functions/create-collection
// Creates, updates, or soft-deletes a clinical collection of articles.
// All collections are private (ownership enforced).
//
// Body: { action, email, token, collectionId?, nome?, descricao?, tags?,
//         pmids?, addPmid?, removePmid? }
// Actions: create | update | delete | list

const { Firestore } = require('./_lib/firestore');
const {
  createCollection, updateCollection, deleteCollection, getUserCollections,
} = require('./_lib/memory-engine');
const { logEvent } = require('./_lib/engagement');
const log          = require('./_lib/logger');
const crypto       = require('crypto');

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
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, email, token, collectionId } = body;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }
  if (!['create', 'update', 'delete', 'list'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    if (action === 'list') {
      const collections = await getUserCollections(db, email);
      return {
        statusCode: 200,
        headers: { ...headers, 'Cache-Control': 'private, no-store' },
        body: JSON.stringify({ collections, total: collections.length }),
      };
    }

    if (action === 'create') {
      const id = await createCollection(db, email, {
        nome:      body.nome      || '',
        descricao: body.descricao || '',
        pmids:     body.pmids     || [],
        tags:      body.tags      || [],
      });
      logEvent(projectId, apiKey, { eventType: 'collection_created', email, pmid: null, digestId: null }).catch(() => {});
      log.debug('[create-collection] created', { email, collectionId: id });
      return { statusCode: 201, headers, body: JSON.stringify({ collectionId: id, success: true }) };
    }

    if (action === 'update') {
      if (!collectionId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'collectionId required' }) };
      await updateCollection(db, email, collectionId, {
        nome:        body.nome,
        descricao:   body.descricao,
        tags:        body.tags,
        addPmid:     body.addPmid    || null,
        removePmid:  body.removePmid || null,
        pmids:       body.pmids,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'delete') {
      if (!collectionId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'collectionId required' }) };
      await deleteCollection(db, email, collectionId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }
  } catch (err) {
    const status = err.message === 'Forbidden' ? 403 : err.message === 'Collection not found' ? 404 : 400;
    log.warn('[create-collection] error', { action, email, err: err.message });
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
