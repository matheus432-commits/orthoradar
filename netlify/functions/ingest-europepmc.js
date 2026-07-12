// Europe PMC ingestion — complements PubMed with PMC-indexed articles.
// Advantage over PubMed: explicit isOpenAccess flag and full-text links.
// Deduplicates against Firestore; saves with status "pending_enrichment".
//
// API docs: https://europepmc.org/RestfulWebService

const { Firestore }       = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { detectEvidenceLevel, classifySpecialty } = require('./_lib/scoring');
const log                 = require('./_lib/logger');
const { request }         = require('./_lib');

const HOST = 'www.ebi.ac.uk';

// ── Query strategy ────────────────────────────────────────────────────────────
// Europe PMC supports free-text + field queries.
// We target Open Access articles to ensure readers can access full papers.
const SPECIALTY_QUERIES = [
  { specialty: 'Ortodontia',      query: 'orthodontics AND (MeSH:orthodontics OR MeSH:"malocclusion")' },
  { specialty: 'Implantodontia',  query: '"dental implants" OR "dental implant"' },
  { specialty: 'Periodontia',     query: 'periodontics OR periodontitis OR "periodontal disease"' },
  { specialty: 'Endodontia',      query: 'endodontics OR "root canal treatment" OR "pulp therapy"' },
  { specialty: 'Dentística',      query: '"dental caries" OR "composite resin" OR "tooth bleaching"' },
  { specialty: 'Prótese',         query: 'prosthodontics OR "dental prosthesis" OR "fixed partial denture" OR "complete denture" OR "removable partial denture" OR "dental crown" OR zirconia' },
  { specialty: 'Cirurgia',        query: '"oral surgery" OR "orthognathic surgery" OR "tooth extraction"' },
  { specialty: 'Odontopediatria', query: '"pediatric dentistry" OR "child oral health"' },
  { specialty: 'Saúde Pública',   query: '"oral health" AND (epidemiology OR "public health")' },
];

// ── Europe PMC search ─────────────────────────────────────────────────────────

async function searchEuropePMC(query, specialty, pageSize = 12) {
  // Date range: last 90 days
  const fromDate = new Date(Date.now() - 90 * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0]
    .replace(/-/g, '/');

  const fullQuery = encodeURIComponent(
    `(${query}) AND FIRST_PDATE:[${fromDate} TO *] AND LANG:eng AND (SRC:MED OR SRC:PMC)`
  );
  const path = (
    `/europepmc/webservices/rest/search?query=${fullQuery}` +
    `&resultType=core&pageSize=${pageSize}&format=json&sort=P_PDATE_D%20desc`
  );

  const res = await request({ hostname: HOST, path, method: 'GET' }, null);
  if (res.status !== 200) {
    log.warn('[europepmc] search failed', { status: res.status, specialty });
    return [];
  }

  const json     = JSON.parse(res.body);
  const results  = json.resultList?.result || [];
  return results
    .filter(r => r.pmid || r.doi)
    .map(r => parseResult(r, specialty));
}

function parseResult(r, specialty) {
  // Authors
  const authors = [];
  if (r.authorList?.author) {
    const auList = Array.isArray(r.authorList.author)
      ? r.authorList.author
      : [r.authorList.author];
    auList.slice(0, 3).forEach(a => {
      const name = a.lastName || a.fullName || '';
      if (name) authors.push(name);
    });
    if (auList.length > 3) authors.push('et al.');
  }

  // Open access: Europe PMC has explicit field
  const isOpenAccess = r.isOpenAccess === 'Y' || r.inEPMC === 'Y';

  // PMCID for full-text link
  const pmcid = r.pmcid || null;
  const url   = pmcid
    ? `https://europepmc.org/article/PMC/${pmcid.replace('PMC', '')}`
    : r.pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`
      : (r.doi ? `https://doi.org/${r.doi}` : '');

  const abstract = (r.abstractText || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const title    = (r.title       || '').replace(/<[^>]+>/g, '').trim();
  const journal  = r.journalTitle || r.bookOrReportDetails?.publisher || '';

  const year = r.pubYear ? parseInt(r.pubYear, 10)
    : r.firstPublicationDate ? parseInt(r.firstPublicationDate.slice(0, 4), 10)
    : null;

  return {
    pmid:         r.pmid   ? String(r.pmid) : null,
    doi:          r.doi    || null,
    pmcid:        pmcid    || null,
    title,
    abstract,
    journal,
    year,
    autores:      authors,
    isOpenAccess: Boolean(isOpenAccess),
    fonte:        'europepmc',
    url,
    _specialty:   specialty,
  };
}

// ── Save to Firestore ─────────────────────────────────────────────────────────

async function saveArticle(db, article) {
  const id = article.pmid || ('doi_' + (article.doi || '').replace(/[^a-zA-Z0-9]/g, '_'));
  if (!id || id === 'doi_') {
    log.warn('[europepmc] no usable ID, skipping');
    return false;
  }

  if (!article.title || !article.abstract || article.abstract.length < 50) {
    log.warn('[europepmc] skipping — insufficient content', {
      id,
      hasTitle:    !!article.title,
      abstractLen: article.abstract?.length ?? 0,
    });
    return false;
  }

  const nivel_evidencia = detectEvidenceLevel(article.title, article.abstract);
  const especialidade   = article._specialty || classifySpecialty(article.title, article.abstract) || 'Odontologia Geral';

  const doc = {
    pmid:         article.pmid    || null,
    doi:          article.doi     || null,
    pmcid:        article.pmcid   || null,
    titulo:       article.title   || '',
    abstract:     (article.abstract || '').slice(0, 2000),
    journal:      article.journal || '',
    year:         article.year    || null,
    autores:      article.autores || [],
    isOpenAccess: article.isOpenAccess || false,
    fonte:        'europepmc',
    url:          article.url     || '',
    pubmedUrl:    article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : (article.url || null),
    especialidade,
    nivel_evidencia,
    status:       'pending_enrichment',
    criadoEm:     new Date().toISOString(),
    data:         new Date().toISOString(),
    curtidas:     0,
    leituras:     0,
    ativo:        true,
  };

  const created = await db.createDoc('artigos', id, doc);
  if (created === false) {
    log.debug('[europepmc] already exists', { id });
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[europepmc] FIREBASE_API_KEY not set'); process.exit(1); }

  const db     = new Firestore(projectId, apiKey);
  const start  = Date.now();
  let totalNew = 0;
  let totalDup = 0;

  for (const { specialty, query } of SPECIALTY_QUERIES) {
    log.info('[europepmc] searching', { specialty });

    let results;
    try {
      results = await searchEuropePMC(query, specialty);
    } catch (err) {
      log.error('[europepmc] search error', { specialty, err: err.message });
      continue;
    }

    if (!results.length) {
      log.info('[europepmc] no results', { specialty });
      continue;
    }

    // Pre-filter by PMID against Firestore
    const pmids       = results.filter(r => r.pmid).map(r => r.pmid);
    const existingSet = pmids.length ? await db.existingPmids(pmids).catch(() => new Set()) : new Set();
    const candidates  = results.filter(r => !r.pmid || !existingSet.has(r.pmid));

    for (const article of candidates) {
      try {
        const saved = await saveArticle(db, article);
        if (saved) {
          totalNew++;
          log.info('[europepmc] saved', { id: article.pmid || article.doi, specialty });
        } else {
          totalDup++;
        }
      } catch (err) {
        log.error('[europepmc] save error', { err: err.message });
      }
      await new Promise(r => setTimeout(r, 50));
    }

    // Respect EBI rate limits (~10 req/s safe)
    await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  log.info('[europepmc] ingestion complete', { new: totalNew, skipped: totalDup, elapsed_s: elapsed });
  return { new: totalNew, skipped: totalDup };
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[europepmc] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
