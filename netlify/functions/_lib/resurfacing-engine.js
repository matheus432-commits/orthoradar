// Resurfacing engine — lightweight spaced repetition for scientific memory.
// Selects saved/liked articles that are ready for review based on:
//   evidence strength, age, profile affinity, and user's recent activity.
//
// No SM-2 algorithm (no per-card scheduling state) — uses population-level
// heuristics that work without per-article timestamps.

const { affinityScore } = require('./behavior-scoring');

const HIGH_EV = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
const MED_EV  = new Set(['Estudo Coorte', 'Revisão Narrativa']);

// Evidence tier: 0.0–1.0
function evidenceTier(nivel) {
  if (HIGH_EV.has(nivel)) return 1.0;
  if (MED_EV.has(nivel))  return 0.5;
  return 0.2;
}

// Recency of article publication (not save date — best proxy available)
// Very new (< 30d): don't resurface yet; old (> 360d): resurface soon
function resurfacingUrgency(dataStr) {
  if (!dataStr) return 0.5;
  const ageDays = (Date.now() - new Date(dataStr).getTime()) / (24 * 3600 * 1000);
  if (ageDays < 30)  return 0.1;  // too new — not worth resurfacing
  if (ageDays < 90)  return 0.5;  // recently consumed — mild urgency
  if (ageDays < 180) return 0.8;  // 3–6 months — prime resurfacing window
  if (ageDays < 365) return 0.9;  // 6–12 months — high urgency
  return 1.0;                      // > 1 year — resurface now
}

// Profile affinity (how much this article matches user preferences)
function articleAffinity(article, profile) {
  if (!profile) return 0.5;
  const tAff = affinityScore(article.tema             || '', profile.favoriteThemes    || {});
  const eAff = affinityScore(article.nivel_evidencia  || '', profile.preferredEvidence || {});
  return tAff * 0.6 + eAff * 0.4;
}

/**
 * Computes a resurfacing priority score (0–100) for one article.
 *
 * Higher score = should be resurfaced sooner.
 * Weights:
 *   evidence strength  30 %
 *   resurfacing urgency 40 %
 *   profile affinity   30 %
 */
function computeResurfacingScore(article, profile) {
  const ev      = evidenceTier(article.nivel_evidencia) * 30;
  const urgency = resurfacingUrgency(article.data) * 40;
  const affinity = articleAffinity(article, profile) * 30;
  return parseFloat((ev + urgency + affinity).toFixed(1));
}

/**
 * Selects articles ready for memory resurfacing.
 *
 * @param {Array}  articles      — enriched article objects (already saved/liked by user)
 * @param {Object} profile       — user behavioral profile (can be null)
 * @param {Object} opts
 *   limit     {number}  — max articles to return (default 5)
 *   minScore  {number}  — minimum resurfacing score threshold (default 20)
 * @returns {Array} — articles with _resurfaceScore, _ageLabel, sorted by score DESC
 */
function selectResurfacingCandidates(articles, profile, opts = {}) {
  const limit   = opts.limit    ?? 5;
  const minScore = opts.minScore ?? 20;

  return articles
    .map(a => ({
      ...a,
      _resurfaceScore: computeResurfacingScore(a, profile),
    }))
    .filter(a => a._resurfaceScore >= minScore)
    .sort((a, b) => b._resurfaceScore - a._resurfaceScore)
    .slice(0, limit)
    .map(a => {
      const ageDays = a.data
        ? Math.floor((Date.now() - new Date(a.data).getTime()) / (24 * 3600 * 1000))
        : null;
      const ageLabel = ageDays === null ? null
        : ageDays < 30  ? 'Publicado este mês'
        : ageDays < 90  ? 'Publicado há ~3 meses'
        : ageDays < 180 ? `Publicado há ~${Math.round(ageDays / 30)} meses`
        : ageDays < 365 ? 'Publicado há ~6 a 12 meses'
        : `Publicado há mais de 1 ano`;

      const { _resurfaceScore, ...rest } = a;
      return {
        ...rest,
        resurfaceScore: _resurfaceScore,
        ageLabel,
        resurfaceReason: buildResurfaceReason(a, profile),
      };
    });
}

function buildResurfaceReason(article, profile) {
  const ageDays = article.data
    ? Math.floor((Date.now() - new Date(article.data).getTime()) / (24 * 3600 * 1000))
    : null;

  if (HIGH_EV.has(article.nivel_evidencia)) {
    return `Alta evidência (${article.nivel_evidencia}) — vale revisar.`;
  }
  if (ageDays !== null && ageDays > 90) {
    const months = Math.round(ageDays / 30);
    return `Você salvou este estudo há ~${months} ${months === 1 ? 'mês' : 'meses'} — deseja revisitar?`;
  }
  if (profile && article.tema) {
    const aff = affinityScore(article.tema, profile.favoriteThemes || {});
    if (aff > 0.5) return `Relevante para o seu tema favorito: ${article.tema}.`;
  }
  return 'Conteúdo salvo aguardando revisão.';
}

module.exports = { selectResurfacingCandidates, computeResurfacingScore };
