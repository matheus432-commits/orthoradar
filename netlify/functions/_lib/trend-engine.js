// Trend intelligence engine — classifies articles into scientific radar signals.
//
// Signals:
//   emAlta           — high engagement in the last 30 days
//   crescimentoRapido — rapidly gaining traction (new + climbing engagement)
//   emergente        — very recent (< 14d), high relevance, low views yet
//   consensoClinico  — high-evidence, multiply recommended, stable engagement
//   debateCientifico — lower evidence but high click/discussion rate

const { computeCuratedScore } = require('./digest-ranking');

// Age in days from ISO date string
function ageDays(dateStr) {
  if (!dateStr) return 9999;
  return (Date.now() - new Date(dateStr).getTime()) / (24 * 3600 * 1000);
}

function engagementTotal(a) {
  return (a.emailCliques || 0) * 4 + (a.curtidas || 0) * 3 + (a.leituras || 0) * 0.5;
}

// Velocity: engagement per day since publication (capped at 30 days)
function velocity(a) {
  const age = Math.max(1, Math.min(30, ageDays(a.data)));
  return engagementTotal(a) / age;
}

const HIGH_EV = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
const LOW_EV  = new Set(['Revisão Narrativa', 'Caso Clínico', 'In Vitro', 'Estudo Animal']);

/**
 * Classifies a list of active articles into radar signal buckets.
 *
 * @param {Array}  articles   — active articles from Firestore
 * @param {number} limitEach  — max items per signal category
 * @returns {{ emAlta, crescimentoRapido, emergente, consensoClinico, debateCientifico }}
 */
function classifyTrends(articles, limitEach = 5) {
  const emAlta           = [];
  const crescimentoRapido = [];
  const emergente        = [];
  const consensoClinico  = [];
  const debateCientifico = [];

  for (const a of articles) {
    const age  = ageDays(a.data);
    const eng  = engagementTotal(a);
    const vel  = velocity(a);
    const ev   = a.nivel_evidencia || '';
    const rs   = a.relevanceScore || 50;

    // Em Alta: substantial engagement, published within 30 days
    if (age <= 30 && eng >= 6) {
      emAlta.push({ ...a, _trendScore: eng + computeCuratedScore(a) * 0.3 });
    }

    // Crescimento Rápido: velocity > 0.5 eng/day; not older than 60 days
    if (age <= 60 && vel >= 0.5) {
      crescimentoRapido.push({ ...a, _trendScore: vel * 10 + rs * 0.2 });
    }

    // Emergente: brand new (≤14d), high relevance, but low raw engagement yet
    if (age <= 14 && rs >= 65 && eng < 4) {
      emergente.push({ ...a, _trendScore: rs + (14 - age) });
    }

    // Consenso Clínico: high evidence, any age
    if (HIGH_EV.has(ev)) {
      consensoClinico.push({ ...a, _trendScore: computeCuratedScore(a) });
    }

    // Debate Científico: lower evidence but noteworthy click/discussion rate
    if (LOW_EV.has(ev) && eng >= 3) {
      debateCientifico.push({ ...a, _trendScore: eng + vel * 5 });
    }
  }

  const top = (arr) =>
    arr
      .sort((a, b) => b._trendScore - a._trendScore)
      .slice(0, limitEach)
      .map(({ _trendScore, ...rest }) => rest);

  return {
    emAlta:            top(emAlta),
    crescimentoRapido: top(crescimentoRapido),
    emergente:         top(emergente),
    consensoClinico:   top(consensoClinico),
    debateCientifico:  top(debateCientifico),
  };
}

module.exports = { classifyTrends, ageDays, engagementTotal, velocity };
