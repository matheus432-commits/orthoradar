// Explanation engine — generates human-readable "Por que recomendamos" text.
// Returns 1-2 concise reasons why an article was selected for a specific user.

const { affinityScore } = require('./behavior-scoring');

// Threshold above which we consider a preference "strong"
const AFFINITY_HIGH = 0.55;

function engagementTotal(a) {
  return (a.emailCliques || 0) * 4 + (a.curtidas || 0) * 3 + (a.leituras || 0) * 0.5;
}

function ageDays(dateStr) {
  if (!dateStr) return 9999;
  return (Date.now() - new Date(dateStr).getTime()) / (24 * 3600 * 1000);
}

/**
 * Returns up to 2 reason strings explaining why this article was recommended.
 *
 * @param {Object} article — enriched article from Firestore
 * @param {Object} profile — user behavioral profile (may be null)
 * @returns {string[]}     — array of 1–2 short reason strings
 */
function explainRecommendation(article, profile) {
  const reasons = [];

  if (profile) {
    // Theme affinity
    const thAff = affinityScore(article.tema || '', profile.favoriteThemes || {});
    if (thAff > AFFINITY_HIGH && article.tema) {
      reasons.push(`Compatível com seu interesse em ${article.tema}`);
    }

    // Evidence affinity
    const evAff = affinityScore(article.nivel_evidencia || '', profile.preferredEvidence || {});
    if (evAff > AFFINITY_HIGH && article.nivel_evidencia) {
      reasons.push(`Nível de evidência que você costuma ler: ${article.nivel_evidencia}`);
    }

    // Journal affinity
    const jAff = affinityScore(article.journal || '', profile.preferredJournals || {});
    if (jAff > AFFINITY_HIGH && article.journal && reasons.length < 2) {
      reasons.push(`Publicado em ${article.journal}, periódico frequente no seu histórico`);
    }
  }

  // High clinical impact (from Claude enrichment)
  if (reasons.length < 2 && article.impacto_pratico) {
    reasons.push('Alto impacto para a prática clínica');
  }

  // Peer engagement signal
  const eng = engagementTotal(article);
  if (reasons.length < 2 && eng >= 5) {
    const n = Math.round(eng / 3);
    reasons.push(`Lido por ${n}+ colegas dentistas recentemente`);
  }

  // Recency signal
  const age = ageDays(article.data);
  if (reasons.length < 2 && age <= 14) {
    reasons.push('Publicado há menos de duas semanas');
  }

  // High evidence fallback
  const highEv = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
  if (reasons.length < 1 && highEv.has(article.nivel_evidencia)) {
    reasons.push(`Alta qualidade de evidência — ${article.nivel_evidencia}`);
  }

  // Generic fallback
  if (!reasons.length) {
    reasons.push('Relevante para a sua especialidade');
  }

  return reasons.slice(0, 2);
}

/**
 * Same as explainRecommendation but returns a single descriptive sentence.
 */
function explainOneLiner(article, profile) {
  const [primary] = explainRecommendation(article, profile);
  return primary || 'Relevante para a sua especialidade';
}

module.exports = { explainRecommendation, explainOneLiner };
