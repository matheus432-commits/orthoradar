// GET /.netlify/functions/get-feature-analytics
// Admin-only endpoint. Returns feature adoption metrics from digest_metrics,
// notes, collections, article_workspace, and user_profiles.
//
// Query: ?secret=ADMIN_SECRET&days=30

const { Firestore }   = require('./_lib/firestore');
const { request }     = require('./_lib');
const log             = require('./_lib/logger');

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

// ── Firestore aggregation count helper ───────────────────────────────────────
async function countDocs(projectId, apiKey, collection, whereClause) {
  const body = JSON.stringify({
    structuredAggregationQuery: {
      structuredQuery: {
        from: [{ collectionId: collection }],
        ...(whereClause ? { where: whereClause } : {}),
      },
      aggregations: [{ alias: 'count', count: {} }],
    },
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);
  if (res.status !== 200) return null;
  const result = JSON.parse(res.body);
  return parseInt(result[0]?.result?.aggregateFields?.count?.integerValue || '0', 10);
}

// ── Event definitions by phase ────────────────────────────────────────────────
const FEATURE_MAP = {
  'Core — Digest': ['open', 'click'],
  'FASE 4 — Inteligência Clínica': [
    'clinical_query_searched', 'comparator_used', 'consensus_viewed',
    'guideline_alert_clicked', 'evidence_snapshot_opened',
  ],
  'FASE 5 — Memória Científica': [
    'note_created', 'knowledge_search', 'graph_opened', 'collection_created',
  ],
  'FASE 6 — Workspace Contextual': [
    'context_opened', 'workspace_note_created', 'highlight_created',
    'briefing_opened', 'timeline_opened', 'related_article_clicked',
  ],
};

// All tracked event types (flat list)
const ALL_EVENTS = Object.values(FEATURE_MAP).flat();

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }

  const { secret, days: daysStr = '30' } = event.queryStringParameters || {};
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const days      = Math.min(parseInt(daysStr, 10) || 30, 90);
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db     = new Firestore(projectId, apiKey);
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const cutoff7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  try {
    // ── 1. Fetch recent events (up to 1000) ──────────────────────────────────
    const recentEvents = await db.query('digest_metrics', {
      where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } },
      orderBy: [{ field: { fieldPath: 'ts' }, direction: 'DESCENDING' }],
      limit: 1000,
    }).catch(() => []);

    // ── 2. Group by eventType ────────────────────────────────────────────────
    const eventCounts   = {};   // eventType → { total, last7, users: Set }
    const dailyCounts   = {};   // YYYY-MM-DD → { eventType → count }

    for (const ev of recentEvents) {
      const et  = ev.eventType || 'unknown';
      const ts  = ev.ts || '';
      const day = ts.slice(0, 10);

      if (!eventCounts[et]) eventCounts[et] = { total: 0, last7: 0, users: new Set() };
      eventCounts[et].total++;
      if (ts >= cutoff7) eventCounts[et].last7++;
      if (ev.email) eventCounts[et].users.add(ev.email);

      if (day) {
        if (!dailyCounts[day]) dailyCounts[day] = {};
        dailyCounts[day][et] = (dailyCounts[day][et] || 0) + 1;
      }
    }

    // ── 3. Build per-phase adoption report ───────────────────────────────────
    const phases = {};
    for (const [phaseName, events] of Object.entries(FEATURE_MAP)) {
      phases[phaseName] = events.map(et => {
        const c = eventCounts[et] || { total: 0, last7: 0, users: new Set() };
        return {
          event:       et,
          total:       c.total,
          last7days:   c.last7,
          uniqueUsers: c.users.size,
        };
      });
    }

    // ── 4. Overall feature engagement funnel ────────────────────────────────
    const openCount  = (eventCounts['open']  || {}).total || 0;
    const clickCount = (eventCounts['click'] || {}).total || 0;
    const fase4Uses  = FEATURE_MAP['FASE 4 — Inteligência Clínica']
      .reduce((s, et) => s + ((eventCounts[et] || {}).total || 0), 0);
    const fase5Uses  = FEATURE_MAP['FASE 5 — Memória Científica']
      .reduce((s, et) => s + ((eventCounts[et] || {}).total || 0), 0);
    const fase6Uses  = FEATURE_MAP['FASE 6 — Workspace Contextual']
      .reduce((s, et) => s + ((eventCounts[et] || {}).total || 0), 0);

    // ── 5. Storage counts (parallel aggregations) ───────────────────────────
    const notDeletedFilter = {
      fieldFilter: { field: { fieldPath: 'deletedAt' }, op: 'EQUAL', value: { nullValue: 'NULL_VALUE' } },
    };
    const [
      totalNotes, totalCollections, totalWorkspaceDocs, totalUserProfiles, totalUsers,
      notesLast7, collectionsLast7,
    ] = await Promise.all([
      countDocs(projectId, apiKey, 'notes',             notDeletedFilter),
      countDocs(projectId, apiKey, 'collections',       notDeletedFilter),
      countDocs(projectId, apiKey, 'article_workspace', null),
      countDocs(projectId, apiKey, 'user_profiles',     null),
      countDocs(projectId, apiKey, 'cadastros',         null),
      countDocs(projectId, apiKey, 'notes', {
        compositeFilter: {
          op: 'AND',
          filters: [
            notDeletedFilter,
            { fieldFilter: { field: { fieldPath: 'criadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff7 } } },
          ],
        },
      }),
      countDocs(projectId, apiKey, 'collections', {
        compositeFilter: {
          op: 'AND',
          filters: [
            notDeletedFilter,
            { fieldFilter: { field: { fieldPath: 'criadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff7 } } },
          ],
        },
      }),
    ]);

    // ── 6. Data quality — articles without enrichment ────────────────────────
    const articlesNoEv = await countDocs(projectId, apiKey, 'artigos', {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'ativo' } } },
          { fieldFilter: { field: { fieldPath: 'nivel_evidencia' }, op: 'EQUAL', value: { nullValue: 'NULL_VALUE' } } },
        ],
      },
    }).catch(() => null);

    // ── 7. Daily trend (last 14 days, core + feature events) ─────────────────
    const trendDays = 14;
    const trend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d   = new Date(Date.now() - i * 24 * 3600 * 1000);
      const day = d.toISOString().slice(0, 10);
      const dc  = dailyCounts[day] || {};
      trend.push({
        date:     day,
        opens:    dc['open']            || 0,
        clicks:   dc['click']           || 0,
        fase4:    FEATURE_MAP['FASE 4 — Inteligência Clínica'].reduce((s, et) => s + (dc[et] || 0), 0),
        fase5:    FEATURE_MAP['FASE 5 — Memória Científica'].reduce((s, et) => s + (dc[et] || 0), 0),
        fase6:    FEATURE_MAP['FASE 6 — Workspace Contextual'].reduce((s, et) => s + (dc[et] || 0), 0),
      });
    }

    // ── 8. Top engaged users (unique users across advanced features) ──────────
    const advancedUserSet = new Set();
    [...FEATURE_MAP['FASE 4 — Inteligência Clínica'],
     ...FEATURE_MAP['FASE 5 — Memória Científica'],
     ...FEATURE_MAP['FASE 6 — Workspace Contextual']].forEach(et => {
      (eventCounts[et]?.users || new Set()).forEach(u => advancedUserSet.add(u));
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        windowDays:  days,

        funnel: {
          digestOpens:         openCount,
          digestClicks:        clickCount,
          ctrDigest:           openCount ? parseFloat((clickCount / openCount * 100).toFixed(1)) : 0,
          fase4FeatureUses:    fase4Uses,
          fase5FeatureUses:    fase5Uses,
          fase6FeatureUses:    fase6Uses,
          advancedFeatureUsers: advancedUserSet.size,
          totalUsers:          totalUsers || 0,
          adoptionRate:        totalUsers
            ? parseFloat((advancedUserSet.size / totalUsers * 100).toFixed(1))
            : 0,
        },

        phases,

        storage: {
          notes:          { total: totalNotes   ?? 0, last7days: notesLast7       ?? 0 },
          collections:    { total: totalCollections ?? 0, last7days: collectionsLast7 ?? 0 },
          workspaces:     totalWorkspaceDocs ?? 0,
          userProfiles:   totalUserProfiles  ?? 0,
        },

        dataQuality: {
          articlesWithoutEvidenceLevel: articlesNoEv ?? 'n/a',
          userProfileCoverage: totalUsers && totalUserProfiles
            ? `${totalUserProfiles}/${totalUsers} (${Math.round(totalUserProfiles/totalUsers*100)}%)`
            : 'n/a',
        },

        trend,
      }, null, 2),
    };

  } catch (err) {
    log.warn('[get-feature-analytics] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
