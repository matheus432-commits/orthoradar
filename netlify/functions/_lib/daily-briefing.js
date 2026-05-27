// Daily clinical briefing generator.
// Produces a short contextual summary of recent scientific activity.
// No AI required; all heuristic-based.

const log = require('./logger');

const HIGH_EV          = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
const GUIDELINE_RX     = [/guideline/i, /diretriz/i, /consenso/i, /recomendação/i, /protocol/i];
const BRIEFING_CACHE   = 'daily_briefings';
const CACHE_TTL_MS     = 60 * 60 * 1000; // 1 hour

/**
 * Builds a daily briefing for a user.
 *
 * @param {Object} db        — Firestore instance
 * @param {string} email     — user email
 * @param {Object} profile   — behavioral profile (can be null)
 * @param {string} specialty — primary specialty (can be null)
 * @param {number} days      — lookback window in days (default 7)
 * @returns {Object}
 */
async function buildBriefing(db, email, profile, specialty = null, days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  // Fetch recent articles
  const articles = await fetchRecentArticles(db, specialty, cutoff, 60);

  // Categorize
  const { byEv, byTheme } = categorize(articles);
  const topTheme   = findTopTheme(articles, profile);
  const guidelines = articles.filter(a =>
    HIGH_EV.has(a.nivel_evidencia) &&
    GUIDELINE_RX.some(rx => rx.test(a.titulo || '') || rx.test(a.titulo_pt || ''))
  ).slice(0, 3);

  const bullets    = buildBullets(byEv, byTheme, guidelines, days);
  const highlights = rankHighlights(articles, profile).slice(0, 3);
  const personalNote = buildPersonalNote(profile, topTheme, specialty);
  const greeting   = buildGreeting();

  const meta = byEv['Meta-análise'] || 0;
  const rs   = byEv['Revisão Sistemática'] || 0;
  const rct  = byEv['RCT'] || 0;

  return {
    date:         new Date().toISOString(),
    greeting,
    periodLabel:  `Últimos ${days} dias`,
    specialty:    specialty || null,
    bullets,
    highlights,
    personalNote,
    topTheme,
    stats: {
      total:      articles.length,
      highEv:     meta + rs + rct,
      metaAnalise: meta,
      rs,
      rcts:       rct,
      guidelines: guidelines.length,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

/**
 * Returns cached briefing if < 1h old, otherwise builds and caches a fresh one.
 */
async function getCachedBriefing(db, email, profile, specialty, days = 7) {
  try {
    const cached = await db.getDoc(BRIEFING_CACHE, email).catch(() => null);
    if (cached && cached.generatedAt) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (age < CACHE_TTL_MS) return cached;
    }
  } catch {}

  const fresh = await buildBriefing(db, email, profile, specialty, days);
  // Persist (best-effort, don't fail the request if this errors)
  db.setDoc(BRIEFING_CACHE, email, fresh).catch(e => log.warn('[briefing] cache write failed', { email, err: e.message }));
  return fresh;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function fetchRecentArticles(db, specialty, cutoff, limit) {
  const statusFilter = { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'ativo' } } };
  const dateFilter   = { fieldFilter: { field: { fieldPath: 'data'   }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: cutoff } } };

  try {
    const filters = specialty
      ? [statusFilter, dateFilter, { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: specialty } } }]
      : [statusFilter, dateFilter];
    return await db.query('artigos', {
      where: filters.length > 1
        ? { compositeFilter: { op: 'AND', filters } }
        : filters[0],
      orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
      limit,
    });
  } catch {
    // Fallback: no orderBy, client-side filter
    const all = await db.query('artigos', { where: statusFilter, limit: limit * 2 }).catch(() => []);
    return all
      .filter(a => a.data && a.data >= cutoff && (!specialty || a.especialidade === specialty))
      .sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1)
      .slice(0, limit);
  }
}

function categorize(articles) {
  const byEv = {}, byTheme = {};
  for (const a of articles) {
    const ev = a.nivel_evidencia || 'Outros';
    byEv[ev]   = (byEv[ev]   || 0) + 1;
    const t    = a.tema || 'Geral';
    byTheme[t] = (byTheme[t] || 0) + 1;
  }
  return { byEv, byTheme };
}

function findTopTheme(articles, profile) {
  if (!articles.length) return null;
  const acc = {};
  for (const a of articles) {
    if (!a.tema) continue;
    const boost = profile?.favoriteThemes?.[a.tema] || 0;
    acc[a.tema] = (acc[a.tema] || 0) + 1 + boost * 5;
  }
  const entries = Object.entries(acc);
  if (!entries.length) return null;
  return entries.sort(([, a], [, b]) => b - a)[0][0];
}

function buildBullets(byEv, byTheme, guidelines, days) {
  const total = Object.values(byEv).reduce((s, n) => s + n, 0);
  if (!total) return [`Nenhum artigo novo nos últimos ${days} dias.`];

  const bullets = [];
  const meta    = byEv['Meta-análise']        || 0;
  const rs      = byEv['Revisão Sistemática'] || 0;
  const rct     = byEv['RCT']                 || 0;

  if (meta + rs > 0) {
    const parts = [
      meta && `${meta} meta-análise${meta > 1 ? 's' : ''}`,
      rs   && `${rs} revisão${rs > 1 ? 'ões' : ''} sistemática${rs > 1 ? 's' : ''}`,
    ].filter(Boolean);
    bullets.push(`${meta + rs} revisão${meta + rs > 1 ? 'ões' : ''} de alta evidência (${parts.join(', ')})`);
  }
  if (rct > 0) bullets.push(`${rct} ensaio${rct > 1 ? 's' : ''} clínico${rct > 1 ? 's' : ''} randomizado${rct > 1 ? 's' : ''}`);
  if (guidelines.length > 0) bullets.push(`${guidelines.length} diretriz${guidelines.length > 1 ? 'es' : ''} ou consenso${guidelines.length > 1 ? 's' : ''} relevante${guidelines.length > 1 ? 's' : ''}`);

  const topThemes = Object.entries(byTheme).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t);
  if (topThemes.length && total > 3) bullets.push(`Temas em destaque: ${topThemes.join(', ')}`);

  return bullets;
}

function rankHighlights(articles, profile) {
  return articles
    .map(a => {
      let score = 0;
      if (HIGH_EV.has(a.nivel_evidencia))                score += 40;
      else if (a.nivel_evidencia === 'Estudo Coorte')    score += 20;
      if (a.isOpenAccess)                                score += 15;
      score += Math.min(20, (a.emailCliques || 0) * 2);
      if (profile?.favoriteThemes?.[a.tema])             score += Math.round(profile.favoriteThemes[a.tema] * 25);
      return { ...a, _s: score };
    })
    .sort((a, b) => b._s - a._s)
    .slice(0, 5)
    .map(({ _s, ...rest }) => rest);
}

function buildPersonalNote(profile, topTheme, specialty) {
  if (!profile || (profile.totalInteractions || 0) < 3) {
    return specialty ? `Curado para ${specialty}.` : 'Continue explorando para personalizar seu briefing.';
  }
  const favs = Object.keys(profile.favoriteThemes || {}).slice(0, 2);
  const all  = [topTheme, ...favs.filter(t => t !== topTheme)].filter(Boolean).slice(0, 2);
  if (!all.length) return specialty ? `Curado para ${specialty}.` : 'Atualizado com base no seu perfil.';
  return `Com base no seu perfil, priorizamos ${all.join(', ')}.`;
}

function buildGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia.';
  if (h < 18) return 'Boa tarde.';
  return 'Boa noite.';
}

module.exports = { buildBriefing, getCachedBriefing };
