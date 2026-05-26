// User behavioral profile — builds, caches, and retrieves per-user preference profiles.
// Profiles are stored in Firestore collection `user_profiles/{email}`.
// Recomputed daily by update-user-profile.js.

const { computePreferences }                   = require('./behavior-scoring');
const { analyzeDigestHistory, detectFatigue, getOptimalDigestSize } = require('./fatigue-detection');
const log                                       = require('./logger');

const PROFILE_COLLECTION = 'user_profiles';
const CACHE_TTL_MS       = 25 * 60 * 60 * 1000; // 25h — never stale during a run

// ── Article metadata batch loader ─────────────────────────────────────────────

async function batchFetchArticleMetadata(db, pmids) {
  const unique = [...new Set(pmids.map(String).filter(Boolean))];
  if (!unique.length) return {};

  const metaMap = {};

  // Batch into groups of 30 (Firestore IN limit)
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30);
    try {
      const docs = await db.query('artigos', {
        where:  batch.length === 1
          ? { fieldFilter: { field: { fieldPath: 'pmid' }, op: 'EQUAL', value: { stringValue: batch[0] } } }
          : { fieldFilter: { field: { fieldPath: 'pmid' }, op: 'IN',    value: { arrayValue: { values: batch.map(p => ({ stringValue: p })) } } } },
        select: { fields: [
          { fieldPath: 'pmid' },
          { fieldPath: 'tema' },
          { fieldPath: 'nivel_evidencia' },
          { fieldPath: 'journal' },
        ]},
        limit:  30,
      });
      docs.forEach(d => { if (d.pmid) metaMap[String(d.pmid)] = d; });
    } catch (err) {
      // Also try direct getDoc fallback
      for (const pmid of batch) {
        try {
          const doc = await db.getDoc('artigos', pmid);
          if (doc) metaMap[pmid] = doc;
        } catch {}
      }
    }
  }
  return metaMap;
}

// ── Engagement metrics from digest history ────────────────────────────────────

async function loadRecentDigests(db, email, limitDays = 90) {
  const cutoff = new Date(Date.now() - limitDays * 24 * 3600 * 1000).toISOString();
  try {
    return await db.query('digests', {
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'email'     }, op: 'EQUAL',                value: { stringValue: email } } },
            { fieldFilter: { field: { fieldPath: 'enviadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
          ],
        },
      },
      orderBy: [{ field: { fieldPath: 'enviadoEm' }, direction: 'DESCENDING' }],
      limit: 60,
    });
  } catch (err) {
    log.warn('[user-profile] loadRecentDigests fallback', { email, err: err.message });
    // Fallback: no orderBy
    try {
      const docs = await db.query('digests', {
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
        limit: 60,
      });
      return docs.sort((a, b) => (b.enviadoEm || '') > (a.enviadoEm || '') ? 1 : -1);
    } catch { return []; }
  }
}

// ── Profile computation ───────────────────────────────────────────────────────

/**
 * Builds a fresh behavioral profile for one user.
 * Call once per day per user from update-user-profile.js.
 *
 * @param {Object} user — full user document (has curtidos, lidos, email, etc.)
 * @param {Firestore} db
 * @returns {Object} profile ready to persist
 */
async function buildProfile(user, db) {
  const email    = user.email;
  const curtidos = Array.isArray(user.curtidos) ? user.curtidos.filter(Boolean) : [];
  const lidos    = Array.isArray(user.lidos)    ? user.lidos.filter(Boolean)    : [];
  const savedos  = Array.isArray(user.salvos)   ? user.salvos.filter(Boolean)   : [];

  // 1. Batch-fetch article metadata for interacted articles
  const allPmids  = [...new Set([...curtidos, ...lidos, ...savedos])];
  const metaMap   = await batchFetchArticleMetadata(db, allPmids);

  // 2. Build interaction list with weights
  const interactions = [];
  const addInteractions = (pmids, eventType) => {
    for (const pmid of pmids) {
      const article = metaMap[String(pmid)];
      if (article) interactions.push({ eventType, article, dateStr: null }); // no date = neutral decay
    }
  };
  addInteractions(curtidos, 'like');
  addInteractions(savedos,  'save');
  addInteractions(lidos,    'read');

  const { themes, evidence, journals } = computePreferences(interactions);

  // 3. Load digest history for engagement metrics
  const recentDigests = await loadRecentDigests(db, email);
  const engagement    = analyzeDigestHistory(recentDigests);

  // 4. Compute composite engagement score
  const engagementScore = parseFloat((
    engagement.openRate   * 0.45 +
    engagement.ctr        * 0.40 +
    Math.min(1, (curtidos.length + savedos.length) / 20) * 0.15
  ).toFixed(3));

  // 5. Fatigue detection
  const fatigueInput = {
    consecutiveIgnored: engagement.consecutiveIgnored,
    openRate:           engagement.openRate,
    engagementScore,
  };
  const fatigue         = detectFatigue(fatigueInput);
  const idealDigestSize = getOptimalDigestSize({ ctr: engagement.ctr, ...fatigueInput });

  // 6. Determine anchor day of week (for weekly sends)
  const anchorDow = recentDigests.length
    ? new Date(recentDigests[recentDigests.length - 1].enviadoEm || Date.now()).getDay()
    : 1;

  return {
    email,
    favoriteThemes:     themes,
    preferredEvidence:  evidence,
    preferredJournals:  journals,
    engagementScore,
    openRate:           engagement.openRate,
    ctr:                engagement.ctr,
    bestOpenHour:       engagement.bestOpenHour,
    idealDigestSize,
    consecutiveIgnored: engagement.consecutiveIgnored,
    fatigueLevel:       fatigue.fatigueScore,
    fatigueAction:      fatigue.action,
    shouldSend:         fatigue.action !== 'pause',
    emailFrequency:     fatigue.action === 'send_weekly' ? 'weekly' : 'daily',
    anchorDow,
    totalInteractions:  allPmids.length,
    totalDigestsSent:   engagement.totalSent,
    updatedAt:          new Date().toISOString(),
  };
}

// ── Profile cache/load ────────────────────────────────────────────────────────

let _memoryCache = {};  // in-process cache to avoid duplicate reads during one run

/**
 * Gets the cached profile for a user. Returns null if not found or stale.
 */
async function getProfile(email, db) {
  if (_memoryCache[email] && Date.now() - _memoryCache[email]._loadedAt < CACHE_TTL_MS) {
    return _memoryCache[email];
  }
  try {
    const profile = await db.getDoc(PROFILE_COLLECTION, email);
    if (profile) {
      _memoryCache[email] = { ...profile, _loadedAt: Date.now() };
      return profile;
    }
  } catch (err) {
    log.warn('[user-profile] getProfile failed', { email, err: err.message });
  }
  return null;
}

/**
 * Persists a profile to Firestore.
 */
async function saveProfile(profile, db) {
  await db.setDoc(PROFILE_COLLECTION, profile.email, profile);
  _memoryCache[profile.email] = { ...profile, _loadedAt: Date.now() };
}

/**
 * Returns true if a profile confidence is high enough for personalization.
 * Falls back to pure algorithm for new users.
 */
function profileConfidence(profile) {
  if (!profile) return 0;
  const n = profile.totalInteractions || 0;
  if (n < 3)  return 0.0;   // cold start
  if (n < 10) return 0.3;   // warming
  if (n < 30) return 0.65;  // learning
  if (n < 60) return 0.85;  // confident
  return 1.0;                // established
}

module.exports = { buildProfile, getProfile, saveProfile, profileConfidence };
