const { request } = require('./_lib');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const body = JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'artigos' }],
        orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
        select: { fields: [
          { fieldPath: 'titulo' }, { fieldPath: 'tema' },
          { fieldPath: 'especialidade' }, { fieldPath: 'data' },
          { fieldPath: 'journal' }, { fieldPath: 'year' }
        ]},
        limit: 6
      }
    });
    const buf = Buffer.from(body, 'utf8');
    const res = await request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
    }, buf);

    if (res.status !== 200) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firestore error' }) };

    const docs = JSON.parse(res.body);
    const artigos = docs
      .filter(d => d.document)
      .map(d => {
        const f = d.document.fields || {};
        return {
          id: d.document.name.split('/').pop(),
          titulo: f.titulo?.stringValue || '',
          tema: f.tema?.stringValue || '',
          especialidade: f.especialidade?.stringValue || '',
          data: f.data?.stringValue || '',
          journal: f.journal?.stringValue || '',
          year: f.year?.stringValue || ''
        };
      });

    return { statusCode: 200, headers, body: JSON.stringify({ artigos }) };
  } catch (err) {
    console.error('get-public-articles error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
