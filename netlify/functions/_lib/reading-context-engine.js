// Reading context engine — infers user experience level from behavioral signals
// and adapts content depth accordingly. Pure JS, no AI required.

const LEVELS = {
  INICIANTE:     'iniciante',
  INTERMEDIARIO: 'intermediário',
  AVANCADO:      'avançado',
  ACADEMICO:     'acadêmico',
  CLINICO:       'clínico',
};

/**
 * Infers experience level from profile signals.
 * Uses: totalInteractions, preferredEvidence, ctr, engagementScore, favoriteThemes.
 */
function inferExperienceLevel(profile) {
  if (!profile) return LEVELS.INICIANTE;

  const total  = profile.totalInteractions || 0;
  const ev     = profile.preferredEvidence || {};
  const ctr    = profile.ctr               || 0;
  const eng    = profile.engagementScore   || 0;
  const themes = Object.keys(profile.favoriteThemes || {}).length;

  // Academic: heavy high-evidence consumption
  const highEvWeight = (ev['Meta-análise'] || 0) + (ev['Revisão Sistemática'] || 0) + (ev['RCT'] || 0);
  if (total >= 50 && highEvWeight > 0.5) return LEVELS.ACADEMICO;

  // Advanced: diverse engagement, many themes
  if (total >= 25 && themes >= 4 && eng >= 0.5) return LEVELS.AVANCADO;

  // Clinical: high CTR, action-oriented
  if (total >= 15 && ctr >= 0.3 && eng >= 0.4) return LEVELS.CLINICO;

  // Warming up
  if (total >= 8) return LEVELS.INTERMEDIARIO;

  return LEVELS.INICIANTE;
}

/**
 * Returns prioritized fields to show for an article, adapted to the user's level.
 * @returns {{ level, focus, fields: [{label, value}], tip }}
 */
function adaptSummary(article, profile) {
  const level = inferExperienceLevel(profile);
  const achados = Array.isArray(article.achados_principais)
    ? article.achados_principais.slice(0, level === LEVELS.ACADEMICO ? 5 : 3).join(' • ')
    : null;

  const common = { nivel_evidencia: article.nivel_evidencia || null, achados };

  switch (level) {
    case LEVELS.INICIANTE:
      return {
        level,
        focus: 'aplicabilidade',
        fields: [
          { label: 'Conclusão prática',  value: article.impacto_pratico || article.impacto || null },
          { label: 'Tipo de estudo',     value: common.nivel_evidencia },
          { label: 'O que estudou',      value: (article.resumo_pt || article.resumo || '').slice(0, 200) || null },
        ].filter(f => f.value),
        tip: 'Foco na aplicabilidade clínica direta.',
      };

    case LEVELS.INTERMEDIARIO:
      return {
        level,
        focus: 'resultados',
        fields: [
          { label: 'Evidência',          value: common.nivel_evidencia },
          { label: 'Principais achados', value: common.achados },
          { label: 'Impacto prático',    value: article.impacto_pratico || null },
          { label: 'Limitações',         value: article.limitacoes || null },
        ].filter(f => f.value),
        tip: null,
      };

    case LEVELS.CLINICO:
      return {
        level,
        focus: 'aplicabilidade-avançada',
        fields: [
          { label: 'Evidência',          value: common.nivel_evidencia },
          { label: 'Achados',            value: common.achados },
          { label: 'Quando aplicar',     value: article.quando_aplicar || article.impacto_pratico || null },
          { label: 'Limitações',         value: article.limitacoes || null },
        ].filter(f => f.value),
        tip: null,
      };

    case LEVELS.AVANCADO:
      return {
        level,
        focus: 'nuance',
        fields: [
          { label: 'Delineamento',       value: common.nivel_evidencia },
          { label: 'Achados',            value: common.achados },
          { label: 'Limitações',         value: article.limitacoes || null },
          { label: 'Aplicabilidade',     value: article.quando_aplicar || article.impacto_pratico || null },
        ].filter(f => f.value),
        tip: null,
      };

    case LEVELS.ACADEMICO:
      return {
        level,
        focus: 'rigor-metodológico',
        fields: [
          { label: 'Delineamento',       value: common.nivel_evidencia },
          { label: 'Metodologia',        value: article.populacao || null },
          { label: 'Resultados',         value: common.achados },
          { label: 'Limitações',         value: article.limitacoes || null },
          { label: 'Conflito evidência', value: article.debate_cientifico || null },
        ].filter(f => f.value),
        tip: 'Análise metodológica detalhada.',
      };

    default:
      return { level: LEVELS.INICIANTE, focus: 'aplicabilidade', fields: [], tip: null };
  }
}

/**
 * Returns recommendation style preferences for the user's level.
 */
function adaptRecommendations(profile) {
  const level = inferExperienceLevel(profile);
  const map = {
    [LEVELS.INICIANTE]:     'Artigos com foco em aplicabilidade clínica direta.',
    [LEVELS.INTERMEDIARIO]: 'Mix de evidência prática e estudos com boa metodologia.',
    [LEVELS.AVANCADO]:      'Estudos com alta evidência e discussão de nuances.',
    [LEVELS.CLINICO]:       'Foco em implicações clínicas e casos comparativos.',
    [LEVELS.ACADEMICO]:     'Meta-análises, revisões sistemáticas e RCTs rigorosos.',
  };
  return {
    level,
    description:         map[level] || map[LEVELS.INICIANTE],
    preferHighEvidence:  level === LEVELS.AVANCADO || level === LEVELS.ACADEMICO,
    showLimitations:     level !== LEVELS.INICIANTE,
    showMethodology:     level === LEVELS.ACADEMICO,
  };
}

module.exports = { inferExperienceLevel, adaptSummary, adaptRecommendations, LEVELS };
