// Diretriz do fundador (22/08): a edição de Ortodontia saiu com os 3 cards
// sobre propriedades de materiais de braquetes/resina — "evite este tipo de
// estudos". Cadeia: detector determinístico (scoring) → demoção no ranking →
// cap de 1 por edição (com piso: excedente volta antes de bloquear) → extras
// premium com materiais no fim da fila.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { isEstudoDeMateriais } = require('../scoring');
const digest = require('../../daily-digest');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'daily-digest.js'), 'utf8');

describe('isEstudoDeMateriais — detector (os 3 casos do print de 22/08)', () => {
  test('nanomateriais antibacterianos em aparelhos estéticos (revisão) → materiais', () => {
    assert.ok(isEstudoDeMateriais(
      'Nanomateriais em aparelhos ortodônticos estéticos: efeitos antibacterianos em foco',
      'O uso de aparelhos ortodônticos estéticos removíveis (alinhadores transparentes) cresceu na prática clínica, mas seu prolongado contato com os tecidos orais favorece acúmulo microbiano.',
      'Revisão Narrativa'));
  });
  test('plasma frio melhorando adesão de braquetes (in vitro) → materiais', () => {
    assert.ok(isEstudoDeMateriais(
      'Plasma atmosférico frio melhora adesão de braquetes ortodônticos: estudo in vitro com ionômero e resina',
      'A colagem de braquetes ortodônticos depende criticamente da qualidade da adesão ao esmalte. Este estudo piloto avaliou o pré-tratamento do esmalte com plasma atmosférico frio.',
      'In Vitro'));
  });
  test('nanopartículas reduzindo atrito em braquetes e fios → materiais', () => {
    assert.ok(isEstudoDeMateriais(
      'Nanopartículas de hidroxiapatita dopada com óxido de zinco reduzem atrito e melhoram propriedades antibacterianas em braquetes e fios ortodônticos',
      'O atrito entre braquetes e fios é um dos principais desafios da mecânica ortodôntica, influenciando a eficiência do movimento dentário.',
      'In Vitro'));
  });
});

describe('isEstudoDeMateriais — estudo CLÍNICO nunca dispara', () => {
  test('RCT de alinhadores vs aparelho fixo em pacientes → clínico', () => {
    assert.ok(!isEstudoDeMateriais(
      'Eficácia de alinhadores transparentes versus aparelho fixo na correção de má oclusão em adolescentes: ensaio clínico randomizado',
      'Foram randomizados 84 pacientes entre 12 e 17 anos. O desfecho primário foi o índice PAR após 18 meses de tratamento.',
      'RCT'));
  });
  test('restauração de resina em ensaio clínico (menciona material, sem bancada) → clínico', () => {
    assert.ok(!isEstudoDeMateriais(
      'Longevidade de restaurações de resina composta em molares permanentes: acompanhamento de 5 anos',
      'Estudo de coorte prospectivo acompanhou 220 restaurações em 140 pacientes, avaliando falhas clínicas anuais.',
      'Estudo Coorte'));
  });
  test('RCT clínico de dentifrício com nano-hidroxiapatita (desfecho no paciente) → clínico', () => {
    assert.ok(!isEstudoDeMateriais(
      'Dentifrício com nano-hidroxiapatita na hipersensibilidade dentinária: ensaio clínico randomizado',
      'Pacientes com hipersensibilidade foram randomizados e avaliados por escala visual analógica após 8 semanas de uso do dentifrício.',
      'RCT'));
  });
  test('cirurgia periodontal sem qualquer contexto de material → clínico', () => {
    assert.ok(!isEstudoDeMateriais(
      'Reposicionamento labial no tratamento do sorriso gengival: série de casos',
      'Doze pacientes com exposição gengival excessiva foram tratados e acompanhados por 12 meses.',
      'Caso Clínico'));
  });
});

describe('limitarEstudosDeMateriais — cap de 1 por edição com piso', () => {
  const mat = (id) => ({ pmid: id, titulo_pt: 'Resistência de união de braquetes: estudo in vitro', resumo_pt: 'Corpos de prova avaliaram a adesão de braquetes com resina.', nivel_evidencia: 'In Vitro' });
  const cli = (id) => ({ pmid: id, titulo_pt: 'Ensaio clínico de contenção após tratamento', resumo_pt: 'Pacientes acompanhados por 24 meses após remoção do aparelho.', nivel_evidencia: 'RCT' });

  test('edição com 3 de materiais fica com 1 e repõe com clínicos da reserva', () => {
    const r = digest.limitarEstudosDeMateriais([mat('1'), mat('2'), mat('3')], [cli('4'), cli('5')], 3, 3);
    assert.equal(r.selecionados.length, 3);
    assert.equal(r.selecionados.filter(a => digest.isEstudoMateriais(a)).length, 1, 'só 1 de materiais');
    assert.equal(r.removidos, 2);
  });
  test('PISO: sem reposição clínica, o excedente volta — edição nunca bloqueia pela mistura', () => {
    const r = digest.limitarEstudosDeMateriais([mat('1'), mat('2'), mat('3')], [], 3, 3);
    assert.equal(r.selecionados.length, 3, 'mantém o mínimo mesmo só com materiais');
    assert.equal(r.removidos, 0, 'nada removido de fato');
  });
  test('reposição não fura o cap de relato de caso', () => {
    const relato = { pmid: '9', titulo_pt: 'Relato de caso: agenesia tratada com mini-implante', resumo_pt: 'Caso clínico de paciente de 14 anos.', nivel_evidencia: 'Caso Clínico' };
    const r = digest.limitarEstudosDeMateriais([mat('1'), mat('2'), cli('3')], [relato, cli('4')], 3, 3);
    assert.ok(!r.selecionados.some(a => a.pmid === '9'), 'relato não entra pela reposição de materiais');
    assert.ok(r.selecionados.some(a => a.pmid === '4'), 'clínico não-relato entra');
  });
  test('edição já equilibrada passa intocada', () => {
    const sel = [cli('1'), cli('2'), mat('3')];
    const r = digest.limitarEstudosDeMateriais(sel, [cli('4')], 3, 3);
    assert.deepEqual(r.selecionados.map(a => a.pmid), ['1', '2', '3']);
    assert.equal(r.removidos, 0);
  });
});

describe('fiação no digest — demoção, cap e extras', () => {
  test('demoção no ranking ANTES da seleção (multiplicador, como o feedback)', () => {
    assert.ok(src.includes('DEMOCAO_MATERIAIS = 0.5'));
    assert.match(src, /art\.relevanceScore = \(art\.relevanceScore \|\| 50\) \* DEMOCAO_MATERIAIS/);
    assert.ok(src.indexOf('DEMOCAO_MATERIAIS;') < src.indexOf('recommendArticles(candidates'), 'demove antes de selecionar');
  });
  test('cap aplicado após o cap de relatos, com log quantificado', () => {
    assert.ok(src.indexOf('limitarRelatosDeCaso(selected') < src.indexOf('limitarEstudosDeMateriais(selected'));
    assert.ok(src.includes('cap de estudos de materiais aplicado'));
  });
  test('reposição pós-resumo respeita o teto e prefere clínico (materiais no fim da reserva)', () => {
    assert.match(src, /isEstudoMateriais\(cand\) && materiaisEmFinais >= MAX_MATERIAIS_POR_EDICAO\) continue/);
    assert.match(src, /reserva\.sort\(\(a, b\) => \(isEstudoMateriais\(a\) \? 1 : 0\)/);
  });
  test('extras premium: penalidade -10 supera tema (5) + afinidade (4.5)', () => {
    assert.match(src, /if \(isEstudoMateriais\(a\)\) m\.score -= 10;/);
  });
});
