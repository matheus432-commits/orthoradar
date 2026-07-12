// Engagement fatigue detection and adaptive delivery strategy.
// Analyzes digest open/click history to determine how to adapt delivery
// for each user without explicitly asking them.

// ── Thresholds ────────────────────────────────────────────────────────────────

const THRESHOLDS = {
  IGNORE_WEEKLY:   7,   // consecutive ignored → switch to weekly
  IGNORE_PAUSE:    14,  // consecutive ignored → pause sending
  MIN_OPEN_RATE:   0.05, // below this → reduce frequency
  HIGH_OPEN_RATE:  0.50, // above this → user is engaged
  LOW_CTR:         0.10, // below this → reduce digest size
  HIGH_CTR:        0.35, // above this → increase digest size
};

/**
 * Analyzes a list of recent digest objects and returns engagement summary.
 * Digests must be sorted newest-first.
 *
 * @param {Array}  recentDigests  — last N digest docs from Firestore
 * @returns {Object} engagement summary
 */
function analyzeDigestHistory(recentDigests) {
  if (!recentDigests.length) {
    return {
      openRate:             0.5,
      ctr:                  0.2,
      consecutiveIgnored:   0,
      totalSent:            0,
      avgArticlesPerDigest: 4,
      bestOpenHour:         7,
      lastOpenAt:           null,
    };
  }

  let totalOpens  = 0;
  let totalClicks = 0;
  let totalSent   = recentDigests.length;
  let consecutive = 0;         // unopened from the most recent
  let hitOpened   = false;
  let lastOpenAt  = null;
  const hourCounts = new Array(24).fill(0);

  for (const digest of recentDigests) {
    const opened  = (digest.aberturas  || 0) > 0;
    const clicked = (digest.cliques    || 0) > 0;

    if (opened)  totalOpens++;
    if (clicked) totalClicks++;

    // Count consecutive ignored from newest
    if (!hitOpened) {
      if (!opened) consecutive++;
      else         hitOpened = true;
    }

    // Track most recent open timestamp
    if (opened && digest.enviadoEm) {
      if (!lastOpenAt || digest.enviadoEm > lastOpenAt) lastOpenAt = digest.enviadoEm;
      const h = new Date(digest.enviadoEm).getUTCHours();
      hourCounts[h]++;
    }
  }

  const openRate = totalSent > 0 ? totalOpens / totalSent : 0.5;
  const ctr      = totalOpens > 0 ? totalClicks / totalOpens : 0.2;
  const avgArticles = recentDigests.reduce((s, d) => s + (d.pmids?.length || 4), 0) / totalSent;

  // Best open hour: peak of hourCounts (default 7 AM UTC if no data)
  const bestOpenHour = hourCounts.indexOf(Math.max(...hourCounts));

  return {
    openRate:             parseFloat(openRate.toFixed(3)),
    ctr:                  parseFloat(ctr.toFixed(3)),
    consecutiveIgnored:   consecutive,
    totalSent,
    avgArticlesPerDigest: parseFloat(avgArticles.toFixed(1)),
    bestOpenHour:         bestOpenHour >= 0 ? bestOpenHour : 7,
    lastOpenAt,
  };
}

/**
 * Determines the delivery action and fatigue score for a user profile.
 *
 * @param {Object} profile — partial or full user profile
 * @returns {{ action, fatigueScore, reason }}
 *   action: 'send_daily' | 'send_daily_reduced' | 'send_weekly' | 'pause'
 */
function detectFatigue(profile) {
  const { consecutiveIgnored = 0, openRate = 0.5, engagementScore = 0.5, lastOpenAt } = profile;

  // Re-engagement recovery: if user opened recently, lift the pause/weekly state.
  // Prevents users from being permanently stuck after a period of inactivity.
  if (lastOpenAt && consecutiveIgnored >= THRESHOLDS.IGNORE_WEEKLY) {
    const daysSinceOpen = (Date.now() - new Date(lastOpenAt).getTime()) / (24 * 3600 * 1000);
    if (daysSinceOpen < 7) {
      return { action: 'send_daily', fatigueScore: 0.2, reason: 're-engaged (opened within last 7 days)' };
    }
  }

  if (consecutiveIgnored >= THRESHOLDS.IGNORE_PAUSE || engagementScore < 0.05) {
    return {
      action:       'pause',
      fatigueScore: 1.0,
      reason:       `${consecutiveIgnored} consecutive ignored digests`,
    };
  }

  if (consecutiveIgnored >= THRESHOLDS.IGNORE_WEEKLY || openRate < THRESHOLDS.MIN_OPEN_RATE) {
    return {
      action:       'send_weekly',
      fatigueScore: 0.7,
      reason:       `Low engagement (open rate ${(openRate * 100).toFixed(0)}%)`,
    };
  }

  if (consecutiveIgnored >= 1) {
    return {
      action:       'send_daily_reduced',
      fatigueScore: 0.35,
      reason:       `Mild disengagement (${consecutiveIgnored} recent ignores)`,
    };
  }

  return {
    action:       'send_daily',
    fatigueScore: Math.max(0, consecutiveIgnored / THRESHOLDS.IGNORE_PAUSE),
    reason:       null,
  };
}

/**
 * Returns the number of articles for the daily digest.
 * Padrão fixo do OdontoFeed: 3 artigos regulares por dia (o Achado da Semana
 * é enviado à parte e pode elevar o total). Mantido como função para
 * compatibilidade com os chamadores existentes.
 */
function getOptimalDigestSize(profile) {
  return 3;
}

/**
 * Returns true if we should send a digest to this user today.
 * Respects fatigue level and weekly-only schedule.
 */
function shouldSendToday(profile) {
  const { action }     = detectFatigue(profile);
  if (action === 'pause')        return false;

  if (action === 'send_weekly') {
    // Send only on the user's "anchor day" (day of week of their first digest, or Monday)
    const anchorDay = profile.anchorDow ?? 1;  // 0=Sun … 6=Sat; default Monday
    return new Date().getDay() === anchorDay;
  }

  return true;  // daily or daily_reduced
}

module.exports = {
  analyzeDigestHistory,
  detectFatigue,
  getOptimalDigestSize,
  shouldSendToday,
  THRESHOLDS,
};
