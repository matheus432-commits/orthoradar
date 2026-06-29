// Engagement tracking helpers.
// Provides atomic Firestore increments and event logging for digest analytics.

const { request }  = require('../_lib');
const { Firestore } = require('./firestore');
const log           = require('./logger');

const HOST = 'firestore.googleapis.com';

// ── Atomic increment via Firestore commit endpoint ────────────────────────────
// Uses server-side FieldTransform — no read required, no race conditions.

async function incrementField(projectId, apiKey, collection, docId, field, amount = 1) {
  const docPath = `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const body    = JSON.stringify({
    writes: [{
      transform: {
        document: docPath,
        fieldTransforms: [{
          fieldPath: field,
          increment: { integerValue: String(amount) },
        }],
      },
    }],
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: HOST,
    path:     `/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);

  if (res.status !== 200) {
    throw new Error(`incrementField ${field} on ${collection}/${docId}: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return true;
}

// Increment multiple fields atomically in one commit
async function incrementFields(projectId, apiKey, collection, docId, fieldAmounts) {
  const docPath = `projects/${projectId}/databases/(default)/documents/${collection}/${docId}`;
  const transforms = Object.entries(fieldAmounts).map(([field, amount]) => ({
    fieldPath: field,
    increment: { integerValue: String(amount) },
  }));

  const body = JSON.stringify({
    writes: [{ transform: { document: docPath, fieldTransforms: transforms } }],
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: HOST,
    path:     `/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);

  if (res.status !== 200) {
    throw new Error(`incrementFields on ${collection}/${docId}: ${res.status} ${res.body.slice(0, 120)}`);
  }
  return true;
}

// ── Digest event logging ──────────────────────────────────────────────────────

/**
 * Records a single tracking event (open | click) to digest_metrics.
 * Best-effort — errors are logged but not thrown.
 */
async function logEvent(projectId, apiKey, event) {
  const db = new Firestore(projectId, apiKey);
  try {
    await db.addDoc('digest_metrics', {
      digestId:  event.digestId  || null,
      email:     event.email     || null,
      eventType: event.eventType || 'unknown',  // open | click
      pmid:      event.pmid      || null,
      ip:        event.ip        || null,
      ts:        new Date().toISOString(),
    });
  } catch (err) {
    log.warn('[engagement] logEvent failed', { err: err.message, eventType: event.eventType });
  }
}

/**
 * Increments the open counter on a digest document.
 * Also increments emailAberturas on each associated article.
 */
async function recordOpen(projectId, apiKey, digestId) {
  try {
    await incrementField(projectId, apiKey, 'digests', digestId, 'aberturas');
  } catch (err) {
    log.warn('[engagement] recordOpen digest failed', { digestId, err: err.message });
  }
}

/**
 * Increments click counters on both the digest and the article.
 */
async function recordClick(projectId, apiKey, digestId, pmid) {
  const tasks = [];
  if (digestId) {
    tasks.push(
      incrementField(projectId, apiKey, 'digests', digestId, 'cliques')
        .catch(e => log.warn('[engagement] recordClick digest failed', { err: e.message }))
    );
  }
  if (pmid) {
    tasks.push(
      incrementField(projectId, apiKey, 'artigos', pmid, 'emailCliques')
        .catch(e => log.warn('[engagement] recordClick article failed', { pmid, err: e.message }))
    );
  }
  await Promise.allSettled(tasks);
}

// ── Gamification: streak and badge tracking ───────────────────────────────────
//
// Firestore collection: `user_engagement`
// Document ID: sha256(email).slice(0, 16) — same as emailHash() in email-template
//
// Schema:
//   email                  string
//   streak                 number   — consecutive days with at least one open/click
//   lastOpenDate           string   — YYYY-MM-DD UTC (last day streak was updated)
//   clicksByTheme          object   — { [tema]: count } all-time
//   clicksByThemeThisMonth object   — { [tema]: count } current month (reset on rollover)
//   currentMonth           string   — YYYY-MM (used to detect month rollover)
//   totalArticlesRead      number   — all-time click count
//   totalArticlesThisMonth number   — current month click count
//   badgesEarned           string[] — all-time badges
//   newBadgesThisWeek      string[] — cleared by digest after each send
//   newBadgesThisMonth     string[] — cleared by monthly summary send
//   updatedAt              string   — ISO timestamp

const BADGE_THRESHOLD = 3; // unique clicks per tema to earn a badge

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function monthUTC()  { return new Date().toISOString().slice(0, 7);  }

function badgeName(tema) {
  return `Pesquisador em ${String(tema).trim()}`;
}

// Reads user_engagement doc — returns null if not found or on error
async function getEngagement(projectId, apiKey, ehash) {
  const db = new Firestore(projectId, apiKey);
  try { return await db.getDoc('user_engagement', ehash); } catch { return null; }
}

// Tries to resolve the user email from a digest document (best-effort, first open)
async function _resolveEmail(db, digestId) {
  if (!digestId) return null;
  try { return (await db.getDoc('digests', digestId))?.email || null; } catch { return null; }
}

/**
 * Called by track-open: bumps streak for the user identified by ehash.
 * Streak rules:
 *   - gap 0 days  (already opened today): no change
 *   - gap 1–2 days (today or 1-day tolerance): streak++
 *   - gap ≥3 days: reset to 1
 */
async function updateStreak(projectId, apiKey, ehash, digestId) {
  if (!ehash || !apiKey) return;
  const db    = new Firestore(projectId, apiKey);
  const today = todayUTC();

  try {
    const eng = await db.getDoc('user_engagement', ehash).catch(() => null);

    const email    = eng?.email || (await _resolveEmail(db, digestId)) || '';
    const lastOpen = eng?.lastOpenDate;
    let streak     = eng?.streak || 0;

    if (!lastOpen) {
      streak = 1;
    } else if (lastOpen !== today) {
      const gapDays = Math.round(
        (new Date(today + 'T00:00:00Z') - new Date(lastOpen + 'T00:00:00Z')) / 86400000
      );
      streak = gapDays <= 2 ? streak + 1 : 1;
    }
    // lastOpen === today: no-op (already counted)

    // updateDoc for existing docs (partial write avoids overwriting badge data)
    const update = { email, streak, lastOpenDate: today, updatedAt: new Date().toISOString() };
    if (!eng) await db.setDoc('user_engagement', ehash, update);
    else      await db.updateDoc('user_engagement', ehash, update);

    log.debug('[engagement] streak updated', { ehash, streak });
  } catch (err) {
    log.warn('[engagement] updateStreak failed', { ehash, err: err.message });
  }
}

/**
 * Called by track-click: increments clicksByTheme and awards badge when BADGE_THRESHOLD met.
 * Also tracks monthly and all-time article read counts.
 */
async function updateBadges(projectId, apiKey, ehash, tema, digestId) {
  const safeTema = String(tema || '').trim();
  if (!ehash || !safeTema || !apiKey) return;
  const db    = new Firestore(projectId, apiKey);
  const month = monthUTC();

  try {
    const eng = await db.getDoc('user_engagement', ehash).catch(() => null);

    const email = eng?.email || (await _resolveEmail(db, digestId)) || '';

    // Reset monthly counters on month rollover
    const monthChanged             = eng?.currentMonth && eng.currentMonth !== month;
    const clicksByTheme            = { ...(eng?.clicksByTheme || {}) };
    const clicksByThemeThisMonth   = monthChanged ? {} : { ...(eng?.clicksByThemeThisMonth || {}) };
    const totalArticlesThisMonth   = monthChanged ? 0  : (eng?.totalArticlesThisMonth || 0);
    const newBadgesThisMonth       = monthChanged ? [] : [...(eng?.newBadgesThisMonth || [])];

    clicksByTheme[safeTema]          = (clicksByTheme[safeTema] || 0) + 1;
    clicksByThemeThisMonth[safeTema] = (clicksByThemeThisMonth[safeTema] || 0) + 1;

    // Badge check — deduplicate earned badges with Set
    const badgesEarned      = [...new Set(eng?.badgesEarned || [])];
    const newBadgesThisWeek = [...(eng?.newBadgesThisWeek || [])];
    const badge             = badgeName(safeTema);
    if (clicksByTheme[safeTema] >= BADGE_THRESHOLD && !badgesEarned.includes(badge)) {
      badgesEarned.push(badge);
      newBadgesThisWeek.push(badge);
      newBadgesThisMonth.push(badge);
      log.info('[engagement] badge earned', { ehash, badge });
    }

    const update = {
      email,
      clicksByTheme,
      clicksByThemeThisMonth,
      totalArticlesRead:      (eng?.totalArticlesRead || 0) + 1,
      totalArticlesThisMonth: totalArticlesThisMonth + 1,
      currentMonth:           month,
      badgesEarned,
      newBadgesThisWeek,
      newBadgesThisMonth,
      updatedAt:              new Date().toISOString(),
    };

    if (!eng) await db.setDoc('user_engagement', ehash, update);
    else      await db.updateDoc('user_engagement', ehash, update);

    log.debug('[engagement] badges updated', { ehash, tema: safeTema, clicks: clicksByTheme[safeTema] });
  } catch (err) {
    log.warn('[engagement] updateBadges failed', { ehash, tema: safeTema, err: err.message });
  }
}

/**
 * Called by daily-digest after a successful send: clears newBadgesThisWeek.
 * Uses updateDoc (partial) to avoid overwriting streak updated by concurrent opens.
 */
async function clearNewBadgesThisWeek(projectId, apiKey, ehash) {
  if (!ehash || !apiKey) return;
  const db = new Firestore(projectId, apiKey);
  try {
    await db.updateDoc('user_engagement', ehash, { newBadgesThisWeek: [] });
  } catch (err) {
    log.warn('[engagement] clearNewBadgesThisWeek failed', { ehash, err: err.message });
  }
}

module.exports = {
  incrementField, incrementFields, logEvent, recordOpen, recordClick,
  getEngagement, updateStreak, updateBadges, clearNewBadgesThisWeek,
};
