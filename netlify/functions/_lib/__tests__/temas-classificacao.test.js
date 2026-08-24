// TEMAS da /biblioteca (fundador 08/08) — taxonomia curada + classificação
// DETERMINÍSTICA (sem IA: "os requests vão falhar / outra alternativa").
// Testa: estrutura da taxonomia, sincronia com o JSON de referência,
// classificação com títulos realistas de cada especialidade, fiação
// prospectiva no enriquecimento e ordenação por frequência no dropdown.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { TAXONOMIA, temasDe, temaValido } = require('../temas-taxonomia');
const { PADROES, classificarTema } = require('../temas-classificador');

const CANONICAS = ['Endodontia', 'Ortodontia', 'Estomatologia', 'DTM e Dor Orofacial', 'Odontopediatria',
  'Implantodontia', 'Dentística', 'Prótese', 'Periodontia', 'Bucomaxilofacial', 'Radiologia'];

describe('taxonomia de temas', () => {
  test('cobre EXATAMENTE as 11 especialidades canônicas, sem listas vazias nem duplicatas', () => {
    assert.deepEqual(Object.keys(TAXONOMIA).sort(), [...CANONICAS].sort());
    for (const [esp, temas] of Object.entries(TAXONOMIA)) {
      assert.ok(temas.length >= 10, `${esp} tem só ${temas.length} temas`);
      assert.equal(new Set(temas).size, temas.length, `${esp} tem tema duplicado`);
    }
  });
  test('JSON de referência (docs/taxonomia-temas.json) em sincronia com o módulo', () => {
    const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'docs', 'taxonomia-temas.json'), 'utf8'));
    assert.deepEqual(json, TAXONOMIA);
  });
  test('todo padrão do classificador aponta para tema existente da MESMA especialidade', () => {
    for (const [esp, lista] of Object.entries(PADROES)) {
      for (const [tema] of lista) assert.ok(temaValido(tema, esp), `${esp}: padrão órfão "${tema}"`);
    }
    // E toda especialidade da taxonomia tem padrões.
    assert.deepEqual(Object.keys(PADROES).sort(), Object.keys(TAXONOMIA).sort());
  });
});

describe('classificação determinística — títulos realistas', () => {
  const casos = [
    ['Ortodontia', 'Expansão rápida da maxila assistida por mini-implantes em adultos', 'Expansão palatina'],
    ['Ortodontia', 'Distalização de molares superiores: novo dispositivo', 'Distalização'],
    // Rodada 08/08 (smoke do enriquecimento): com mini-implantes no título o
    // empate caía em Ancoragem — mas o que define o estudo é a distalização
    // (o movimento clínico buscado), não o dispositivo acessório.
    ['Ortodontia', 'Distalização de molares superiores com mini-implantes: ensaio clínico', 'Distalização'],
    ['Ortodontia', 'Ancoragem esquelética com mini-implantes: estabilidade primária', 'Ancoragem esquelética e mini-implantes'],
    ['Implantodontia', 'Peri-implantite: protocolo de descontaminação da superfície', 'Peri-implantite'],
    ['Implantodontia', 'Levantamento de seio maxilar com enxerto em bloco', 'Levantamento de seio maxilar'],
    ['Periodontia', 'Recobrimento radicular com enxerto de tecido conjuntivo', 'Recobrimento radicular'],
    ['Endodontia', 'Instrumentação reciprocante versus rotatória em molares', 'Instrumentação mecanizada'],
    ['Endodontia', 'MTA versus Biodentine no capeamento pulpar direto', 'Terapia pulpar vital'],
    ['Dentística', 'Resina bulk fill em restaurações classe II: 5 anos', 'Resina bulk fill'],
    ['Bucomaxilofacial', 'Extração de terceiros molares impactados: fatores de risco', 'Terceiros molares'],
    ['Prótese', 'Coroas de zircônia monolítica: desempenho clínico', 'Zircônia'],
    ['Odontopediatria', 'Hipomineralização molar-incisivo: manejo restaurador', 'Hipomineralização molar-incisivo'],
    ['Radiologia', 'Deep learning para detecção de lesão periapical em CBCT', 'Inteligência artificial em imagem'],
    ['DTM e Dor Orofacial', 'Toxina botulínica no bruxismo do sono', 'Bruxismo'],
    ['Estomatologia', 'Leucoplasia oral: taxa de transformação maligna', 'Leucoplasia'],
  ];
  for (const [esp, titulo, esperado] of casos) {
    test(`${esp}: "${titulo.slice(0, 40)}…" → ${esperado}`, () => {
      const tema = classificarTema({ especialidade: esp, titulo_pt: titulo });
      assert.equal(tema, esperado);
      assert.ok(temaValido(tema, esp));
    });
  }
  test('sem match → "" (nunca inventa); especialidade desconhecida → ""', () => {
    assert.equal(classificarTema({ especialidade: 'Ortodontia', titulo_pt: 'Estudo bibliométrico da produção científica' }), '');
    assert.equal(classificarTema({ especialidade: 'Odontologia Geral', titulo_pt: 'Alinhadores invisíveis' }), '');
    assert.equal(classificarTema(null), '');
  });
  test('título pesa mais que resumo (3×1) no desempate', () => {
    const tema = classificarTema({
      especialidade: 'Dentística',
      titulo_pt: 'Clareamento dental em consultório',
      resumo_pt: 'comparado com resina composta e facetas em casos estéticos',
    });
    assert.equal(tema, 'Clareamento dental');
  });
});

describe('fiação prospectiva e dropdown', () => {
  test('enriquecimento classifica tema — v2 canônico com fallback determinístico (24/08)', () => {
    const claude = fs.readFileSync(path.join(__dirname, '..', 'claude.js'), 'utf8');
    assert.ok(claude.includes("require('./temas-pipeline')"), 'classificação canônica plugada no enriquecimento');
    assert.match(claude, /tema:\s*temasCanon\.tema/, 'campo tema sai da classificação canônica');
    assert.match(claude, /temas:\s*temasCanon\.temas/, 'ids canônicos gravados');
    assert.match(claude, /versao_taxonomia:\s*temasCanon\.versao_taxonomia/, 'versão gravada em todo artigo novo');
    // O determinístico de 08/08 segue vivo como FALLBACK dentro do pipeline.
    const pipeline = fs.readFileSync(path.join(__dirname, '..', 'temas-pipeline.js'), 'utf8');
    assert.ok(pipeline.includes("require('./temas-classificador')"), 'fallback determinístico preservado');
  });
  test('dropdown da biblioteca ordena temas por FREQUÊNCIA (mais artigos primeiro)', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'biblioteca.html'), 'utf8');
    assert.match(html, /freq\.get\(b\)-freq\.get\(a\)/, 'ordenação por contagem decrescente');
  });
  test('migração retroativa: determinística, com relatório por especialidade e dry-run', () => {
    const s = fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'scripts', 'gerar-temas.js'), 'utf8');
    assert.ok(s.includes('classificarTema'), 'usa o MESMO classificador da geração');
    assert.ok(!/anthropic|api\.anthropic|ANTHROPIC_API_KEY/i.test(s), 'migração NÃO chama IA (decisão 08/08)');
    assert.ok(s.includes('RELATÓRIO DA MIGRAÇÃO'), 'imprime o relatório pedido');
    assert.ok(s.includes('DRY_RUN'), 'suporta dry-run');
  });
});
