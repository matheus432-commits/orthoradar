// Study comparator — builds a structured side-by-side comparison matrix for 2–4 articles.
// Uses existing enriched fields; no additional AI calls.

const { buildSnapshot } = require('./evidence-snapshot');

// ── Field extractors ──────────────────────────────────────────────────────────

function extractPopulation(article) {
  const text = [article.titulo_pt, article.titulo, article.resumo_pt].filter(Boolean).join(' ');
  const m = /(\d+)\s*(pacientes?|participantes?|adultos?|dentes?|implantes?|casos?|indivíduos?)/i.exec(text)
         || /n\s*=\s*(\d+)/i.exec(text);
  if (m) return m[0];
  return article.populacao || null;
}

function extractFollowUp(article) {
  const text = [article.resumo_pt, article.resumo, article.titulo_pt, article.titulo].filter(Boolean).join(' ');
  const m = /(\d+)\s*(m[eê]ses?|anos?|semanas?|weeks?|months?|years?)/i.exec(text)
         || /follow.?up[:\s]+([\w\s]+)/i.exec(text);
  if (m) return m[0];
  return null;
}

function formatAchados(article) {
  if (Array.isArray(article.achados_principais) && article.achados_principais.length) {
    return article.achados_principais.filter(Boolean).slice(0, 3).join(' • ');
  }
  return article.impacto_pratico || (article.resumo_pt || '').slice(0, 200) || '—';
}

const EVIDENCE_ORDER = {
  'Meta-análise': 8, 'Revisão Sistemática': 7, 'RCT': 6, 'Estudo Coorte': 5,
  'Revisão Narrativa': 4, 'Caso Clínico': 3, 'In Vitro': 2, 'Estudo Animal': 1,
};

/**
 * Produces a structured comparison matrix for 2–4 articles.
 *
 * @param {Array} articles — enriched article objects
 * @returns {Object}       — { articles: [...meta], dimensions: {...} }
 */
function compareStudies(articles) {
  if (!articles || articles.length < 2) throw new Error('At least 2 articles required for comparison');
  const capped = articles.slice(0, 4);

  const meta = capped.map(a => ({
    pmid:           a.pmid || a.id || '',
    titulo:         a.titulo_pt || a.titulo || '—',
    journal:        a.journal || '—',
    data:           a.data || null,
    year:           a.data ? new Date(a.data).getFullYear() : null,
    especialidade:  a.especialidade || '—',
    tema:           a.tema || '—',
    pubmedUrl:      a.pubmedUrl || '',
    isOpenAccess:   a.isOpenAccess || false,
    evidenceOrder:  EVIDENCE_ORDER[a.nivel_evidencia] || 0,
  }));

  const dimensions = {
    tipoEstudo:    capped.map(a => a.nivel_evidencia || '—'),
    populacao:     capped.map(a => extractPopulation(a) || '—'),
    followUp:      capped.map(a => extractFollowUp(a)   || 'Não informado'),
    intervencao:   capped.map(a => a.tema || a.especialidade || '—'),
    desfecho:      capped.map(a => formatAchados(a)),
    impacto:       capped.map(a => a.impacto_pratico     || '—'),
    limitacoes:    capped.map(a => a.limitacoes          || '—'),
    relevanceScore: capped.map(a => a.relevanceScore     || 0),
    evidenceRank:  capped.map(a => EVIDENCE_ORDER[a.nivel_evidencia] || 0),
  };

  // Flag highest-evidence article
  const maxRank   = Math.max(...dimensions.evidenceRank);
  const strongestIdx = dimensions.evidenceRank.findIndex(r => r === maxRank);

  // Highlight agreements: dimensions where all values are identical or similar
  const agreements = [];
  if (new Set(dimensions.tipoEstudo).size === 1) agreements.push('tipoEstudo');

  // Highlight divergences: pairs with different directions
  const directions = capped.map(a => {
    const text = (a.impacto_pratico || '') + ' ' + (Array.isArray(a.achados_principais) ? a.achados_principais.join(' ') : '');
    const { detectDirection } = require('./consensus-engine');
    return detectDirection(text);
  });
  const uniqueDirs = new Set(directions.filter(d => d !== 'neutral'));
  const hasDivergence = uniqueDirs.size > 1;

  return {
    articles:       meta,
    dimensions,
    strongestIdx,
    hasDivergence,
    agreements,
    disclaimer:     'Comparação gerada automaticamente a partir de campos enriquecidos. Consulte os artigos originais para dados completos.',
  };
}

module.exports = { compareStudies };
