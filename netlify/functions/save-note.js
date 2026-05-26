// POST /.netlify/functions/save-note
// Creates, updates, or soft-deletes a personal note.
// All notes are private by default (ownership enforced).
//
// Body: { action, email, token, noteId?, text, pmid?, tipo?, tags?,
//         tituloArtigo?, tema?, especialidade? }
// Actions: create | update | delete | export

const { Firestore }     = require('./_lib/firestore');
const { createNote, updateNote, deleteNote, exportUserData } = require('./_lib/memory-engine');
const { logEvent }      = require('./_lib/engagement');
const log               = require('./_lib/logger');
const crypto            = require('crypto');

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

  const { action, email, token, noteId } = body;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }
  if (!['create', 'update', 'delete', 'export'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  const valid = await validateSession(db, email, token);
  if (!valid) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

  try {
    if (action === 'create') {
      const id = await createNote(db, email, {
        texto:         body.text || body.texto || '',
        pmid:          body.pmid          || null,
        tituloArtigo:  body.tituloArtigo  || null,
        tema:          body.tema          || null,
        especialidade: body.especialidade || null,
        tipo:          body.tipo          || 'nota',
        tags:          body.tags          || [],
      });
      logEvent(projectId, apiKey, { eventType: 'note_created', email, pmid: body.pmid || null, digestId: null }).catch(() => {});
      log.debug('[save-note] created', { email, noteId: id });
      return { statusCode: 201, headers, body: JSON.stringify({ noteId: id, success: true }) };
    }

    if (action === 'update') {
      if (!noteId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'noteId required' }) };
      await updateNote(db, email, noteId, {
        texto: body.text || body.texto,
        tipo:  body.tipo,
        tags:  body.tags,
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'delete') {
      if (!noteId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'noteId required' }) };
      await deleteNote(db, email, noteId);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'export') {
      const data = await exportUserData(db, email);
      return { statusCode: 200, headers: { ...headers, 'Content-Disposition': 'attachment; filename="odontofeed-export.json"' }, body: JSON.stringify(data) };
    }
  } catch (err) {
    const status = err.message === 'Forbidden' ? 403 : err.message === 'Note not found' ? 404 : 400;
    log.warn('[save-note] error', { action, email, err: err.message });
    return { statusCode: status, headers, body: JSON.stringify({ error: err.message }) };
  }
};
