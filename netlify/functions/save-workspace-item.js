// POST /.netlify/functions/save-workspace-item
// Saves or deletes items in a user's article workspace.
// All items are private and ownership-validated.
//
// Body: { action, email, token, pmid, ...itemData }
// Actions: save_highlight | save_bookmark | save_quick_note | save_snapshot | delete
// For delete: also requires { itemType, itemId }

const { Firestore }  = require('./_lib/firestore');
const {
  saveHighlight, saveBookmark, saveQuickNote, saveSnapshot,
  deleteWorkspaceItem,
} = require('./_lib/workspace-engine');
const { logEvent }   = require('./_lib/engagement');
const log            = require('./_lib/logger');
const crypto         = require('crypto');

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

  const { action, email, token, pmid } = body;
  const VALID_ACTIONS = ['save_highlight', 'save_bookmark', 'save_quick_note', 'save_snapshot', 'delete'];

  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  if (!pmid)            return { statusCode: 400, headers, body: JSON.stringify({ error: 'pmid required' }) };
  if (!VALID_ACTIONS.includes(action)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db    = new Firestore(projectId, apiKey);
  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    let item;
    let eventType = null;

    if (action === 'save_highlight') {
      item      = await saveHighlight(db, email, String(pmid), { text: body.text, context: body.context, color: body.color });
      eventType = 'highlight_created';
    } else if (action === 'save_bookmark') {
      item = await saveBookmark(db, email, String(pmid), { label: body.label, section: body.section });
    } else if (action === 'save_quick_note') {
      item      = await saveQuickNote(db, email, String(pmid), { text: body.text, tipo: body.tipo });
      eventType = 'workspace_note_created';
    } else if (action === 'save_snapshot') {
      item = await saveSnapshot(db, email, String(pmid), { title: body.title, content: body.content });
    } else if (action === 'delete') {
      if (!body.itemType || !body.itemId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'itemType and itemId required for delete' }) };
      }
      await deleteWorkspaceItem(db, email, String(pmid), body.itemType, body.itemId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (eventType) {
      logEvent(projectId, apiKey, { eventType, email, pmid: String(pmid), digestId: null }).catch(() => {});
    }

    log.debug('[save-workspace-item]', { action, email, pmid });
    return { statusCode: 201, headers, body: JSON.stringify({ item, success: true }) };

  } catch (err) {
    const status = err.message === 'Forbidden' ? 403 : 400;
    log.warn('[save-workspace-item] error', { action, email, pmid, err: err.message });
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
