// Memory engine — note and collection CRUD helpers.
// Handles ownership validation and soft delete.
// All write operations require the email of the authenticated user.

const crypto = require('crypto');
const log    = require('./logger');

const NOTES_COL       = 'notes';
const COLLECTIONS_COL = 'collections';

const NOTE_TIPOS     = ['nota', 'highlight', 'takeaway'];
const MAX_NOTE_LEN   = 2000;
const MAX_TAGS       = 5;
const MAX_TAG_LEN    = 40;
const MAX_COLLECTIONS = 50;
const MAX_COLL_ITEMS  = 100;

// ── Validation helpers ────────────────────────────────────────────────────────

function validateNote(data) {
  const errors = [];
  if (!data.texto || data.texto.trim().length < 1) errors.push('texto is required');
  if (data.texto && data.texto.length > MAX_NOTE_LEN) errors.push(`texto max ${MAX_NOTE_LEN} chars`);
  if (data.tipo && !NOTE_TIPOS.includes(data.tipo)) errors.push('tipo must be nota|highlight|takeaway');
  if (data.tags) {
    if (!Array.isArray(data.tags))               errors.push('tags must be an array');
    else if (data.tags.length > MAX_TAGS)        errors.push(`max ${MAX_TAGS} tags`);
    else if (data.tags.some(t => t.length > MAX_TAG_LEN)) errors.push(`tag max ${MAX_TAG_LEN} chars`);
  }
  return errors;
}

// ── Notes ─────────────────────────────────────────────────────────────────────

/**
 * Creates a new note.
 * @returns {string} noteId
 */
async function createNote(db, email, data) {
  const errors = validateNote(data);
  if (errors.length) throw new Error(errors.join('; '));

  const noteId = crypto.randomUUID();
  const now    = new Date().toISOString();

  await db.setDoc(NOTES_COL, noteId, {
    noteId,
    email,
    pmid:         data.pmid        || null,
    tituloArtigo: data.tituloArtigo || null,
    tema:         data.tema         || null,
    especialidade: data.especialidade || null,
    texto:        data.texto.trim(),
    tipo:         NOTE_TIPOS.includes(data.tipo) ? data.tipo : 'nota',
    tags:         Array.isArray(data.tags) ? data.tags.slice(0, MAX_TAGS).map(t => String(t).slice(0, MAX_TAG_LEN)) : [],
    criadoEm:     now,
    atualizadoEm: now,
    deletedAt:    null,
  });

  log.debug('[memory] note created', { noteId, email });
  return noteId;
}

/**
 * Updates an existing note. Validates ownership.
 */
async function updateNote(db, email, noteId, data) {
  const existing = await db.getDoc(NOTES_COL, noteId);
  if (!existing)                    throw new Error('Note not found');
  if (existing.email !== email)     throw new Error('Forbidden');
  if (existing.deletedAt)           throw new Error('Note already deleted');

  const errors = validateNote({ texto: data.texto ?? existing.texto, tipo: data.tipo ?? existing.tipo, tags: data.tags ?? existing.tags });
  if (errors.length) throw new Error(errors.join('; '));

  await db.updateDoc(NOTES_COL, noteId, {
    texto:        (data.texto ?? existing.texto).trim(),
    tipo:         data.tipo ?? existing.tipo,
    tags:         data.tags ?? existing.tags,
    atualizadoEm: new Date().toISOString(),
  });
}

/**
 * Soft-deletes a note. Validates ownership.
 */
async function deleteNote(db, email, noteId) {
  const existing = await db.getDoc(NOTES_COL, noteId);
  if (!existing)                throw new Error('Note not found');
  if (existing.email !== email) throw new Error('Forbidden');

  await db.updateDoc(NOTES_COL, noteId, { deletedAt: new Date().toISOString() });
}

/**
 * Lists all active notes for a user.
 */
async function getUserNotes(db, email) {
  try {
    const docs = await db.query(NOTES_COL, {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email'     }, op: 'EQUAL', value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'deletedAt' }, op: 'EQUAL', value: { nullValue: 'NULL_VALUE' } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }],
      limit: 200,
    });
    return docs;
  } catch {
    // Fallback if index not ready: client-side filter
    const all = await db.query(NOTES_COL, {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 200,
    }).catch(() => []);
    return all.filter(d => !d.deletedAt);
  }
}

/**
 * Lists all notes for a specific article.
 */
async function getNotesForArticle(db, email, pmid) {
  const all = await getUserNotes(db, email);
  return all.filter(n => String(n.pmid || '') === String(pmid || ''));
}

// ── Collections ───────────────────────────────────────────────────────────────

/**
 * Creates a new collection.
 * @returns {string} collectionId
 */
async function createCollection(db, email, data) {
  if (!data.nome || !data.nome.trim()) throw new Error('nome is required');
  if (data.nome.length > 80)           throw new Error('nome max 80 chars');

  // Count existing collections
  const existing = await getUserCollections(db, email);
  if (existing.length >= MAX_COLLECTIONS) throw new Error(`Max ${MAX_COLLECTIONS} collections reached`);

  const collectionId = crypto.randomUUID();
  const now          = new Date().toISOString();

  await db.setDoc(COLLECTIONS_COL, collectionId, {
    collectionId,
    email,
    nome:         data.nome.trim(),
    descricao:    (data.descricao || '').slice(0, 300),
    pmids:        Array.isArray(data.pmids) ? data.pmids.slice(0, MAX_COLL_ITEMS) : [],
    tags:         Array.isArray(data.tags)  ? data.tags.slice(0, MAX_TAGS)        : [],
    publica:      false,
    criadoEm:     now,
    atualizadoEm: now,
    deletedAt:    null,
  });

  log.debug('[memory] collection created', { collectionId, email });
  return collectionId;
}

/**
 * Updates a collection. Supports rename, description, and pmid add/remove.
 */
async function updateCollection(db, email, collectionId, data) {
  const existing = await db.getDoc(COLLECTIONS_COL, collectionId);
  if (!existing)                 throw new Error('Collection not found');
  if (existing.email !== email)  throw new Error('Forbidden');
  if (existing.deletedAt)        throw new Error('Collection already deleted');

  let pmids = existing.pmids || [];
  if (data.addPmid    && !pmids.includes(data.addPmid))    pmids.push(data.addPmid);
  if (data.removePmid) pmids = pmids.filter(p => p !== data.removePmid);
  pmids = pmids.slice(0, MAX_COLL_ITEMS);

  await db.updateDoc(COLLECTIONS_COL, collectionId, {
    nome:         (data.nome     ?? existing.nome).trim(),
    descricao:    ((data.descricao ?? existing.descricao) || '').slice(0, 300),
    pmids,
    tags:         data.tags      ?? existing.tags,
    atualizadoEm: new Date().toISOString(),
  });
}

/**
 * Soft-deletes a collection.
 */
async function deleteCollection(db, email, collectionId) {
  const existing = await db.getDoc(COLLECTIONS_COL, collectionId);
  if (!existing)                 throw new Error('Collection not found');
  if (existing.email !== email)  throw new Error('Forbidden');

  await db.updateDoc(COLLECTIONS_COL, collectionId, { deletedAt: new Date().toISOString() });
}

/**
 * Lists all active collections for a user.
 */
async function getUserCollections(db, email) {
  try {
    const docs = await db.query(COLLECTIONS_COL, {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email'     }, op: 'EQUAL', value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'deletedAt' }, op: 'EQUAL', value: { nullValue: 'NULL_VALUE' } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'criadoEm' }, direction: 'DESCENDING' }],
      limit: 60,
    });
    return docs;
  } catch {
    const all = await db.query(COLLECTIONS_COL, {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 60,
    }).catch(() => []);
    return all.filter(d => !d.deletedAt);
  }
}

// ── LGPD export ───────────────────────────────────────────────────────────────

/**
 * Returns all user data for LGPD compliance export.
 */
async function exportUserData(db, email) {
  const [notes, collections] = await Promise.all([
    getUserNotes(db, email),
    getUserCollections(db, email),
  ]);
  return {
    email,
    exportedAt: new Date().toISOString(),
    notes,
    collections,
  };
}

module.exports = {
  createNote, updateNote, deleteNote, getUserNotes, getNotesForArticle,
  createCollection, updateCollection, deleteCollection, getUserCollections,
  exportUserData,
};
