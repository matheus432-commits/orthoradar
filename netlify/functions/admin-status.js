const https = require('https');
const { request } = require('./_lib');

async function firestoreQuery(projectId, apiKey, query) {
  const body = JSON.stringify({ structuredQuery: query });
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8');
    const req = https.request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

async function listAll(projectId, apiKey, collection, pageSize = 300) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = `pageSize=${pageSize}&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : '');
    const res = await request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}?${qs}`,
      method: 'GET'
    });
    if (res.status !== 200) break;
    const json = JSON.parse(res.body);
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);
  return docs;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  const secret = (event.queryStringParameters || {}).secret;
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const [userDocs, artigoDocs] = await Promise.all([
      listAll(projectId, apiKey, 'cadastros'),
      listAll(projectId, apiKey, 'artigos_enviados')
    ]);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayISO = todayMidnight.toISOString();

    let totalUsers = 0, activeUsers = 0, inactiveUsers = 0;
    const bySpec = {};

    for (const doc of userDocs) {
      const f = doc.fields || {};
      totalUsers++;
      const ativo = f.ativo?.booleanValue !== false;
      if (ativo) {
        activeUsers++;
        const specs = f.especialidade?.arrayValue?.values
          ? f.especialidade.arrayValue.values.map(v => v.stringValue).filter(Boolean)
          : f.especialidade?.stringValue ? [f.especialidade.stringValue] : ['Não informado'];
        specs.forEach(s => { bySpec[s] = (bySpec[s] || 0) + 1; });
      } else {
        inactiveUsers++;
      }
    }

    let totalArticles = artigoDocs.length;
    let todayArticles = 0;
    const articlesBySpec = {};

    for (const doc of artigoDocs) {
      const f = doc.fields || {};
      const data = f.data?.stringValue || '';
      if (data >= todayISO) todayArticles++;
      const spec = f.especialidade?.stringValue || 'Não informado';
      articlesBySpec[spec] = (articlesBySpec[spec] || 0) + 1;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, bySpecialty: bySpec },
        articles: { total: totalArticles, today: todayArticles, bySpecialty: articlesBySpec }
      }, null, 2)
    };
  } catch (err) {
    console.error('Admin status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
