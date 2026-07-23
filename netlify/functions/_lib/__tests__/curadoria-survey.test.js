// Curadoria (22/07): artigos nunca em inglês/sem resumo na edição, e sem
// questionários/surveys de opinião (baixa acionabilidade clínica).
// Run: node --test netlify/functions/_lib/__tests__/curadoria-survey.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isEnriched, isLowValueSurvey } = require('../../daily-digest.js');

describe('isEnriched — trava anti-artigo-cru', () => {
  const resumoOk = 'x'.repeat(130);
  test('exige titulo_pt (>=10) E resumo_pt (>=120)', () => {
    assert.equal(isEnriched({ titulo_pt: 'Título em português bom', resumo_pt: resumoOk }), true);
    assert.equal(isEnriched({ titulo: 'English only', resumo: 'English abstract' }), false); // sem _pt
    assert.equal(isEnriched({ titulo_pt: 'curto', resumo_pt: resumoOk }), false);            // título curto
    assert.equal(isEnriched({ titulo_pt: 'Título bom o suficiente', resumo_pt: 'curto' }), false); // resumo curto
    assert.equal(isEnriched({}), false);
  });
});

describe('isLowValueSurvey — remove questionários/surveys de opinião', () => {
  const enr = { resumo_pt: 'y'.repeat(130) };

  test('PEGA os casos reais reportados pelo fundador', () => {
    // Dinamarca/Suécia (o que apareceu cru na edição)
    assert.equal(isLowValueSurvey({ ...enr,
      titulo: 'Orthodontic treatment need assessment and treatment timing - a questionnaire survey among specialists in Denmark and Sweden' }), true);
    // "estilo Kosovo" — survey entre dentistas
    assert.equal(isLowValueSurvey({ ...enr,
      titulo: 'A survey of knowledge and attitudes among dentists in Kosovo' }), true);
    // Versão traduzida (titulo_pt) também é pega
    assert.equal(isLowValueSurvey({ ...enr,
      titulo_pt: 'Avaliação por questionário entre especialistas dinamarqueses e suecos' }), true);
  });

  test('pega variações: surveys, inquérito, KAP, "conhecimento entre estudantes"', () => {
    assert.equal(isLowValueSurvey({ titulo: 'Cross-sectional surveys of oral health' }), true);
    assert.equal(isLowValueSurvey({ titulo_pt: 'Inquérito nacional de saúde bucal' }), true);
    assert.equal(isLowValueSurvey({ titulo: 'Knowledge, attitude and practice regarding fluoride' }), true);
    assert.equal(isLowValueSurvey({ titulo_pt: 'Conhecimento sobre biossegurança entre estudantes de odontologia' }), true);
    assert.equal(isLowValueSurvey({ nivel_evidencia: 'Survey', titulo_pt: 'Estudo transversal' }), true);
  });

  test('NÃO derruba estudos clínicos legítimos (sem falso positivo)', () => {
    assert.equal(isLowValueSurvey({ ...enr,
      titulo: 'Bond strength of debonded orthodontic brackets after different reconditioning protocols: an in vitro study' }), false);
    assert.equal(isLowValueSurvey({ ...enr,
      titulo_pt: 'Resistência à fratura de incisivos com pinos de fibra: estudo in vitro' }), false);
    assert.equal(isLowValueSurvey({ ...enr,
      titulo: 'A randomized controlled trial of two aligner systems for arch expansion' }), false);
    assert.equal(isLowValueSurvey({ ...enr,
      titulo_pt: 'Distração osteogênica em fissura unilateral: relato de caso' }), false);
    // "survey" como parte de outra palavra não dispara (surveillance)
    assert.equal(isLowValueSurvey({ titulo: 'Surveillance of oral cancer incidence over 10 years' }), false);
  });
});
