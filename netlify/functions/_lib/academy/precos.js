// ACADEMY — CONFIG DE PREÇOS (spec de monetização 25/08).
//
// FONTE ÚNICA de todo valor monetário do Academy (e dos preços novos do
// Premium): o doc global `config/precos` no Firestore, editável no painel
// admin. NENHUM preço fica hardcoded fora dos DEFAULTS deste módulo — e os
// defaults existem só como semente/fallback quando o doc ainda não existe.
//
// TETO DO CRÉDITO é PERCENTUAL (teto_credito_pct), nunca valor fixo: se o
// preço da exportação mudar, o teto acompanha sozinho (regra 2 da spec).

const DEFAULTS = {
  premium_mensal: 29.90,
  premium_anual_desconto_pct: 20,   // comunicação SEMPRE "2 meses grátis"
  academy_mensal: 59.90,
  exportacao_valor: 497.00,
  teto_credito_pct: 50,
  carencia_credito_dias: 30,
};

const round2 = (n) => Math.round(n * 100) / 100;

// Valores DERIVADOS (nunca armazenados — sempre recalculados da config).
function derivados(precos) {
  const anual = round2(precos.premium_mensal * 12 * (1 - precos.premium_anual_desconto_pct / 100));
  return {
    premium_anual: anual,
    premium_anual_mensal_equivalente: round2(anual / 12),
    teto_credito: round2(precos.exportacao_valor * precos.teto_credito_pct / 100),
    minimo_pago_exportacao: round2(precos.exportacao_valor - precos.exportacao_valor * precos.teto_credito_pct / 100),
  };
}

// Carrega config/precos do banco, com defaults para campos ausentes.
async function carregarPrecos(db) {
  let doc = null;
  try { doc = await db.getDoc('config', 'precos'); } catch { /* usa defaults */ }
  const precos = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (doc && typeof doc[k] === 'number' && doc[k] >= 0) precos[k] = doc[k];
  }
  return { ...precos, ...derivados(precos) };
}

const fmtBRL = (n) => 'R$ ' + Number(n).toFixed(2).replace('.', ',');

module.exports = { DEFAULTS, derivados, carregarPrecos, fmtBRL, round2 };
