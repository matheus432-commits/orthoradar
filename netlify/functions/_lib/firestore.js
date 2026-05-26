// Firestore REST API client — wraps the existing _lib.js request() with retry.
// All methods accept/return plain JS objects; wire format conversion is internal.

const { request } = require('../_lib');

const HOST = 'firestore.googleapis.com';

// ── Wire format helpers ───────────────────────────────────────────────────────

function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}

function toFields(obj) {
  const f = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) f[k] = toValue(v);
  }
  return f;
}

function fromValue(val) {
  if (!val) return null;
  if ('nullValue'      in val) return null;
  if ('booleanValue'   in val) return val.booleanValue;
  if ('integerValue'   in val) return parseInt(val.integerValue, 10);
  if ('doubleValue'    in val) return val.doubleValue;
  if ('stringValue'    in val) return val.stringValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue'     in val) return (val.arrayValue.values || []).map(fromValue);
  if ('mapValue'       in val) return fromFields(val.mapValue.fields || {});
  return null;
}

function fromFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields)) obj[k] = fromValue(v);
  return obj;
}

function fromDoc(doc) {
  if (!doc || !doc.name) return null;
  return { id: doc.name.split('/').pop(), ...fromFields(doc.fields || {}) };
}

// ── Client class ─────────────────────────────────────────────────────────────

class Firestore {
  constructor(projectId, apiKey) {
    this.projectId = projectId;
    this.apiKey    = apiKey;
    this._base     = `/v1/projects/${projectId}/databases/(default)/documents`;
  }

  _qs(extra) {
    return 'key=' + this.apiKey + (extra ? '&' + extra : '');
  }

  _docPath(collection, docId) {
    return `${this._base}/${collection}/${docId}?${this._qs()}`;
  }

  async _send(path, method, body) {
    const buf = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const headers = buf
      ? { 'Content-Type': 'application/json', 'Content-Length': buf.length }
      : {};
    const res = await request({ hostname: HOST, path, method, headers }, buf);
    return res;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async getDoc(collection, docId) {
    const res = await this._send(this._docPath(collection, docId), 'GET');
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`Firestore getDoc ${res.status}: ${res.body.slice(0, 200)}`);
    return fromDoc(JSON.parse(res.body));
  }

  // Full overwrite (upsert)
  async setDoc(collection, docId, data) {
    const path = this._docPath(collection, docId);
    const res  = await this._send(path, 'PATCH', { fields: toFields(data) });
    if (res.status !== 200 && res.status !== 201)
      throw new Error(`Firestore setDoc ${res.status}: ${res.body.slice(0, 200)}`);
    return fromDoc(JSON.parse(res.body));
  }

  // Create only — returns `false` if document already exists (HTTP 412)
  async createDoc(collection, docId, data) {
    const path = `${this._base}/${collection}/${docId}?${this._qs('currentDocument.exists=false')}`;
    const res  = await this._send(path, 'PATCH', { fields: toFields(data) });
    if (res.status === 412) return false;
    if (res.status !== 200 && res.status !== 201)
      throw new Error(`Firestore createDoc ${res.status}: ${res.body.slice(0, 200)}`);
    return fromDoc(JSON.parse(res.body));
  }

  // Partial field update — only touches the provided fields
  async updateDoc(collection, docId, data) {
    const fields = toFields(data);
    const mask   = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
    const path   = `${this._base}/${collection}/${docId}?${this._qs(mask)}`;
    const res    = await this._send(path, 'PATCH', { fields });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new Error(`Firestore updateDoc ${res.status}: ${res.body.slice(0, 200)}`);
    return fromDoc(JSON.parse(res.body));
  }

  // Auto-ID insert
  async addDoc(collection, data) {
    const path = `${this._base}/${collection}?${this._qs()}`;
    const res  = await this._send(path, 'POST', { fields: toFields(data) });
    if (res.status !== 200 && res.status !== 201)
      throw new Error(`Firestore addDoc ${res.status}: ${res.body.slice(0, 200)}`);
    return fromDoc(JSON.parse(res.body));
  }

  async deleteDoc(collection, docId) {
    const res = await this._send(this._docPath(collection, docId), 'DELETE');
    if (res.status !== 200 && res.status !== 204)
      throw new Error(`Firestore deleteDoc ${res.status}`);
  }

  // ── Query ────────────────────────────────────────────────────────────────

  async query(collection, { where, orderBy, limit, select, startAt } = {}) {
    const q = { from: [{ collectionId: collection }] };
    if (where)   q.where   = where;
    if (orderBy) q.orderBy = orderBy;
    if (limit)   q.limit   = limit;
    if (select)  q.select  = select;
    if (startAt) q.startAt = startAt;

    const path = `${this._base}:runQuery?${this._qs()}`;
    const res  = await this._send(path, 'POST', { structuredQuery: q });
    if (res.status !== 200) throw new Error(`Firestore query ${res.status}: ${res.body.slice(0, 200)}`);
    return JSON.parse(res.body).filter(d => d.document).map(d => fromDoc(d.document));
  }

  // List collection with optional pageToken (paginated)
  async listDocs(collection, { pageSize = 300, pageToken } = {}) {
    let qs = `pageSize=${pageSize}&${this._qs()}`;
    if (pageToken) qs += '&pageToken=' + pageToken;
    const path = `${this._base}/${collection}?${qs}`;
    const res  = await this._send(path, 'GET');
    if (res.status !== 200) throw new Error(`Firestore listDocs ${res.status}: ${res.body.slice(0, 200)}`);
    const json = JSON.parse(res.body);
    return {
      docs:          (json.documents || []).map(fromDoc),
      nextPageToken: json.nextPageToken || null,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  // Returns a Set of PMIDs that already exist in the artigos collection.
  async existingPmids(pmids) {
    const existing = new Set();
    if (!pmids.length) return existing;

    for (let i = 0; i < pmids.length; i += 30) {
      const batch = pmids.slice(i, i + 30);
      const whereClause = batch.length === 1
        ? { fieldFilter: { field: { fieldPath: 'pmid' }, op: 'EQUAL', value: { stringValue: batch[0] } } }
        : { fieldFilter: { field: { fieldPath: 'pmid' }, op: 'IN',    value: { arrayValue: { values: batch.map(p => ({ stringValue: p })) } } } };
      try {
        const docs = await this.query('artigos', {
          where:  whereClause,
          select: { fields: [{ fieldPath: 'pmid' }] },
          limit:  30,
        });
        docs.forEach(d => d.pmid && existing.add(String(d.pmid)));
      } catch {
        // If IN query fails (index not ready), fall back to individual gets
        for (const pmid of batch) {
          try { if (await this.getDoc('artigos', pmid)) existing.add(pmid); } catch {}
        }
      }
    }
    return existing;
  }
}

module.exports = { Firestore, toFields, fromFields, toValue, fromValue };
