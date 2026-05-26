// Consensus engine — detects convergence, conflict, and patterns across article groups.
// Groups articles by tema, analyzes direction of evidence, returns per-tema consensus objects.
// No AI calls — fully algorithmic using enriched field content.

const { computeCuratedScore } = require('./digest-ranking');

// ── Direction signal words (Portuguese) ──────────────────────────────────────

const POSITIVE_KW = [
  'eficaz','efetivo','superior','melhora','reduz','menor perda','maior sucesso',
  'benefício','favorável','positivo','vantagem','recomenda','adequado',
  'bem tolerado','seguro','eficiente','satisfatório','promissor','significativo',
  'melhor','aumentou','diminuiu','reduziu','benefic','sucesso','favorec',
];

const NEGATIVE_KW = [
  'inferior','sem diferença','não houve','não demonstrou','falha','complicação',
  'risco','adverso','desvantagem','problema','contra-indicado','insuficiente',
  'limitado','não significativo','sem benefício','fracasso','piora','prejudic',
];

const MIXED_KW = [
  'depende','controverso','variável','inconsistente','diverge','conflito',
  'misto','inconclusivo','indefinido','heterogêneo','heterogeneo',
];

function detectDirection(text) {
  if (!text) return 'neutral';
  const t = text.toLowerCase();
  let pos = 0, neg = 0, mix = 0;
  for (const kw of POSITIVE_KW) { if (t.includes(kw)) pos++; }
  for (const kw of NEGATIVE_KW) { if (t.includes(kw)) neg++; }
  for (const kw of MIXED_KW)    { if (t.includes(kw)) mix++; }
  if (mix > 0) return 'mixed';
  if (pos > neg * 1.5) return 'positive';
  if (neg > pos * 1.5) return 'negative';
  if (pos > 0 || neg > 0) return 'mixed';
  return 'neutral';
}

const HIGH_EV  = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
const MED_EV   = new Set(['Estudo Coorte', 'Revisão Narrativa']);

function evidenceStrength(nivels) {
  const h = nivels.filter(n => HIGH_EV.has(n)).length;
  const m = nivels.filter(n => MED_EV.has(n)).length;
  return { high: h, med: m, total: nivels.length };
}

/**
 * Classifies a group of articles into a consensus category.
 *
 * @returns {{ level, label, color }}
 *   level:  'forte' | 'tendencia' | 'conflitante' | 'insuficiente'
 */
function classifyConsensus(articles, direction) {
  const niv   = articles.map(a => a.nivel_evidencia).filter(Boolean);
  const str   = evidenceStrength(niv);
  const total = articles.length;

  if (total < 2 || str.high + str.med < 1) {
    return { level: 'insuficiente', label: 'Evidência Insuficiente', color: '#94a3b8' };
  }
  if (direction === 'mixed') {
    return { level: 'conflitante', label: 'Evidência Conflitante', color: '#ef4444' };
  }
  if (str.high >= 2 && total >= 3 && direction !== 'neutral') {
    return { level: 'forte', label: 'Forte Consenso', color: '#10b981' };
  }
  if ((str.high >= 1 || str.med >= 2) && total >= 2) {
    return { level: 'tendencia', label: 'Tendência Emergente', color: '#f59e0b' };
  }
  return { level: 'insuficiente', label: 'Evidência Insuficiente', color: '#94a3b8' };
}

/**
 * Builds a narrative summary sentence for a tema group.
 */
function buildSummary(tema, articles, direction, consensusLevel) {
  const total    = articles.length;
  const nivCounts = {};
  for (const a of articles) {
    const n = a.nivel_evidencia || 'outros';
    nivCounts[n] = (nivCounts[n] || 0) + 1;
  }
  const highParts = Object.entries(nivCounts)
    .filter(([k]) => HIGH_EV.has(k))
    .map(([k, v]) => `${v} ${k === 'RCT' ? 'ensaio' + (v > 1 ? 's' : '') + ' clínico' + (v > 1 ? 's' : '') : k.toLowerCase() + (v > 1 ? 's' : '')}`)
    .join(', ');

  const directionText = {
    positive: 'indicam efeito favorável',
    negative: 'apontam para resultado desfavorável ou sem benefício claro',
    mixed:    'apresentam resultados heterogêneos',
    neutral:  'fornecem dados sobre',
  }[direction] || 'abordam';

  const prefix = highParts
    ? `${highParts.charAt(0).toUpperCase() + highParts.slice(1)}`
    : `${total} estudo${total > 1 ? 's' : ''}`;

  const recentCount = articles.filter(a => {
    if (!a.data) return false;
    return (Date.now() - new Date(a.data).getTime()) < 365 * 24 * 3600 * 1000;
  }).length;

  const recencyNote = recentCount >= 2 ? ` (${recentCount} publicados no último ano)` : '';

  return `${prefix} ${directionText} para ${tema}${recencyNote}.`;
}

/**
 * Processes a list of articles for ONE specialty and returns per-tema consensus data.
 *
 * @param {Array}  articles  — active articles from Firestore for a specialty
 * @param {number} minGroup  — minimum articles per tema to show
 * @returns {Array}          — array of consensus objects sorted by strength DESC
 */
function analyzeConsensus(articles, minGroup = 2) {
  // Group by tema
  const byTema = {};
  for (const a of articles) {
    const tema = a.tema || 'Geral';
    if (!byTema[tema]) byTema[tema] = [];
    byTema[tema].push(a);
  }

  const results = [];

  for (const [tema, group] of Object.entries(byTema)) {
    if (group.length < minGroup) continue;

    // Detect dominant direction from impacto_pratico + achados_principais
    const directions = group.map(a => {
      const text = [
        a.impacto_pratico || '',
        Array.isArray(a.achados_principais) ? a.achados_principais.join(' ') : (a.achados_principais || ''),
      ].join(' ');
      return detectDirection(text);
    });

    const dirCount = {};
    for (const d of directions) { dirCount[d] = (dirCount[d] || 0) + 1; }
    const dominant = Object.entries(dirCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral';
    const direction = (dirCount['mixed'] || 0) + (dirCount['negative'] || 0) >= group.length * 0.4
      ? 'mixed' : dominant;

    const consensus   = classifyConsensus(group, direction);
    const summary     = buildSummary(tema, group, direction, consensus.level);
    const topArticles = group
      .map(a => ({ ...a, _cs: computeCuratedScore(a) }))
      .sort((a, b) => b._cs - a._cs)
      .slice(0, 4)
      .map(({ _cs, ...rest }) => rest);

    // Evidence breakdown
    const evBreakdown = {};
    for (const a of group) {
      const n = a.nivel_evidencia || 'Outros';
      evBreakdown[n] = (evBreakdown[n] || 0) + 1;
    }

    results.push({
      tema,
      ...consensus,
      summary,
      direction,
      articleCount:   group.length,
      evBreakdown,
      topArticles,
    });
  }

  // Sort: forte > tendencia > conflitante > insuficiente, then by article count
  const ORDER = { forte: 4, tendencia: 3, conflitante: 2, insuficiente: 1 };
  return results.sort((a, b) =>
    (ORDER[b.level] - ORDER[a.level]) || b.articleCount - a.articleCount
  );
}

module.exports = { analyzeConsensus, classifyConsensus, detectDirection };
