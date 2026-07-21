// Tests da sincronia narração ↔ cenas do Reel (parte pura, sem rede).
// Run: node --test netlify/functions/_lib/__tests__/reel-scenes.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { computeTimings, findBoundaries, conceptSlug, fallbackSegments, segmentScript, _extractJson } = require('../reel-scenes');

const ROTEIRO =
  'Olá, dentista! Hoje vamos falar sobre cimentação de facetas cerâmicas. ' +
  'O estudo avaliou o protocolo adesivo em quarenta pacientes acompanhados por dois anos. ' +
  'Os resultados mostraram que o condicionamento com ácido fluorídrico seguido de silano teve o melhor desempenho, enquanto o grupo sem silano apresentou mais falhas adesivas. ' +
  'Na prática, vale reforçar o silano como etapa obrigatória. ' +
  'Este episódio é informativo. Até amanhã!';

const INICIOS = [
  'Olá, dentista! Hoje vamos falar sobre',
  'O estudo avaliou o protocolo adesivo',
  'Os resultados mostraram que o condicionamento',
  'Na prática, vale reforçar o silano',
  'Este episódio é informativo',
];

describe('reel-scenes — sincronia', () => {
  test('findBoundaries localiza os segmentos em ordem (busca normalizada)', () => {
    const b = findBoundaries(ROTEIRO, INICIOS);
    assert.ok(b, 'não localizou');
    assert.equal(b.length, 5);
    assert.equal(b[0], 0);
    for (let i = 1; i < b.length; i++) assert.ok(b[i] > b[i - 1], 'fora de ordem em ' + i);
  });

  test('computeTimings: durações proporcionais que somam a duração do áudio', () => {
    const secs = computeTimings(ROTEIRO, INICIOS, 180);
    assert.equal(secs.length, 5);
    const soma = secs.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(soma - 180) < 1, 'soma=' + soma);
    // O trecho de RESULTADOS é o mais longo do roteiro → maior duração.
    const max = Math.max(...secs);
    assert.equal(secs[2], max);
    // Nenhum segmento abaixo do mínimo de 2s.
    assert.ok(secs.every(s => s >= 2));
  });

  test('computeTimings: fallback (início não encontrado) divide igual sem quebrar', () => {
    const secs = computeTimings(ROTEIRO, ['xxx yyy zzz www kkk qqq', INICIOS[1]], 60);
    assert.equal(secs.length, 2);
    assert.ok(Math.abs(secs.reduce((a, b) => a + b, 0) - 60) < 1);
  });

  test('computeTimings: acentuação e caixa não atrapalham a busca', () => {
    const secs = computeTimings(ROTEIRO, ['OLÁ DENTISTA hoje vamos falar', 'os RESULTADOS mostraram que o condicionamento'], 90);
    assert.equal(secs.length, 2);
    assert.ok(Math.abs(secs.reduce((a, b) => a + b, 0) - 90) < 1);
  });

  test('conceptSlug normaliza para chave de cache estável', () => {
    assert.equal(conceptSlug('Profilaxia da Faceta'), 'profilaxia-da-faceta');
    assert.equal(conceptSlug('Cimentação adesiva!'), 'cimentacao-adesiva');
    assert.equal(conceptSlug(''), 'cena-generica');
  });
});

describe('reel-scenes — robustez da segmentação', () => {
  test('extractJson tolera cercas ```json e texto ao redor', () => {
    assert.deepEqual(_extractJson('bla ```json\n{"segmentos":[1,2,3]}\n``` fim'), { segmentos: [1, 2, 3] });
    assert.deepEqual(_extractJson('{"segmentos":[{"a":{"b":1}}]}'), { segmentos: [{ a: { b: 1 } }] });
    assert.equal(_extractJson('sem json aqui'), null);
    assert.equal(_extractJson(''), null);
  });

  test('fallbackSegments: capa + cenas + outro cobrindo o roteiro', () => {
    const rot = 'Bom dia, dentista. Hoje um estudo de endodontia. Os métodos compararam dois grupos. '
      + 'Os resultados mostraram menos dor no grupo reciprocante. A relevância clínica é grande. Até amanhã.';
    const segs = fallbackSegments(rot);
    assert.ok(segs.length >= 3);
    assert.equal(segs[0].tipo, 'capa');
    assert.equal(segs[segs.length - 1].tipo, 'outro');
    assert.ok(segs.slice(1, -1).every(s => s.tipo === 'cena'));
    // sem "visual" → não chama o Imagen (cartão de texto)
    assert.ok(segs.every(s => s.visual === ''));
  });

  test('fallbackSegments: roteiro curto demais → null', () => {
    assert.equal(fallbackSegments('Uma frase só.'), null);
  });

  test('segmentScript sem chave cai no fallback determinístico', async () => {
    const rot = 'Olá. Estudo um. Estudo dois. Estudo três. Conclusão. Tchau.';
    const segs = await segmentScript(rot, { titulo: 'x' }, null);
    assert.ok(Array.isArray(segs) && segs.length >= 3);
    assert.equal(segs[0].tipo, 'capa');
  });
});
