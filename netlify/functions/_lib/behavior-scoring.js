// Behavioral signal processing — converts raw user interactions into
// normalized preference scores per tema, evidence level, and journal.
//
// Signal weights (higher = stronger interest signal):
//   like (curtido)  : 4.0  — explicit positive action
//   save            : 3.5  — intent to revisit
//   click (email)   : 3.0  — acted on the email CTA
//   read (lido)     : 1.5  — completed or skimmed the article
//   sent (baseline) : 0.1  — neutral, just received
//
// Recency decay: interactions in the last 30 days count fully;
// 30–90 days = 60%; > 90 days = 30%.

const SIGNAL_WEIGHT = {
  like:  4.0,
  save:  3.5,
  click: 3.0,
  read:  1.5,
  sent:  0.1,
};

function decayFactor(dateStr) {
  if (!dateStr) return 0.5;
  const ageDays = (Date.now() - new Date(dateStr).getTime()) / (24 * 3600 * 1000);
  if (ageDays < 30)  return 1.0;
  if (ageDays < 90)  return 0.6;
  if (ageDays < 180) return 0.3;
  return 0.1;
}

/**
 * Takes a list of enriched interaction records and builds weighted preference maps.
 *
 * @param {Array} interactions — each: { eventType, article, dateStr }
 *   article: { tema, nivel_evidencia, journal }
 * @returns {{ themes, evidence, journals }}
 *   Each map: key → normalized score 0.0–1.0
 */
function computePreferences(interactions) {
  const rawThemes   = {};
  const rawEvidence = {};
  const rawJournals = {};
  let   totalWeight = 0;

  for (const { eventType, article, dateStr } of interactions) {
    const w = (SIGNAL_WEIGHT[eventType] || 0.1) * decayFactor(dateStr);
    if (!w || !article) continue;

    if (article.tema) {
      rawThemes[article.tema]  = (rawThemes[article.tema]  || 0) + w;
    }
    if (article.nivel_evidencia) {
      rawEvidence[article.nivel_evidencia] = (rawEvidence[article.nivel_evidencia] || 0) + w;
    }
    if (article.journal) {
      rawJournals[article.journal] = (rawJournals[article.journal] || 0) + w;
    }
    totalWeight += w;
  }

  if (!totalWeight) return { themes: {}, evidence: {}, journals: {} };

  return {
    themes:   normalizeTopN(rawThemes,   totalWeight, 15),
    evidence: normalizeTopN(rawEvidence, totalWeight, 10),
    journals: normalizeTopN(rawJournals, totalWeight, 20),
  };
}

// Normalize scores to 0–1 range and keep only topN entries (to limit document size)
function normalizeTopN(raw, total, topN) {
  return Object.entries(raw)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .reduce((acc, [k, v]) => {
      acc[k] = parseFloat((v / total).toFixed(3));
      return acc;
    }, {});
}

/**
 * Builds the affinity score of a single article against a preference map.
 * Returns 0.0–1.0; defaults to 0.5 (neutral) when no data available.
 */
function affinityScore(value, preferenceMap) {
  if (!value || !preferenceMap || !Object.keys(preferenceMap).length) return 0.5;
  return preferenceMap[value] ?? 0.5;
}

module.exports = { computePreferences, affinityScore, SIGNAL_WEIGHT, decayFactor };
