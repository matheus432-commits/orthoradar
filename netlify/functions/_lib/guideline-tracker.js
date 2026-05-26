// Guideline tracker — detects systematic reviews, meta-analyses, and position statements.
// Generates clinical alerts when high-evidence publications are indexed for a specialty.
// No AI calls — algorithmic alert generation from enriched fields.

const HIGH_EV_TYPES = new Set(['Meta-análise', 'Revisão Sistemática']);

// Patterns that suggest a guideline/position paper/consensus in the title
const GUIDELINE_PATTERNS = [
  /guideline/i, /diretriz/i, /consenso/i, /posicionamento/i, /recomenda[çc]/i,
  /systematic review/i, /revisão sistemática/i, /meta.anal/i, /meta.anál/i,
  /position statement/i, /clinical practice/i, /best practice/i,
  /evidence.based/i, /baseado em evidên/i,
];

function isGuidelineArticle(article) {
  const titulo = (article.titulo_pt || article.titulo || '').toLowerCase();
  if (HIGH_EV_TYPES.has(article.nivel_evidencia)) return true;
  return GUIDELINE_PATTERNS.some(re => re.test(titulo));
}

/**
 * Generates an alert sentence for a high-evidence article.
 */
function buildAlertText(article) {
  const ev   = article.nivel_evidencia || 'Revisão';
  const tema = article.tema || article.especialidade || 'sua área';
  const age  = article.data
    ? Math.floor((Date.now() - new Date(article.data).getTime()) / (24 * 3600 * 1000))
    : null;

  const ageText = age !== null && age <= 7
    ? 'Publicado esta semana'
    : age !== null && age <= 30
      ? 'Publicado este mês'
      : 'Publicado recentemente';

  let alertText;
  if (ev === 'Meta-análise') {
    alertText = `Nova meta-análise sobre ${tema} — pode alterar protocolos baseados em estudos individuais.`;
  } else if (ev === 'Revisão Sistemática') {
    alertText = `Revisão sistemática recente sobre ${tema} — consolida evidências disponíveis.`;
  } else {
    alertText = `Alta evidência sobre ${tema} — verifique implicações para sua prática.`;
  }

  return { ageText, alertText };
}

/**
 * Filters and ranks articles as guideline-level publications.
 *
 * @param {Array}  articles   — active articles
 * @param {number} maxAlerts  — max alerts to return
 * @param {number} maxAgeDays — only consider articles newer than this
 * @returns {Array}           — alert objects sorted by evidence strength then recency
 */
function detectGuidelineAlerts(articles, maxAlerts = 8, maxAgeDays = 90) {
  const cutoff = Date.now() - maxAgeDays * 24 * 3600 * 1000;

  return articles
    .filter(a => {
      if (!isGuidelineArticle(a)) return false;
      if (a.data && new Date(a.data).getTime() < cutoff) return false;
      return true;
    })
    .sort((a, b) => {
      // Meta-análise first, then Revisão Sistemática, then by recency
      const evRank = (ev) => ev === 'Meta-análise' ? 2 : ev === 'Revisão Sistemática' ? 1 : 0;
      const rankDiff = evRank(b.nivel_evidencia) - evRank(a.nivel_evidencia);
      if (rankDiff !== 0) return rankDiff;
      return (b.data || '') > (a.data || '') ? 1 : -1;
    })
    .slice(0, maxAlerts)
    .map(a => {
      const { ageText, alertText } = buildAlertText(a);
      return {
        pmid:            a.pmid || a.id || '',
        titulo:          a.titulo_pt || a.titulo || '',
        journal:         a.journal || '',
        data:            a.data || '',
        nivel_evidencia: a.nivel_evidencia || '',
        especialidade:   a.especialidade  || '',
        tema:            a.tema || '',
        resumo:          (a.resumo_pt || '').slice(0, 200),
        impacto:         a.impacto_pratico || '',
        pubmedUrl:       a.pubmedUrl || '',
        isOpenAccess:    a.isOpenAccess || false,
        ageText,
        alertText,
        severity:        a.nivel_evidencia === 'Meta-análise' ? 'high' : 'medium',
      };
    });
}

module.exports = { detectGuidelineAlerts, isGuidelineArticle };
