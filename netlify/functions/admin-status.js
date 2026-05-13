const crypto = require('crypto');
const { request, corsHeaders, preflight } = require('./_lib');

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
    if (res.status !== 200) { console.warn('[Admin] Firestore list error:', collection, 'status:', res.status); break; }
    const json = JSON.parse(res.body);
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function countDocs(projectId, apiKey, collection, whereClause) {
  const query = {
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: collection }],
        ...(whereClause ? { where: whereClause } : {})
      },
      aggregations: [{ alias: 'count', count: {} }]
    }
  };
  const body = JSON.stringify(query);
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) return null;
  const result = JSON.parse(res.body);
  return parseInt(result[0]?.result?.aggregateFields?.count?.integerValue || '0', 10);
}

exports.handler = async (event) => {
  const headers = corsHeaders();

  const secret = (event.queryStringParameters || {}).secret || '';
  const adminSecret = process.env.ADMIN_SECRET || '';
  let authorized = false;
  if (secret.length > 0 && secret.length === adminSecret.length) {
    try { authorized = crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret)); } catch { authorized = false; }
  }
  if (!authorized) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const todayISO = todayMidnight.toISOString();

    // Fetch users (expected to be small) for specialty breakdown; use aggregation for article counts
    const [userDocs, totalArticles, todayArticles] = await Promise.all([
      listAll(projectId, apiKey, 'cadastros'),
      countDocs(projectId, apiKey, 'artigos_enviados', null),
      countDocs(projectId, apiKey, 'artigos_enviados', {
        fieldFilter: { field: { fieldPath: 'data' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: todayISO } }
      })
    ]);

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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, bySpecialty: bySpec },
        articles: { total: totalArticles ?? 'n/a', today: todayArticles ?? 'n/a' }
      }, null, 2)
    };
  } catch (err) {
    console.error('Admin status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
