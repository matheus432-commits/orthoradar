// Tests for fatigue-detection.js
// Run: node --test netlify/functions/_lib/__tests__/fatigue-detection.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  analyzeDigestHistory,
  detectFatigue,
  getOptimalDigestSize,
  shouldSendToday,
  THRESHOLDS,
} = require('../fatigue-detection');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeDigest({ opened = true, clicked = false, daysAgo = 1 } = {}) {
  const d = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
  return {
    aberturas:  opened  ? 1 : 0,
    cliques:    clicked ? 1 : 0,
    enviadoEm:  d,
    pmids:      ['1', '2', '3', '4'],
  };
}

function recentOpened(n = 10) {
  return Array.from({ length: n }, (_, i) => makeDigest({ opened: true, daysAgo: i + 1 }));
}

function recentIgnored(n = 10) {
  return Array.from({ length: n }, (_, i) => makeDigest({ opened: false, daysAgo: i + 1 }));
}

// ── analyzeDigestHistory ──────────────────────────────────────────────────────

describe('analyzeDigestHistory', () => {
  test('empty list returns safe defaults', () => {
    const r = analyzeDigestHistory([]);
    assert.equal(r.openRate, 0.5);
    assert.equal(r.ctr, 0.2);
    assert.equal(r.consecutiveIgnored, 0);
    assert.equal(r.lastOpenAt, null);
  });

  test('all opened: openRate = 1.0, consecutiveIgnored = 0', () => {
    const r = analyzeDigestHistory(recentOpened(5));
    assert.equal(r.openRate, 1.0);
    assert.equal(r.consecutiveIgnored, 0);
    assert.ok(r.lastOpenAt !== null);
  });

  test('none opened: openRate = 0, consecutiveIgnored = n', () => {
    const r = analyzeDigestHistory(recentIgnored(8));
    assert.equal(r.openRate, 0);
    assert.equal(r.consecutiveIgnored, 8);
    assert.equal(r.lastOpenAt, null);
  });

  test('consecutiveIgnored resets at first open (newest first)', () => {
    // 3 ignored, then 1 opened, then more ignored
    const digests = [
      makeDigest({ opened: false, daysAgo: 1 }),
      makeDigest({ opened: false, daysAgo: 2 }),
      makeDigest({ opened: false, daysAgo: 3 }),
      makeDigest({ opened: true,  daysAgo: 4 }),
      makeDigest({ opened: false, daysAgo: 5 }),
    ];
    const r = analyzeDigestHistory(digests);
    assert.equal(r.consecutiveIgnored, 3);
  });

  test('lastOpenAt is the most recent open timestamp', () => {
    const digests = [
      makeDigest({ opened: false, daysAgo: 1 }),
      makeDigest({ opened: true,  daysAgo: 2 }),
      makeDigest({ opened: true,  daysAgo: 5 }),
    ];
    const r = analyzeDigestHistory(digests);
    // Most recent open is daysAgo=2
    const expected = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const actual   = new Date(r.lastOpenAt);
    const diffMs   = Math.abs(expected.getTime() - actual.getTime());
    assert.ok(diffMs < 5000, `lastOpenAt should be ~2 days ago, got ${r.lastOpenAt}`);
  });
});

// ── detectFatigue ─────────────────────────────────────────────────────────────

describe('detectFatigue', () => {
  test('engaged user → send_daily', () => {
    const r = detectFatigue({ consecutiveIgnored: 0, openRate: 0.7, engagementScore: 0.5 });
    assert.equal(r.action, 'send_daily');
  });

  test('1 consecutive ignore → send_daily_reduced', () => {
    const r = detectFatigue({ consecutiveIgnored: 1, openRate: 0.5, engagementScore: 0.5 });
    assert.equal(r.action, 'send_daily_reduced');
  });

  test(`${THRESHOLDS.IGNORE_WEEKLY} consecutive ignored → send_weekly`, () => {
    const r = detectFatigue({ consecutiveIgnored: THRESHOLDS.IGNORE_WEEKLY, openRate: 0.2, engagementScore: 0.3 });
    assert.equal(r.action, 'send_weekly');
  });

  test(`${THRESHOLDS.IGNORE_PAUSE} consecutive ignored → pause`, () => {
    const r = detectFatigue({ consecutiveIgnored: THRESHOLDS.IGNORE_PAUSE, openRate: 0.0, engagementScore: 0.3 });
    assert.equal(r.action, 'pause');
  });

  test('very low engagementScore → pause', () => {
    const r = detectFatigue({ consecutiveIgnored: 0, openRate: 0.5, engagementScore: 0.04 });
    assert.equal(r.action, 'pause');
  });

  test('very low openRate → send_weekly', () => {
    const r = detectFatigue({ consecutiveIgnored: 0, openRate: 0.03, engagementScore: 0.3 });
    assert.equal(r.action, 'send_weekly');
  });

  test('re-engagement recovery: user was paused but opened recently → send_daily', () => {
    const lastOpenAt = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(); // 2 days ago
    const r = detectFatigue({
      consecutiveIgnored: THRESHOLDS.IGNORE_PAUSE + 5,
      openRate: 0.0,
      engagementScore: 0.0,
      lastOpenAt,
    });
    assert.equal(r.action, 'send_daily', `Expected re-engagement recovery, got ${r.action} (${r.reason})`);
  });

  test('re-engagement does not apply if last open was 10+ days ago', () => {
    const lastOpenAt = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const r = detectFatigue({
      consecutiveIgnored: THRESHOLDS.IGNORE_PAUSE,
      openRate: 0.0,
      engagementScore: 0.0,
      lastOpenAt,
    });
    assert.equal(r.action, 'pause');
  });

  test('re-engagement does not apply if ignored count below weekly threshold', () => {
    const lastOpenAt = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
    const r = detectFatigue({
      consecutiveIgnored: 1,  // below IGNORE_WEEKLY threshold
      openRate: 0.5,
      engagementScore: 0.5,
      lastOpenAt,
    });
    // Normal flow — should be send_daily_reduced (1 ignored) not affected by re-engagement
    assert.equal(r.action, 'send_daily_reduced');
  });
});

// ── getOptimalDigestSize ──────────────────────────────────────────────────────

describe('getOptimalDigestSize', () => {
  test('high CTR → 5 articles', () => {
    const size = getOptimalDigestSize({ ctr: 0.4, consecutiveIgnored: 0, openRate: 0.8, engagementScore: 0.7 });
    assert.equal(size, 5);
  });

  test('moderate CTR → 4 articles', () => {
    const size = getOptimalDigestSize({ ctr: 0.2, consecutiveIgnored: 0, openRate: 0.5, engagementScore: 0.5 });
    assert.equal(size, 4);
  });

  test('low CTR → 3 articles', () => {
    const size = getOptimalDigestSize({ ctr: 0.05, consecutiveIgnored: 0, openRate: 0.3, engagementScore: 0.3 });
    assert.equal(size, 3);
  });

  test('paused user → 3 articles (conservative)', () => {
    const size = getOptimalDigestSize({ ctr: 0.5, consecutiveIgnored: 20, openRate: 0.0, engagementScore: 0.0 });
    assert.equal(size, 3);
  });
});

// ── shouldSendToday ───────────────────────────────────────────────────────────

describe('shouldSendToday', () => {
  test('daily user always sends', () => {
    const result = shouldSendToday({ consecutiveIgnored: 0, openRate: 0.7, engagementScore: 0.5 });
    assert.equal(result, true);
  });

  test('paused user never sends', () => {
    const result = shouldSendToday({ consecutiveIgnored: THRESHOLDS.IGNORE_PAUSE, openRate: 0.0, engagementScore: 0.0 });
    assert.equal(result, false);
  });

  test('weekly user only sends on anchor day', () => {
    const today = new Date().getDay(); // 0–6
    const notToday = (today + 1) % 7;

    const sendOnAnchor = shouldSendToday({
      consecutiveIgnored: THRESHOLDS.IGNORE_WEEKLY,
      openRate: 0.02,
      engagementScore: 0.3,
      anchorDow: today,
    });
    assert.equal(sendOnAnchor, true);

    const dontSendOff = shouldSendToday({
      consecutiveIgnored: THRESHOLDS.IGNORE_WEEKLY,
      openRate: 0.02,
      engagementScore: 0.3,
      anchorDow: notToday,
    });
    assert.equal(dontSendOff, false);
  });

  test('re-engaged paused user sends today', () => {
    const lastOpenAt = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
    const result = shouldSendToday({
      consecutiveIgnored: THRESHOLDS.IGNORE_PAUSE + 3,
      openRate: 0.0,
      engagementScore: 0.0,
      lastOpenAt,
    });
    assert.equal(result, true);
  });
});
