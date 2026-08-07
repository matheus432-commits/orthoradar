// Pedido do fundador (08/08): "Distanciamento" deve virar SEMPRE
// "Distalização" — é o termo que o dentista busca; a tradução literal de
// "distalization" deixava o estudo invisível na busca.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { corrigirTermosBR } = require('../claude');

describe('distanciamento → distalização (corrigirTermosBR)', () => {
  test('substitui preservando maiúscula inicial e plural', () => {
    assert.equal(corrigirTermosBR('Distanciamento de molares com mini-implantes'),
      'Distalização de molares com mini-implantes');
    assert.equal(corrigirTermosBR('distanciamentos sequenciais'), 'distalizações sequenciais');
  });

  test('concorda o artigo (o→a, do→da, no→na, ao→à, pelo→pela, um→uma)', () => {
    assert.equal(corrigirTermosBR('o distanciamento do segmento posterior'),
      'a distalização do segmento posterior');
    assert.equal(corrigirTermosBR('Avaliação do distanciamento e da ancoragem'),
      'Avaliação da distalização e da ancoragem');
    assert.equal(corrigirTermosBR('no distanciamento com alinhadores'), 'na distalização com alinhadores');
    assert.equal(corrigirTermosBR('associado ao distanciamento'), 'associado à distalização');
    assert.equal(corrigirTermosBR('obtido pelo distanciamento'), 'obtido pela distalização');
    assert.equal(corrigirTermosBR('um distanciamento de 2 mm'), 'uma distalização de 2 mm');
    assert.equal(corrigirTermosBR('Os distanciamentos obtidos'), 'As distalizações obtidas'.replace('obtidas', 'obtidos'));
  });

  test('não toca em palavras vizinhas legítimas', () => {
    assert.equal(corrigirTermosBR('distância e distal permanecem'), 'distância e distal permanecem');
    assert.equal(corrigirTermosBR('o distanciador permanece'), 'o distanciador permanece');
  });

  test('cadeia de geração cobre o termo: enriquecimento + resumo completo + roteiro do podcast', () => {
    const claude = fs.readFileSync(path.join(__dirname, '..', 'claude.js'), 'utf8');
    assert.match(claude, /distanciamento\\b\/gi/, 'termo no corretor determinístico');
    // Título e resumo são corrigidos ANTES da classificação de tema (rodada
    // 08/08: o tema é classificado sobre o texto FINAL que o dentista busca).
    assert.match(claude, /const tituloCorr = corrigirTermosBR\(/, 'título corrigido antes do tema');
    assert.match(claude, /const resumoCorr = corrigirTermosBR\(/, 'resumo corrigido antes do tema');
    assert.match(claude, /titulo_pt:\s+tituloCorr/, 'titulo_pt usa o texto corrigido');
    assert.match(claude, /resumo_pt:\s+resumoCorr/, 'resumo_pt usa o texto corrigido');
    assert.ok(claude.indexOf('const tituloCorr') < claude.indexOf('tema: classificarTema('), 'correção vem antes da classificação');
    for (const campo of ['impacto_pratico', 'limitacoes']) {
      assert.match(claude, new RegExp(campo + ':\\s+corrigirTermosBR\\('), campo + ' passa pelo corretor');
    }
    const script = fs.readFileSync(path.join(__dirname, '..', 'podcast-script.js'), 'utf8');
    assert.ok(script.includes('corrigirTermosBR(roteiro)'), 'roteiro do podcast também é corrigido');
  });

  test('backfill do acervo existe e cobre artigos + episódios + digests', () => {
    const bf = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'scripts', 'corrigir-terminologia.js'), 'utf8');
    assert.ok(bf.includes("'artigos'") && bf.includes('podcast_episodios') && bf.includes('digests_especialidade'));
    assert.ok(bf.includes('corrigirTermosBR'), 'backfill usa o MESMO corretor da geração');
  });
});
