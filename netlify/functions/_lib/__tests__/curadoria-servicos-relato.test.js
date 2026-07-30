// Incidentes de 27/07 (edição do dia):
//
// (1) FALSO NEGATIVO — "Registro eletrônico integrado de doenças orais: modelo
//     de gestão de dados em saúde bucal" (dados de Singapura, PLoS One) entrou
//     na edição. Passou por TODOS os filtros existentes: não cita SUS, não é
//     promoção de saúde, não é bibliometria, não menciona custo. Faltava a
//     categoria "pesquisa em serviços / informática em saúde".
//
// (2) FALSO POSITIVO — Prótese ficou SEM edição porque 2 dos 3 artigos eram
//     RELATOS DE CASO e foram descartados por "não indicar qual foi superior".
//     Diretriz do fundador (27/07): "relato de caso pode passar" — o resultado
//     de um relato é a conduta e o desfecho, não um vencedor entre dois braços.

const { test } = require('node:test');
const assert = require('node:assert');

const {
  isServicoSaudeDados, isRelatoDeCaso, isResultadosIndisponiveis,
} = require('../../daily-digest.js');

// ── (1) Pesquisa de serviços / informática em saúde ─────────────────────────

test('barra o caso real: registro eletrônico + gestão de dados (Singapura)', () => {
  assert.strictEqual(isServicoSaudeDados({
    titulo_pt: 'Registro eletrônico integrado de doenças orais: modelo de gestão de dados em saúde bucal',
    resumo_pt: 'Estudo de coorte que descreve a implantação de um registro nacional de doenças orais.',
  }), true);
});

test('barra prontuário eletrônico, EHR e sistema de informação em saúde', () => {
  for (const titulo of [
    'Prontuário eletrônico odontológico: avaliação de implantação',
    'Adoption of electronic health record systems in dental practices',
    'Sistema de informação em saúde bucal: análise de cobertura',
    'Health informatics applied to oral disease monitoring',
  ]) {
    assert.strictEqual(isServicoSaudeDados({ titulo_pt: titulo }), true, titulo);
  }
});

test('barra vigilância, interoperabilidade e força de trabalho', () => {
  for (const titulo of [
    'Sistema de vigilância epidemiológica das doenças bucais',
    'Interoperabilidade entre bases de dados de saúde bucal',
    'Oral health workforce distribution across regions',
    'Data governance in national dental registries',
  ]) {
    assert.strictEqual(isServicoSaudeDados({ titulo_pt: titulo }), true, titulo);
  }
});

test('NÃO barra estudo clínico que usa palavras parecidas (sem falso positivo)', () => {
  for (const titulo of [
    'Registro de mordida em cera versus digital na confecção de próteses totais',
    'Registro oclusal com escaneamento intraoral: precisão comparada',
    'Coorte de 15 anos com implantes de uma e duas peças: sobrevivência',
    'Banco de dados de um centro: desfechos de retratamento endodôntico',
    'Análise de dados de 200 pacientes tratados com resina bulk-fill',
  ]) {
    assert.strictEqual(isServicoSaudeDados({ titulo_pt: titulo }), false, titulo);
  }
});

// ── (2) Relato de caso passa na trava de veredito ───────────────────────────

test('reconhece relato e série de casos', () => {
  assert.strictEqual(isRelatoDeCaso({ titulo_pt: 'Relato de caso: reabilitação com overdenture' }), true);
  assert.strictEqual(isRelatoDeCaso({ titulo_pt: 'Série de casos de displasia ectodérmica' }), true);
  assert.strictEqual(isRelatoDeCaso({ title: 'A case report of mandibular reconstruction' }), true);
  assert.strictEqual(isRelatoDeCaso({ titulo_pt: 'Ensaio clínico randomizado de resinas' }), false);
});

test('os 2 relatos reais de Prótese (27/07) NÃO são mais descartados', () => {
  const overdenture = {
    titulo_pt: 'Abordagem Prostodôntica Integrada para Displasia Ectodérmica: Overdenture — relato de caso',
    resumo_pt: 'Paciente de 12 anos reabilitado com overdenture; acompanhamento de 24 meses sem intercorrências.',
    resultados_disponiveis: false, // a IA marca false por não haver comparação
  };
  const fissura = {
    titulo_pt: 'Reabilitação Prostodôntica Completa em Adolescente Edêntulo com Fissura — relato de caso',
    resumo_pt: 'Não é possível dizer qual técnica seria superior, pois trata-se de um único paciente. '
             + 'A conduta adotada devolveu função mastigatória e estética.',
  };
  assert.strictEqual(isResultadosIndisponiveis(overdenture), false);
  assert.strictEqual(isResultadosIndisponiveis(fissura), false);
});

test('relato SEM o desfecho no material continua sendo descartado', () => {
  assert.strictEqual(isResultadosIndisponiveis({
    titulo_pt: 'Reabilitação com implantes zigomáticos: relato de caso',
    resumo_pt: 'O material disponibilizado não traz os valores do acompanhamento; consulte o texto completo.',
  }), true);
  assert.strictEqual(isResultadosIndisponiveis({
    titulo_pt: 'Enxerto ósseo em maxila atrófica: relato de caso',
    resumo_pt: 'Acesso restrito ao artigo; os resultados não foram disponibilizados.',
  }), true);
});

test('estudo COMPARATIVO sem veredito continua barrado (regra do fundador intacta)', () => {
  assert.strictEqual(isResultadosIndisponiveis({
    titulo_pt: 'Comparação entre dois cimentos resinosos',
    resumo_pt: 'O resumo não deixa claro qual dos dois materiais apresentou melhor desempenho.',
  }), true);
  assert.strictEqual(isResultadosIndisponiveis({
    titulo_pt: 'Instrumentos rotatórios versus manuais',
    resultados_disponiveis: false,
  }), true);
});

// ── Regressão 30/07: extra Premium de Ortodontia saiu com resumo que admite
// "o material fornecido não traz de forma explícita quais variáveis..." ──────
const { test: test3007 } = require('node:test');
const assert3007 = require('node:assert');

test3007('resumo que admite material sem variáveis/valores (texto real 30/07) é barrado', () => {
  const texto = 'Quanto aos resultados, o material fornecido não traz de forma explícita ' +
    'quais variáveis dentárias ou cefalométricas se mostraram estatisticamente associadas ' +
    'à maior ou à menor abertura de overbite, nem os valores numéricos correspondentes a ' +
    'essas associações. Como se trata de um estudo de braço único, sem comparação entre ' +
    'diferentes técnicas, não há um vencedor a ser declarado nesse sentido; essas ' +
    'correlações específicas não constam detalhadas no resumo disponível.';
  const art = { titulo_pt: 'Fatores de variabilidade do overbite anterior', resumo_pt: 'r'.repeat(150), resumo_completo: texto };
  assert3007.strictEqual(isResultadosIndisponiveis(art), true,
    'a admissão de material inacessível DEVE ser barrada (base E extras premium)');
});

test3007('variação "não constam detalhadas no resumo disponível" sozinha também é barrada', () => {
  const art = { titulo_pt: 'Estudo X', resumo_pt: 'r'.repeat(150),
    resumo_completo: 'O estudo correlacionou variáveis, mas as correlações específicas não constam detalhadas no resumo disponível.' };
  assert3007.strictEqual(isResultadosIndisponiveis(art), true);
});
