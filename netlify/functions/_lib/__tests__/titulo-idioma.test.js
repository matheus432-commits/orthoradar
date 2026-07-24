// Título traduzido tem de estar EM PORTUGUÊS (incidente 24/07: card com título
// em inglês passou porque o gate só media comprimento).
// Run: node --test netlify/functions/_lib/__tests__/titulo-idioma.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { tituloEmIngles } = require('../scoring');
const { isEnriched } = require('../../daily-digest.js');

describe('tituloEmIngles — detecta título não traduzido', () => {
  test('CASO REAL (24/07): título inglês → true', () => {
    assert.equal(tituloEmIngles(
      'Orthodontics and temporomandibular disorders: a comprehensive review',
      'Orthodontics and temporomandibular disorders: a comprehensive review'), true);
  });

  test('titulo_pt idêntico ao original (não traduzido) → true', () => {
    assert.equal(tituloEmIngles('Bond strength of universal adhesives', 'Bond strength of universal adhesives'), true);
  });

  test('inglês sem acento e com ≥2 marcadores → true (mesmo sem o original)', () => {
    assert.equal(tituloEmIngles('Effect of fluoride on caries: a systematic review', ''), true);
    assert.equal(tituloEmIngles('Outcomes of implants in diabetic patients', ''), true);
  });

  test('português com acento → false', () => {
    assert.equal(tituloEmIngles('Ortodontia e disfunções temporomandibulares: uma revisão abrangente', 'Orthodontics and TMD: a review'), false);
    assert.equal(tituloEmIngles('Resistência de união de adesivos universais', 'Bond strength of universal adhesives'), false);
    assert.equal(tituloEmIngles('Distração osteogênica em fissura unilateral', ''), false);
  });

  test('português SEM acento e sem marcadores ingleses → false (sem falso positivo)', () => {
    assert.equal(tituloEmIngles('Bruxismo do sono e dor orofacial em adultos', ''), false);
    assert.equal(tituloEmIngles('Uso de laser de baixa potencia em mucosite', ''), false);
  });

  test('vazio → false (tratado pelo gate de comprimento)', () => {
    assert.equal(tituloEmIngles('', 'anything'), false);
    assert.equal(tituloEmIngles(null, null), false);
  });
});

describe('isEnriched — agora barra título em inglês', () => {
  const resumoOk = 'x'.repeat(130);
  test('título inglês → NÃO enriquecido (mesmo com resumo_pt ok)', () => {
    assert.equal(isEnriched({
      titulo: 'Orthodontics and temporomandibular disorders: a comprehensive review',
      titulo_pt: 'Orthodontics and temporomandibular disorders: a comprehensive review',
      resumo_pt: resumoOk }), false);
  });
  test('título PT + resumo ok → enriquecido', () => {
    assert.equal(isEnriched({
      titulo: 'Orthodontics and TMD',
      titulo_pt: 'Ortodontia e disfunção temporomandibular: revisão',
      resumo_pt: resumoOk }), true);
  });
});
