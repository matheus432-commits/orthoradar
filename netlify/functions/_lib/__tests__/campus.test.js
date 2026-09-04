// OdontoFeed CAMPUS — porta do aluno, páginas piloto e gerador.
//
// O que fica travado aqui:
//   • as páginas piloto seguem o esqueleto de 9 blocos e apontam para ids
//     reais da árvore; nenhuma traz PMID escrito à mão; nenhuma foto;
//   • o gerador monta prompt sem inventar referência e só aceita rascunho
//     que respeite o esqueleto (parser testado com resposta simulada);
//   • campus.html: identidade da casa, duas portas, abas (apostilas,
//     simulados, calculadoras), prateleiras por módulo, busca em todo o
//     texto, leitura com os 9 blocos, download por impressão, sem <img>;
//   • a função admin exige ADMIN_SECRET e não tem schedule.
//
// Run: node --test netlify/functions/_lib/__tests__/campus.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const { BLOCOS, problemasDaPagina, capa, blocoDeBusca } = require('../campus/pagina');
const { montarPrompt, interpretar, localizarPagina, gerarPagina } = require('../campus/gerador');
const { taxonomia } = require('../ensino/taxonomia');

const DIR = path.join(RAIZ, 'data', 'campus', 'paginas');
const paginas = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, p: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
const idsArvore = new Set();
for (const a of taxonomia().areas) for (const m of a.modulos) for (const t of m.temas) for (const p of t.paginas) idsArvore.add(p.id);
const html = fs.readFileSync(path.join(RAIZ, 'campus.html'), 'utf8');

describe('páginas piloto', () => {
  test('existem as cinco páginas de Ortodontia combinadas com o fundador', () => {
    assert.equal(paginas.length, 5);
    const temas = paginas.map(({ p }) => p.titulo.toLowerCase());
    for (const t of ['mini-implante', 'herbst', 'expansão rápida', 'recidiva', 'steiner']) assert.ok(temas.some((x) => x.includes(t)), t);
    assert.ok(paginas.every(({ p }) => p.areaId === 'ortodontia'));
  });
  test('cada uma respeita o esqueleto de 9 blocos e aponta para uma página real da árvore', () => {
    for (const { f, p } of paginas) {
      assert.deepEqual(problemasDaPagina(p), [], f);
      assert.ok(idsArvore.has(p.id), f + ' id fora da árvore: ' + p.id);
      for (const b of BLOCOS) if (b.id !== 'pesquisa' && b.id !== 'validacao') assert.ok(p[b.id], f + ' sem ' + b.id);
    }
  });
  test('rascunhos: nada validado ainda, sem PMID, sem foto, sem emoji, com "Distalização"', () => {
    for (const { f, p } of paginas) {
      assert.equal(p.estado, 'rascunho', f);
      const s = JSON.stringify(p);
      assert.ok(!/PMID/i.test(s), f + ' cita PMID');
      assert.ok(!/\.(jpg|jpeg|png|webp)|<img/i.test(s), f + ' tem foto');
      assert.ok(!/distanciamento/i.test(s), f);
    }
    assert.ok(paginas.some(({ p }) => JSON.stringify(p).includes('Distalização')));
  });
  test('autoteste: 5 questões, gabarito dentro das alternativas, explicação marca a correta', () => {
    for (const { f, p } of paginas) for (const [i, q] of p.autoteste.entries()) {
      assert.equal(q.alternativas.length, q.explicacoes.length, f + ' q' + i);
      assert.match(q.explicacoes[q.correta], /^Correta/, f + ' q' + i + ': explicação da correta deve começar com "Correta"');
      q.explicacoes.forEach((e, k) => { if (k !== q.correta) assert.ok(!/^Correta/.test(e), f + ' q' + i + ': alternativa ' + k + ' não é a correta'); });
    }
  });
  test('fluxograma: um início, todo nó alcançável, nenhum nó de fim sem chegada', () => {
    for (const { f, p } of paginas) {
      const f0 = p.fluxograma; const ini = f0.nos.filter((n) => n.tipo === 'inicio');
      assert.equal(ini.length, 1, f);
      const alc = new Set([ini[0].id]); let mudou = true;
      while (mudou) { mudou = false; for (const a of f0.arestas) if (alc.has(a.de) && !alc.has(a.para)) { alc.add(a.para); mudou = true; } }
      assert.equal(alc.size, f0.nos.length, f + ': nós inalcançáveis');
      for (const n of f0.nos) if (n.tipo === 'fim') assert.ok(f0.arestas.some((a) => a.para === n.id), f + ': fim sem chegada ' + n.id);
    }
  });
  test('capa e bloco de busca: "miniimplante" e "streptococcus" acham o que devem', () => {
    const mini = paginas.find(({ p }) => /mini-implante/i.test(p.titulo)).p;
    const c = capa(mini);
    assert.equal(c.estado, 'rascunho'); assert.match(c.cor, /^#[0-9A-F]{6}$/i); assert.ok(c.resumo.length > 40);
    assert.ok(blocoDeBusca(mini).includes('miniimplante'), 'hífen removido na busca');
    assert.ok(!blocoDeBusca(mini).includes('streptococcus'));
  });
});

describe('gerador', () => {
  const alvo = localizarPagina('ortodontia/diagnostico/cefalometria/analise-de-steiner');
  test('localiza a página na árvore com área, módulo, tema e irmãs', () => {
    assert.equal(alvo.area.nome, 'Ortodontia'); assert.equal(alvo.tema.nome, 'Cefalometria');
    assert.ok(alvo.irmas.length >= 3 && !alvo.irmas.includes('Análise de Steiner'));
    assert.equal(localizarPagina('nao/existe'), null);
  });
  test('prompt: só títulos reais como contexto, proíbe PMID, exige JSON com os 9 blocos', () => {
    const pr = montarPrompt(alvo, [{ titulo: 'Um artigo real', journal: 'AJO-DO', year: 2025 }]);
    assert.ok(pr.includes('1. Um artigo real (AJO-DO, 2025)'));
    assert.ok(pr.includes('NÃO cite números de PMID'));
    assert.ok(pr.includes('Distalização'));
    for (const k of ['umMinuto', 'infografico', 'fluxograma', 'passoAPasso', 'macetes', 'ondeErra', 'autoteste', 'pesquisa']) assert.ok(pr.includes('"' + k + '"'), k);
    assert.ok(montarPrompt(alvo, []).includes('nenhum artigo recente localizado'));
  });
  test('parser: resposta com cerca de markdown vira rascunho válido; resposta fora do esqueleto é recusada', () => {
    const base = paginas[0].p;
    const corpo = { titulo: 'T', umMinuto: base.umMinuto, infografico: base.infografico, fluxograma: base.fluxograma, passoAPasso: base.passoAPasso, macetes: base.macetes, ondeErra: base.ondeErra, autoteste: base.autoteste, pesquisa: { termos: ['x'] } };
    const p = interpretar('```json\n' + JSON.stringify(corpo) + '\n```', alvo);
    assert.equal(p.estado, 'rascunho'); assert.equal(p.id, alvo.pagina.id); assert.equal(p.area, 'Ortodontia');
    assert.deepEqual(problemasDaPagina(p), []);
    assert.throws(() => interpretar(JSON.stringify({ ...corpo, autoteste: corpo.autoteste.slice(0, 3) }), alvo), /exatamente 5 questões/);
    assert.throws(() => interpretar('sem json', alvo), /sem JSON/);
  });
  test('gerarPagina: dryRun devolve prompt sem chamar; com chamada injetada devolve rascunho', async () => {
    const d = await gerarPagina({ paginaId: alvo.pagina.id, dryRun: true });
    assert.ok(d.prompt.includes('Análise de Steiner') && d.alvo.tema === 'Cefalometria');
    let chamadas = 0;
    const base = paginas[1].p;
    const p = await gerarPagina({ paginaId: alvo.pagina.id, chamar: async () => { chamadas++; return JSON.stringify({ titulo: 'x', umMinuto: base.umMinuto, infografico: base.infografico, fluxograma: base.fluxograma, passoAPasso: base.passoAPasso, macetes: base.macetes, ondeErra: base.ondeErra, autoteste: base.autoteste, pesquisa: { termos: ['y'] } }); } });
    assert.equal(chamadas, 1); assert.equal(p.estado, 'rascunho');
    await assert.rejects(gerarPagina({ paginaId: 'nao/existe' }), /não existe na árvore/);
  });
  test('função admin: exige ADMIN_SECRET, POST, sem schedule no netlify.toml', () => {
    const src = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'campus-gerar.js'), 'utf8');
    assert.ok(src.includes('ADMIN_SECRET') && src.includes("httpMethod !== 'POST'"));
    assert.ok(src.includes("estado: 'rascunho'") || src.includes('pagina.estado'));
    const toml = fs.readFileSync(path.join(RAIZ, 'netlify.toml'), 'utf8');
    assert.ok(!/campus-gerar/.test(toml), 'nunca agendada');
  });
});

describe('campus.html (porta do aluno)', () => {
  test('identidade da casa e zero fotos', () => {
    for (const tok of ['--bg:#FBF7EF', '--gold:#B08968', '--border:#EDE6D8']) assert.ok(html.includes(tok), tok);
    assert.ok(html.includes('OdontoFeed<em>.</em> Campus') && html.includes('← voltar à área de membro'));
    assert.ok(!/<img/i.test(html), 'sem fotos por enquanto (decisão do fundador)');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html.replace(/<script>[\s\S]*<\/script>/, '')));
  });
  test('duas portas: aluno entra, professor em breve', () => {
    assert.ok(html.includes('Para quem estuda') && html.includes('Para quem ensina'));
    assert.ok(html.includes('onclick="irAluno()"') && /em breve/.test(html));
  });
  test('abas do aluno: todas as soluções sugeridas, sem filtro por ciclo', () => {
    for (const a of ['apostilas', 'simulados', 'flashcards', 'prova', 'checklists', 'casos', 'trilhas', 'audio', 'calculadoras']) assert.ok(html.includes('data-aba="' + a + '"'), a);
    assert.ok(!html.includes('filtros-ciclo') && !html.includes("filtrarCiclo("), 'a aba Especialização e os filtros de ciclo saíram (04/09)');
  });
  test('cada solução trabalha em cima dos dados das apostilas e da memória local do aluno', () => {
    assert.ok(html.includes('function cartoesDe') && html.includes("const passos=[1,3,7,14]"), 'flashcards com repetição espaçada');
    assert.ok(html.includes('async function provaAmanha') && html.includes('erros[q.pergunta]'), 'prova amanhã prioriza o que errou');
    assert.ok(html.includes('async function checklists') && html.includes('p.passoAPasso.map'), 'checklists do passo a passo');
    assert.ok(html.includes('async function casos') && html.includes('function passoCaso'), 'casos percorrem o fluxograma');
    assert.ok(html.includes('function trilha()') && html.includes('const OBJETIVOS='), 'trilhas por objetivo');
    assert.ok(html.includes('speechSynthesis') && html.includes("u.lang='pt-BR'"), 'áudio');
    assert.ok(html.includes("localStorage.getItem('campus.'") && html.includes('try{'), 'memória local protegida por try');
  });
  test('apostilas: especialidade → prateleiras por módulo com capas tipográficas → busca em todo o texto → leitura → download', () => {
    assert.ok(html.includes('id="grade-esp"') && html.includes('class="prateleira"') && html.includes('class="fila"'));
    assert.ok(html.includes('class="capa"') && html.includes('class="banner"'), 'capa com banner, sem imagem');
    assert.ok(html.includes('Busque em todo o texto das apostilas de'));
    assert.ok(html.includes("termos.every(t=>c.busca.includes(t))"), 'E de termos sobre o bloco de busca da página');
    assert.ok(html.includes('em preparação'), 'mostra o que ainda vem da árvore');
    for (const [k] of [['umMinuto'], ['infografico'], ['fluxograma'], ['passoAPasso'], ['macetes'], ['ondeErra'], ['autoteste'], ['pesquisa'], ['validacao']]) assert.ok(html.includes("['" + k + "',"), k);
    assert.ok(html.includes('window.print()') && html.includes('@media print'));
    assert.ok(html.includes("MOSTRAR_RASCUNHOS||c.estado!=='rascunho'"), 'produção esconde rascunhos');
  });
  test('bloco 8 vem da Biblioteca ao vivo; validação explica o rascunho', () => {
    assert.ok(html.includes("/.netlify/functions/acervo?esp="));
    assert.ok(html.includes('Rascunho para validação'));
  });
  test('calculadoras com fonte declarada e valores de Malamed', () => {
    assert.ok(html.includes('Malamed'));
    assert.ok(html.includes('lido:{mgkg:7,max:500,mgml:20') && html.includes('bupi:{mgkg:2,max:90'));
    assert.ok(html.includes('CPO-D') && html.includes('Cronologia de erupção') && html.includes('Dose pediátrica'));
  });
  test('prévia autocontida gerada e em dia com campus.html e as páginas', () => {
    const prev = path.join(RAIZ, 'docs', 'prototipos', 'campus-preview.html');
    assert.ok(fs.existsSync(prev), 'rode scripts/campus-indice.js');
    const s = fs.readFileSync(prev, 'utf8');
    assert.ok(s.includes('window.CAMPUS_DADOS='));
    assert.ok(s.includes(html.slice(html.indexOf('<script>') + 8, html.indexOf('<script>') + 400)), 'script da prévia igual ao de campus.html');
    for (const { p } of paginas) assert.ok(s.includes(JSON.stringify(p.titulo)), p.titulo);
    const idx = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'campus', 'indice.json'), 'utf8'));
    assert.equal(idx.apostilas.length, paginas.length);
  });
});
