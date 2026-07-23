// Curadoria (22/07): artigos nunca em inglês/sem resumo na edição, e sem
// questionários/surveys de opinião (baixa acionabilidade clínica).
// Run: node --test netlify/functions/_lib/__tests__/curadoria-survey.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isEnriched, isLowValueSurvey, isPublicHealthPolicy } = require('../../daily-digest.js');

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

describe('isPublicHealthPolicy — fora estudos de SUS/SB Brasil/políticas', () => {
  test('PEGA os casos reais reportados pelo fundador', () => {
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Uso de próteses dentárias em adultos e idosos no Brasil: tendências e impacto do SUS (2003–2023)',
      journal: 'Revista brasileira de epidemiologia = Brazilian journal of epidemiology' }), true);
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Uso e necessidade de próteses dentárias em atividades diárias entre idosos brasileiros: achados do SB Brasil 2023',
      journal: 'Revista brasileira de epidemiologia = Brazilian journal of epidemiology' }), true);
  });

  test('pega SUS, política pública, inquérito nacional, ESF', () => {
    assert.equal(isPublicHealthPolicy({ titulo_pt: 'Acesso aos serviços odontológicos no Sistema Único de Saúde' }), true);
    assert.equal(isPublicHealthPolicy({ titulo_pt: 'Políticas públicas de saúde bucal no Brasil' }), true);
    assert.equal(isPublicHealthPolicy({ titulo_pt: 'Cárie e desigualdade: inquérito nacional de saúde bucal' }), true);
    assert.equal(isPublicHealthPolicy({ titulo_pt: 'Cobertura da Estratégia Saúde da Família e saúde bucal' }), true);
    assert.equal(isPublicHealthPolicy({ titulo: 'Dental care in the Unified Health System (SUS)' }), true);
  });

  test('epidemiologia + contexto populacional (prevalência/uso/acesso)', () => {
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Prevalência de edentulismo em idosos', journal: 'Cadernos de epidemiologia' }), true);
  });

  test('NÃO derruba estudo clínico só por ser brasileiro ou por citar "Brasil"', () => {
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Resistência de união de adesivos universais: estudo in vitro no Brasil',
      journal: 'Brazilian oral research' }), false);
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Ensaio clínico randomizado de dois sistemas de alinhadores',
      journal: 'Brazilian dental journal' }), false);
    // epidemiologia clínica SEM contexto de política/uso não é barrada
    assert.equal(isPublicHealthPolicy({
      titulo_pt: 'Fatores de risco para falha de implantes: coorte de 5 anos',
      journal: 'Journal of clinical epidemiology' }), false);
  });
});
