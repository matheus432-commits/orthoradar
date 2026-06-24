const { request } = require('./_lib');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=1800'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const base = '/v1/projects/' + projectId + '/databases/(default)/documents:runAggregationQuery?key=' + apiKey;

  async function countCollection(collectionId) {
    const body = JSON.stringify({
      structuredAggregationQuery: {
        aggregations: [{ alias: 'count', count: {} }],
        structuredQuery: { from: [{ collectionId }] }
      }
    });
    const buf = Buffer.from(body, 'utf8');
    const res = await request({
      hostname: 'firestore.googleapis.com',
      path: base,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
    }, buf);
    if (res.status !== 200) return 0;
    const data = JSON.parse(res.body);
    const val = data[0]?.result?.aggregateFields?.count;
    return parseInt(val?.integerValue || val?.doubleValue || '0', 10);
  }

  try {
    const [assinantes, artigos] = await Promise.all([
      countCollection('cadastros'),
      countCollection('artigos')
    ]);
    return { statusCode: 200, headers, body: JSON.stringify({ assinantes, artigos }) };
  } catch (err) {
    console.error('get-stats error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
