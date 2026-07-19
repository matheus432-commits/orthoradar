// Regra editorial: o OdontoFeed só publica estudos COM resultados. Protocolos
// e estudos em andamento NUNCA entram. Caso real que motivou a regra: o
// protocolo de RCT do laceback (JMIR Research Protocols).
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { isUnfinishedStudy } = require('../scoring');

describe('isUnfinishedStudy — barra protocolos e estudos em andamento', () => {
  test('CASO REAL: protocolo de RCT do laceback → não concluído', () => {
    assert.equal(
      isUnfinishedStudy(
        'Clinical and Patient-Reported Outcomes of Laceback Ligature in Fixed Orthodontic Treatment: Protocol for a Randomized Controlled Trial.',
        'This study protocol describes a randomized controlled trial. We will recruit patients to assess plaque, pain and adverse events.',
        'JMIR Research Protocols'
      ),
      true
    );
  });

  test('"study protocol" no título → não concluído', () => {
    assert.equal(isUnfinishedStudy('Effect of X on Y: a study protocol', '', 'Trials'), true);
  });

  test('"rationale and design" → não concluído', () => {
    assert.equal(isUnfinishedStudy('Rationale and design of the DENTAL trial', 'A prospective study.', 'BMJ Open'), true);
  });

  test('abstract "we will recruit/assess" → não concluído', () => {
    assert.equal(
      isUnfinishedStudy('Comparação de adesivos em dentina', 'We will enroll one hundred patients and will assess bond strength over two years.', 'J Dent'),
      true
    );
  });

  test('periódico "Research Protocols" → não concluído', () => {
    assert.equal(isUnfinishedStudy('Qualquer título', 'Qualquer abstract.', 'JMIR Research Protocols'), true);
  });

  test('protocolo em português → não concluído', () => {
    assert.equal(isUnfinishedStudy('Protocolo de estudo para avaliar clareamento', 'Serão recrutados pacientes.', 'RGO'), true);
  });

  // ── Negativos: estudos CONCLUÍDOS não podem ser barrados ──
  test('RCT concluído com resultados → NÃO é barrado', () => {
    assert.equal(
      isUnfinishedStudy(
        'Immediate loading with ISQ >= 65: a 3-year randomized trial',
        'We enrolled 120 patients. Implant survival was 98.2% at three years, comparable to conventional loading.',
        'Clinical Oral Implants Research'
      ),
      false
    );
  });

  test('meta-análise concluída → NÃO é barrada', () => {
    assert.equal(
      isUnfinishedStudy(
        'Aligners versus fixed appliances: a systematic review and meta-analysis',
        'Twelve studies were included. Aligners were as effective as fixed appliances after eighteen months.',
        'American Journal of Orthodontics'
      ),
      false
    );
  });

  test('estudo com um "will" solto no fim NÃO é falso-positivo (marcador longe do início)', () => {
    const abstract = 'A total of 200 restorations were evaluated over five years with excellent survival. '
      + 'x'.repeat(420) + ' Future work will explore longer follow-up.';
    assert.equal(isUnfinishedStudy('Longevity of direct composite restorations: a 5-year cohort', abstract, 'J Dent'), false);
  });
});
