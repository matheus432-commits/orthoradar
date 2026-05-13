const { request } = require('./_lib');

async function findOldDocuments(projectId, apiKey, cutoffISO) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'artigos_enviados' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'data' },
          op: 'LESS_THAN',
          value: { stringValue: cutoffISO }
        }
      },
      limit: 400
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) throw new Error('Firestore query failed: ' + res.status);
  const docs = JSON.parse(res.body);
  return docs.filter(d => d.document).map(d => d.document.name);
}

async function batchDelete(projectId, apiKey, docNames) {
  const writes = docNames.map(name => ({ delete: name }));
  const body = JSON.stringify({ writes });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:batchWrite?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) throw new Error('batchWrite failed: ' + res.status);
  return docNames.length;
}

const BATCH_SIZE = 200;

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('Missing FIREBASE_API_KEY');
    return { statusCode: 500, body: 'Missing env vars' };
  }

  const retentionDays = parseInt(process.env.ARTICLE_RETENTION_DAYS || '180', 10);
  const cutoffISO = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  console.log('Cleanup: deleting artigos_enviados older than', cutoffISO);

  let deleted = 0, errors = 0;
  try {
    const docNames = await findOldDocuments(projectId, apiKey, cutoffISO);
    console.log('Documents to delete:', docNames.length);

    for (let i = 0; i < docNames.length; i += BATCH_SIZE) {
      const chunk = docNames.slice(i, i + BATCH_SIZE);
      try {
        deleted += await batchDelete(projectId, apiKey, chunk);
      } catch (e) {
        console.warn('Batch delete failed:', e.message);
        errors += chunk.length;
      }
      if (i + BATCH_SIZE < docNames.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const result = { deleted, errors, cutoff: cutoffISO, timestamp: new Date().toISOString() };
  console.log('Cleanup complete:', result);
  return { statusCode: 200, body: JSON.stringify(result) };
};
