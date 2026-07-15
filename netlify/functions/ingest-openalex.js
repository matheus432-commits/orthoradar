// OpenAlex ingestion — covers dental articles not indexed in PubMed,
// prioritizing Open Access works (full text freely available).
// API: https://docs.openalex.org/api-entities/works

const { Firestore }       = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { detectEvidenceLevel, classifySpecialty } = require('./_lib/scoring');
const log                 = require('./_lib/logger');
const { request }         = require('./_lib');

const HOST = 'api.openalex.org';

// OpenAlex concept IDs for dentistry sub-fields
// Find IDs at: https://api.openalex.org/concepts?search=orthodontics
const CONCEPT_QUERIES = [
  { specialty: 'Ortodontia',      conceptId: 'C185592680',  name: 'Orthodontics' },
  { specialty: 'Implantodontia',  conceptId: 'C2777765523', name: 'Dental implant' },
  { specialty: 'Periodontia',     conceptId: 'C2779289990', name: 'Periodontology' },
  { specialty: 'Endodontia',      conceptId: 'C2776461803', name: 'Endodontics' },
  { specialty: 'Dentística',      conceptId: 'C95993970',   name: 'Dentistry' },      // fallback broad
  { specialty: 'Prótese',         conceptId: 'C2777099539', name: 'Prosthodontics' },
  { specialty: 'Odontopediatria', conceptId: 'C2779247069', name: 'Pediatric dentistry' },
];

// ── OpenAlex API helpers ──────────────────────────────────────────────────────

async function searchOpenAlex(conceptId, perPage = 12) {
  // Only Open Access, English, last 90 days
  const fromDate = new Date(Date.now() - 90 * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0];

  const filter = [
    `concepts.id:${conceptId}`,
    `from_publication_date:${fromDate}`,
    'language:en',
    'open_access.is_oa:true',
    'type:journal-article',
  ].join(',');

  const path = (
    `/works?filter=${encodeURIComponent(filter)}` +
    `&per-page=${perPage}&sort=publication_date:desc` +
    `&select=id,doi,title,abstract_inverted_index,authorships,primary_location,publication_year,publication_date,open_access,concepts` +
    `&mailto=contato@odontofeed.com` // polite pool: better rate limits
  );

  const res = await request({ hostname: HOST, path, method: 'GET' }, null);
  if (res.status !== 200) {
    log.warn('[openalex] search failed', { status: res.status, conceptId });
    return [];
  }

  const json    = JSON.parse(res.body);
  return (json.results || []).map(parseWork);
}

function parseWork(work) {
  const doi  = work.doi ? work.doi.replace('https://doi.org/', '') : null;
  // Extract PMID from IDs if available
  const pmid = extractPmid(work);

  // Reconstruct abstract from inverted index
  const abstract = reconstructAbstract(work.abstract_inverted_index);

  // Authors
  const authors = (work.authorships || [])
    .slice(0, 3)
    .map(a => a.author?.display_name?.split(' ').pop() || '')
    .filter(Boolean);
  if ((work.authorships || []).length > 3) authors.push('et al.');

  const journal = work.primary_location?.source?.display_name || '';
  const url     = work.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : '');

  return {
    pmid,
    doi,
    openAlexId:   work.id || null,
    title:        work.title || '',
    abstract,
    journal,
    year:         work.publication_year || null,
    data:         work.publication_date || null,
    autores:      authors,
    isOpenAccess: true,         // filtered at query level
    oaUrl:        work.open_access?.oa_url || url,
    fonte:        'openalex',
    url:          url || (doi ? `https://doi.org/${doi}` : ''),
  };
}

function extractPmid(work) {
  if (!work.ids) return null;
  const pmidEntry = Object.entries(work.ids).find(([k]) => k === 'pmid');
  if (pmidEntry) return String(pmidEntry[1]).replace('https://pubmed.ncbi.nlm.nih.gov/', '').replace('/', '');
  return null;
}

// OpenAlex stores abstracts as inverted index: { word: [position, ...], ... }
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  try {
    const positions = [];
    for (const [word, pos] of Object.entries(invertedIndex)) {
      for (const p of pos) positions.push({ p, word });
    }
    positions.sort((a, b) => a.p - b.p);
    return positions.map(x => x.word).join(' ').trim();
  } catch {
    return '';
  }
}

// ── Save to Firestore ─────────────────────────────────────────────────────────

async function saveArticle(db, article, specialty) {
  const id = article.pmid || (article.doi ? 'doi_' + article.doi.replace(/[^a-zA-Z0-9]/g, '_') : null);
  if (!id) {
    log.warn('[openalex] no usable ID, skipping', { title: (article.title || '').slice(0, 50) });
    return false;
  }

  const nivel_evidencia = detectEvidenceLevel(article.title, article.abstract);
  const especialidade   = specialty || classifySpecialty(article.title, article.abstract) || 'Odontologia Geral';
  const pubDate         = article.data ? new Date(article.data).toISOString() : new Date().toISOString();

  const doc = {
    pmid:         article.pmid       || null,
    doi:          article.doi        || null,
    openAlexId:   article.openAlexId || null,
    titulo:       article.title      || '',
    abstract:     (article.abstract  || '').slice(0, 2000),
    journal:      article.journal    || '',
    year:         article.year       || null,
    autores:      article.autores    || [],
    isOpenAccess: true,
    fonte:        'openalex',
    url:          article.oaUrl || article.url || '',
    pubmedUrl:    article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`
                              : (article.doi ? `https://doi.org/${article.doi}` : (article.oaUrl || article.url || null)),
    especialidade,
    nivel_evidencia,
    status:       'pending_enrichment',
    criadoEm:     new Date().toISOString(),
    data:         pubDate,
    curtidas:     0,
    leituras:     0,
    ativo:        true,
  };

  const created = await db.createDoc('artigos', id, doc);
  if (created === false) {
    log.debug('[openalex] already exists', { id });
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[openalex] FIREBASE_API_KEY not set'); process.exit(1); }

  const db     = new Firestore(projectId, apiKey);
  const start  = Date.now();
  let totalNew = 0;
  let totalDup = 0;

  for (const { specialty, conceptId } of CONCEPT_QUERIES) {
    log.info('[openalex] searching', { specialty, conceptId });

    let works;
    try {
      works = await searchOpenAlex(conceptId);
    } catch (err) {
      log.error('[openalex] search error', { specialty, err: err.message });
      continue;
    }

    if (!works.length) {
      log.info('[openalex] no results', { specialty });
      continue;
    }

    // Pre-filter: skip if PMID already known
    const pmids       = works.filter(w => w.pmid).map(w => w.pmid);
    const existingSet = pmids.length ? await db.existingPmids(pmids).catch(() => new Set()) : new Set();
    const candidates  = works.filter(w => !w.pmid || !existingSet.has(w.pmid));

    for (const work of candidates) {
      // Skip if no title or abstract (low-quality record)
      if (!work.title || !work.abstract) {
        log.debug('[openalex] skipping record with no abstract', { doi: work.doi });
        continue;
      }

      try {
        const saved = await saveArticle(db, work, specialty);
        if (saved) {
          totalNew++;
          log.info('[openalex] saved', { id: work.pmid || work.doi, specialty });
        } else {
          totalDup++;
        }
      } catch (err) {
        log.error('[openalex] save error', { err: err.message });
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Polite rate limit: OpenAlex allows 10 req/s for polite pool
    await new Promise(r => setTimeout(r, 150));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log.info('[openalex] ingestion complete', { new: totalNew, skipped: totalDup, elapsed_s: elapsed });
  return { new: totalNew, skipped: totalDup };
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[openalex] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
