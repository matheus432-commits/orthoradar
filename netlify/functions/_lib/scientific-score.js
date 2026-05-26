// Scientific score engine — computes a 0-100 score and reading streak
// from a user behavioral profile + recent digests.

// Evidence levels ordered from highest to lowest quality
const EVIDENCE_QUALITY_RANK = {
  'Meta-análise':        1.00,
  'Revisão Sistemática': 0.88,
  'RCT':                 0.75,
  'Estudo Coorte':       0.55,
  'Revisão Narrativa':   0.35,
  'Caso Clínico':        0.20,
  'In Vitro':            0.12,
  'Estudo Animal':       0.08,
};

const HIGH_EVIDENCE = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);

/**
 * Computes scientificScore 0–100 and its four sub-components.
 *
 * Volume (0-25)     — breadth of reading (log scale)
 * Consistency (0-25)— open rate + engagement regularity
 * Diversity (0-25)  — variety of themes and evidence levels consumed
 * Quality (0-25)    — proportion of high-evidence articles read
 */
function computeScientificScore(profile) {
  if (!profile) return { total: 0, volume: 0, consistency: 0, diversity: 0, quality: 0 };

  // Volume: totalInteractions, log2 scale; 64 interactions → max
  const n = profile.totalInteractions || 0;
  const volume = Math.min(25, Math.round((Math.log2(1 + n) / Math.log2(65)) * 25));

  // Consistency: openRate (60%) + engagementScore (40%)
  const consistency = Math.min(25, Math.round(
    ((profile.openRate || 0) * 0.60 + (profile.engagementScore || 0) * 0.40) * 25
  ));

  // Diversity: distinct evidence levels (max 5) + capped theme breadth
  const evidenceLevels = Object.keys(profile.preferredEvidence || {}).length;
  const themeCount     = Object.keys(profile.favoriteThemes    || {}).length;
  const diversity = Math.min(25, Math.round(
    Math.min(5, evidenceLevels) * 3.0 +
    Math.min(8, themeCount)    * 1.25
  ));

  // Quality: weighted average evidence quality from preferredEvidence map
  const ev        = profile.preferredEvidence || {};
  const evEntries = Object.entries(ev);
  let   totalW    = 0, highW = 0;
  for (const [level, weight] of evEntries) {
    const q = EVIDENCE_QUALITY_RANK[level] ?? 0.1;
    highW  += weight * q;
    totalW += weight;
  }
  const qualityRatio = totalW > 0 ? highW / totalW : 0;
  const quality = Math.min(25, Math.round(qualityRatio * 25));

  return {
    total:       volume + consistency + diversity + quality,
    volume,
    consistency,
    diversity,
    quality,
  };
}

/**
 * Computes reading streak in weeks.
 * A week counts if the user opened at least one digest that week.
 */
function computeReadingStreak(recentDigests) {
  if (!recentDigests || !recentDigests.length) return 0;

  const openedWeekKeys = new Set();
  for (const d of recentDigests) {
    if ((d.aberturas || 0) > 0 && d.enviadoEm) {
      openedWeekKeys.add(weekKey(new Date(d.enviadoEm)));
    }
  }

  let streak = 0;
  let cursor = weekKey(new Date()); // current week
  // Allow current week to be incomplete (don't penalise)
  if (openedWeekKeys.has(cursor)) { streak++; }
  // Walk back week by week
  for (let i = 1; i <= 52; i++) {
    const prev = weekKeyOffset(i);
    if (openedWeekKeys.has(prev)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ISO week string "YYYY-Www"
function weekKey(date) {
  const d  = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Thursday of ISO week
  const year = d.getFullYear();
  const week = Math.ceil(((d - new Date(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekKeyOffset(weeksBack) {
  const d = new Date();
  d.setDate(d.getDate() - weeksBack * 7);
  return weekKey(d);
}

/**
 * Formats top N themes/evidence as ranked arrays for API responses.
 */
function topEntries(map, n = 5) {
  return Object.entries(map || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([label, weight]) => ({ label, weight: parseFloat(weight.toFixed(3)) }));
}

module.exports = { computeScientificScore, computeReadingStreak, topEntries, EVIDENCE_QUALITY_RANK, HIGH_EVIDENCE };
