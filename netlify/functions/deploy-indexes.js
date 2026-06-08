// Creates Firestore composite indexes using the Admin REST API with OAuth2 bearer token.
// Exchanges the FIREBASE_REFRESH_TOKEN for an access token, then creates each index.
//
// Run via GitHub Actions deploy-firestore-indexes.yml

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PROJECT_ID     = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const REFRESH_TOKEN  = process.env.FIREBASE_TOKEN;
const CLIENT_ID      = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET  = 'j9iVZfS8kkCEFUPaAeJV0sAi';

if (!REFRESH_TOKEN) { console.error('FIREBASE_TOKEN not set'); process.exit(1); }

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8');
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Length': buf.length, ...headers },
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(buf); req.end();
  });
}

function httpsGet(hostname, path, bearer) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path, method: 'GET',
      headers: { Authorization: `Bearer ${bearer}` },
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function getAccessToken() {
  const body = `client_id=${CLIENT_ID}&client_secret=${encodeURIComponent(CLIENT_SECRET)}&refresh_token=${encodeURIComponent(REFRESH_TOKEN)}&grant_type=refresh_token`;
  const res  = await httpsPost('oauth2.googleapis.com', '/token', body, { 'Content-Type': 'application/x-www-form-urlencoded' });
  const json = JSON.parse(res.body);
  if (!json.access_token) { console.error('Token exchange failed:', JSON.stringify(json)); process.exit(1); }
  console.log('Access token obtained.');
  return json.access_token;
}

async function listIndexes(bearer, collectionGroup) {
  const p   = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
  const res = await httpsGet('firestore.googleapis.com', p, bearer);
  if (res.status === 404 || res.status === 200) {
    const json = JSON.parse(res.body);
    return json.indexes || [];
  }
  return [];
}

function indexKey(idx) {
  return (idx.fields || []).map(f => `${f.fieldPath}:${f.order}`).join('|');
}

async function createIndex(bearer, collectionGroup, fields) {
  const body = JSON.stringify({
    queryScope: 'COLLECTION',
    fields: fields.map(f => ({ fieldPath: f.fieldPath, order: f.order || 'ASCENDING' })),
  });
  const p   = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
  const res = await httpsPost('firestore.googleapis.com', p, body, {
    'Content-Type':   'application/json',
    'Authorization':  `Bearer ${bearer}`,
  });
  return { status: res.status, body: res.body };
}

async function main() {
  const indexFile = path.join(__dirname, '..', '..', 'firestore.indexes.json');
  const { indexes } = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  console.log(`Deploying ${indexes.length} indexes to project: ${PROJECT_ID}`);

  const bearer = await getAccessToken();

  // Group by collectionGroup
  const byCollection = {};
  for (const idx of indexes) {
    if (!byCollection[idx.collectionGroup]) byCollection[idx.collectionGroup] = [];
    byCollection[idx.collectionGroup].push(idx);
  }

  let created = 0, skipped = 0, failed = 0;

  for (const [collectionGroup, idxList] of Object.entries(byCollection)) {
    const existing    = await listIndexes(bearer, collectionGroup);
    const existingSet = new Set(existing.map(indexKey));

    for (const idx of idxList) {
      const key = idx.fields.map(f => `${f.fieldPath}:${f.order || 'ASCENDING'}`).join('|');
      if (existingSet.has(key)) {
        console.log(`  SKIP  ${collectionGroup}: ${idx.fields.map(f => f.fieldPath).join('+')}`);
        skipped++; continue;
      }

      const res = await createIndex(bearer, collectionGroup, idx.fields);
      if (res.status === 200 || res.status === 409) {
        console.log(`  OK    ${collectionGroup}: ${idx.fields.map(f => f.fieldPath).join('+')} (building...)`);
        created++;
      } else {
        const msg = (() => { try { return JSON.parse(res.body)?.error?.message?.slice(0, 100); } catch { return res.body?.slice(0, 100); } })();
        console.warn(`  FAIL  (${res.status}) ${collectionGroup}: ${msg}`);
        failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\nDone: created=${created} skipped=${skipped} failed=${failed}`);
  console.log('Note: indexes build asynchronously in Firestore (2-5 minutes).');
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
