// Medidor CENTRAL de custo de IA (decisão do fundador 31/07): TODA chamada à
// API Anthropic registra aqui os tokens reais devolvidos pela API (usage), com
// preço POR MODELO — o medidor antigo usava um preço único (Haiku) e só cobria
// um arquivo, subestimando o custo real do dia. No fim de cada runner o resumo
// por etapa é impresso no log ([custo]), então cada run do Actions mostra
// exatamente quanto custou e onde.

const log = require('./logger');

// USD por 1M tokens (tabela Anthropic). Modelo fora da tabela usa o preço de
// Sonnet (conservador — melhor superestimar que subestimar).
const PRECOS = {
  'claude-sonnet-5':            { in: 3.00, out: 15.00 },
  'claude-haiku-4-5-20251001':  { in: 1.00, out: 5.00 },
  'claude-haiku-4-5':           { in: 1.00, out: 5.00 },
};
const PRECO_PADRAO = { in: 3.00, out: 15.00 };

let _etapas = {}; // etapa -> { chamadas, tokensIn, tokensOut, usd }

function registrar(model, usage, etapa = 'outros') {
  const p = PRECOS[String(model || '')] || PRECO_PADRAO;
  const tin = Number(usage?.input_tokens || 0);
  const tout = Number(usage?.output_tokens || 0);
  const usd = (tin / 1e6) * p.in + (tout / 1e6) * p.out;
  const e = _etapas[etapa] || (_etapas[etapa] = { chamadas: 0, tokensIn: 0, tokensOut: 0, usd: 0 });
  e.chamadas++; e.tokensIn += tin; e.tokensOut += tout; e.usd += usd;
  return usd;
}

function resumoCusto() {
  const etapas = {};
  let totalUsd = 0, totalChamadas = 0;
  for (const [k, v] of Object.entries(_etapas)) {
    etapas[k] = { chamadas: v.chamadas, usd: Number(v.usd.toFixed(4)) };
    totalUsd += v.usd; totalChamadas += v.chamadas;
  }
  return { total_usd: Number(totalUsd.toFixed(4)), chamadas: totalChamadas, etapas };
}

// Imprime o resumo no log do run (chamar no fim de cada runner).
function logCusto(contexto) {
  const r = resumoCusto();
  log.info(`[custo] ${contexto}`, r);
  console.log(`[CUSTO ${contexto}] total US$ ${r.total_usd} em ${r.chamadas} chamadas:`,
    Object.entries(r.etapas).map(([k, v]) => `${k}=US$${v.usd}(${v.chamadas}x)`).join(' '));
  return r;
}

function zerarCusto() { _etapas = {}; }

module.exports = { registrar, resumoCusto, logCusto, zerarCusto };
