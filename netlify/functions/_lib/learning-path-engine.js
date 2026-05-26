// Learning path engine — builds progressive "Trilhas Inteligentes" from articles.
//
// A trilha is a curated sequence of articles on a single tema ordered from
// foundational (case reports, narrative reviews) to advanced (RCTs, meta-analyses).
// This mirrors how a clinician would build expertise: context first, then evidence.

const EVIDENCE_ORDER = {
  'Caso Clínico':        1,
  'Estudo Animal':       2,
  'In Vitro':            3,
  'Revisão Narrativa':   4,
  'Estudo Coorte':       5,
  'RCT':                 6,
  'Revisão Sistemática': 7,
  'Meta-análise':        8,
};

const MIN_PATH_ARTICLES = 3;
const MAX_PATH_ARTICLES = 7;

/**
 * Groups articles by tema, orders each group foundational→advanced,
 * and returns the top `maxPaths` themes with enough articles.
 *
 * @param {Array}  articles  — active articles (should already be filtered by specialty)
 * @param {Object} profile   — user profile (used to personalise path order)
 * @param {number} maxPaths  — max number of trilhas to return
 * @returns {Array}          — array of path objects
 */
function buildLearningPaths(articles, profile, maxPaths = 4) {
  // Group by tema
  const byTema = {};
  for (const a of articles) {
    const tema = a.tema || 'Geral';
    if (!byTema[tema]) byTema[tema] = [];
    byTema[tema].push(a);
  }

  // Score each tema: prefer user's favorite themes + must have enough articles
  const favThemes = profile?.favoriteThemes || {};

  const paths = Object.entries(byTema)
    .filter(([, arts]) => arts.length >= MIN_PATH_ARTICLES)
    .map(([tema, arts]) => {
      // Order: foundational → advanced
      const ordered = [...arts].sort((a, b) => {
        const ra = EVIDENCE_ORDER[a.nivel_evidencia] || 3;
        const rb = EVIDENCE_ORDER[b.nivel_evidencia] || 3;
        return ra - rb;
      }).slice(0, MAX_PATH_ARTICLES);

      const affinity = favThemes[tema] || 0.3;
      const pathScore = affinity * 0.6 + Math.min(1, ordered.length / MAX_PATH_ARTICLES) * 0.4;

      return {
        id:        tema.toLowerCase().replace(/[^a-z0-9]+/gi, '-'),
        title:     tema,
        subtitle:  buildSubtitle(ordered),
        articles:  ordered,
        total:     ordered.length,
        pathScore,
      };
    })
    .sort((a, b) => b.pathScore - a.pathScore)
    .slice(0, maxPaths);

  // Attach progress (how many articles the user has already read in this path)
  const readSet = new Set((profile?.readPmids || []).map(String));

  return paths.map(({ pathScore, ...p }) => ({
    ...p,
    progress: p.articles.filter(a => readSet.has(String(a.pmid || a.id || ''))).length,
    articles: p.articles.map(a => ({
      pmid:            a.pmid || a.id || '',
      titulo:          a.titulo || a.titulo_pt || '',
      journal:         a.journal || '',
      data:            a.data || '',
      nivel_evidencia: a.nivel_evidencia || '',
      resumo:          a.resumo_pt || a.resumo || '',
      pubmedUrl:       a.pubmedUrl || '',
      isOpenAccess:    a.isOpenAccess || false,
    })),
  }));
}

function buildSubtitle(articles) {
  const levels = [...new Set(articles.map(a => a.nivel_evidencia).filter(Boolean))];
  if (!levels.length) return 'Do contexto clínico à evidência científica';
  if (levels.length === 1) return `${levels[0]} — aprofundamento temático`;
  const first = levels[0];
  const last  = levels[levels.length - 1];
  return `De ${first} a ${last}`;
}

module.exports = { buildLearningPaths, EVIDENCE_ORDER };
