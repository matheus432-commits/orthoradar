// Sinal de feedback dos dentistas ("interessante" / "pouco relevante") usado
// na curadoria — desenhado para NUNCA virar lista negra:
//
//   1. SUAVIZAÇÃO BAYESIANA (prior 0.5 com peso 6): um voto isolado move o
//      sinal ~2-4%; só padrões consistentes de MUITOS dentistas têm efeito.
//   2. EFEITO LIMITADO: o multiplicador fica em [0.85, 1.15] — ajusta o
//      ranking, jamais exclui. Um tema "mal votado" continua concorrendo e
//      sendo enviado quando é o mais relevante do dia.
//   3. DUAS CAMADAS: o agregado de TODOS ajusta (pouco) a edição compartilhada
//      da especialidade; os votos do PRÓPRIO dentista pesam só na curadoria
//      pessoal dele (extras Premium), sem afetar os demais.
//   4. JANELA de 90 dias: padrões antigos expiram sozinhos.

const WINDOW_DAYS = 90;
const PRIOR_W = 6;    // peso do prior (equivale a 6 votos neutros)
const PRIOR_P = 0.5;  // prior: neutro
const MULT_MIN = 0.85, MULT_MAX = 1.15;

// (up + prior) / (n + priorW) — proporção suavizada de votos positivos.
function smoothed(up, down) {
  return (up + PRIOR_W * PRIOR_P) / (up + down + PRIOR_W);
}

// Agrega os docs de artigo_feedback da ESPECIALIDADE em dimensões de padrão
// (tema e nível de evidência). Filtra a janela de tempo aqui (sem índice novo).
function aggregateStats(docs, { now = Date.now() } = {}) {
  const cutoff = now - WINDOW_DAYS * 86400000;
  const stats = { temas: {}, niveis: {}, total: 0 };
  for (const d of docs || []) {
    const t = Date.parse(d.data || '');
    if (Number.isFinite(t) && t < cutoff) continue;
    const voto = d.voto === 'util' ? 'up' : d.voto === 'nao_util' ? 'down' : null;
    if (!voto) continue;
    stats.total++;
    for (const [dim, key] of [['temas', d.tema], ['niveis', d.nivel_evidencia]]) {
      const k = String(key || '').trim();
      if (!k) continue;
      const s = stats[dim][k] || (stats[dim][k] = { up: 0, down: 0 });
      s[voto]++;
    }
  }
  return stats;
}

// Multiplicador de ranking [0.85, 1.15] para um artigo dado o agregado da
// especialidade. Sem dados das dimensões do artigo → 1 (neutro).
function feedbackMultiplier(article, stats) {
  if (!stats) return 1;
  const parts = [];
  const t = stats.temas?.[String(article.tema || '').trim()];
  if (t && (t.up + t.down) > 0) parts.push(smoothed(t.up, t.down));
  const n = stats.niveis?.[String(article.nivel_evidencia || '').trim()];
  if (n && (n.up + n.down) > 0) parts.push(smoothed(n.up, n.down));
  if (!parts.length) return 1;
  const s = parts.reduce((a, b) => a + b, 0) / parts.length; // 0..1 (0.5 = neutro)
  const mult = 1 + (s - PRIOR_P) * 0.6;
  return Math.min(MULT_MAX, Math.max(MULT_MIN, mult));
}

// Afinidade PESSOAL por tema a partir dos votos do próprio dentista:
// { tema: bônus } com bônus limitado a ±4.5 (nunca domina o score de tema,
// que dá 10+ pontos para tema preferido — reordena, não exclui).
function personalTemaAffinity(docs, { now = Date.now() } = {}) {
  const cutoff = now - WINDOW_DAYS * 86400000;
  const net = {};
  for (const d of docs || []) {
    const t = Date.parse(d.data || '');
    if (Number.isFinite(t) && t < cutoff) continue;
    const tema = String(d.tema || '').trim();
    if (!tema) continue;
    net[tema] = (net[tema] || 0) + (d.voto === 'util' ? 1 : d.voto === 'nao_util' ? -1 : 0);
  }
  const aff = {};
  for (const [tema, v] of Object.entries(net)) {
    aff[tema] = Math.max(-3, Math.min(3, v)) * 1.5; // ±4.5
  }
  return aff;
}

module.exports = { aggregateStats, feedbackMultiplier, personalTemaAffinity, smoothed, WINDOW_DAYS, MULT_MIN, MULT_MAX };
