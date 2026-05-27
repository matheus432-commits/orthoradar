// Related knowledge engine — connects articles by tema, specialty,
// evidence level, journal, keyword overlap, and behavioral affinity.
// All deterministic. No vector DB or paid embeddings.

const { tokenize } = require('./semantic-ranking');
const { affinityScore } = require('./behavior-scoring');

// Evidence rank (higher = stronger)
const EV_RANK = {
  'Meta-análise':        6,
  'Revisão Sistemática': 5,
  'RCT':                 4,
  'Estudo Coorte':       3,
  'Revisão Narrativa':   2,
  'Caso Clínico':        1,
  'In Vitro':            1,
  'Estudo Animal':       0,
};

/**
 * Computes relatedness between two articles (0–100).
 * Weights: tema 35, specialty 20, evidence 15, journal 10, keyword 10, behavior 10.
 *
 * @returns {{ score, reason }}
 */
function computeRelatedness(a, b, profile = null) {
  let score = 0;
  const flags = {};

  // tema overlap (35%)
  if (a.tema && b.tema) {
    if (a.tema === b.tema) { score += 35; flags.tema = a.tema; }
    else if (
      a.tema.toLowerCase().includes(b.tema.toLowerCase()) ||
      b.tema.toLowerCase().includes(a.tema.toLowerCase())
    ) { score += 20; flags.temaPartial = true; }
  }

  // especialidade (20%)
  if (a.especialidade && b.especialidade) {
    if (a.especialidade === b.especialidade) { score += 20; flags.spec = a.especialidade; }
    else score += 3;
  }

  // evidence tier proximity (15%)
  const aEv = EV_RANK[a.nivel_evidencia] ?? 2;
  const bEv = EV_RANK[b.nivel_evidencia] ?? 2;
  const evDiff = Math.abs(aEv - bEv);
  if (evDiff === 0) { score += 15; flags.evMatch = true; }
  else if (evDiff === 1) score += 10;
  else if (evDiff === 2) score += 4;

  // journal match (10%)
  if (a.journal && b.journal && a.journal === b.journal) { score += 10; flags.journal = a.journal; }

  // keyword overlap (10%) — from title + theme tokens
  const aTokens = tokenize([(a.titulo_pt || a.titulo || ''), (a.tema || ''), (a.resumo_pt || a.resumo || '').slice(0, 200)].join(' '));
  const bTokens = tokenize([(b.titulo_pt || b.titulo || ''), (b.tema || ''), (b.resumo_pt || b.resumo || '').slice(0, 200)].join(' '));
  const aSet    = new Set(aTokens);
  const overlap = bTokens.filter(t => aSet.has(t)).length;
  score += Math.min(10, Math.floor(overlap * 1.5));

  // behavioral affinity (10%)
  if (profile) {
    const aAff = affinityScore(a.tema || '', profile.favoriteThemes || {});
    const bAff = affinityScore(b.tema || '', profile.favoriteThemes || {});
    if (aAff > 0.5 && bAff > 0.5) score += 10;
    else if (aAff > 0.3 && bAff > 0.3) score += 5;
  }

  return { score: Math.min(100, score), reason: buildReason(a, b, flags) };
}

function buildReason(a, b, flags) {
  const parts = [];
  if (flags.tema)        parts.push(`tema ${flags.tema}`);
  if (flags.spec)        parts.push(flags.spec);
  if (flags.evMatch)     parts.push(`nível de evidência similar (${a.nivel_evidencia})`);
  if (flags.journal)     parts.push('mesmo periódico');
  if (flags.temaPartial) parts.push('tema relacionado');
  if (!parts.length) return 'Conteúdo relacionado.';
  return `Relacionado por ${parts.join(' + ')}.`;
}

/**
 * Ranks a list of articles by relatedness to a pivot.
 * Returns sorted array with { ...article, relatedness: { score, reason } }
 */
function rankRelatedArticles(pivot, articles, profile = null, limit = 8) {
  const pivotPmid = String(pivot.pmid || pivot.id || '');
  return articles
    .filter(a => String(a.pmid || a.id || '') !== pivotPmid)
    .map(a => ({ ...a, _rel: computeRelatedness(pivot, a, profile) }))
    .filter(a => a._rel.score >= 25)
    .sort((a, b) => b._rel.score - a._rel.score)
    .slice(0, limit)
    .map(({ _rel, ...rest }) => ({ ...rest, relatedness: _rel }));
}

/**
 * Groups articles into theme/specialty clusters sorted by size.
 */
function clusterArticles(articles) {
  const clusters = {};
  for (const a of articles) {
    const key = a.tema || a.especialidade || 'Geral';
    if (!clusters[key]) clusters[key] = [];
    clusters[key].push(a);
  }
  return Object.entries(clusters)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([label, items]) => ({ label, count: items.length, articles: items }));
}

module.exports = { computeRelatedness, rankRelatedArticles, clusterArticles };
