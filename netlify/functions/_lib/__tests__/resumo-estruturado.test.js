// Tests do resumo completo — diretriz 19/07/2026 v2 (pedido do fundador):
// PROSA FLUIDA, sem títulos de seção, cobrindo as 4 dimensões do podcast
// (objetivo, materiais e métodos, resultados, relevância clínica).
// isResumoEstruturado detecta o formato COM TÍTULOS (janela curta antes da v2)
// para o digest regenerar; prosa retorna false e é mantida.
// Run: node --test netlify/functions/_lib/__tests__/resumo-estruturado.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isResumoEstruturado, RESUMO_SECOES } = require('../claude');

const COM_TITULOS = `Objetivo
Avaliar a resistência de união de pinos de fibra de vidro cimentados com dois protocolos adesivos.

Materiais e métodos
Ensaio laboratorial com 40 raízes bovinas divididas em dois grupos, com termociclagem.

Resultados
O grupo com silano apresentou maior resistência de união, com falhas predominantemente adesivas no grupo controle.

Relevância clínica
O preparo da superfície do pino influencia diretamente a retenção. Limitações: estudo in vitro.`;

const PROSA = 'Este estudo teve como objetivo avaliar a resistência de união de pinos de fibra de vidro sob dois protocolos adesivos. Os autores conduziram um ensaio laboratorial com 40 raízes bovinas divididas em dois grupos, submetidas a termociclagem. Os resultados mostraram maior resistência de união no grupo tratado com silano, com falhas predominantemente adesivas no controle. Na prática clínica, o achado reforça que o preparo da superfície do pino influencia a retenção, embora o desenho in vitro limite a extrapolação direta.';

describe('resumo completo — prosa fluida (v2)', () => {
  test('as 4 dimensões obrigatórias são as do podcast', () => {
    assert.deepEqual(RESUMO_SECOES, ['Objetivo', 'Materiais e métodos', 'Resultados', 'Relevância clínica']);
  });

  test('prosa fluida NÃO é marcada para regeneração', () => {
    assert.equal(isResumoEstruturado(PROSA), false);
  });

  test('formato com títulos é detectado (digest regenera para prosa)', () => {
    assert.equal(isResumoEstruturado(COM_TITULOS), true);
  });

  test('variações de caixa e dois-pontos nos títulos também são detectadas', () => {
    const v = COM_TITULOS
      .replace('Objetivo', 'OBJETIVO:')
      .replace('Materiais e métodos', 'Materiais e Métodos:')
      .replace('Resultados', 'RESULTADOS')
      .replace('Relevância clínica', 'Relevância Clínica:');
    assert.equal(isResumoEstruturado(v), true);
  });

  test('vazio/nulo nunca conta como formato com títulos', () => {
    assert.equal(isResumoEstruturado(''), false);
    assert.equal(isResumoEstruturado(null), false);
  });

  test('prosa que apenas MENCIONA as palavras (objetivo, resultados…) não é confundida com títulos', () => {
    // As palavras aparecem no meio das frases, não como títulos em linha própria
    assert.ok(/objetivo/i.test(PROSA) && /resultados/i.test(PROSA));
    assert.equal(isResumoEstruturado(PROSA), false);
  });
});
