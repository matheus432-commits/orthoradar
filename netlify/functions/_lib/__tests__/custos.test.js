// Tests do motor do dashboard de custos.
// Run: node --test netlify/functions/_lib/__tests__/custos.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildCustos, ttsCostUsd, resendCostUsd, imagenCostUsd } = require('../custos');

describe('custos — tabelas de preço', () => {
  test('TTS: 1M grátis, depois US$30/1M (Chirp3-HD)', () => {
    assert.equal(ttsCostUsd(500_000), 0);
    assert.equal(ttsCostUsd(1_000_000), 0);
    assert.equal(ttsCostUsd(2_000_000), 30);
    assert.equal(ttsCostUsd(3_600_000), 78); // teto do budget → custo máximo possível
  });

  test('Resend: grátis até 3000 e-mails; acima disso plano de US$20', () => {
    assert.equal(resendCostUsd(0), 0);
    assert.equal(resendCostUsd(3000), 0);
    assert.equal(resendCostUsd(3001), 20);
    assert.equal(resendCostUsd(45000), 20);
  });

  test('Imagen: US$0.04 por imagem NOVA (cache não paga)', () => {
    assert.equal(imagenCostUsd(0), 0);
    assert.equal(imagenCostUsd(25), 1);
  });
});

describe('custos — buildCustos (payload do dashboard)', () => {
  const base = {
    month: '2026-07', ttsChars: 1_800_000, ttsBudgetChars: 3_600_000,
    emailsSent: 4500, igPosts: 10, igReels: 8,
    imagensNovasMes: 30, cacheCenas: 42, usuariosAtivos: 150,
    diasNoMes: 31, diaAtual: 20,
  };

  test('itens medidos refletem os contadores; totais e BRL presentes', () => {
    const d = buildCustos(base);
    const tts = d.items.find(i => i.id === 'tts');
    assert.equal(tts.mesAtualUsd, 24); // (1.8M-1M)/1M*30
    assert.equal(tts.usoPct, 50);
    const resend = d.items.find(i => i.id === 'resend');
    assert.equal(resend.mesAtualUsd, 20); // 4500 > free tier
    const imagen = d.items.find(i => i.id === 'imagen');
    assert.equal(imagen.mesAtualUsd, 1.2);
    assert.ok(d.totais.projecaoMinBrl > 0);
    assert.ok(d.totais.projecaoMaxBrl > d.totais.projecaoMinBrl);
    assert.ok(d.porUsuarioBrl.min > 0);
  });

  test('projeção do TTS respeita o teto do budget (nunca projeta acima)', () => {
    // Ritmo altíssimo: 3.5M em 10 dias → projeção linear seria 10.8M; teto = 3.6M.
    const d = buildCustos({ ...base, ttsChars: 3_500_000, diaAtual: 10 });
    const tts = d.items.find(i => i.id === 'tts');
    assert.equal(tts.projecaoUsd, 78); // custo do teto, não do ritmo linear
  });

  test('sem usuários → porUsuario null (sem divisão por zero)', () => {
    const d = buildCustos({ ...base, usuariosAtivos: 0 });
    assert.equal(d.porUsuarioBrl, null);
  });

  test('e-mails dentro do free tier → Resend zera', () => {
    const d = buildCustos({ ...base, emailsSent: 2000 });
    assert.equal(d.items.find(i => i.id === 'resend').mesAtualUsd, 0);
  });
});
