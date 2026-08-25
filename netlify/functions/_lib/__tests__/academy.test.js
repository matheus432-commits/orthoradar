// ODONTOFEED ACADEMY (spec 25/08) — MVP relato de caso.
// Testa os módulos puros de verdade (não só marcadores) + os guardrails
// estáticos das functions e da interface.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

const estado = require('../academy/estado');
const { avaliarConformidade, modeloTCLE } = require('../academy/conformidade');
const { CARE_ITENS, checklistPreenchida } = require('../academy/care');
const { interpretarResposta, SISTEMA_BASE, construirTurno } = require('../academy/entrevista');
const { montarEstrategia, formatarVancouver, referenciaVerificavel } = require('../academy/referencias');
const { recomendar, CATALOGO, SINAIS_PREDATORIO } = require('../academy/periodicos');
const { criarZip } = require('../academy/zip');
const { criarDocx } = require('../academy/docx');
const { criarPdf } = require('../academy/pdf');
const { montarPacote, DECLARACAO_IA, blocosManuscrito } = require('../academy/pacote');

// Projeto de exemplo completo o bastante para o pacote.
function projetoExemplo() {
  const p = estado.novoProjeto('dra@exemplo.com');
  p.id = 'acad-teste';
  p.tipo_trabalho = 'relato_de_caso';
  p.conformidade = { ...p.conformidade, avaliada: true, liberado: true, paciente_identificavel: true, tcle_disponivel: true, envolve_alem_do_relato: false };
  p.pergunta_pesquisa = { texto_simples: 'x', pico: { p: 'peri-implantitis', i: 'laser', c: 'convencional', o: 'bone level' }, confirmada: true };
  p.referencias = [{ pmid: '12345678', doi: '10.1000/x', titulo: 'Estudo real.', autores: 'Silva A, Costa B', journal: 'Braz Oral Res', ano: '2024', volume: '38', paginas: 'e10' }];
  for (const s of estado.SECOES) p.secoes[s] = { texto: 'Texto aprovado da seção ' + s + '.', aprovada: true };
  p.periodico_alvo = 'journal-of-applied-oral-science';
  p.imagens = [{ objectPath: 'academy/acad-teste/figura-01.jpg', legenda: 'Aspecto inicial', anonimizada: true }];
  return p;
}

describe('academy — máquina de etapas (trava bloqueante por construção)', () => {
  test('projeto novo nasce na entrada, sem conformidade liberada', () => {
    const p = estado.novoProjeto('X@Y.com');
    assert.equal(p.etapa_atual, 'entrada');
    assert.equal(p.usuario_email, 'x@y.com');
    assert.equal(p.conformidade.liberado, false);
  });
  test('SEM conformidade liberada NÃO existe caminho para a redação', () => {
    const p = { ...estado.novoProjeto('x@y.com'), etapa_atual: 'conformidade', tipo_trabalho: 'relato_de_caso' };
    assert.ok(estado.podeAvancar(p, 'pergunta'), 'bloqueado com pendência clínica');
    p.conformidade.liberado = true;
    assert.equal(estado.podeAvancar(p, 'pergunta'), null, 'liberado destrava');
  });
  test('etapas andam uma a uma; voltar é sempre permitido', () => {
    const p = { ...estado.novoProjeto('x@y.com'), etapa_atual: 'pergunta' };
    assert.ok(estado.podeAvancar(p, 'manuscrito'), 'pular etapa é proibido');
    assert.equal(estado.podeAvancar(p, 'entrada'), null, 'voltar pode');
  });
  test('manuscrito → periódico exige TODAS as seções aprovadas pelo autor', () => {
    const p = projetoExemplo();
    p.etapa_atual = 'manuscrito';
    p.secoes.discussao.aprovada = false;
    assert.match(estado.podeAvancar(p, 'periodico'), /discussao/);
  });
  test('tipo fora do MVP é barrado com franqueza (não finge que conduz)', () => {
    const p = { ...estado.novoProjeto('x@y.com'), etapa_atual: 'triagem', tipo_trabalho: 'ensaio_clinico', entrada_livre: 'x' };
    assert.match(estado.podeAvancar(p, 'conformidade'), /relatos de caso/);
  });
});

describe('academy — conformidade ética (Lei 14.874/2024 + CNS 466/510)', () => {
  test('imagem identificável sem TCLE → BLOQUEIA, com caminho concreto', () => {
    const v = avaliarConformidade({ pacienteIdentificavel: true, tcleDisponivel: false, envolveAlemDoRelato: false });
    assert.equal(v.liberado, false);
    assert.ok(v.pendencias[0].includes('TCLE'));
    assert.ok(v.caminhos.length >= 1);
  });
  test('coleta antes da aprovação → franqueza + 3 alternativas viáveis (nunca seguir)', () => {
    const v = avaliarConformidade({ pacienteIdentificavel: false, envolveAlemDoRelato: true, coletaPreAprovacao: true });
    assert.equal(v.liberado, false);
    assert.ok(v.pendencias[0].includes('retroativa não existe'));
    assert.equal(v.caminhos.length, 3);
    assert.ok(v.caminhos.some(c => /revis[ãa]o de literatura/i.test(c)), 'alternativa da spec presente');
  });
  test('caso limpo libera; aviso de normas + links oficiais SEMPRE presentes', () => {
    const v = avaliarConformidade({ pacienteIdentificavel: true, tcleDisponivel: true, envolveAlemDoRelato: false });
    assert.equal(v.liberado, true);
    assert.ok(v.avisoNormas.includes('14.874/2024'));
    assert.ok(v.links.plataformaBrasil.includes('plataformabrasil'));
  });
  test('TCLE modelo: placeholders [PREENCHER], nunca inferidos', () => {
    const t = modeloTCLE({});
    assert.ok(t.includes('[PREENCHER: nome completo do paciente]'));
    assert.ok(t.includes('retirar este consentimento'));
  });
});

describe('academy — CARE por baixo, sem sigla para o dentista', () => {
  test('13 itens, cada um mapeado a uma seção, com pergunta clínica', () => {
    assert.equal(CARE_ITENS.length, 13);
    for (const i of CARE_ITENS) assert.ok(estado.SECOES.includes(i.secao), i.id);
    assert.equal(CARE_ITENS.filter(i => i.pergunta === null).length, 1, 'só consentimento não repergunta');
  });
  test('checklist preenchida reflete aprovação real das seções', () => {
    const cheia = checklistPreenchida(projetoExemplo());
    assert.ok(cheia.every(i => i.contemplado));
    const p2 = projetoExemplo(); p2.secoes.discussao.aprovada = false;
    assert.ok(checklistPreenchida(p2).some(i => !i.contemplado));
  });
});

describe('academy — entrevista: contrato validado no servidor', () => {
  test('princípios no sistema: 1 pergunta, siglas proibidas, [PREENCHER], nunca inventar', () => {
    for (const marca of ['UMA pergunta por vez', 'PROIBIDO escrevê-las', 'Três níveis de explicação', '[PREENCHER]', 'NUNCA invente referência']) {
      assert.ok(SISTEMA_BASE.includes(marca), marca);
    }
  });
  test('ação fora da lista branca da etapa é DESCARTADA', () => {
    const r = interpretarResposta(JSON.stringify({ fala: 'oi', acoes: [{ tipo: 'definir_periodico', valor: 'x' }] }), 'entrada');
    assert.equal(r.acoes.length, 0);
    assert.ok(r.descartadas.length);
  });
  test('conformidade: campo/valor inválidos nunca passam', () => {
    const r = interpretarResposta(JSON.stringify({ fala: 'ok', acoes: [
      { tipo: 'responder_conformidade', campo: 'campo_inventado', valor: true },
      { tipo: 'responder_conformidade', campo: 'tcle_disponivel', valor: 'sim' },
      { tipo: 'responder_conformidade', campo: 'paciente_identificavel', valor: true },
    ] }), 'conformidade');
    assert.equal(r.acoes.length, 1);
    assert.equal(r.acoes[0].campo, 'paciente_identificavel');
  });
  test('rascunho só da SEÇÃO CORRENTE; modelo fora do JSON → fala crua sem ações', () => {
    const r1 = interpretarResposta(JSON.stringify({ fala: 'x', acoes: [{ tipo: 'rascunho_secao', secao: 'discussao', texto: 'y' }] }), 'manuscrito', { secaoAtual: 'metodos' });
    assert.equal(r1.acoes.length, 0);
    const r2 = interpretarResposta('texto solto sem json', 'entrada');
    assert.equal(r2.acoes.length, 0);
    assert.ok(r2.fala.includes('texto solto'));
  });
  test('contexto do turno leva o projeto INTEIRO e só referências verificadas', () => {
    const p = projetoExemplo();
    const { system, prompt } = construirTurno(p, [], 'oi');
    assert.ok(prompt.includes('PMID 12345678'));
    assert.ok(prompt.includes('ÚNICAS que você pode citar'));
    assert.ok(system.includes('ETAPA ATUAL'));
  });
});

describe('academy — referências verificáveis + Vancouver', () => {
  test('estratégia PICO vira busca MeSH/tiab com AND', () => {
    const e = montarEstrategia({ p: 'peri-implantitis', i: 'laser therapy', o: 'bone level' });
    assert.ok(e.includes('peri-implantitis[tiab]') && e.includes(' AND ') && e.includes('MeSH'));
  });
  test('Vancouver com DOI e PMID; sem PMID a referência NÃO é verificável', () => {
    const r = { pmid: '111', doi: '10.1/x', titulo: 'T.', autores: 'A B', journal: 'J', ano: '2024', volume: '1', paginas: '2-3' };
    const v = formatarVancouver(r, 1);
    assert.ok(v.includes('PMID: 111') && v.includes('doi:10.1/x') && v.startsWith('1. '));
    assert.ok(referenciaVerificavel(r));
    assert.ok(!referenciaVerificavel({ doi: '10.1/x', titulo: 'T', journal: 'J' }), 'sem PMID não entra');
  });
});

describe('academy — periódicos e predatórios', () => {
  test('iniciante vê primeiro nacional + acesso aberto + sem taxa', () => {
    const lista = recomendar({});
    assert.ok(lista.length >= 5);
    assert.ok(lista[0].nacional && /sem taxa/i.test(lista[0].apc), 'topo da lista é o caminho barato');
    const comApc = lista.find(p => !/sem taxa/i.test(p.apc));
    assert.ok(comApc && comApc.alertaCusto, 'APC sempre com alerta explícito');
  });
  test('catálogo: todos com escopo, APC, idioma, tempo e link de instruções', () => {
    for (const p of CATALOGO.periodicos) {
      for (const c of ['escopo', 'apc', 'idiomas', 'tempoMedioResposta', 'instrucoes']) assert.ok(p[c], p.id + '.' + c);
    }
  });
  test('filtro por especialidade respeita somenteEspecialidades', () => {
    const orto = recomendar({ especialidade: 'Ortodontia' });
    assert.ok(orto.some(p => p.id === 'dental-press-journal-orthodontics'));
    assert.ok(!recomendar({ especialidade: 'Endodontia' }).some(p => p.id === 'dental-press-journal-orthodontics'));
  });
  test('sinais de predatório em linguagem clínica (COPE/Think-Check-Submit)', () => {
    assert.ok(SINAIS_PREDATORIO.length >= 5);
    assert.ok(SINAIS_PREDATORIO.some(s => /aceite garantido|APC|DOAJ/i.test(s)));
  });
});

describe('academy — exportadores sem dependências', () => {
  test('ZIP: assinaturas locais + EOCD corretos', () => {
    const z = criarZip([{ nome: 'a.txt', dados: 'olá' }]);
    assert.equal(z.readUInt32LE(0), 0x04034b50);
    assert.equal(z.readUInt32LE(z.length - 22), 0x06054b50);
  });
  test('DOCX: contêiner com document.xml e escape de XML', () => {
    const d = criarDocx([{ tipo: 'paragrafo', texto: 'a & b <c>' }]);
    assert.equal(d.readUInt32LE(0), 0x04034b50, 'docx é zip');
    const s = d.toString('latin1');
    assert.ok(s.includes('word/document.xml'));
    assert.ok(d.toString('utf8').includes('a &amp; b &lt;c&gt;'));
  });
  test('PDF: header, xref e acentos (WinAnsi)', () => {
    const p = criarPdf([{ tipo: 'titulo1', texto: 'Distalização' }, { tipo: 'paragrafo', texto: 'coração êxito ãõç' }]);
    const s = p.toString('latin1');
    assert.ok(s.startsWith('%PDF-1.4'));
    assert.ok(s.includes('startxref') && s.endsWith('%%EOF\n'));
    assert.ok(s.includes('WinAnsiEncoding'));
  });
});

describe('academy — pacote de entrega', () => {
  test('ZIP completo com as 9 peças da spec', () => {
    const zip = montarPacote(projetoExemplo()).toString('latin1');
    for (const nome of ['manuscrito.docx', 'manuscrito.pdf', 'cover-letter.docx', 'checklist-care.pdf', 'tcle-modelo.docx', 'declaracoes.docx', 'roteiro-de-submissao.pdf', 'figuras.txt']) {
      assert.ok(zip.includes(nome), nome);
    }
  });
  test('declaração de IA (ICMJE 2026): IA não é autora, autores respondem por tudo', () => {
    assert.ok(DECLARACAO_IA.includes('não é autora'));
    assert.ok(DECLARACAO_IA.includes('integral responsabilidade'));
    const blocos = blocosManuscrito(projetoExemplo());
    assert.ok(blocos.some(b => b.texto === DECLARACAO_IA), 'declaração DENTRO do manuscrito');
  });
  test('lacuna vira [PREENCHER] — nunca preenchida por inferência (guardrail 2)', () => {
    const p = projetoExemplo();
    delete p.secoes.conclusao;
    const blocos = blocosManuscrito(p);
    assert.ok(blocos.some(b => b.texto === '[PREENCHER]'));
  });
  test('só referência verificável entra no manuscrito (guardrail 1)', () => {
    const p = projetoExemplo();
    p.referencias.push({ titulo: 'Sem PMID — não pode entrar', journal: 'X' });
    const refs = blocosManuscrito(p).filter(b => /PMID:/.test(b.texto));
    assert.equal(refs.length, 1);
  });
});

describe('academy — functions e interface (guardrails de fiação)', () => {
  test('todas as functions: sessão validada ANTES de tocar projeto + rate limit', () => {
    for (const f of ['academy-projeto', 'academy-chat', 'academy-busca', 'academy-upload', 'academy-export']) {
      const code = src(path.join(FUNCS, f + '.js'));
      assert.ok(code.indexOf('sessaoValida(') < code.indexOf("getDoc('academy_projetos'") || code.includes("query('academy_projetos'"), f);
      assert.ok(code.includes('rateLimited(event'), f + ' rate limit');
      assert.ok(code.includes('usuario_email === email') || code.includes('usuario_email !== email') || code.includes("op: 'EQUAL', value: { stringValue: email }"), f + ' escopo do dono');
    }
  });
  test('aprovação de seção SÓ pela mão do autor (guardrail 7): o chat nunca aprova', () => {
    const chat = src(path.join(FUNCS, 'academy-chat.js'));
    assert.ok(chat.includes('aprovada: false'), 'rascunho nasce não-aprovado');
    assert.ok(!chat.includes('aprovada: true'), 'chat não tem caminho de aprovação');
    assert.ok(src(path.join(FUNCS, 'academy-projeto.js')).includes("acao === 'aprovar_secao'"));
  });
  test('veredito de conformidade é do SERVIDOR (avaliarConformidade no chat), não da conversa', () => {
    const chat = src(path.join(FUNCS, 'academy-chat.js'));
    assert.ok(chat.includes('avaliarConformidade('));
    assert.ok(chat.includes('podeAvancar('), 'avanço sempre pela máquina de etapas');
  });
  test('upload remove metadados por padrão e avisa da anonimização visual', () => {
    const up = src(path.join(FUNCS, 'academy-upload.js'));
    assert.ok(up.includes('limparMetadadosJpeg'));
    assert.ok(up.includes('responsabilidade do autor'));
  });
  test('export: sem periódico → 409 com explicação, nunca pacote pela metade em silêncio', () => {
    const ex = src(path.join(FUNCS, 'academy-export.js'));
    assert.ok(ex.includes('409') && ex.includes('pacote_indisponivel'));
  });
  test('interface: posicionamento explícito + identidade da casa (#2D6A4F, creme, serif)', () => {
    const html = src(path.join(RAIZ, 'academy.html'));
    assert.ok(html.includes('não redação terceirizada'));
    assert.ok(html.includes('#2D6A4F') && html.includes('#F6F1E8') && html.includes('Georgia'));
    assert.ok(html.includes('Aprovar seção'), 'botão de aprovação humana');
    assert.ok(html.includes('metadados (EXIF/GPS) removidos'), 'aviso de anonimização');
    assert.ok(!/\bPICO\b|\bCARE\b|STROBE|CONSORT|PRISMA/.test(html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')), 'siglas acadêmicas nunca na interface');
  });
});
