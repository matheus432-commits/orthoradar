// ACADEMY — MOTOR DE CRÉDITO DE EXPORTAÇÃO (spec de monetização 25/08).
//
// Modelo: usar o Academy é GRÁTIS do início ao fim; a cobrança existe só na
// EXPORTAÇÃO. A assinatura mensal gera crédito que abate a exportação.
//
// Regras (exatamente as da spec):
//   1. ACÚMULO  — academy_mensal de crédito por mensalidade efetivamente paga;
//   2. TETO     — o crédito nunca abate mais que teto_credito_pct% (config) do
//                 valor da exportação; o mínimo pago acompanha o preço;
//   3. CONSUMO  — exportou: crédito aplicado é consumido e o saldo ZERA;
//   4. VALIDADE — benefício de assinante ATIVO; cancelou: carência de
//                 carencia_credito_dias; depois disso o saldo expira TODO e
//                 reativar NÃO restaura (o acúmulo recomeça do zero);
//   5. NÃO ASSINANTE — exporta pagando o valor cheio; assinar nunca é
//                 obrigatório para concluir um trabalho.
//
// Módulo PURO (sem I/O) — as functions passam o doc da assinatura e a config;
// os testes cobrem todos os exemplos numéricos da spec.

const { round2 } = require('./precos');

const dia = (d) => String(d || '').slice(0, 10);

// Crédito DISPONÍVEL da assinatura na data `hoje` (validade aplicada).
// Devolve { credito, situacao } — situacao ∈ ativo | carencia | expirado | sem_assinatura.
function creditoDisponivel(assinatura, precos, hoje) {
  const h = dia(hoje || new Date().toISOString());
  if (!assinatura) return { credito: 0, situacao: 'sem_assinatura' };
  const saldo = round2(Number(assinatura.credito_acumulado) || 0);
  if (assinatura.ativa) return { credito: saldo, situacao: 'ativo' };
  if (!assinatura.data_cancelamento) return { credito: 0, situacao: 'sem_assinatura' };
  const expira = dia(assinatura.data_expiracao_credito ||
    new Date(new Date(dia(assinatura.data_cancelamento) + 'T00:00:00Z').getTime() + precos.carencia_credito_dias * 86400000).toISOString());
  if (h <= expira) return { credito: saldo, situacao: 'carencia', expiraEm: expira };
  return { credito: 0, situacao: 'expirado' };
}

// MEMÓRIA DE CÁLCULO da exportação — o que a tela de confirmação mostra e o
// que fica gravado no doc exportacao:{projeto}.
function calcularExportacao(assinatura, precos, hoje) {
  const { credito, situacao, expiraEm } = creditoDisponivel(assinatura, precos, hoje);
  const valorCheio = round2(precos.exportacao_valor);
  const teto = round2(valorCheio * precos.teto_credito_pct / 100);
  const creditoAplicado = round2(Math.min(credito, teto));
  return {
    valor_cheio: valorCheio,
    credito_disponivel: credito,
    teto_credito: teto,
    credito_aplicado: creditoAplicado,
    teto_atingido: credito > teto,
    valor_pago: round2(valorCheio - creditoAplicado),
    situacao_credito: situacao,
    credito_expira_em: expiraEm || null,
  };
}

// Registro de uma mensalidade PAGA — idempotente por id_transacao (o job
// mensal e o webhook do gateway podem repetir sem duplicar crédito).
function aplicarPagamento(assinatura, precos, { data, valor, id_transacao }) {
  const hist = Array.isArray(assinatura.historico_pagamentos) ? assinatura.historico_pagamentos : [];
  if (hist.some(p => p.id_transacao === id_transacao)) return { assinatura, duplicado: true };
  return {
    duplicado: false,
    assinatura: {
      ...assinatura,
      ativa: true,
      meses_pagos: (Number(assinatura.meses_pagos) || 0) + 1,
      credito_acumulado: round2((Number(assinatura.credito_acumulado) || 0) + (valor ?? precos.academy_mensal)),
      historico_pagamentos: [...hist, { data: data || new Date().toISOString(), valor: round2(valor ?? precos.academy_mensal), id_transacao }],
    },
  };
}

// CONSUMO na exportação (regra 3): o saldo ZERA — não sobra troco de crédito;
// o acúmulo recomeça para o próximo trabalho.
function consumirCredito(assinatura) {
  return { ...assinatura, credito_acumulado: 0, meses_pagos: 0, credito_consumido_em: new Date().toISOString() };
}

// Cancelamento: marca a carência; o crédito segue utilizável até expirar.
function aplicarCancelamento(assinatura, precos, hoje) {
  const h = dia(hoje || new Date().toISOString());
  const expira = dia(new Date(new Date(h + 'T00:00:00Z').getTime() + precos.carencia_credito_dias * 86400000).toISOString());
  return { ...assinatura, ativa: false, data_cancelamento: h, data_expiracao_credito: expira };
}

// Job diário: expira o saldo de canceladas além da carência. Reativar depois
// NUNCA restaura — por isso o saldo é zerado de fato, não só ocultado.
function expirarSeVencida(assinatura, precos, hoje) {
  const { situacao } = creditoDisponivel(assinatura, precos, hoje);
  if (situacao !== 'expirado' || !(Number(assinatura.credito_acumulado) > 0)) return { assinatura, expirou: false };
  return {
    expirou: true,
    assinatura: { ...assinatura, credito_acumulado: 0, meses_pagos: 0, credito_expirado_em: new Date().toISOString() },
  };
}

// Simulação para a tela de assinatura (transparência): quanto a exportação
// custaria após N meses de assinatura.
function simularMeses(precos, meses = [1, 3, 6]) {
  return meses.map(m => {
    const bruto = round2(m * precos.academy_mensal);
    const sim = calcularExportacao({ ativa: true, credito_acumulado: bruto }, precos);
    return { meses: m, credito: bruto, credito_aplicado: sim.credito_aplicado, teto_atingido: sim.teto_atingido, exportacao_por: sim.valor_pago };
  });
}

module.exports = { creditoDisponivel, calcularExportacao, aplicarPagamento, consumirCredito, aplicarCancelamento, expirarSeVencida, simularMeses };
