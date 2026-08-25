// MOTOR DE CRÉDITO DO ACADEMY (spec de monetização 25/08) — todos os
// exemplos numéricos da spec + teto percentual + validade/carência/expiração.
const { test, describe } = require('node:test');
const assert = require('node:assert');

const { DEFAULTS, derivados, fmtBRL } = require('../academy/precos');
const { calcularExportacao, aplicarPagamento, consumirCredito, aplicarCancelamento, expirarSeVencida, simularMeses, creditoDisponivel } = require('../academy/credito');

const PRECOS = { ...DEFAULTS, ...derivados(DEFAULTS) };
const assinaturaComMeses = (n) => {
  let a = { ativa: true, meses_pagos: 0, credito_acumulado: 0, historico_pagamentos: [] };
  for (let i = 1; i <= n; i++) a = aplicarPagamento(a, PRECOS, { id_transacao: 'tx-' + i }).assinatura;
  return a;
};

describe('exemplos EXATOS da spec', () => {
  test('3 meses → crédito R$ 179,70 → exportação sai por R$ 317,30', () => {
    const c = calcularExportacao(assinaturaComMeses(3), PRECOS);
    assert.equal(c.credito_disponivel, 179.70);
    assert.equal(c.credito_aplicado, 179.70);
    assert.equal(c.valor_pago, 317.30);
    assert.equal(c.teto_atingido, false);
  });
  test('5 meses → crédito R$ 299,50 limitado ao teto R$ 248,50 → paga R$ 248,50', () => {
    const c = calcularExportacao(assinaturaComMeses(5), PRECOS);
    assert.equal(c.credito_disponivel, 299.50);
    assert.equal(c.teto_credito, 248.50);
    assert.equal(c.credito_aplicado, 248.50);
    assert.equal(c.valor_pago, 248.50);
    assert.equal(c.teto_atingido, true);
  });
  test('12 meses → segue no teto → paga R$ 248,50', () => {
    const c = calcularExportacao(assinaturaComMeses(12), PRECOS);
    assert.equal(c.valor_pago, 248.50);
    assert.equal(c.teto_atingido, true);
  });
  test('não assinante → paga R$ 497,00 integrais', () => {
    const c = calcularExportacao(null, PRECOS);
    assert.equal(c.credito_aplicado, 0);
    assert.equal(c.valor_pago, 497.00);
    assert.equal(c.situacao_credito, 'sem_assinatura');
  });
  test('4 meses → exporta (zera) → +2 meses → novo crédito R$ 119,80', () => {
    let a = assinaturaComMeses(4);
    assert.equal(calcularExportacao(a, PRECOS).credito_aplicado, 239.60);
    a = consumirCredito(a);
    assert.equal(a.credito_acumulado, 0);
    assert.equal(a.meses_pagos, 0, 'acúmulo recomeça do zero');
    a = aplicarPagamento(a, PRECOS, { id_transacao: 'tx-5' }).assinatura;
    a = aplicarPagamento(a, PRECOS, { id_transacao: 'tx-6' }).assinatura;
    const c = calcularExportacao(a, PRECOS);
    assert.equal(c.credito_disponivel, 119.80);
    assert.equal(c.valor_pago, 377.20);
  });
});

describe('teto é PERCENTUAL — acompanha o preço da exportação', () => {
  test('exportação a R$ 600 → teto vira R$ 300 sozinho; mínimo pago R$ 300', () => {
    const precos = { ...PRECOS, exportacao_valor: 600.00 };
    const c = calcularExportacao(assinaturaComMeses(12), precos);
    assert.equal(c.teto_credito, 300.00);
    assert.equal(c.valor_pago, 300.00);
  });
  test('teto_credito_pct configurável (40% → teto R$ 198,80)', () => {
    const precos = { ...PRECOS, teto_credito_pct: 40 };
    const c = calcularExportacao(assinaturaComMeses(12), precos);
    assert.equal(c.teto_credito, 198.80);
    assert.equal(c.valor_pago, 298.20);
  });
});

describe('validade: carência de 30 dias e expiração definitiva', () => {
  test('cancelou: crédito segue válido DENTRO da carência', () => {
    const a = aplicarCancelamento(assinaturaComMeses(3), PRECOS, '2026-08-01');
    assert.equal(a.data_expiracao_credito, '2026-08-31');
    const c = calcularExportacao(a, PRECOS, '2026-08-31');
    assert.equal(c.credito_aplicado, 179.70, 'último dia da carência ainda vale');
    assert.equal(c.situacao_credito, 'carencia');
  });
  test('após 30 dias sem assinatura o saldo expira INTEGRALMENTE', () => {
    const a = aplicarCancelamento(assinaturaComMeses(3), PRECOS, '2026-08-01');
    const c = calcularExportacao(a, PRECOS, '2026-09-01');
    assert.equal(c.credito_aplicado, 0);
    assert.equal(c.valor_pago, 497.00);
    assert.equal(c.situacao_credito, 'expirado');
  });
  test('job de expiração zera o saldo; reativar NÃO restaura', () => {
    let a = aplicarCancelamento(assinaturaComMeses(5), PRECOS, '2026-08-01');
    const r = expirarSeVencida(a, PRECOS, '2026-09-02');
    assert.equal(r.expirou, true);
    assert.equal(r.assinatura.credito_acumulado, 0);
    // reativa pagando um mês novo: só o mês novo conta
    const nova = aplicarPagamento(r.assinatura, PRECOS, { id_transacao: 'tx-nova' }).assinatura;
    assert.equal(nova.credito_acumulado, 59.90);
    assert.equal(calcularExportacao(nova, PRECOS).valor_pago, 437.10);
  });
  test('dentro da carência o job NÃO expira', () => {
    const a = aplicarCancelamento(assinaturaComMeses(2), PRECOS, '2026-08-01');
    assert.equal(expirarSeVencida(a, PRECOS, '2026-08-20').expirou, false);
  });
});

describe('acúmulo idempotente + simulação de transparência', () => {
  test('mesma id_transacao NUNCA credita duas vezes (webhook/job podem repetir)', () => {
    let a = assinaturaComMeses(1);
    const r = aplicarPagamento(a, PRECOS, { id_transacao: 'tx-1' });
    assert.equal(r.duplicado, true);
    assert.equal(r.assinatura.credito_acumulado, 59.90);
  });
  test('simulação 1/3/6 meses (tela de assinatura)', () => {
    const s = simularMeses(PRECOS, [1, 3, 6]);
    assert.deepEqual(s.map(x => x.exportacao_por), [437.10, 317.30, 248.50]);
    assert.equal(s[2].teto_atingido, true, '6 meses já bate o teto');
  });
  test('creditoDisponivel de assinante ativo nunca expira', () => {
    const { situacao, credito } = creditoDisponivel(assinaturaComMeses(3), PRECOS, '2030-01-01');
    assert.equal(situacao, 'ativo');
    assert.equal(credito, 179.70);
  });
  test('formatação BRL e derivados do Premium (2 meses grátis = 20% real)', () => {
    assert.equal(fmtBRL(497), 'R$ 497,00');
    const d = derivados(DEFAULTS);
    assert.equal(d.premium_anual, 287.04);
    assert.equal(d.premium_anual_mensal_equivalente, 23.92);
    assert.equal(d.teto_credito, 248.50);
    assert.equal(d.minimo_pago_exportacao, 248.50);
  });
});
