// Tests do resumo estruturado (diretriz 19/07/2026): o resumo escrito do site
// tem as mesmas 4 dimensões do podcast — Objetivo, Materiais e métodos,
// Resultados, Relevância clínica — e resumos antigos em prosa são detectados
// para regeneração pelo digest.
// Run: node --test netlify/functions/_lib/__tests__/resumo-estruturado.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isResumoEstruturado, RESUMO_SECOES } = require('../claude');

const ESTRUTURADO = `Objetivo
Avaliar a resistência de união de pinos de fibra de vidro cimentados com dois protocolos adesivos.

Materiais e métodos
Ensaio laboratorial com 40 raízes bovinas divididas em dois grupos, com termociclagem.

Resultados
O grupo com silano apresentou maior resistência de união, com falhas predominantemente adesivas no grupo controle.

Relevância clínica
O preparo da superfície do pino influencia diretamente a retenção. Limitações: estudo in vitro, sem carga mastigatória real.`;

const PROSA = 'Este estudo avaliou a resistência de união de pinos de fibra. Os autores utilizaram 40 raízes bovinas e concluíram que o silano melhora a retenção, embora o desenho in vitro limite a extrapolação clínica.';

describe('resumo estruturado', () => {
  test('as 4 seções obrigatórias são as do podcast', () => {
    assert.deepEqual(RESUMO_SECOES, ['Objetivo', 'Materiais e métodos', 'Resultados', 'Relevância clínica']);
  });

  test('resumo no formato novo é reconhecido', () => {
    assert.equal(isResumoEstruturado(ESTRUTURADO), true);
  });

  test('variações de caixa e dois-pontos também passam', () => {
    const v = ESTRUTURADO
      .replace('Objetivo', 'OBJETIVO:')
      .replace('Materiais e métodos', 'Materiais e Métodos:')
      .replace('Resultados', 'RESULTADOS')
      .replace('Relevância clínica', 'Relevância Clínica:');
    assert.equal(isResumoEstruturado(v), true);
  });

  test('resumo antigo em prosa → false (será regenerado pelo digest)', () => {
    assert.equal(isResumoEstruturado(PROSA), false);
    assert.equal(isResumoEstruturado(''), false);
    assert.equal(isResumoEstruturado(null), false);
  });

  test('faltando a seção Resultados → false (resultado é obrigatório)', () => {
    const semResultados = ESTRUTURADO.replace(/Resultados\n/, '');
    assert.equal(isResumoEstruturado(semResultados), false);
  });
});
