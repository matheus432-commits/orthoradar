// Hybrid recommendation engine.
//
// Scoring model:
//   personalizedScore = baseScore * (1 - w) + behaviorMatch * 100 * w
//
// where w (personalization weight) scales with profile confidence:
//   cold start user  (< 3 interactions):  w = 0.0  → pure algorithm
//   warming          (3-10):              w = 0.25
//   learning         (10-30):             w = 0.50
//   established      (30+):               w = 0.65
//
// behaviorMatch = themeAffinity * 0.45 + evidenceAffinity * 0.30 + journalAffinity * 0.25

const { computeCuratedScore }   = require('./digest-ranking');
const { affinityScore }         = require('./behavior-scoring');
const { profileConfidence }     = require('./user-profile');
const { detectFatigue, getOptimalDigestSize } = require('./fatigue-detection');

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Computes behavioral affinity score 0.0–1.0 for one article against a user profile.
 */
function behaviorMatch(article, profile) {
  if (!profile) return 0.5;

  const tAff = affinityScore(article.tema             || '', profile.favoriteThemes    || {});
  const eAff = affinityScore(article.nivel_evidencia  || '', profile.preferredEvidence || {});
  const jAff = affinityScore(article.journal          || '', profile.preferredJournals  || {});

  return tAff * 0.45 + eAff * 0.30 + jAff * 0.25;
}

/**
 * Final personalized score for one article.
 * Higher = better candidate for inclusion in this user's digest.
 */
function scoreArticleForUser(article, profile) {
  const base  = computeCuratedScore(article);          // 0–~100
  const bm    = behaviorMatch(article, profile);       // 0–1
  const conf  = profileConfidence(profile);             // 0–1

  // Blend: as confidence grows, personal behavior matters more
  const personalWeight = conf * 0.65;                  // up to 65% personalization
  const baseWeight     = 1 - personalWeight;

  return base * baseWeight + bm * 100 * personalWeight;
}

// ── Selection ─────────────────────────────────────────────────────────────────

/**
 * Selects a personalized, diverse digest from candidate articles.
 *
 * Same diversity constraints as curateDigest but uses personalizedScore.
 * Respects adaptive digest size from the profile.
 *
 * @param {Array}  candidates — active articles (not yet sent to this user)
 * @param {Object} profile    — user behavioral profile (can be null for cold start)
 * @param {Object} opts       — { maxArticles, minArticles }
 * @returns {Array}  curated articles with _personalizedScore attached
 */
function recommendArticles(candidates, profile, opts = {}) {
  const maxArticles = opts.maxArticles ?? getOptimalDigestSize(profile || {});
  const minArticles = opts.minArticles ?? Math.min(3, maxArticles);

  if (!candidates.length) return [];

  const scored = candidates
    .map(a => ({ ...a, _ps: scoreArticleForUser(a, profile) }))
    .sort((a, b) => b._ps - a._ps);

  const temaCount    = {};
  const journalCount = {};

  function pick(list, maxPerTema, maxPerJournal) {
    const sel = [];
    for (const article of list) {
      if (sel.length >= maxArticles) break;
      const tema    = String(article.tema    || 'geral').toLowerCase().trim();
      const journal = String(article.journal || '').toLowerCase().trim();

      if ((temaCount[tema]    || 0) >= maxPerTema)                          continue;
      if (journal && (journalCount[journal] || 0) >= maxPerJournal
          && sel.length >= minArticles)                                      continue;

      sel.push(article);
      temaCount[tema]    = (temaCount[tema]    || 0) + 1;
      if (journal) journalCount[journal] = (journalCount[journal] || 0) + 1;
    }
    return sel;
  }

  // Try strict constraints first, relax if needed
  for (const [mpt, mpj] of [[2, 1], [3, 2], [5, 5]]) {
    Object.keys(temaCount).forEach(k => delete temaCount[k]);
    Object.keys(journalCount).forEach(k => delete journalCount[k]);
    const result = pick(scored, mpt, mpj);
    if (result.length >= minArticles) return result;
  }

  return scored.slice(0, maxArticles); // last resort: top N by score
}

/**
 * Explains why an article was selected (useful for admin/debugging).
 */
function explainScore(article, profile) {
  const conf = profileConfidence(profile);
  const bm   = behaviorMatch(article, profile);
  const base = computeCuratedScore(article);
  return {
    base_score:          parseFloat(base.toFixed(1)),
    behavior_match:      parseFloat(bm.toFixed(3)),
    profile_confidence:  parseFloat(conf.toFixed(2)),
    personalized_score:  parseFloat(scoreArticleForUser(article, profile).toFixed(1)),
    theme_affinity:      affinityScore(article.tema || '', profile?.favoriteThemes   || {}),
    evidence_affinity:   affinityScore(article.nivel_evidencia || '', profile?.preferredEvidence || {}),
    journal_affinity:    affinityScore(article.journal || '', profile?.preferredJournals || {}),
  };
}

module.exports = { recommendArticles, scoreArticleForUser, behaviorMatch, explainScore };
