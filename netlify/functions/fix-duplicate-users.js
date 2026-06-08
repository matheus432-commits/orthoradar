// One-shot script: finds duplicate user documents in `cadastros` by email
// and removes the ones with incomplete data (no especialidade).
//
// Run: node netlify/functions/fix-duplicate-users.js

const { Firestore } = require('./_lib/firestore');
const log           = require('./_lib/logger');

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY not set'); process.exit(1); }

  const db = new Firestore(projectId, apiKey);

  // Load all users
  let allDocs = [];
  let pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    allDocs = allDocs.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);

  log.info('[fix-users] total documents loaded', { count: allDocs.length });

  // Group by email
  const byEmail = {};
  for (const doc of allDocs) {
    if (!doc.email) continue;
    if (!byEmail[doc.email]) byEmail[doc.email] = [];
    byEmail[doc.email].push(doc);
  }

  // Find emails with more than one document
  const duplicates = Object.entries(byEmail).filter(([, docs]) => docs.length > 1);
  log.info('[fix-users] emails with duplicate documents', { count: duplicates.length });

  let deleted = 0;

  for (const [email, docs] of duplicates) {
    // Keep the doc with the most data (has especialidade); delete the others
    const hasSpecialty = docs.filter(d => {
      const esp = Array.isArray(d.especialidade) ? d.especialidade : d.especialidade ? [d.especialidade] : [];
      return esp.filter(Boolean).length > 0;
    });
    const noSpecialty = docs.filter(d => {
      const esp = Array.isArray(d.especialidade) ? d.especialidade : d.especialidade ? [d.especialidade] : [];
      return esp.filter(Boolean).length === 0;
    });

    log.info('[fix-users] duplicate found', {
      email,
      total:       docs.length,
      withEsp:     hasSpecialty.length,
      withoutEsp:  noSpecialty.length,
      ids:         docs.map(d => d.id),
    });

    // Delete all docs without specialty (if at least one good doc exists)
    if (hasSpecialty.length > 0) {
      for (const doc of noSpecialty) {
        try {
          await db.deleteDoc('cadastros', doc.id);
          log.info('[fix-users] deleted duplicate', { email, id: doc.id });
          deleted++;
        } catch (err) {
          log.warn('[fix-users] delete failed', { email, id: doc.id, err: err.message });
        }
      }
    } else {
      log.warn('[fix-users] skipping — no doc with specialty to keep', { email });
    }
  }

  const result = { duplicatesFound: duplicates.length, deleted };
  log.info('[fix-users] complete', result);
  console.log('Done:', JSON.stringify(result));
  return result;
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
}
