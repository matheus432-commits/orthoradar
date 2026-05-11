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

async function deleteDocument(apiKey, docName) {
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/' + docName + '?key=' + apiKey,
    method: 'DELETE'
  }, null);
  return res.status === 200;
}

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('Missing FIREBASE_API_KEY');
    return { statusCode: 500, body: 'Missing env vars' };
  }

  const cutoffISO = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  console.log('Cleanup: deleting artigos_enviados older than', cutoffISO);

  let deleted = 0, errors = 0;
  try {
    const docNames = await findOldDocuments(projectId, apiKey, cutoffISO);
    console.log('Documents to delete:', docNames.length);

    for (const name of docNames) {
      try {
        const ok = await deleteDocument(apiKey, name);
        if (ok) deleted++;
        else errors++;
      } catch (e) {
        console.warn('Delete failed:', name.split('/').pop(), e.message);
        errors++;
      }
      // Stay under Firestore write rate limits
      await new Promise(r => setTimeout(r, 50));
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }

  const result = { deleted, errors, cutoff: cutoffISO, timestamp: new Date().toISOString() };
  console.log('Cleanup complete:', result);
  return { statusCode: 200, body: JSON.stringify(result) };
};
