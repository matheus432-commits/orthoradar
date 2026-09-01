// Tests da CURADORIA de 31/08 (dois prints do fundador na edição de Ortodontia)
// e do achado de privacidade encontrado junto:
//
//   1. HISTÓRICO/BIOGRÁFICO — "A contribuição italiana à biomecânica
//      ortodôntica: uma perspectiva histórica" passava porque nada filtrava
//      artigo historiográfico. "estudos deste tipo não devem entrar na
//      seleção" → exclusão dura, com guarda para não confundir com "história
//      clínica"/"história natural da doença", que são termos clínicos.
//   2. BANCADA DE MATERIAIS NO EXTRA PREMIUM — "Biocompatibilidade de fios
//      ortodônticos com revestimento de grafeno (in vitro + modelo animal)"
//      virou o ÚNICO extra do fundador: na edição base a regra é demoção +
//      teto 1, mas o pool dos extras não tinha trava nenhuma. No extra é
//      exclusão (2 artigos só; extra ruim é pior que nenhum).
//   3. PRIVACIDADE — o daily-digest logava o e-mail do dentista em ~17 pontos
//      e o pipeline roda no GitHub Actions, onde o log é PÚBLICO.
//
// Run: node --test netlify/functions/_lib/__tests__/curadoria-historico-extras.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const src = (f) => fs.readFileSync(path.join(FUNCS, f), 'utf8');
const { isHistoricoBiografico, passaCuradoria } = require('../../daily-digest.js');
const { isEstudoDeMateriais } = require('../scoring.js');
const logger = require('../logger.js');

// Artigo mínimo que PASSA em todas as outras travas (enriquecido, com resumo).
const base = (over = {}) => ({
  pmid: '40000001',
  titulo_pt: 'Efeito do alinhador termoplástico na recidiva em 24 meses: ensaio clínico',
  titulo: 'Effect of thermoplastic aligners on relapse at 24 months: a clinical trial',
  resumo_pt: 'Ensaio clínico randomizado com 120 pacientes que comparou dois protocolos de contenção após tratamento ortodôntico, medindo recidiva do apinhamento em 24 meses de acompanhamento com modelos digitais seriados.',
  nivel_evidencia: 'Ensaio Clínico',
  ...over,
});

describe('artigo histórico/biográfico — exclusão (print 1 do fundador)', () => {
  test('o caso REAL do print entra na trava', () => {
    const a = base({
      titulo_pt: 'A contribuição italiana à biomecânica ortodôntica: uma perspectiva histórica',
      titulo: 'The Italian contribution to orthodontic biomechanics: a historical perspective',
      nivel_evidencia: 'Revisão Narrativa',
      resumo_pt: 'Este estudo revisa a evolução histórica da biomecânica ortodôntica na Itália, desde observações anatômicas renascentistas até o desenvolvimento de técnicas e ferramentas diagnósticas contemporâneas.',
    });
    assert.equal(isHistoricoBiografico(a), true);
    assert.equal(passaCuradoria(a), false, 'não pode entrar em edição nem em extra');
  });
  test('outras formas do mesmo gênero: memorial, biografia, pioneiros, aniversário', () => {
    const casos = [
      'In memoriam: o legado de um pesquisador da Periodontia',
      'Biografia e trajetória do fundador da escola brasileira de Ortodontia',
      'Pioneiros da implantodontia: uma retrospectiva histórica',
      'História da Odontologia brasileira ao longo de 100 anos de ensino',
      'Milestones in the history of endodontics',
    ];
    for (const t of casos) {
      assert.equal(isHistoricoBiografico(base({ titulo_pt: t, titulo: t })), true, t);
    }
  });
  test('GUARDA: termo clínico com "história" NUNCA dispara', () => {
    // titulo = original em inglês (como vem do PubMed), titulo_pt = tradução —
    // igualar os dois faria a trava tituloEmIngles disparar por outro motivo.
    const clinicos = [
      ['Impacto da história clínica de cárie na sobrevida de restaurações em 5 anos', 'Caries risk and restoration survival at 5 years'],
      ['História natural da doença periodontal em adultos: coorte de 10 anos', 'Natural progression of periodontal disease in adults: a 10-year cohort'],
      ['Relação entre história familiar e agenesia dentária', 'Familial predisposition and tooth agenesis'],
      ['História de trauma dentoalveolar e prognóstico endodôntico', 'Previous dentoalveolar trauma and endodontic prognosis'],
    ];
    for (const [pt, en] of clinicos) {
      const a = base({ titulo_pt: pt, titulo: en });
      assert.equal(isHistoricoBiografico(a), false, pt);
      assert.equal(passaCuradoria(a), true, 'estudo clínico legítimo segue passando: ' + pt);
    }
    // Em inglês o gatilho também não dispara (quem barra título em inglês é
    // outra trava, a tituloEmIngles — aqui só a histórica está sob teste).
    const en = 'Medical history and risk of implant failure: a retrospective cohort';
    assert.equal(isHistoricoBiografico(base({ titulo_pt: en, titulo: en })), false, en);
  });
  test('estudo clínico comum continua passando (a trava não é ampla demais)', () => {
    assert.equal(isHistoricoBiografico(base()), false);
    assert.equal(passaCuradoria(base()), true);
  });
});

describe('bancada de materiais no extra Premium (print 2 do fundador)', () => {
  const grafeno = base({
    pmid: '40000002',
    titulo_pt: 'Biocompatibilidade de fios ortodônticos com revestimento de grafeno: avaliação em células e modelo animal',
    titulo: 'Biocompatibility of graphene-coated orthodontic wires: in vitro and animal model evaluation',
    nivel_evidencia: 'In Vitro',
    resumo_pt: 'O estudo avaliou fios de aço inoxidável e de níquel-titânio revestidos com grafeno por deposição química de vapor, medindo citotoxicidade em fibroblastos em cultura e adesão celular às superfícies.',
  });

  test('o caso REAL do print é reconhecido como estudo de bancada de materiais', () => {
    assert.equal(isEstudoDeMateriais(
      `${grafeno.titulo_pt} ${grafeno.titulo}`, grafeno.resumo_pt, grafeno.nivel_evidencia), true);
  });
  test('pool dos extras EXCLUI bancada; a edição base mantém demoção + teto 1', () => {
    const dd = src('daily-digest.js');
    // Pool dos extras: exclusão dura na mesma linha do passaCuradoria.
    assert.match(dd, /pool = brutos\.filter\(a => passaCuradoria\(a\) && !isEstudoMateriais\(a\)/,
      'extras excluem bancada no pool');
    // Poço fundo (acervo completo) também exclui.
    assert.match(dd, /!passaCuradoria\(a\) \|\| isEstudoMateriais\(a\)/, 'poço fundo exclui bancada');
    // Ranking mantém a demoção como cinto e suspensório.
    assert.ok(dd.includes('if (isEstudoMateriais(a)) m.score -= 10;'));
    // A edição BASE segue com demoção + teto (não virou exclusão sem querer).
    assert.ok(dd.includes('MAX_MATERIAIS_POR_EDICAO = 1'));
    assert.ok(dd.includes('DEMOCAO_MATERIAIS'));
  });
  test('passaCuradoria sozinho NÃO bane bancada — a edição base ainda pode usá-la para fechar o dia', () => {
    assert.equal(passaCuradoria(grafeno), true, 'exclusão de bancada é só no caminho dos extras');
  });
});

describe('poço fundo dos extras — enxergar o acervo inteiro (causa do "só 1 extra")', () => {
  const dd = src('daily-digest.js');
  test('a leitura do acervo não usa mais corte sem ordenação (fatia dos pmids mais antigos)', () => {
    assert.ok(dd.includes("db.queryAll('artigos'"), 'acervo paginado por completo');
    // O trecho do acervo da especialidade não pode ter limit fixo; o limit:300
    // que sobra no arquivo é o dos votos do próprio assinante (outra coleção).
    const bloco = dd.slice(dd.indexOf('async function acervoDaEspecialidade'), dd.indexOf('async function pickPremiumExtras'));
    assert.ok(!/limit:\s*\d/.test(bloco), 'sem teto na leitura do acervo');
    assert.ok(/queryAll\('artigos'/.test(bloco));
  });
  test('acervo é lido UMA vez por especialidade (cache), não por assinante', () => {
    assert.ok(dd.includes('_acervoPorEsp'));
    assert.match(dd, /if \(_acervoPorEsp\.has\(esp\)\) return _acervoPorEsp\.get\(esp\)/);
  });
  test('fila de candidatos ficou mais funda (+10)', () => {
    assert.ok(dd.includes('PREMIUM_EXTRAS + 10'));
  });
});

describe('privacidade — log do GitHub Actions é PÚBLICO', () => {
  test('e-mail vira apelido estável, nunca texto claro', () => {
    const m = logger.mascarar({ email: 'dra.ana@clinica.com.br' });
    assert.ok(!/dra\.ana@clinica\.com\.br/.test(JSON.stringify(m)), 'e-mail não pode sobrar no log');
    assert.match(m.email, /^usuario#[0-9a-f]{8}$/);
    assert.equal(m.email, logger.apelido('DRA.ANA@Clinica.com.BR '), 'mesmo dentista = mesmo apelido (case/espaço)');
    assert.notEqual(m.email, logger.apelido('outra@x.com'));
  });
  test('mascara e-mail no meio de frase, em array e em objeto aninhado', () => {
    const m = logger.mascarar({
      msg: 'falha ao enviar para joao@x.com agora',
      lista: ['a@b.com', 'ok'],
      dentro: { user: { email: 'c@d.org' } },
    });
    const txt = JSON.stringify(m);
    for (const e of ['joao@x.com', 'a@b.com', 'c@d.org']) assert.ok(!txt.includes(e), e + ' vazou');
    assert.equal((txt.match(/usuario#/g) || []).length, 3);
  });
  test('dados não-e-mail passam intactos (o logger não distorce o resto)', () => {
    const dados = { especialidade: 'Ortodontia', pmid: '40885697', n: 3, ok: true, nulo: null };
    assert.deepEqual(logger.mascarar(dados), dados);
  });
  test('saída real do console não contém o e-mail', () => {
    const orig = console.log;
    let capturado = '';
    console.log = (s) => { capturado += s; };
    try { logger.info('[digest] COMPLETE', { email: 'fundador@odontofeed.com', result: 'sent' }); }
    finally { console.log = orig; }
    assert.ok(!capturado.includes('fundador@odontofeed.com'));
    assert.ok(capturado.includes('usuario#'));
    assert.ok(capturado.includes('"result":"sent"'), 'resto do log preservado');
  });
});
