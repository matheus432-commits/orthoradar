// CAPA DO REEL (04/09, fundador): "ao invés de aparecer somente o nome grande
// da especialidade, vamos manter o nome da especialidade porém já aparecer o
// nome do estudo que está sendo discutido, para reter e fazer com que o
// dentista abra o vídeo".
//
// O que fica travado aqui:
//   1. a capa mostra o título do estudo E continua mostrando a especialidade;
//   2. a especialidade cede tamanho para o título caber, sem sumir;
//   3. título comprido é cortado em palavra inteira, nunca no meio;
//   4. episódio sem título não quebra a capa (volta ao layout antigo);
//   5. nada sai da zona segura central (o feed recorta 9:16 para 4:5).
//
// Run: node --test netlify/functions/_lib/__tests__/reel-capa.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildReelHtml, tituloDeCapa, espFontPxComEstudo, tituloFontPx, CAPA_TITULO_MAX } = require('../reel-builder');
const { capaFontPx } = require('../especialidade-identidade');

const CENAS = [
  { tipo: 'capa', rotulo: '', frase: '' },
  { tipo: 'cena', rotulo: 'O achado', frase: 'Uma frase.', imgSrc: 'https://x/y.png' },
  { tipo: 'cena', rotulo: 'Na clínica', frase: 'Outra frase.', imgSrc: null },
  { tipo: 'outro', rotulo: '', frase: '' },
];
const capaDe = (opts) => buildReelHtml({ especialidade: 'Ortodontia', cor: '#B08968', dataLonga: '4 de setembro', cenas: CENAS, ...opts }).html;

describe('título do estudo na capa', () => {
  test('a capa traz o estudo e mantém a especialidade', () => {
    const html = capaDe({ tituloEstudo: 'Mini-implantes na retração em massa' });
    assert.ok(html.includes('Mini-implantes na retração em massa'), 'o estudo aparece');
    assert.ok(html.includes('>Ortodontia<'), 'a especialidade continua na capa');
    assert.ok(html.includes('class="estudo"'));
  });

  test('a especialidade diminui para o título caber, mas segue grande e na cor', () => {
    const html = capaDe({ tituloEstudo: 'Mini-implantes na retração em massa' });
    const px = espFontPxComEstudo('Ortodontia');
    assert.ok(px < capaFontPx('Ortodontia'), 'cede espaço');
    assert.ok(px >= 56, 'continua legível no feed');
    assert.ok(html.includes(`font-size:${px}px`));
    assert.ok(html.includes('color:#B08968'), 'cor-assinatura preservada');
  });

  test('sem título, a capa volta ao layout antigo com a especialidade cheia', () => {
    for (const t of [undefined, '', '   ']) {
      const html = capaDe({ tituloEstudo: t });
      assert.ok(!html.includes('class="estudo"'), 'sem bloco vazio');
      assert.ok(html.includes(`font-size:${capaFontPx('Ortodontia')}px`), 'especialidade no tamanho cheio');
    }
  });

  test('o corte de título é em palavra inteira e sinalizado', () => {
    const longo = 'Avaliação da influência do protocolo de fotoativação sobre a resistência de união de sistemas adesivos universais em dentina profunda contaminada por sangue';
    const t = tituloDeCapa(longo);
    assert.ok(t.length <= CAPA_TITULO_MAX + 1, 'respeita o teto: ' + t.length);
    assert.ok(t.endsWith('…'), 'sinaliza que continua');
    assert.ok(!/\s…$/.test(t), 'sem espaço solto antes das reticências');
    const semRetic = t.slice(0, -1);
    assert.ok(longo.startsWith(semRetic), 'o que sobrou é o começo real do título');
    assert.ok(!/\S$/.test(longo[semRetic.length]) || longo[semRetic.length] === ' ', 'cortou em fronteira de palavra');
  });

  test('subtítulo metodológico após dois-pontos sai quando o começo se sustenta', () => {
    assert.equal(
      tituloDeCapa('Resina impressa em 3D para restaurações interinas: estudo in vitro randomizado'),
      'Resina impressa em 3D para restaurações interinas');
    // Começo curto demais continua inteiro — cortar deixaria a capa sem sentido.
    assert.equal(tituloDeCapa('Cárie: o que mudou'), 'Cárie: o que mudou');
  });

  test('espaço em excesso e quebra de linha viram um título de uma linha só', () => {
    assert.equal(tituloDeCapa('  Adesivos\n\nuniversais   em   dentina  '), 'Adesivos universais em dentina');
  });

  test('a fonte do título encolhe conforme ele cresce, nunca abaixo do legível', () => {
    const curto = tituloFontPx('Mini-implantes'), longo = tituloFontPx('x'.repeat(95));
    assert.ok(curto > longo, 'título longo, fonte menor');
    assert.ok(longo >= 44, 'piso de legibilidade no feed');
  });

  test('título com HTML é escapado (não injeta markup na capa)', () => {
    const html = capaDe({ tituloEstudo: 'Estudo <script>alert(1)</script> & cia' });
    assert.ok(!html.includes('<script>alert'), 'sem script injetado');
    assert.ok(html.includes('&amp;') || html.includes('&lt;script&gt;'));
  });

  test('a capa inteira continua na zona segura central', () => {
    const html = capaDe({ tituloEstudo: 'Mini-implantes na retração em massa' });
    const capa = html.slice(html.indexOf('class="f cover"'), html.indexOf('class="f scene"'));
    const centro = capa.slice(capa.indexOf('cov-center'));
    for (const marca of ['kicker', 'esp', 'rule', 'estudo', 'meta', 'cov-foot']) {
      assert.ok(centro.includes(marca), marca + ' dentro do bloco central');
    }
    assert.ok(html.includes('-webkit-line-clamp:4'), 'título limitado a 4 linhas para não empurrar o rodapé');
  });
});
