// PubMed ingestion — searches PubMed for recent dental articles,
// deduplicates against Firestore, and saves new ones with status "pending_enrichment".
//
// Run daily via GitHub Actions before process-article.js.
// Trigger: node netlify/functions/ingest-pubmed.js

const { Firestore }             = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { filterNew }             = require('./_lib/dedup');
const { detectEvidenceLevel, classifySpecialty, scoreRelevance } = require('./_lib/scoring');
const log                       = require('./_lib/logger');
const { request }               = require('./_lib');

// ── NCBI rate limiter (3 req/s without API key, 10/s with key) ───────────────
let _lastNcbi = 0;
async function ncbiThrottle() {
  const minGap = process.env.NCBI_API_KEY ? 100 : 400;
  const wait   = minGap - (Date.now() - _lastNcbi);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastNcbi = Date.now();
}

const NCBI_KEY = process.env.NCBI_API_KEY ? '&api_key=' + process.env.NCBI_API_KEY : '';

// ── Specialty search queries ──────────────────────────────────────────────────
// Each entry generates one PubMed search per ingestion run.
// Keep to 12 specialties × ~10 articles each = ~120 candidates/day.
const SPECIALTY_QUERIES = [
  { specialty: 'Ortodontia',      query: 'orthodontics[MeSH Major Topic]' },
  { specialty: 'Implantodontia',  query: 'dental implants[MeSH Major Topic]' },
  { specialty: 'Periodontia',     query: 'periodontics[MeSH Major Topic]' },
  { specialty: 'Endodontia',      query: 'endodontics[MeSH Major Topic]' },
  { specialty: 'Dentística',      query: 'dental caries[MeSH Major Topic] OR dental restoration permanent[MeSH Major Topic]' },
  { specialty: 'Prótese',         query: 'prosthodontics[MeSH Major Topic] OR "denture, partial, fixed"[MeSH Major Topic] OR "denture, complete"[MeSH Major Topic]' },
  { specialty: 'Cirurgia',        query: 'oral surgical procedures[MeSH Major Topic]' },
  { specialty: 'Odontopediatria', query: 'pediatric dentistry[MeSH Major Topic]' },
  { specialty: 'Saúde Pública',   query: 'public health dentistry[MeSH Major Topic]' },
  { specialty: 'Radiologia',      query: 'radiography dental[MeSH Major Topic] OR cone-beam computed tomography[MeSH Major Topic]' },
  { specialty: 'Estomatologia',   query: 'stomatognathic diseases[MeSH Major Topic]' },
  { specialty: 'DTM',             query: 'temporomandibular joint disorders[MeSH Major Topic]' },
];

const DATE_RANGE = 'last+90+days'; // wider window → more candidates, dedup handles repeats

// ── PubMed API helpers ────────────────────────────────────────────────────────

async function searchPmids(query, retMax = 15) {
  await ncbiThrottle();
  const encodedQuery = encodeURIComponent(
    `(${query}) AND ("last 90 days"[PDat]) AND (English[lang])`
  );
  const path = `/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=${retMax}&retmode=json${NCBI_KEY}`;
  const res  = await request({ hostname: 'eutils.ncbi.nlm.nih.gov', path, method: 'GET' }, null);
  if (res.status !== 200) {
    log.warn('[pubmed] esearch failed', { status: res.status, query: query.slice(0, 80) });
    return [];
  }
  const json = JSON.parse(res.body);
  return (json.esearchresult?.idlist || []).map(String);
}

async function fetchArticles(pmids) {
  if (!pmids.length) return [];
  await ncbiThrottle();
  const ids  = pmids.join(',');
  const path = `/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids}&retmode=xml&rettype=abstract${NCBI_KEY}`;
  const res  = await request({ hostname: 'eutils.ncbi.nlm.nih.gov', path, method: 'GET' }, null);
  if (res.status !== 200) {
    log.warn('[pubmed] efetch failed', { status: res.status });
    return [];
  }
  return parseArticlesXml(res.body);
}

function parseArticlesXml(xml) {
  const articles = [];
  const artMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];

  for (const block of artMatches) {
    try {
      const pmid = extractTag(block, 'PMID') || '';
      if (!pmid) continue;

      const title    = cleanText(extractTag(block, 'ArticleTitle') || '');
      const abstract = cleanText(extractTag(block, 'AbstractText') || '');
      const journal  = cleanText(
        extractTag(block, 'Title') ||
        extractTag(block, 'ISOAbbreviation') ||
        ''
      );

      const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
      const year      = yearMatch ? parseInt(yearMatch[1], 10) : null;

      // Authors: first 3 + et al
      const authorMatches = block.match(/<LastName>(.*?)<\/LastName>/g) || [];
      const authors = authorMatches
        .slice(0, 3)
        .map(m => m.replace(/<\/?LastName>/g, '').trim());
      if (authorMatches.length > 3) authors.push('et al.');

      const doi = extractTag(block, 'ELocationID') || null;

      // Open access: check PMC link or OA status
      const isOpenAccess = /pmc\d+/i.test(block) || /<CommentsCorrections RefType="pmc-article-url"/.test(block);

      if (!title || !abstract) continue;

      articles.push({
        pmid,
        doi:          doi || null,
        title,
        abstract,
        journal:      journal || '',
        year:         year || new Date().getFullYear(),
        autores:      authors,
        isOpenAccess: Boolean(isOpenAccess),
        fonte:        'pubmed',
        pubmedUrl:    `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    } catch (err) {
      log.warn('[pubmed] parse error on block', { err: err.message });
    }
  }
  return articles;
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

function cleanText(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// ── Save to Firestore ─────────────────────────────────────────────────────────

async function saveArticle(db, article, specialty) {
  const nivel_evidencia = detectEvidenceLevel(article.title, article.abstract);
  const especialidade   = specialty || classifySpecialty(article.title, article.abstract) || 'Odontologia Geral';

  const doc = {
    pmid:             article.pmid,
    doi:              article.doi   || null,
    titulo:           article.title  || '',
    abstract:         (article.abstract || '').slice(0, 2000), // stored for AI processing
    journal:          article.journal  || '',
    year:             article.year     || null,
    autores:          article.autores  || [],
    isOpenAccess:     article.isOpenAccess || false,
    fonte:            'pubmed',
    pubmedUrl:        article.pubmedUrl || `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
    especialidade,
    nivel_evidencia,
    status:           'pending_enrichment', // process-article.js will update this
    criadoEm:         new Date().toISOString(),
    data:             new Date().toISOString(), // immutable after first insert
    curtidas:         0,
    leituras:         0,
    ativo:            true,
  };

  const created = await db.createDoc('artigos', article.pmid, doc);
  if (created === false) {
    log.debug('[pubmed] already exists, skipping', { pmid: article.pmid });
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[pubmed] FIREBASE_API_KEY not set'); process.exit(1); }

  const db      = new Firestore(projectId, apiKey);
  const started = Date.now();
  let totalNew  = 0;
  let totalSeen = 0;

  for (const { specialty, query } of SPECIALTY_QUERIES) {
    log.info('[pubmed] searching specialty', { specialty });

    let pmids;
    try {
      pmids = await searchPmids(query, 15);
    } catch (err) {
      log.error('[pubmed] searchPmids error', { specialty, err: err.message });
      continue;
    }

    if (!pmids.length) {
      log.info('[pubmed] no results', { specialty });
      continue;
    }

    // Dedup against Firestore before fetching full records
    const existingSet = await db.existingPmids(pmids).catch(() => new Set());
    const newPmids    = pmids.filter(p => !existingSet.has(p));
    totalSeen += pmids.length - newPmids.length;

    if (!newPmids.length) {
      log.info('[pubmed] all already exist', { specialty, count: pmids.length });
      continue;
    }

    let articles;
    try {
      articles = await fetchArticles(newPmids);
    } catch (err) {
      log.error('[pubmed] fetchArticles error', { specialty, err: err.message });
      continue;
    }

    for (const article of articles) {
      try {
        const saved = await saveArticle(db, article, specialty);
        if (saved) {
          totalNew++;
          log.info('[pubmed] saved', { pmid: article.pmid, specialty });
        }
      } catch (err) {
        log.error('[pubmed] save error', { pmid: article.pmid, err: err.message });
      }
      // Brief pause to avoid Firestore write bursts
      await new Promise(r => setTimeout(r, 50));
    }

    // Pause between specialty queries
    await new Promise(r => setTimeout(r, 500));
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  log.info('[pubmed] ingestion complete', { new: totalNew, skipped: totalSeen, elapsed_s: elapsed });
  return { new: totalNew, skipped: totalSeen };
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[pubmed] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Direct CLI execution
if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
