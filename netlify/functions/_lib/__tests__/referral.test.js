// Tests do programa de indicações.
// Run: node --test netlify/functions/_lib/__tests__/referral.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { gerarRefCode, normalizeRefCode, calcularBonus, linkDe, INDICACOES_POR_MES } = require('../referral');

describe('referral', () => {
  test('gerarRefCode: 7 chars do alfabeto sem ambíguos', () => {
    for (let i = 0; i < 200; i++) {
      const c = gerarRefCode();
      assert.equal(c.length, 7);
      assert.ok(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{7}$/.test(c), 'código inesperado: ' + c);
    }
  });

  test('normalizeRefCode: maiúsculas, valida comprimento e alfabeto', () => {
    assert.equal(normalizeRefCode('abcdefg').length, 7);
    assert.equal(normalizeRefCode('  abcdefg  '), 'ABCDEFG');
    assert.equal(normalizeRefCode('ABC'), '');          // curto
    assert.equal(normalizeRefCode('ABCDEF0'), '');      // 0 não está no alfabeto
    assert.equal(normalizeRefCode('ABCDEFI'), '');      // I não está no alfabeto
    assert.equal(normalizeRefCode(''), '');
    assert.equal(normalizeRefCode(null), '');
  });

  test('calcularBonus: a cada N indicações = 1 mês', () => {
    assert.equal(INDICACOES_POR_MES, 3);
    const b0 = calcularBonus(0);
    assert.equal(b0.mesesGanhos, 0);
    assert.equal(b0.faltamParaProximo, 3);

    assert.equal(calcularBonus(1).faltamParaProximo, 2);
    assert.equal(calcularBonus(2).faltamParaProximo, 1);

    const b3 = calcularBonus(3);
    assert.equal(b3.mesesGanhos, 1);
    assert.equal(b3.faltamParaProximo, 3); // começou novo ciclo

    assert.equal(calcularBonus(6).mesesGanhos, 2);
    assert.equal(calcularBonus(7).mesesGanhos, 2);
    assert.equal(calcularBonus(7).noCiclo, 1);
  });

  test('linkDe: monta o link de indicação', () => {
    assert.equal(linkDe('ABCDEFG'), 'https://odontofeed.com/?ref=ABCDEFG');
  });
});
