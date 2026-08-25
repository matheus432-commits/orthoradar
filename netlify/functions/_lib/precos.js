// Fonte ÚNICA de preços da plataforma (diretriz 08/2026).
//
// Nenhum valor de preço deve ser hardcoded fora deste arquivo: módulos leem
// os DEFAULTS daqui (contexto síncrono) ou carregarPrecos(db) (funções), que
// aplica overrides do doc Firestore `config/precos` — editável no admin sem
// deploy. O plano anual do Premium é DERIVADO (desconto %), nunca digitado:
// se o preço mensal mudar, o anual acompanha. Comunicação do anual é SEMPRE
// "2 meses grátis" — nunca "20% off".

const log = require('./logger');

const DEFAULTS = {
  premium_mensal:            29.90,  // R$/mês — OdontoFeed Premium (curadoria diária)
  premium_anual_desconto_pct: 20,    // % — comunicado como "2 meses grátis"
  academy_mensal:            59.90,  // R$/mês — assinatura OdontoFeed Academy
  exportacao_valor:          497.00, // R$ por trabalho exportado no Academy
  teto_credito_pct:          50,     // % máx. da exportação abatível por crédito
  carencia_credito_dias:     30,     // dias de validade do crédito após cancelar
};

// ── Aritmética em CENTAVOS (evita 0.1+0.2) ───────────────────────────────────
function centavos(reais) { return Math.round(Number(reais) * 100); }
function reais(cent)     { return Math.round(cent) / 100; }

// Deriva o plano anual do Premium a partir do mensal + desconto %.
// 29,90 × 12 × 0,80 = R$ 287,04 (equivalente a R$ 23,92/mês).
function premiumAnual(p = DEFAULTS) {
  const totalCent = Math.round(centavos(p.premium_mensal) * 12 * (100 - p.premium_anual_desconto_pct) / 100);
  const equivCent = Math.round(totalCent / 12);
  return { valor: reais(totalCent), valorCentavos: totalCent, mensalEquiv: reais(equivCent), mensalEquivCentavos: equivCent };
}

// Teto de crédito em R$, derivado do percentual — se exportacao_valor mudar,
// o teto acompanha automaticamente (exigência da spec).
function tetoCredito(p = DEFAULTS) {
  return reais(Math.round(centavos(p.exportacao_valor) * p.teto_credito_pct / 100));
}

// Merge dos overrides persistidos sobre os defaults. Só aceita chaves
// conhecidas com número válido — um doc corrompido nunca derruba preços.
function mesclar(overrides) {
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    const v = overrides && overrides[k];
    if (typeof v === 'number' && isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

// Carrega config_precos do Firestore (doc `config/precos`); em erro/ausência,
// devolve os DEFAULTS — preço nunca fica indisponível.
async function carregarPrecos(db) {
  try {
    const doc = await db.getDoc('config', 'precos');
    return mesclar(doc || {});
  } catch (err) {
    log.warn('[precos] falha ao carregar config/precos — usando defaults', { err: err.message });
    return { ...DEFAULTS };
  }
}

function formatBRL(v) {
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
}

module.exports = { DEFAULTS, carregarPrecos, mesclar, premiumAnual, tetoCredito, centavos, reais, formatBRL };
