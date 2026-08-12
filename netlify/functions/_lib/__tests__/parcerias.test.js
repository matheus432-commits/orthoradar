// SISTEMA DE PARCERIAS (12/08) — a regra central é o MAX(data_resgate,
// data_inicio_cobranca): o aluno resgata hoje, mas os 90 dias só contam a
// partir do início da cobrança (texto honesto na página de resgate). Estes
// testes cravam a matemática, a validação do cupom e as proteções.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const P = require('../parcerias');

describe('parcerias — regra MAX(data_resgate, data_inicio_cobranca)', () => {
  test('resgate ANTES da cobrança: benefício começa no início da cobrança', () => {
    assert.equal(P.inicioBeneficio('2026-08-12', '2026-10-01'), '2026-10-01');
  });
  test('resgate DEPOIS da cobrança ativa: benefício começa no resgate', () => {
    assert.equal(P.inicioBeneficio('2026-11-15', '2026-10-01'), '2026-11-15');
  });
  test('cobrança ainda não ativada: início é null (aguardando)', () => {
    assert.equal(P.inicioBeneficio('2026-08-12', null), null);
    assert.equal(P.fimBeneficio(null), null);
  });
  test('fim = início + 90 dias exatos', () => {
    assert.equal(P.fimBeneficio('2026-10-01'), '2026-12-30');
    assert.equal(P.BENEFICIO_DIAS, 90);
  });
  test('ativação em lote só toca quem AGUARDA e aplica o MAX', () => {
    const r = { status: P.STATUS.AGUARDANDO, data_resgate: '2026-08-12' };
    const c = P.camposAtivacaoLote(r, '2026-10-01');
    assert.deepEqual(c, {
      data_inicio_beneficio: '2026-10-01',
      data_fim_beneficio: '2026-12-30',
      status: P.STATUS.ATIVO,
    });
    assert.equal(P.camposAtivacaoLote({ status: P.STATUS.ATIVO }, '2026-10-01'), null, 'ativo não é reprocessado (idempotência do lote)');
    assert.equal(P.camposAtivacaoLote({ status: P.STATUS.ENCERRADO }, '2026-10-01'), null);
  });
  test('resgate novo com cobrança JÁ ativa nasce beneficio_ativo com 90 dias', () => {
    const c = P.camposNovoResgate({
      parceiroId: 'p1', cupom: 'impl-nayara', email: 'A@B.com', nome: ' Ana ',
      cobrancaAtiva: true, dataInicioCobranca: '2026-10-01', hoje: '2026-11-15',
    });
    assert.equal(c.status, P.STATUS.ATIVO);
    assert.equal(c.data_inicio_beneficio, '2026-11-15');
    assert.equal(c.data_fim_beneficio, P.fimBeneficio('2026-11-15'));
    assert.equal(c.cupom_id, 'IMPL-NAYARA');
    assert.equal(c.usuario_email, 'a@b.com');
    assert.equal(c.usuario_nome, 'Ana');
  });
  test('resgate novo SEM cobrança ativa nasce aguardando, com datas null', () => {
    const c = P.camposNovoResgate({ parceiroId: 'p1', cupom: 'X', email: 'a@b.com', nome: 'Ana', cobrancaAtiva: false, hoje: '2026-08-12' });
    assert.equal(c.status, P.STATUS.AGUARDANDO);
    assert.equal(c.data_inicio_beneficio, null);
    assert.equal(c.data_fim_beneficio, null);
  });
});

describe('parcerias — validação do cupom', () => {
  const p = { ativo: true, validade_cupom: '2027-02-12', limite_resgates: 100 };
  test('cupom saudável passa', () => {
    assert.deepEqual(P.validarResgate(p, 50, '2026-08-12'), { ok: true });
  });
  test('inexistente / inativo / expirado / esgotado — cada um com seu motivo', () => {
    assert.equal(P.validarResgate(null, 0).motivo, 'cupom_inexistente');
    assert.equal(P.validarResgate({ ...p, ativo: false }, 0).motivo, 'cupom_inativo');
    assert.equal(P.validarResgate(p, 0, '2027-02-13').motivo, 'cupom_expirado');
    assert.equal(P.validarResgate(p, 100, '2026-08-12').motivo, 'limite_esgotado');
  });
  test('limite null/vazio = ilimitado (spec)', () => {
    assert.ok(P.validarResgate({ ...p, limite_resgates: null }, 99999, '2026-08-12').ok);
    assert.ok(P.validarResgate({ ...p, limite_resgates: '' }, 99999, '2026-08-12').ok);
  });
  test('validade padrão do cupom = criação + 6 meses', () => {
    assert.equal(P.validadePadrao('2026-08-12'), '2027-02-12');
  });
  test('normalizações: cupom uppercase; slug kebab sem acento', () => {
    assert.equal(P.normalizarCupom('  impl nayara! '), 'IMPL-NAYARA');
    assert.equal(P.normalizarSlug('Nayara IDZ — Implantodontia do Zero'), 'nayara-idz-implantodontia-do-zero');
  });
});

describe('parcerias — avisos, expiração e proteções', () => {
  const ativo = { status: P.STATUS.ATIVO, data_fim_beneficio: '2026-12-30' };
  test('aviso de 7 dias: dispara na janela, uma única vez, nunca no dia do fim', () => {
    assert.ok(P.precisaAviso7(ativo, '2026-12-23'), 'dentro da janela');
    assert.ok(!P.precisaAviso7(ativo, '2026-12-22'), '8 dias antes ainda não');
    assert.ok(!P.precisaAviso7({ ...ativo, aviso7EnviadoEm: '2026-12-23' }, '2026-12-24'), 'já avisado não repete');
    assert.ok(!P.precisaAviso7(ativo, '2026-12-30'), 'no dia do fim quem fala é o e-mail de encerramento');
  });
  test('encerramento: só no fim (ou depois), e só para benefício ativo', () => {
    assert.ok(!P.precisaEncerrar(ativo, '2026-12-29'));
    assert.ok(P.precisaEncerrar(ativo, '2026-12-30'));
    assert.ok(P.precisaEncerrar(ativo, '2027-01-05'));
    assert.ok(!P.precisaEncerrar({ ...ativo, status: P.STATUS.AGUARDANDO }, '2027-01-05'), 'aguardando nunca expira');
  });
  test('PROTEÇÃO: assinante pago nunca é rebaixado — vira convertido_pago', () => {
    assert.ok(P.converteuParaPago({ dataAtivacaoPremium: '2026-11-01' }));
    assert.ok(P.converteuParaPago({ planoPremium: 'anual' }));
    assert.ok(!P.converteuParaPago({ plano: 'premium' }), 'cortesia não é pagamento');
  });
  test('dias restantes com piso em zero', () => {
    assert.equal(P.diasRestantes('2026-12-30', '2026-12-23'), 7);
    assert.equal(P.diasRestantes('2026-12-30', '2027-01-10'), 0);
  });
});

describe('parcerias — painel e CSV', () => {
  const resgates = [
    { status: P.STATUS.AGUARDANDO, usuario_nome: 'Ana', usuario_email: 'a@a.com', data_resgate: '2026-08-12' },
    { status: P.STATUS.ATIVO, usuario_nome: 'Bia; "PhD"', usuario_email: 'b@b.com', data_resgate: '2026-08-12', data_inicio_beneficio: '2026-10-01', data_fim_beneficio: '2026-12-30' },
    { status: P.STATUS.ENCERRADO, usuario_nome: 'Caio', usuario_email: 'c@c.com', data_resgate: '2026-05-01' },
    { status: P.STATUS.CONVERTIDO, usuario_nome: 'Duda', usuario_email: 'd@d.com', data_resgate: '2026-05-01' },
  ];
  test('resumo conta cada status', () => {
    assert.deepEqual(P.resumoParceiro(resgates), { total: 4, aguardando: 1, ativos: 1, encerrados: 1, convertidos: 1 });
  });
  test('CSV pt-BR: BOM, separador ;, campos com ; ou aspas escapados', () => {
    const csv = P.relatorioCSV({ nome_parceiro: 'Nayara', nome_produto: 'IDZ', codigo_cupom: 'IMPL-NAYARA' }, resgates, '2026-12-23');
    assert.ok(csv.startsWith('﻿'), 'BOM para o Excel BR');
    assert.ok(csv.includes('"Bia; ""PhD"""'), 'escape correto');
    assert.ok(csv.includes('Benefício ativo'));
    assert.ok(csv.includes(';7'), 'dias restantes calculados');
    assert.ok(csv.includes('12/08/2026'), 'datas em pt-BR');
  });
});
