// One-shot script: finds active articles with empty journal field and patches
// them by fetching the journal name from PubMed or EuropePMC.
// Falls back to source name if API lookup fails.
//
// Run: node netlify/functions/fix-missing-journals.js

const { Firestore } = require('./_lib/firestore');
const { request }   = require('./_lib');
const log           = require('./_lib/logger');

let _lastNcbi = 0;
async function ncbiThrottle() {
  const wait = 400 - (Date.now() - _lastNcbi);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastNcbi = Date.now();
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

async function fetchJournalPubMed(pmid) {
  await ncbiThrottle();
  try {
    const path = `/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract`;
    const res  = await request({ hostname: 'eutils.ncbi.nlm.nih.gov', path, method: 'GET' }, null);
    if (res.status !== 200) return null;
    return extractTag(res.body, 'Title') || extractTag(res.body, 'ISOAbbreviation') || null;
  } catch {
    return null;
  }
}

async function fetchJournalEuropePMC(pmid) {
  try {
    const path = `/europepmc/webservices/rest/search?query=ext_id:${pmid}&resultType=core&format=json&pageSize=1`;
    const res  = await request({ hostname: 'www.ebi.ac.uk', path, method: 'GET' }, null);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.body);
    return json.resultList?.result?.[0]?.journalTitle || null;
  } catch {
    return null;
  }
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY not set'); process.exit(1); }

  const db = new Firestore(projectId, apiKey);

  // Fetch all active articles with empty journal
  const articles = await db.query('artigos', {
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'status'  }, op: 'EQUAL', value: { stringValue: 'active' } } },
          { fieldFilter: { field: { fieldPath: 'journal' }, op: 'EQUAL', value: { stringValue: ''       } } },
        ],
      },
    },
    limit: 500,
  });

  log.info('[fix-journals] articles with empty journal', { count: articles.length });

  let fixed = 0, failed = 0;

  for (const art of articles) {
    const docId = art.pmid || art.id;
    if (!docId) { failed++; continue; }

    let journal = null;

    if (art.pmid) {
      journal = await fetchJournalPubMed(art.pmid);
      if (!journal) journal = await fetchJournalEuropePMC(art.pmid);
    }

    // Fallback to source label so the field is never blank
    if (!journal) {
      journal = art.fonte === 'europepmc' ? 'Europe PMC'
              : art.fonte === 'openalex'  ? 'OpenAlex'
              : 'PubMed';
    }

    try {
      await db.updateDoc('artigos', docId, { journal });
      log.info('[fix-journals] patched', { id: docId, journal });
      fixed++;
    } catch (err) {
      log.warn('[fix-journals] patch failed', { id: docId, err: err.message });
      failed++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  const result = { fixed, failed, total: articles.length };
  log.info('[fix-journals] complete', result);
  console.log('Done:', JSON.stringify(result));
  return result;
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
}
