// Clinical workspace engine — per-user, per-article workspace storage.
// Items: highlights, bookmarks, quickNotes, snapshots.
// Document ID is md5(email:pmid) — deterministic, URL-safe, no collisions.
// Uses read-modify-write (no arrayUnion needed in Firestore REST wrapper).

const crypto = require('crypto');
const log    = require('./logger');

const WORKSPACE_COL = 'article_workspace';
const LIMITS = {
  highlights: 50,
  bookmarks:  20,
  quickNotes: 30,
  snapshots:  10,
};
const QUICK_NOTE_TIPOS = ['nota', 'dúvida', 'insight', 'aplicar'];

// ── Document identity ────────────────────────────────────────────────────────

function workspaceDocId(email, pmid) {
  return crypto.createHash('md5').update(email + ':' + String(pmid)).digest('hex');
}

async function _getOrInit(db, email, pmid) {
  const docId = workspaceDocId(email, pmid);
  const existing = await db.getDoc(WORKSPACE_COL, docId).catch(() => null);
  if (existing) {
    if (existing.email !== email) throw new Error('Forbidden');
    return { doc: existing, docId };
  }
  const fresh = {
    email,
    pmid:       String(pmid),
    highlights: [],
    bookmarks:  [],
    quickNotes: [],
    snapshots:  [],
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
  };
  return { doc: fresh, docId };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * Retrieves the workspace for (email, pmid). Returns null if none exists.
 */
async function getWorkspace(db, email, pmid) {
  const docId = workspaceDocId(email, pmid);
  const doc   = await db.getDoc(WORKSPACE_COL, docId).catch(() => null);
  if (!doc) return null;
  if (doc.email !== email) throw new Error('Forbidden');
  return doc;
}

/**
 * Saves a text highlight to the workspace.
 * @param {Object} data — { text, context?, color? }
 * @returns highlight item with generated id
 */
async function saveHighlight(db, email, pmid, data) {
  if (!data.text || !data.text.trim()) throw new Error('text is required');
  if (data.text.length > 500) throw new Error('Highlight max 500 chars');

  const { doc, docId } = await _getOrInit(db, email, pmid);
  const item = {
    id:        crypto.randomUUID(),
    text:      data.text.trim().slice(0, 500),
    context:   (data.context || '').slice(0, 200),
    color:     ['yellow', 'blue', 'green', 'red'].includes(data.color) ? data.color : 'yellow',
    createdAt: new Date().toISOString(),
  };
  const updated = { ...doc, highlights: [...(doc.highlights || []), item].slice(-LIMITS.highlights), updatedAt: new Date().toISOString() };
  await db.setDoc(WORKSPACE_COL, docId, updated);
  log.debug('[workspace] highlight saved', { email, pmid });
  return item;
}

/**
 * Saves a bookmark to the workspace.
 * @param {Object} data — { label?, section? }
 */
async function saveBookmark(db, email, pmid, data) {
  const { doc, docId } = await _getOrInit(db, email, pmid);
  const item = {
    id:        crypto.randomUUID(),
    label:     (data.label   || 'Bookmark').slice(0, 100),
    section:   (data.section || '').slice(0, 100),
    createdAt: new Date().toISOString(),
  };
  const updated = { ...doc, bookmarks: [...(doc.bookmarks || []), item].slice(-LIMITS.bookmarks), updatedAt: new Date().toISOString() };
  await db.setDoc(WORKSPACE_COL, docId, updated);
  return item;
}

/**
 * Saves a quick note to the workspace.
 * @param {Object} data — { text, tipo? }
 */
async function saveQuickNote(db, email, pmid, data) {
  if (!data.text || !data.text.trim()) throw new Error('text is required');
  if (data.text.length > 1000) throw new Error('Quick note max 1000 chars');

  const { doc, docId } = await _getOrInit(db, email, pmid);
  const item = {
    id:        crypto.randomUUID(),
    text:      data.text.trim(),
    tipo:      QUICK_NOTE_TIPOS.includes(data.tipo) ? data.tipo : 'nota',
    createdAt: new Date().toISOString(),
  };
  const updated = { ...doc, quickNotes: [...(doc.quickNotes || []), item].slice(-LIMITS.quickNotes), updatedAt: new Date().toISOString() };
  await db.setDoc(WORKSPACE_COL, docId, updated);
  log.debug('[workspace] quick-note saved', { email, pmid });
  return item;
}

/**
 * Saves a snapshot to the workspace.
 * @param {Object} data — { title, content }
 */
async function saveSnapshot(db, email, pmid, data) {
  if (!data.title || !data.content) throw new Error('title and content required');

  const { doc, docId } = await _getOrInit(db, email, pmid);
  const item = {
    id:        crypto.randomUUID(),
    title:     data.title.slice(0, 100),
    content:   data.content.slice(0, 2000),
    createdAt: new Date().toISOString(),
  };
  const updated = { ...doc, snapshots: [...(doc.snapshots || []), item].slice(-LIMITS.snapshots), updatedAt: new Date().toISOString() };
  await db.setDoc(WORKSPACE_COL, docId, updated);
  return item;
}

/**
 * Removes one item from a workspace array by its id.
 * @param {string} itemType — 'highlights' | 'bookmarks' | 'quickNotes' | 'snapshots'
 * @param {string} itemId   — UUID of the item to remove
 */
async function deleteWorkspaceItem(db, email, pmid, itemType, itemId) {
  const validTypes = ['highlights', 'bookmarks', 'quickNotes', 'snapshots'];
  if (!validTypes.includes(itemType)) throw new Error('Invalid item type');

  const docId    = workspaceDocId(email, pmid);
  const existing = await db.getDoc(WORKSPACE_COL, docId).catch(() => null);
  if (!existing) return;
  if (existing.email !== email) throw new Error('Forbidden');

  const updated = {
    ...existing,
    [itemType]: (existing[itemType] || []).filter(item => item.id !== itemId),
    updatedAt: new Date().toISOString(),
  };
  await db.setDoc(WORKSPACE_COL, docId, updated);
}

module.exports = {
  getWorkspace, saveHighlight, saveBookmark, saveQuickNote, saveSnapshot,
  deleteWorkspaceItem, workspaceDocId, LIMITS, QUICK_NOTE_TIPOS,
};
