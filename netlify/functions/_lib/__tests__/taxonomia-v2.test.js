// TAXONOMIA CANÔNICA v2 (spec 24/08): integridade estrutural, normalização,
// mapeamento por sinônimo e compatibilidade retroativa com a v1 (08/08) —
// TODO label antigo precisa mapear para um id novo, senão a migração
// gastaria IA à toa (e poderia divergir do que o dentista já viu).
const { test, describe } = require('node:test');
const assert = require('node:assert');

const tx = require('../taxonomia');
const { TAXONOMIA: V1 } = require('../temas-taxonomia');

describe('taxonomia v2 — estrutura', () => {
  test('validar() não encontra nenhum problema (slugs, unicidade, 25-40, lowercase)', () => {
    assert.deepEqual(tx.validar(), []);
  });
  test('11 especialidades canônicas da plataforma', () => {
    assert.equal(tx.ESPECIALIDADES.length, 11);
    for (const e of ['Ortodontia', 'Bucomaxilofacial', 'DTM e Dor Orofacial', 'Estomatologia']) {
      assert.ok(tx.ESPECIALIDADES.includes(e), e);
    }
  });
  test('Ortodontia tem exatamente os 40 temas da lista do fundador', () => {
    assert.equal(tx.temasDe('Ortodontia').length, 40);
    for (const label of ['Alinhadores invisíveis', 'Distalização molar', 'Expansão maxilar e DAME',
      'Surgery-first', 'Lesões de mancha branca', 'Ortodontia no paciente adulto', 'Autoligado',
      'Corticotomia e piezocisão', 'Agenesia dentária', 'Respiração bucal']) {
      assert.ok(tx.temasDe('Ortodontia').some(t => t.label === label), label);
    }
  });
  test('versão 2 declarada (gravada nos artigos como versao_taxonomia)', () => {
    assert.equal(tx.TAXONOMIA_VERSAO, 2);
  });
  test('terminologia: nunca "distanciamento" — sempre Distalização (diretriz do fundador)', () => {
    const json = require('fs').readFileSync(tx.ARQUIVO, 'utf8');
    assert.ok(!/distanciamento/i.test(json));
  });
});

describe('taxonomia v2 — normalização', () => {
  test('lowercase + acentos + pontuação + plural', () => {
    assert.equal(tx.normalizar('Alinhadores INVISÍVEIS!'), 'alinhador invisivel');
    assert.equal(tx.normalizar('Extração vs. não extração'), 'extracao vs nao extracao');
    assert.equal(tx.normalizar('  Ortodontia e sono/apneia '), 'ortodontia e sono apneia');
    assert.equal(tx.normalizar('cistos e tumores'), 'cisto e tumor');
    assert.equal(tx.normalizar('expansões'), 'expansao');
  });
});

describe('taxonomia v2 — mapeamento por sinônimo (o bug dos 6 artigos)', () => {
  test('todas as variantes de alinhadores caem no MESMO id', () => {
    for (const v of ['Alinhadores invisíveis', 'Alinhadores', 'alinhador', 'Alinhadores transparentes', 'Invisalign', 'aligners', 'Clear Aligners', 'ClearCorrect']) {
      assert.equal(tx.mapear(v, 'Ortodontia'), 'alinhadores-invisiveis', v);
    }
  });
  test('id canônico passa direto; string fora da taxonomia devolve null', () => {
    assert.equal(tx.mapear('alinhadores-invisiveis', 'Ortodontia'), 'alinhadores-invisiveis');
    assert.equal(tx.mapear('tema inventado pela ia', 'Ortodontia'), null);
    assert.equal(tx.mapear('', 'Ortodontia'), null);
  });
  test('mapearLista aceita string OU array e deduplica', () => {
    assert.deepEqual(tx.mapearLista('Invisalign', 'Ortodontia'), ['alinhadores-invisiveis']);
    assert.deepEqual(tx.mapearLista(['Alinhadores', 'invisalign', 'Distalização'], 'Ortodontia'),
      ['alinhadores-invisiveis', 'distalizacao-molar']);
  });
  test('labelDe devolve o texto de exibição', () => {
    assert.equal(tx.labelDe('alinhadores-invisiveis'), 'Alinhadores invisíveis');
    assert.equal(tx.labelDe('inexistente'), '');
  });
  test('ehIdValido é por especialidade (valida resposta da IA)', () => {
    assert.ok(tx.ehIdValido('distalizacao-molar', 'Ortodontia'));
    assert.ok(!tx.ehIdValido('distalizacao-molar', 'Periodontia'));
  });
});

describe('taxonomia v2 — retrocompatibilidade com a v1 (migração sem IA)', () => {
  test('TODO label da taxonomia v1 mapeia para um id da v2 na mesma especialidade', () => {
    const faltas = [];
    for (const [esp, labels] of Object.entries(V1)) {
      for (const label of labels) {
        if (!tx.mapear(label, esp)) faltas.push(`${esp}: "${label}"`);
      }
    }
    assert.deepEqual(faltas, [], 'labels v1 sem mapa: ' + faltas.join(' | '));
  });
});
