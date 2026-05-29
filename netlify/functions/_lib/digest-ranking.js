// Curation algorithm for daily digest.
// Scores articles with a multi-factor model and selects a diverse subset
// that maximises engagement while avoiding redundancy.

const EVIDENCE_WEIGHT = {
  'Meta-análise':        25,
  'Revisão Sistemática': 22,
  'RCT':                 20,
  'Estudo Coorte':       12,
  'Revisão Narrativa':    8,
  'Caso Clínico':         5,
  'In Vitro':             4,
  'Estudo Animal':        3,
};

function recencyScore(dataStr) {
  if (!dataStr) return 0;
  const ageDays = (Date.now() - new Date(dataStr).getTime()) / (24 * 3600 * 1000);
  if (ageDays <  7)  return 20;
  if (ageDays < 30)  return 15;
  if (ageDays < 60)  return 10;
  if (ageDays < 90)  return  7;
  if (ageDays < 180) return  4;
  return 1;
}

function engagementScore(article) {
  const c = article.curtidas      || 0;
  const k = article.emailCliques  || 0;
  const l = article.leituras      || 0;
  return Math.min(20, c * 3 + k * 2 + l * 0.3);
}

// Composite curation score — higher = better candidate for digest
function computeCuratedScore(article) {
  return (
    (article.relevanceScore || 50) * 0.35 +          // 0–35
    (EVIDENCE_WEIGHT[article.nivel_evidencia] || 5) * 0.9 + // 0–22.5
    recencyScore(article.data) +                       // 0–20
    (article.isOpenAccess ? 12 : 0) +                  // 0 or 12
    (article.qualidadeIA || 0.5) * 10 +                // 0–10
    engagementScore(article)                           // 0–20
  );
}

/**
 * Selects up to maxArticles from candidates applying diversity constraints.
 *
 * Diversity rules (in priority order):
 *   1. Max 2 articles per tema
 *   2. Max 1 article per journal when digest has ≥ 3 articles
 *   3. Prefer high-evidence over low-evidence
 *
 * If strict constraints prevent reaching MIN_ARTICLES, constraints are
 * relaxed progressively until the minimum is met.
 *
 * @param {Array}  candidates  - article objects (must already have status="active")
 * @param {number} maxArticles - upper bound, usually 5
 * @param {number} minArticles - lower bound, usually 3
 * @returns {Array} curated selection sorted by score descending
 */
function curateDigest(candidates, maxArticles = 5, minArticles = 3) {
  if (!candidates.length) return [];

  const scored = candidates
    .map(a => ({ ...a, _cs: computeCuratedScore(a) }))
    .sort((a, b) => b._cs - a._cs);

  function pickWithConstraints(list, maxPerTema, maxPerJournal) {
    const selected     = [];
    const temaCount    = {};
    const journalCount = {};

    for (const article of list) {
      if (selected.length >= maxArticles) break;

      const tema    = String(article.tema    || 'geral').toLowerCase().trim();
      const journal = String(article.journal || '').toLowerCase().trim();

      if ((temaCount[tema]    || 0) >= maxPerTema)                       continue;
      if (journal && (journalCount[journal] || 0) >= maxPerJournal
          && selected.length >= minArticles)                             continue;

      selected.push(article);
      temaCount[tema]       = (temaCount[tema]    || 0) + 1;
      if (journal) journalCount[journal] = (journalCount[journal] || 0) + 1;
    }
    return selected;
  }

  // Try strictest constraints first; relax progressively if minArticles not reached.
  // NOTE: indexOf() with object literals always returns -1 (reference equality),
  // so the last-attempt check must use an index-based loop.
  const attempts = [
    { maxPerTema: 2, maxPerJournal: 1 },
    { maxPerTema: 3, maxPerJournal: 2 },
    { maxPerTema: 5, maxPerJournal: 5 },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { maxPerTema, maxPerJournal } = attempts[i];
    const result = pickWithConstraints(scored, maxPerTema, maxPerJournal);
    // Return when we have enough articles OR on the last attempt (accept whatever we have)
    if (result.length >= minArticles || i === attempts.length - 1) {
      return result;
    }
  }

  // Final fallback: top N by score, no diversity constraints
  return scored.slice(0, maxArticles);
}

module.exports = { curateDigest, computeCuratedScore, recencyScore, engagementScore };
