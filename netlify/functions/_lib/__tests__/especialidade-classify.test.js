// Regras de classificação de especialidade — casos reais que já falharam em
// produção e NÃO podem regredir:
//   1. Artigo sobre dentição decídua ia para Prótese → é Odontopediatria.
//   2. Restauração direta substituindo amálgama ia para Prótese → é Dentística.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { classifySpecialty, especialidadeOverride } = require('../scoring');

describe('classifySpecialty — precedência pediátrica', () => {
  test('coroa de zircônia em molares decíduos → Odontopediatria (não Prótese)', () => {
    assert.equal(
      classifySpecialty(
        'Clinical performance of zirconia crowns in primary molars',
        'Prefabricated zirconia crowns were evaluated in children with severe caries in primary teeth.'
      ),
      'Odontopediatria'
    );
  });

  test('pulpotomia em dente decíduo → Odontopediatria (não Endodontia)', () => {
    assert.equal(
      classifySpecialty(
        'Pulpotomy outcomes in primary teeth: a randomized trial',
        'Comparison of MTA and formocresol pulpotomy in deciduous molars of preschool children.'
      ),
      'Odontopediatria'
    );
  });

  test('termo em português "decíduo" também dispara', () => {
    assert.equal(
      classifySpecialty('Traumatismo em dente decíduo', 'Avaliação de traumatismos na dentição decídua.'),
      'Odontopediatria'
    );
  });
});

describe('classifySpecialty — restauração direta é Dentística', () => {
  test('substituição de amálgama por resina direta → Dentística (não Prótese)', () => {
    assert.equal(
      classifySpecialty(
        'Replacement of amalgam restorations with direct composite: 5-year outcomes',
        'Direct resin composite restorations replacing defective amalgam in permanent molars were assessed for longevity and marginal ceramic-like finish.'
      ),
      'Dentística'
    );
  });
});

describe('classifySpecialty — Prótese legítima continua Prótese', () => {
  test('prótese total convencional segue em Prótese', () => {
    assert.equal(
      classifySpecialty(
        'Patient satisfaction with complete dentures: a cohort study',
        'Edentulous adults rehabilitated with conventional complete denture prostheses were followed for two years.'
      ),
      'Prótese'
    );
  });
});

describe('especialidadeOverride — palavra final sobre a IA', () => {
  test('IA disse Prótese, texto é decíduo → força Odontopediatria', () => {
    assert.equal(
      especialidadeOverride('Zirconia crowns in primary molars', 'children with deciduous teeth', 'Prótese'),
      'Odontopediatria'
    );
  });

  test('IA disse Prótese, texto é restauração direta → força Dentística', () => {
    assert.equal(
      especialidadeOverride('Direct composite restoration replacing amalgam', 'permanent posterior teeth', 'Prótese'),
      'Dentística'
    );
  });

  test('IA disse Prótese e o artigo É de prótese → não interfere (null)', () => {
    assert.equal(
      especialidadeOverride('Overdenture retention systems', 'complete denture wearers, implant-retained overdenture', 'Prótese'),
      null
    );
  });

  test('rótulo já correto de Odontopediatria → não interfere (null)', () => {
    assert.equal(
      especialidadeOverride('Pulpotomy in primary molars', 'deciduous teeth of children', 'Odontopediatria'),
      null
    );
  });
});
