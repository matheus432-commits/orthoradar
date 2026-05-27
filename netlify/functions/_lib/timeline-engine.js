// Timeline memory engine — builds a longitudinal learning timeline from the user's
// notes, collections, and engagement events. Groups by week and month.

// ISO week key — YYYY-Www
function isoWeekKey(d) {
  const jan4  = new Date(d.getFullYear(), 0, 4);
  const week  = Math.ceil((((d - jan4) / 86400000) + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function monthLabel(d) { return `${PT_MONTHS[d.getMonth()]} ${d.getFullYear()}`; }

function weekLabel(d) {
  const diffWeeks = Math.floor((Date.now() - d.getTime()) / (7 * 24 * 3600 * 1000));
  if (diffWeeks === 0) return 'Esta semana';
  if (diffWeeks === 1) return 'Semana passada';
  return `${diffWeeks} semanas atrás`;
}

const EVENT_ICONS = {
  open: '📧', click: '🔗', note_created: '📝', knowledge_search: '🔍',
  graph_opened: '🗺️', collection_created: '📁', workspace_note_created: '✏️',
  highlight_created: '🔆', timeline_opened: '📅', briefing_opened: '📋',
  context_opened: '🔎', related_article_clicked: '➡️',
};

function labelForEvent(m, article) {
  const t = article ? (article.titulo_pt || article.titulo || '').slice(0, 60) : '';
  switch (m.eventType) {
    case 'open':                    return t ? `Abriu digest · ${t}` : 'Abriu digest';
    case 'click':                   return t ? `Clicou em: ${t}` : 'Clicou em artigo';
    case 'note_created':            return 'Criou nota científica';
    case 'knowledge_search':        return 'Pesquisou na base de conhecimento';
    case 'graph_opened':            return 'Explorou o mapa do conhecimento';
    case 'collection_created':      return 'Criou coleção clínica';
    case 'workspace_note_created':  return t ? `Nota de workspace: ${t}` : 'Nota de workspace';
    case 'highlight_created':       return t ? `Highlight em: ${t}` : 'Criou highlight';
    case 'context_opened':          return t ? `Contexto de: ${t}` : 'Abriu painel contextual';
    case 'related_article_clicked': return t ? `Artigo relacionado: ${t}` : 'Clicou em relacionado';
    default: return m.eventType.replace(/_/g, ' ');
  }
}

/**
 * Builds a timeline from user data sources.
 *
 * @param {Object} sources      — { notes, collections, metrics }
 * @param {Object} articleMeta  — pmid → { titulo_pt, titulo, tema, especialidade }
 * @param {number} limitDays    — lookback window (default 90)
 * @returns {{ weeks, months, topThemes, streak, totalEvents }}
 */
function buildTimeline(sources, articleMeta = {}, limitDays = 90) {
  const cutoff = Date.now() - limitDays * 24 * 3600 * 1000;
  const events = [];

  // ── Notes ──────────────────────────────────────────────────────────────────
  for (const note of (sources.notes || [])) {
    const ts = note.criadoEm ? new Date(note.criadoEm).getTime() : 0;
    if (!ts || ts < cutoff) continue;
    const article = note.pmid ? articleMeta[String(note.pmid)] : null;
    events.push({
      type:   'note',
      ts,
      date:   note.criadoEm,
      label:  note.tituloArtigo ? `Nota em: ${note.tituloArtigo.slice(0, 55)}` : 'Nota avulsa',
      detail: note.texto.slice(0, 100),
      tema:   note.tema || article?.tema || null,
      pmid:   note.pmid || null,
      icon:   '📝',
    });
  }

  // ── Collections ────────────────────────────────────────────────────────────
  for (const col of (sources.collections || [])) {
    const ts = col.criadoEm ? new Date(col.criadoEm).getTime() : 0;
    if (!ts || ts < cutoff) continue;
    events.push({
      type:   'collection',
      ts,
      date:   col.criadoEm,
      label:  `Coleção: ${col.nome}`,
      detail: `${(col.pmids || []).length} artigos`,
      tema:   null,
      pmid:   null,
      icon:   '📁',
    });
  }

  // ── Engagement events ──────────────────────────────────────────────────────
  const TRACKED = new Set([
    'open', 'click', 'note_created', 'knowledge_search', 'graph_opened',
    'collection_created', 'workspace_note_created', 'highlight_created',
    'context_opened', 'related_article_clicked', 'briefing_opened', 'timeline_opened',
  ]);
  for (const m of (sources.metrics || [])) {
    const ts = m.ts ? new Date(m.ts).getTime() : 0;
    if (!ts || ts < cutoff || !TRACKED.has(m.eventType)) continue;
    const article = m.pmid ? articleMeta[String(m.pmid)] : null;
    events.push({
      type:   m.eventType,
      ts,
      date:   m.ts,
      label:  labelForEvent(m, article),
      detail: article ? (article.titulo_pt || article.titulo || '').slice(0, 80) : '',
      tema:   article?.tema || null,
      pmid:   m.pmid || null,
      icon:   EVENT_ICONS[m.eventType] || '•',
    });
  }

  events.sort((a, b) => b.ts - a.ts);

  // ── Group by week ──────────────────────────────────────────────────────────
  const byWeekMap = {};
  for (const ev of events) {
    const d   = new Date(ev.ts);
    const key = isoWeekKey(d);
    if (!byWeekMap[key]) byWeekMap[key] = { key, label: weekLabel(d), events: [] };
    byWeekMap[key].events.push(ev);
  }

  // ── Group by month ─────────────────────────────────────────────────────────
  const byMonthMap = {};
  for (const ev of events) {
    const d   = new Date(ev.ts);
    const key = monthKey(d);
    if (!byMonthMap[key]) byMonthMap[key] = { key, label: monthLabel(d), count: 0, themes: {} };
    byMonthMap[key].count++;
    if (ev.tema) byMonthMap[key].themes[ev.tema] = (byMonthMap[key].themes[ev.tema] || 0) + 1;
  }

  // ── Top themes ─────────────────────────────────────────────────────────────
  const themeAcc = {};
  for (const ev of events) {
    if (ev.tema) themeAcc[ev.tema] = (themeAcc[ev.tema] || 0) + 1;
  }
  const topThemes = Object.entries(themeAcc)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([tema, count]) => ({ tema, count }));

  // ── Streak ────────────────────────────────────────────────────────────────
  const daySet = new Set(events.map(e => new Date(e.ts).toLocaleDateString('pt-BR')));
  const today  = new Date();
  let streak   = 0;
  for (let i = 0; i < 60; i++) {
    const key = new Date(today.getTime() - i * 24 * 3600 * 1000).toLocaleDateString('pt-BR');
    if (daySet.has(key)) streak++;
    else if (i > 0) break;
  }

  return {
    weeks:       Object.values(byWeekMap).slice(0, 12),
    months:      Object.values(byMonthMap).slice(0, 6).map(m => ({
      ...m,
      topTheme: m.themes && Object.keys(m.themes).length
        ? Object.entries(m.themes).sort(([,a],[,b]) => b-a)[0][0]
        : null,
    })),
    topThemes,
    streak,
    totalEvents: events.length,
  };
}

module.exports = { buildTimeline };
