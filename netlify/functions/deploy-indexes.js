// Creates all Firestore composite indexes defined in firestore.indexes.json.
// Uses the Firestore Admin REST API (requires FIREBASE_API_KEY).
//
// Run: node netlify/functions/deploy-indexes.js

const https      = require('https');
const fs         = require('fs');
const path       = require('path');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const API_KEY    = process.env.FIREBASE_API_KEY;

if (!API_KEY) { console.error('FIREBASE_API_KEY not set'); process.exit(1); }

const HOST = 'firestore.googleapis.com';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const buf = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const req = https.request({
      hostname: HOST,
      path:     path + '?key=' + API_KEY,
      method,
      headers:  buf ? { 'Content-Type': 'application/json', 'Content-Length': buf.length } : {},
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (buf) req.write(buf);
    req.end();
  });
}

// Map our index JSON format to Firestore API format
function toFirestoreIndex(idx) {
  return {
    queryScope: idx.queryScope || 'COLLECTION',
    fields: idx.fields.map(f => ({
      fieldPath: f.fieldPath,
      order:     f.order || 'ASCENDING',
    })),
  };
}

async function listExistingIndexes(collectionGroup) {
  const p = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
  const res = await apiRequest('GET', p, null);
  if (res.status !== 200) return [];
  const json = JSON.parse(res.body);
  return json.indexes || [];
}

function indexesMatch(existing, desired) {
  if (existing.queryScope !== desired.queryScope) return false;
  const ef = existing.fields || [];
  const df = desired.fields  || [];
  if (ef.length !== df.length) return false;
  return df.every((df, i) =>
    ef[i]?.fieldPath === df.fieldPath && ef[i]?.order === df.order
  );
}

async function main() {
  const indexFile = path.join(__dirname, '..', '..', 'firestore.indexes.json');
  const { indexes } = JSON.parse(fs.readFileSync(indexFile, 'utf8'));

  console.log(`Deploying ${indexes.length} indexes to project: ${PROJECT_ID}`);

  // Group by collectionGroup
  const byCollection = {};
  for (const idx of indexes) {
    if (!byCollection[idx.collectionGroup]) byCollection[idx.collectionGroup] = [];
    byCollection[idx.collectionGroup].push(idx);
  }

  let created = 0, skipped = 0, failed = 0;

  for (const [collectionGroup, idxList] of Object.entries(byCollection)) {
    let existing = [];
    try {
      existing = await listExistingIndexes(collectionGroup);
    } catch (err) {
      console.warn(`  Could not list indexes for ${collectionGroup}: ${err.message}`);
    }

    for (const idx of idxList) {
      const desired = toFirestoreIndex(idx);

      // Skip if already exists
      const alreadyExists = existing.some(e => indexesMatch(e, desired));
      if (alreadyExists) {
        console.log(`  SKIP (exists) ${collectionGroup}: ${idx.fields.map(f => f.fieldPath).join(' + ')}`);
        skipped++;
        continue;
      }

      const p = `/v1/projects/${PROJECT_ID}/databases/(default)/collectionGroups/${collectionGroup}/indexes`;
      try {
        const res = await apiRequest('POST', p, desired);
        if (res.status === 200 || res.status === 409) {
          console.log(`  OK ${collectionGroup}: ${idx.fields.map(f => f.fieldPath).join(' + ')}`);
          created++;
        } else {
          const body = JSON.parse(res.body);
          console.warn(`  FAIL (${res.status}) ${collectionGroup}: ${body?.error?.message?.slice(0, 120)}`);
          failed++;
        }
      } catch (err) {
        console.warn(`  ERROR ${collectionGroup}: ${err.message}`);
        failed++;
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  console.log(`\nDone: created=${created} skipped=${skipped} failed=${failed}`);
  return { created, skipped, failed };
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
