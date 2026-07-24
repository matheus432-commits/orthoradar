// Curadoria clínica (diretriz do fundador, 24/07): três regras novas para que
// só entrem estudos com IMPACTO CLÍNICO e RESULTADOS acessíveis, e para que a
// classificação de especialidade não erre em temas sistêmicos.
//   A. isHealthSystemCost — barra projeção de custos / economia / carga no
//      sistema de saúde (ex.: NHS britânico até 2050; estudo de Kosovo).
//   B. isResultadosIndisponiveis — barra estudo cujos resultados não estão no
//      material (remete ao "texto completo", dados não divulgados).
//   C. corrigirEspecialidade — osteoporose/antirreabsortivos/MRONJ nunca é
//      Dentística; vira Estomatologia.
// Run: node --test netlify/functions/_lib/__tests__/curadoria-clinica.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { isHealthSystemCost, isResultadosIndisponiveis, isHealthPromotionBehavior, isBibliometricScoping } = require('../../daily-digest.js');
const { corrigirEspecialidade } = require('../claude.js');

describe('A0b. isBibliometricScoping — mapeamento/escopo/bibliometria (meta-pesquisa)', () => {
  test('barra mapeamento de pesquisas multipaís', () => {
    assert.equal(isBibliometricScoping({
      titulo_pt: 'Função mastigatória em idosos: mapeamento de pesquisas no Japão, Suécia e Índia',
      journal: 'The Japanese dental science review',
    }), true);
  });
  test('barra scoping review / bibliometria / panorama da produção', () => {
    assert.equal(isBibliometricScoping({ titulo: 'A scoping review of dental implant research' }), true);
    assert.equal(isBibliometricScoping({ titulo_pt: 'Análise bibliométrica da produção científica em endodontia' }), true);
    assert.equal(isBibliometricScoping({ titulo_pt: 'Panorama das pesquisas em periodontia na última década' }), true);
  });
  test('NÃO barra revisão sistemática/RCT clínico comum', () => {
    assert.equal(isBibliometricScoping({ titulo_pt: 'Revisão sistemática da sobrevivência de implantes curtos', resumo_pt: 'Meta-análise de 12 RCTs.' }), false);
    assert.equal(isBibliometricScoping({ titulo_pt: 'Resina bulk-fill versus incremental', resumo_pt: 'RCT clínico.' }), false);
  });
});

describe('A0. isHealthPromotionBehavior — promoção/comportamento/programa (qualquer país)', () => {
  test('barra programa de intervenção comportamental (Filipinas / Kosovo)', () => {
    assert.equal(isHealthPromotionBehavior({
      titulo_pt: 'Sorrisos Empoderados: Intervenção Digital Baseada em Teoria para Comportamento em Saúde Bucal',
      journal: 'International dental journal',
    }), true);
    assert.equal(isHealthPromotionBehavior({ titulo: 'A theory-based digital program for oral health behaviour change in schoolchildren' }), true);
  });
  test('barra educação/promoção/campanha/letramento em saúde', () => {
    assert.equal(isHealthPromotionBehavior({ titulo_pt: 'Educação em saúde bucal em escolas rurais' }), true);
    assert.equal(isHealthPromotionBehavior({ titulo: 'Oral health promotion campaign and community awareness' }), true);
    assert.equal(isHealthPromotionBehavior({ titulo: 'Health literacy and oral health behaviour' }), true);
  });
  test('termo fraco (app/motivacional) só barra com contexto de programa/comunidade', () => {
    // app SEM contexto comunitário/programa e SEM desfecho comportamental → não barra
    assert.equal(isHealthPromotionBehavior({ titulo_pt: 'Aplicativo para planejamento digital de implantes', resumo_pt: 'Precisão do guia cirúrgico.' }), false);
    // app + programa comunitário → barra
    assert.equal(isHealthPromotionBehavior({ titulo: 'A mobile app program for community-based caries prevention behaviour' }), true);
  });
  test('NÃO barra RCT clínico de tratamento', () => {
    assert.equal(isHealthPromotionBehavior({ titulo_pt: 'Resina bulk-fill versus incremental na infiltração marginal', resumo_pt: 'RCT clínico.' }), false);
    assert.equal(isHealthPromotionBehavior({ titulo_pt: 'Sobrevivência de implantes com carga imediata', resumo_pt: 'Coorte 5 anos.' }), false);
  });
});

describe('A. isHealthSystemCost — custo/economia no sistema de saúde', () => {
  test('barra projeção de custos diretos no sistema de saúde britânico', () => {
    assert.equal(isHealthSystemCost({
      titulo_pt: 'Projeção dos custos diretos de doenças orais no sistema de saúde britânico até 2050',
      journal: 'Frontiers in public health',
    }), true);
  });
  test('barra carga econômica / burden of disease populacional', () => {
    assert.equal(isHealthSystemCost({ titulo: 'The economic burden of oral diseases: a national projection' }), true);
    assert.equal(isHealthSystemCost({ titulo_pt: 'Custos das doenças bucais em nível nacional no país' }), true);
  });
  test('NÃO barra custo-efetividade clínica de um tratamento (é relevante)', () => {
    assert.equal(isHealthSystemCost({
      titulo_pt: 'Custo-efetividade da resina bulk-fill versus incremental em restaurações classe II',
      resumo_pt: 'Ensaio clínico comparou o desempenho e o custo por restauração entre as técnicas.',
    }), false);
  });
  test('NÃO barra estudo clínico sem contexto de custo', () => {
    assert.equal(isHealthSystemCost({ titulo_pt: 'Sobrevivência de coroas de zircônia em molares', resumo_pt: 'Coorte de 5 anos.' }), false);
  });
});

describe('B. isResultadosIndisponiveis — só entra estudo com resultados acessíveis', () => {
  test('flag explícita da IA (resultados_disponiveis=false) basta', () => {
    assert.equal(isResultadosIndisponiveis({ resultados_disponiveis: false, resumo_pt: 'qualquer' }), true);
  });
  test('barra quando o resumo remete ao TEXTO COMPLETO para os resultados', () => {
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'O estudo avaliou a deflexão cuspal; para os resultados detalhados, consulte o texto completo do artigo.',
    }), true);
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'Recomenda-se a leitura do artigo original na íntegra para os achados numéricos.',
    }), true);
  });
  test('barra quando admite que os resultados não foram disponibilizados/relatados', () => {
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'Os resultados não foram disponibilizados no material analisado.',
    }), true);
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'Com base apenas no resumo, não é possível detalhar os desfechos.',
    }), true);
  });
  test('NÃO barra resumo com resultados de verdade (mesmo citando "resultados")', () => {
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'Os resultados mostraram que a técnica incremental reduziu a infiltração marginal em 32% frente à bulk-fill.',
    }), false);
    assert.equal(isResultadosIndisponiveis({
      resumo_pt: 'Não houve diferença significativa entre os grupos na sobrevivência das restaurações.',
    }), false);
  });
});

describe('C. corrigirEspecialidade — osteoporose/MRONJ nunca é Dentística', () => {
  const artOsteo = { titulo_pt: 'Avaliação odontológica pré-tratamento em osteoporose: barreira real ou proteção necessária?' };
  test('Dentística → Estomatologia quando o foco é osteoporose/antirreabsortivo', () => {
    assert.equal(corrigirEspecialidade('Dentística', artOsteo), 'Estomatologia');
    assert.equal(corrigirEspecialidade('Ortodontia', { abstract: 'bisphosphonate-related osteonecrosis of the jaw (MRONJ)' }), 'Estomatologia');
    assert.equal(corrigirEspecialidade('Endodontia', { titulo: 'Denosumab and osteonecrosis risk before extraction' }), 'Estomatologia');
  });
  test('Bucomaxilofacial e Estomatologia são mantidas (competência legítima em MRONJ)', () => {
    assert.equal(corrigirEspecialidade('Bucomaxilofacial', { titulo: 'Surgical management of MRONJ' }), 'Bucomaxilofacial');
    assert.equal(corrigirEspecialidade('Estomatologia', artOsteo), 'Estomatologia');
  });
  test('não mexe em estudo sem tema sistêmico de osteonecrose', () => {
    assert.equal(corrigirEspecialidade('Dentística', { titulo_pt: 'Resina bulk-fill versus incremental' }), 'Dentística');
  });
});
