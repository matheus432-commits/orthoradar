// Motor de crédito do Academy — cobre TODOS os exemplos da spec (08/2026)
// mais teto percentual configurável, validade/carência e idempotência.

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { DEFAULTS, mesclar, premiumAnual, tetoCredito } = require('../precos');
const C = require('../academy/credito');

const P = { ...DEFAULTS }; // academy 59,90 · exportação 497,00 · teto 50% · carência 30d

// Assinatura com N mensalidades pagas (histórico coerente com o espelho).
function assinaturaComMeses(n, base = '2026-01-') {
  let a = C.novaAssinatura('dr@exemplo.com', '2026-01-01T00:00:00.000Z');
  for (let i = 1; i <= n; i++) {
    const r = C.aplicarPagamento(a, {
      valor: P.academy_mensal, id_transacao: 'tx-' + i, data: `${base}${String(i).padStart(2, '0')}T12:00:00.000Z`,
    }, `${base}${String(i).padStart(2, '0')}T12:00:00.000Z`);
    assert.equal(r.aplicado, true);
    a = r.assinatura;
  }
  return a;
}

describe('exemplos da spec — validação obrigatória', () => {
  test('3 meses → crédito R$179,70 → exportação R$317,30', () => {
    const a = assinaturaComMeses(3);
    assert.equal(a.credito_acumulado, 179.70);
    const m = C.calcularExportacao({ assinatura: a, precos: P });
    assert.equal(m.credito_aplicado, 179.70);
    assert.equal(m.teto_atingido, false);
    assert.equal(m.valor_final, 317.30);
  });

  test('5 meses → crédito R$299,50 limitado ao teto R$248,50 → exportação R$248,50', () => {
    const a = assinaturaComMeses(5);
    assert.equal(a.credito_acumulado, 299.50);
    const m = C.calcularExportacao({ assinatura: a, precos: P });
    assert.equal(m.teto_credito, 248.50);
    assert.equal(m.credito_aplicado, 248.50);
    assert.equal(m.teto_atingido, true);
    assert.equal(m.valor_final, 248.50);
  });

  test('12 meses → teto R$248,50 → exportação R$248,50 (mínimo sempre pago)', () => {
    const m = C.calcularExportacao({ assinatura: assinaturaComMeses(12), precos: P });
    assert.equal(m.credito_aplicado, 248.50);
    assert.equal(m.valor_final, 248.50);
    assert.equal(m.valor_final, m.valor_cheio - m.teto_credito); // nunca abaixo de 50%
  });

  test('não assinante → paga R$497,00 integrais', () => {
    const m = C.calcularExportacao({ assinatura: null, precos: P });
    assert.equal(m.credito_aplicado, 0);
    assert.equal(m.valor_final, 497.00);
    assert.equal(m.motivo_credito, 'sem_assinatura');
  });

  test('4 meses, exportou (zerou), +2 meses → novo crédito R$119,80', () => {
    let a = assinaturaComMeses(4);
    a = C.consumirCredito(a, '2026-05-01T00:00:00.000Z');
    assert.equal(a.credito_acumulado, 0);
    assert.equal(a.meses_pagos, 0);
    for (let i = 5; i <= 6; i++) {
      a = C.aplicarPagamento(a, { valor: P.academy_mensal, id_transacao: 'tx-' + i, data: `2026-06-0${i}T00:00:00.000Z` }).assinatura;
    }
    assert.equal(a.credito_acumulado, 119.80);
    const m = C.calcularExportacao({ assinatura: a, precos: P });
    assert.equal(m.valor_final, 377.20); // 497 − 119,80
  });
});

describe('teto como PERCENTUAL configurável', () => {
  test('teto acompanha automaticamente a mudança do preço de exportação', () => {
    const caro = mesclar({ exportacao_valor: 800 });
    assert.equal(tetoCredito(caro), 400.00);
    const m = C.calcularExportacao({ credito: 999, precos: caro });
    assert.equal(m.credito_aplicado, 400.00);
    assert.equal(m.valor_final, 400.00);
  });

  test('percentual diferente (ex.: 40%) muda o teto sem tocar no motor', () => {
    const p40 = mesclar({ teto_credito_pct: 40 });
    assert.equal(tetoCredito(p40), 198.80);
    const m = C.calcularExportacao({ credito: 500, precos: p40 });
    assert.equal(m.valor_final, 298.20);
  });

  test('crédito nunca abate mais que o valor da exportação (teto 100% degenerado)', () => {
    const livre = mesclar({ teto_credito_pct: 100 });
    const m = C.calcularExportacao({ credito: 9999, precos: livre });
    assert.equal(m.valor_final, 0);
    assert.equal(m.credito_aplicado, 497.00);
  });
});

describe('validade — benefício de assinante ativo', () => {
  test('cancelou: crédito vale durante a carência de 30 dias', () => {
    let a = assinaturaComMeses(3);
    a = C.cancelarAssinatura(a, P, '2026-04-01T00:00:00.000Z');
    assert.equal(a.data_expiracao_credito, '2026-05-01T00:00:00.000Z');
    const dentro = C.creditoDisponivel(a, P, '2026-04-20T00:00:00.000Z');
    assert.equal(dentro.credito, 179.70);
    assert.equal(dentro.motivo, 'carencia');
  });

  test('após 30 dias sem assinatura: saldo expira integralmente', () => {
    let a = C.cancelarAssinatura(assinaturaComMeses(3), P, '2026-04-01T00:00:00.000Z');
    const fora = C.creditoDisponivel(a, P, '2026-05-02T00:00:00.000Z');
    assert.equal(fora.credito, 0);
    assert.equal(fora.motivo, 'expirado');
    const m = C.calcularExportacao({ assinatura: a, precos: P, hoje: '2026-05-02T00:00:00.000Z' });
    assert.equal(m.valor_final, 497.00);
  });

  test('job diário expira o saldo vencido (e só ele)', () => {
    const cancelada = C.cancelarAssinatura(assinaturaComMeses(2), P, '2026-04-01T00:00:00.000Z');
    const antes = C.expirarSeVencido(cancelada, P, '2026-04-15T00:00:00.000Z');
    assert.equal(antes.expirou, false);
    const depois = C.expirarSeVencido(cancelada, P, '2026-05-10T00:00:00.000Z');
    assert.equal(depois.expirou, true);
    assert.equal(depois.assinatura.credito_acumulado, 0);
    const ativa = C.expirarSeVencido(assinaturaComMeses(2), P, '2027-01-01T00:00:00.000Z');
    assert.equal(ativa.expirou, false); // ativa nunca expira
  });

  test('reativar NÃO restaura crédito expirado — acúmulo recomeça do zero', () => {
    const cancelada = C.cancelarAssinatura(assinaturaComMeses(5), P, '2026-04-01T00:00:00.000Z');
    const re = C.reativarAssinatura(cancelada, P, '2026-06-01T00:00:00.000Z');
    assert.equal(re.ativa, true);
    assert.equal(re.credito_acumulado, 0);
    assert.equal(re.meses_pagos, 0);
  });

  test('reativar DENTRO da carência preserva o saldo', () => {
    const cancelada = C.cancelarAssinatura(assinaturaComMeses(3), P, '2026-04-01T00:00:00.000Z');
    const re = C.reativarAssinatura(cancelada, P, '2026-04-10T00:00:00.000Z');
    assert.equal(re.ativa, true);
    assert.equal(re.credito_acumulado, 179.70);
    assert.equal(re.data_cancelamento, null);
  });
});

describe('acúmulo e reconciliação', () => {
  test('pagamento é idempotente por id_transacao', () => {
    let a = assinaturaComMeses(1);
    const rep = C.aplicarPagamento(a, { valor: P.academy_mensal, id_transacao: 'tx-1' });
    assert.equal(rep.aplicado, false);
    assert.equal(rep.motivo, 'duplicado');
    assert.equal(rep.assinatura.credito_acumulado, 59.90);
  });

  test('pagamento sem id ou com valor inválido não credita', () => {
    const a = C.novaAssinatura('x@y.com');
    assert.equal(C.aplicarPagamento(a, { valor: 59.90, id_transacao: '' }).aplicado, false);
    assert.equal(C.aplicarPagamento(a, { valor: 0, id_transacao: 'tx' }).aplicado, false);
  });

  test('expirar move o corte: reconciliar NUNCA restaura saldo expirado (sem flip-flop)', () => {
    const cancelada = C.cancelarAssinatura(assinaturaComMeses(3), P, '2026-04-01T00:00:00.000Z');
    const { assinatura: expirada, expirou } = C.expirarSeVencido(cancelada, P, '2026-05-10T00:00:00.000Z');
    assert.equal(expirou, true);
    assert.equal(expirada.credito_acumulado, 0);
    const r = C.reconciliar(expirada, '2026-05-10T01:00:00.000Z');
    assert.equal(r.corrigiu, false, 'reconciliação estável após expirar');
    assert.equal(r.assinatura.credito_acumulado, 0);
  });

  test('reconciliar recomputa o espelho a partir do histórico pós-consumo', () => {
    let a = assinaturaComMeses(4);
    a = C.consumirCredito(a, '2026-05-01T00:00:00.000Z');
    a = C.aplicarPagamento(a, { valor: 59.90, id_transacao: 'tx-9', data: '2026-06-05T00:00:00.000Z' }).assinatura;
    const drift = { ...a, credito_acumulado: 999, meses_pagos: 7 }; // corrompe o espelho
    const r = C.reconciliar(drift, '2026-06-10T00:00:00.000Z');
    assert.equal(r.corrigiu, true);
    assert.equal(r.assinatura.credito_acumulado, 59.90);
    assert.equal(r.assinatura.meses_pagos, 1);
    assert.equal(C.reconciliar(r.assinatura).corrigiu, false); // estável
  });
});

describe('transparência — simulação e memória de cálculo', () => {
  test('simulação 1/3/6 meses para a tela de assinatura', () => {
    assert.equal(C.simularExportacao(1, P).valor_final, 437.10);
    assert.equal(C.simularExportacao(3, P).valor_final, 317.30);
    assert.equal(C.simularExportacao(6, P).valor_final, 248.50); // teto
    assert.equal(C.simularExportacao(6, P).teto_atingido, true);
  });

  test('memória de cálculo expõe todos os campos da tela de confirmação', () => {
    const m = C.calcularExportacao({ assinatura: assinaturaComMeses(3), precos: P });
    for (const campo of ['valor_cheio', 'credito_acumulado', 'teto_credito', 'credito_aplicado', 'teto_atingido', 'valor_final']) {
      assert.ok(campo in m, 'faltou ' + campo);
    }
  });
});

describe('preços derivados (fonte única)', () => {
  test('Premium: mensal 29,90 · anual derivado 287,04 (equiv 23,92) — "2 meses grátis"', () => {
    assert.equal(DEFAULTS.premium_mensal, 29.90);
    const anual = premiumAnual();
    assert.equal(anual.valor, 287.04);
    assert.equal(anual.mensalEquiv, 23.92);
  });

  test('Academy 59,90 · exportação 497,00 · teto 50% = 248,50 · carência 30d', () => {
    assert.equal(DEFAULTS.academy_mensal, 59.90);
    assert.equal(DEFAULTS.exportacao_valor, 497.00);
    assert.equal(tetoCredito(), 248.50);
    assert.equal(DEFAULTS.carencia_credito_dias, 30);
  });

  test('mesclar ignora override inválido e aceita válido', () => {
    const p = mesclar({ exportacao_valor: 'abc', academy_mensal: 79.90, chave_estranha: 1 });
    assert.equal(p.exportacao_valor, 497.00);
    assert.equal(p.academy_mensal, 79.90);
    assert.equal('chave_estranha' in p, false);
  });
});
