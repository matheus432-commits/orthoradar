// Engagement tracking helpers.
// Provides atomic Firestore increments and event logging for digest analytics.

const { request }  = require('../_lib');
const { Firestore } = require('./firestore');
const log           = require('./logger');

const HOST = 'firestore.googleapis.com';

// ── Atomic increment via Firestore commit endpoint ────────────────────────────
// Uses server-side FieldTransform — no read required, no race conditions.

async function incrementField(projectId, apiKey, collection, docId, field, amount = 1) {
  const docPath = `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const body    = JSON.stringify({
    writes: [{
      transform: {
        document: docPath,
        fieldTransforms: [{
          fieldPath: field,
          increment: { integerValue: String(amount) },
        }],
      },
    }],
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: HOST,
    path:     `/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);

  if (res.status !== 200) {
    throw new Error(`incrementField ${field} on ${collection}/${docId}: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return true;
}

// Increment multiple fields atomically in one commit
async function incrementFields(projectId, apiKey, collection, docId, fieldAmounts) {
  const docPath = `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const transforms = Object.entries(fieldAmounts).map(([field, amount]) => ({
    fieldPath: field,
    increment: { integerValue: String(amount) },
  }));

  const body = JSON.stringify({
    writes: [{ transform: { document: docPath, fieldTransforms: transforms } }],
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: HOST,
    path:     `/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);

  if (res.status !== 200) {
    throw new Error(`incrementFields on ${collection}/${docId}: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return true;
}

// ── Digest event logging ──────────────────────────────────────────────────────

/**
 * Records a single tracking event (open | click) to digest_metrics.
 * Best-effort — errors are logged but not thrown.
 */
async function logEvent(projectId, apiKey, event) {
  const db = new Firestore(projectId, apiKey);
  try {
    await db.addDoc('digest_metrics', {
      digestId:  event.digestId  || null,
      email:     event.email     || null,
      eventType: event.eventType || 'unknown',  // open | click
      pmid:      event.pmid      || null,
      ip:        event.ip        || null,
      ts:        new Date().toISOString(),
    });
  } catch (err) {
    log.warn('[engagement] logEvent failed', { err: err.message, eventType: event.eventType });
  }
}

/**
 * Increments the open counter on a digest document.
 * Also increments emailAberturas on each associated article.
 */
async function recordOpen(projectId, apiKey, digestId) {
  try {
    await incrementField(projectId, apiKey, 'digests', digestId, 'aberturas');
  } catch (err) {
    log.warn('[engagement] recordOpen digest failed', { digestId, err: err.message });
  }
}

/**
 * Increments click counters on both the digest and the article.
 */
async function recordClick(projectId, apiKey, digestId, pmid) {
  const tasks = [];
  if (digestId) {
    tasks.push(
      incrementField(projectId, apiKey, 'digests', digestId, 'cliques')
        .catch(e => log.warn('[engagement] recordClick digest failed', { err: e.message }))
    );
  }
  if (pmid) {
    tasks.push(
      incrementField(projectId, apiKey, 'artigos', pmid, 'emailCliques')
        .catch(e => log.warn('[engagement] recordClick article failed', { pmid, err: e.message }))
    );
  }
  await Promise.allSettled(tasks);
}

module.exports = { incrementField, incrementFields, logEvent, recordOpen, recordClick };
