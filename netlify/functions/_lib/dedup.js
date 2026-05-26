// Deduplication helpers for the article ingestion pipeline.
// All checks are against the shared `artigos` Firestore collection.

const log = require('./logger');

/**
 * Given a list of candidate articles (each with .pmid and optionally .doi),
 * returns only those that are NOT yet in the artigos collection.
 *
 * @param {Firestore} db - Firestore client instance
 * @param {Array}     articles - raw article objects
 * @returns {Array}   new articles only
 */
async function filterNew(db, articles) {
  if (!articles.length) return [];

  const pmids = articles.map(a => String(a.pmid)).filter(Boolean);
  const dois  = articles.map(a => a.doi).filter(Boolean);

  // Check PMIDs in batch
  let existingByPmid = new Set();
  try {
    existingByPmid = await db.existingPmids(pmids);
  } catch (err) {
    log.warn('[dedup] existingPmids failed, proceeding without dedup', { err: err.message });
  }

  // DOI-based dedup (articles without PMID)
  let existingByDoi = new Set();
  if (dois.length) {
    try {
      for (let i = 0; i < dois.length; i += 30) {
        const batch = dois.slice(i, i + 30);
        const where = batch.length === 1
          ? { fieldFilter: { field: { fieldPath: 'doi' }, op: 'EQUAL', value: { stringValue: batch[0] } } }
          : { fieldFilter: { field: { fieldPath: 'doi' }, op: 'IN',    value: { arrayValue: { values: batch.map(d => ({ stringValue: d })) } } } };
        const docs = await db.query('artigos', {
          where,
          select: { fields: [{ fieldPath: 'doi' }] },
          limit:  30,
        });
        docs.forEach(d => d.doi && existingByDoi.add(d.doi));
      }
    } catch (err) {
      log.warn('[dedup] doi lookup failed', { err: err.message });
    }
  }

  const newArticles = articles.filter(a => {
    const pmid = String(a.pmid || '');
    if (pmid && existingByPmid.has(pmid)) return false;
    if (a.doi && existingByDoi.has(a.doi)) return false;
    return true;
  });

  log.info('[dedup] filter result', {
    total:    articles.length,
    existing: articles.length - newArticles.length,
    new:      newArticles.length,
  });

  return newArticles;
}

/**
 * Deduplicate within a list (same pmid appearing from multiple sources).
 * Keeps the first occurrence (PubMed preferred over EuropePMC over OpenAlex).
 */
function deduplicateList(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.pmid ? `pmid:${a.pmid}` : `doi:${a.doi}` || `title:${(a.title || '').slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { filterNew, deduplicateList };
