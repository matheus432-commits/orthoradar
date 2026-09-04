'use strict';
// OdontoFeed CAMPUS — a PÁGINA de apostila (unidade do produto do aluno).
//
// Toda página tem o mesmo esqueleto de 9 blocos (spec 01/09), para que o aluno
// saiba onde procurar cada coisa sem ler o texto inteiro, e para que a mesma
// página vire a aula e a prova do professor. Este módulo é puro: define o
// esqueleto, valida uma página e deriva o que a interface precisa (capa,
// bloco de busca). Nenhum I/O.
//
// Estados: 'rascunho' (gerado ou escrito, invisível ao aluno) → 'validada'
// (um dentista leu, corrigiu e assinou) → 'publicada'. A tela de validação
// fica para depois (decisão do fundador, 04/09); por ora o estado é dado.

const { normalizar } = require('../ensino/taxonomia');

const BLOCOS = [
  { id: 'umMinuto', nome: 'Em um minuto', funcao: 'O tema em cinco frases, o que cai em prova e por que importa na clínica.' },
  { id: 'infografico', nome: 'Infográfico', funcao: 'Uma imagem que resume o tema, desenhada em vetor a partir do texto validado.' },
  { id: 'fluxograma', nome: 'Fluxograma de decisão', funcao: 'Se isso, então aquilo: diagnóstico, escolha, conduta.' },
  { id: 'passoAPasso', nome: 'Passo a passo', funcao: 'O procedimento em etapas numeradas, com o que conferir em cada uma.' },
  { id: 'macetes', nome: 'Macetes e dicas', funcao: 'Mnemônicos, números para decorar, o jeito de lembrar.' },
  { id: 'ondeErra', nome: 'Onde todo mundo erra', funcao: 'Os erros clássicos de prova e de clínica neste tema.' },
  { id: 'autoteste', nome: 'Autoteste', funcao: 'Cinco questões no estilo ENADE e residência, com explicação de cada alternativa.' },
  { id: 'pesquisa', nome: 'O que a pesquisa diz hoje', funcao: 'Os artigos mais recentes da Biblioteca do OdontoFeed sobre o tema. Atualiza sozinho.' },
  { id: 'validacao', nome: 'Quem validou', funcao: 'Nome, especialidade e data da validação.' },
];

const ESTADOS = ['rascunho', 'validada', 'publicada'];

// Formato 2 (spec 04/09, "o aluno precisa querer continuar"): além dos 9
// blocos, a página ganha um CORPO de leitura: abertura com situação clínica,
// seções curtas com visuais em SVG escritos à mão, quadros de destaque e uma
// pergunta de checagem por seção, e um fechamento com resumo visual e três
// flashcards. Regra de ouro: nunca mais de 3 parágrafos seguidos sem um
// visual, um quadro ou uma pergunta.
const VISUAIS = ['fluxograma', 'classificacao', 'linha-do-tempo', 'forcas', 'comparativo', 'processo', 'anatomico', 'grafico', 'mapa'];
const DESTAQUES = { erro: 'Erro comum', dica: 'Dica clínica', prova: 'Cai na prova', mito: 'Mito x verdade', frase: 'Em uma frase' };
const MAX_PARAGRAFOS_SEGUIDOS = 3;
const MAX_CHARS_PARAGRAFO = 520; // 2 a 4 linhas de leitura
const MARCA_VERIFICAR = '[VERIFICAR]';

function erro(lista, cond, msg) { if (!cond) lista.push(msg); }

function svgDe(v) { return Array.isArray(v && v.svg) ? v.svg.join('\n') : String((v && v.svg) || ''); }

// Um visual em SVG escrito à mão: viewBox, título e descrição (acessibilidade)
// e markup sem script, sem imagem externa, sem evento.
function problemasDoVisual(v, onde, e) {
  erro(e, v && typeof v === 'object', onde + ': visual ausente');
  if (!v || typeof v !== 'object') return;
  erro(e, VISUAIS.includes(v.formato), onde + ': formato de visual desconhecido (' + v.formato + ')');
  erro(e, typeof v.titulo === 'string' && v.titulo.trim(), onde + ': visual sem título');
  erro(e, typeof v.descricao === 'string' && v.descricao.length > 20, onde + ': visual sem descrição para leitor de tela');
  erro(e, /^0 0 \d+ \d+$/.test(v.viewBox || ''), onde + ': viewBox no formato "0 0 L A"');
  const s = svgDe(v);
  erro(e, s.includes('<') && s.length > 40, onde + ': svg vazio');
  erro(e, !/<script|<image|<foreignObject|javascript:|\son[a-z]+\s*=|href\s*=\s*['"]https?:/i.test(s), onde + ': svg com script, imagem externa, evento ou link');
  erro(e, !/<svg[\s>]/i.test(s), onde + ': o svg é só o miolo; a tag <svg> é da plataforma');
}

function problemasDoCorpo(p, e) {
  const ab = p.abertura || {};
  erro(e, typeof ab.situacao === 'string' && ab.situacao.length > 40, 'abertura.situacao: situação clínica concreta');
  erro(e, typeof ab.pergunta === 'string' && /\?\s*$/.test(ab.pergunta), 'abertura.pergunta: termina com pergunta');
  erro(e, !/^(a|o|as|os)\s+\S+\s+(é|são)\s+definid/i.test(ab.situacao || ''), 'abertura não começa com definição de dicionário');
  erro(e, Array.isArray(p.secoes) && p.secoes.length >= 3, 'secoes: ao menos 3 seções');
  let visuais = 0; const estilos = new Set(); let destaques = 0;
  for (const [i, s] of (p.secoes || []).entries()) {
    const onde = 'secoes[' + i + ']';
    erro(e, s && typeof s.titulo === 'string' && s.titulo.trim(), onde + ': título');
    erro(e, s && Array.isArray(s.blocos) && s.blocos.length >= 2, onde + ': ao menos 2 blocos');
    erro(e, s && s.checagem && s.checagem.pergunta && s.checagem.resposta, onde + ': checagem com pergunta e resposta');
    let seguidos = 0;
    for (const [j, b] of ((s && s.blocos) || []).entries()) {
      const ondeB = onde + '.blocos[' + j + ']';
      if (!b || !b.tipo) { e.push(ondeB + ': bloco sem tipo'); continue; }
      if (b.tipo === 'p' || b.tipo === 'lista') {
        seguidos++;
        if (b.tipo === 'p') { erro(e, typeof b.texto === 'string' && b.texto.trim(), ondeB + ': parágrafo vazio'); erro(e, (b.texto || '').length <= MAX_CHARS_PARAGRAFO, ondeB + ': parágrafo longo demais (' + (b.texto || '').length + ' > ' + MAX_CHARS_PARAGRAFO + ')'); }
        else erro(e, Array.isArray(b.itens) && b.itens.length >= 2 && b.itens.length <= 7, ondeB + ': lista de 2 a 7 itens');
        erro(e, seguidos <= MAX_PARAGRAFOS_SEGUIDOS, ondeB + ': mais de ' + MAX_PARAGRAFOS_SEGUIDOS + ' parágrafos seguidos sem visual, quadro ou pergunta');
      } else {
        seguidos = 0;
        if (b.tipo === 'visual') { visuais++; problemasDoVisual(b, ondeB, e); }
        else if (b.tipo === 'destaque') { destaques++; estilos.add(b.estilo); erro(e, DESTAQUES[b.estilo], ondeB + ': estilo de destaque desconhecido'); erro(e, b.estilo === 'mito' ? (b.mito && b.verdade) : (typeof b.texto === 'string' && b.texto.length > 20), ondeB + ': destaque sem texto'); }
        else if (b.tipo === 'imagem') { for (const k of ['imagem', 'mostrar', 'legenda', 'destacar']) erro(e, typeof b[k] === 'string' && b[k].trim(), ondeB + ': placeholder de imagem clínica sem ' + k); }
        else if (b.tipo === 'pergunta') { erro(e, b.pergunta && b.resposta, ondeB + ': pergunta com resposta'); }
        else e.push(ondeB + ': tipo de bloco desconhecido (' + b.tipo + ')');
      }
    }
  }
  erro(e, visuais >= 1, 'densidade: ao menos 1 visual principal nas seções');
  erro(e, destaques >= 2 && estilos.size >= 2, 'densidade: ao menos 2 quadros de destaque de tipos diferentes');
  const f = p.fechamento || {};
  problemasDoVisual(f.visual, 'fechamento.visual', e);
  erro(e, Array.isArray(f.flashcards) && f.flashcards.length === 3 && f.flashcards.every((c) => c.frente && c.verso), 'fechamento.flashcards: exatamente 3, com frente e verso');
  if (p.estado !== 'rascunho') erro(e, !JSON.stringify(p).includes(MARCA_VERIFICAR), 'página validada não pode manter [VERIFICAR]');
}

// Devolve a lista de problemas (vazia = válida). Não lança.
function problemasDaPagina(p) {
  const e = [];
  erro(e, p && typeof p === 'object', 'página não é objeto');
  if (e.length) return e;
  for (const k of ['id', 'areaId', 'area', 'modulo', 'tema', 'titulo']) erro(e, typeof p[k] === 'string' && p[k].trim(), `falta ${k}`);
  erro(e, /^[a-z0-9/-]+$/.test(p.id || ''), 'id não é um caminho da árvore');
  erro(e, ESTADOS.includes(p.estado), 'estado inválido');
  const u = p.umMinuto || {};
  erro(e, Array.isArray(u.frases) && u.frases.length >= 4 && u.frases.length <= 6, 'umMinuto.frases: 4 a 6 frases');
  erro(e, Array.isArray(u.caiNaProva) && u.caiNaProva.length >= 2, 'umMinuto.caiNaProva: ao menos 2 itens');
  erro(e, typeof u.porQueImporta === 'string' && u.porQueImporta.length > 30, 'umMinuto.porQueImporta');
  const inf = p.infografico || {};
  erro(e, typeof inf.titulo === 'string' && Array.isArray(inf.itens) && inf.itens.length >= 3 && inf.itens.every((i) => i.rotulo && i.texto), 'infografico: título e 3+ itens com rótulo e texto');
  const f = p.fluxograma || {};
  erro(e, typeof f.titulo === 'string' && Array.isArray(f.nos) && f.nos.length >= 3, 'fluxograma: título e 3+ nós');
  if (Array.isArray(f.nos)) {
    const ids = new Set(f.nos.map((n) => n.id));
    erro(e, ids.size === f.nos.length, 'fluxograma: ids de nós repetidos');
    erro(e, f.nos.every((n) => ['inicio', 'decisao', 'acao', 'fim'].includes(n.tipo) && n.texto), 'fluxograma: nó sem tipo válido ou texto');
    erro(e, Array.isArray(f.arestas) && f.arestas.every((a) => ids.has(a.de) && ids.has(a.para)), 'fluxograma: aresta aponta para nó inexistente');
    erro(e, f.nos.filter((n) => n.tipo === 'inicio').length === 1, 'fluxograma: exatamente um nó de início');
  }
  erro(e, Array.isArray(p.passoAPasso) && p.passoAPasso.length >= 3 && p.passoAPasso.every((s) => s.passo && s.confira), 'passoAPasso: 3+ passos com "confira"');
  erro(e, Array.isArray(p.macetes) && p.macetes.length >= 2 && p.macetes.every((m) => m.titulo && m.texto), 'macetes: 2+');
  erro(e, Array.isArray(p.ondeErra) && p.ondeErra.length >= 3 && p.ondeErra.every((x) => x.erro && x.porque && x.certo), 'ondeErra: 3+ com erro/porque/certo');
  erro(e, Array.isArray(p.autoteste) && p.autoteste.length === 5, 'autoteste: exatamente 5 questões');
  for (const [i, q] of (p.autoteste || []).entries()) {
    erro(e, q && q.pergunta && Array.isArray(q.alternativas) && q.alternativas.length >= 4 && q.alternativas.length <= 5, `autoteste[${i}]: 4 ou 5 alternativas`);
    erro(e, Number.isInteger(q && q.correta) && q.correta >= 0 && q.correta < (q.alternativas || []).length, `autoteste[${i}]: índice da correta`);
    erro(e, Array.isArray(q && q.explicacoes) && q.explicacoes.length === (q.alternativas || []).length, `autoteste[${i}]: uma explicação por alternativa`);
  }
  const ps = p.pesquisa || {};
  erro(e, Array.isArray(ps.termos) && ps.termos.length >= 1, 'pesquisa.termos: termos de busca na Biblioteca');
  erro(e, !ps.artigos, 'pesquisa: nunca traz artigos fixos; o bloco é dinâmico');
  const v = p.validacao || {};
  erro(e, typeof v === 'object', 'validacao');
  if (p.estado !== 'rascunho') erro(e, v.validadoPor && v.data, 'página validada precisa de validadoPor e data');
  if (p.formato === 2) problemasDoCorpo(p, e);
  else erro(e, !p.secoes && !p.abertura, 'página com corpo precisa declarar "formato": 2');
  // Linguagem da casa.
  const txt = JSON.stringify(p);
  erro(e, !/distanciamento/i.test(txt), 'termo proibido: Distanciamento (use Distalização)');
  erro(e, !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt), 'emoji na página');
  erro(e, !/\bPMID\s*:?\s*\d/i.test(txt), 'PMID escrito à mão: referência verificável só vem da Biblioteca');
  return e;
}

function validarPagina(p) {
  const e = problemasDaPagina(p);
  if (e.length) throw new Error('página inválida: ' + e.join('; '));
  return true;
}

// Capa da "prateleira": tudo que a lista precisa sem carregar a página inteira.
// A cor da capa é determinística pelo id (paleta da casa), sem foto.
const PALETA = ['#B08968', '#3E7C4F', '#4A6B8A', '#B4533B', '#8A6E4B', '#5E7C6A'];
function capa(p) {
  let h = 0; for (const c of p.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return {
    id: p.id, areaId: p.areaId, area: p.area, modulo: p.modulo, tema: p.tema, titulo: p.titulo,
    estado: p.estado, cor: PALETA[h % PALETA.length], formato: p.formato || 1,
    resumo: (p.umMinuto && p.umMinuto.frases && p.umMinuto.frases[0]) || '',
    pergunta: (p.abertura && p.abertura.pergunta) || '',
    validadoPor: (p.validacao && p.validacao.validadoPor) || null,
    busca: blocoDeBusca(p),
  };
}

// Texto normalizado de TUDO que está escrito na página, para a busca
// "streptococcus mutans → todas as apostilas em que aparece".
function blocoDeBusca(p) {
  const partes = [p.area, p.modulo, p.tema, p.titulo];
  const u = p.umMinuto || {};
  partes.push(...(u.frases || []), ...(u.caiNaProva || []), u.porQueImporta || '');
  const inf = p.infografico || {}; partes.push(inf.titulo || '', ...(inf.itens || []).flatMap((i) => [i.rotulo, i.texto]));
  const f = p.fluxograma || {}; partes.push(f.titulo || '', ...(f.nos || []).map((n) => n.texto), ...(f.arestas || []).map((a) => a.rotulo || ''));
  partes.push(...(p.passoAPasso || []).flatMap((s) => [s.passo, s.confira]));
  partes.push(...(p.macetes || []).flatMap((m) => [m.titulo, m.texto]));
  partes.push(...(p.ondeErra || []).flatMap((x) => [x.erro, x.porque, x.certo]));
  partes.push(...(p.autoteste || []).flatMap((q) => [q.pergunta, ...(q.alternativas || []), ...(q.explicacoes || [])]));
  partes.push(...((p.pesquisa || {}).termos || []));
  partes.push(...textosDoCorpo(p));
  const tokens = new Set(normalizar(partes.filter(Boolean).join(' ')).split(' ').filter(Boolean));
  return [...tokens].join(' ');
}

// Só o texto lido (sem markup) de um visual: o que está em <text>.
function textoDoSvg(v) { return svgDe(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

function textosDoCorpo(p) {
  const t = [];
  if (p.abertura) t.push(p.abertura.situacao, p.abertura.pergunta);
  for (const s of p.secoes || []) {
    t.push(s.titulo);
    for (const b of s.blocos || []) {
      if (b.tipo === 'p') t.push(b.texto);
      else if (b.tipo === 'lista') t.push(...(b.itens || []));
      else if (b.tipo === 'visual') t.push(b.titulo, b.descricao, b.legenda || '', textoDoSvg(b));
      else if (b.tipo === 'destaque') t.push(b.titulo || '', b.texto || '', b.mito || '', b.verdade || '');
      else if (b.tipo === 'imagem') t.push(b.legenda, b.mostrar);
      else if (b.tipo === 'pergunta') t.push(b.pergunta, b.resposta);
    }
    if (s.checagem) t.push(s.checagem.pergunta, s.checagem.resposta);
  }
  const f = p.fechamento || {};
  if (f.visual) t.push(f.visual.titulo, f.visual.descricao, textoDoSvg(f.visual));
  for (const c of f.flashcards || []) t.push(c.frente, c.verso);
  return t.filter(Boolean);
}

// Números da página para o controle de progresso (data/campus-progresso.json):
// palavras de prosa (sem markup), visuais por formato, quadros por estilo,
// imagens clínicas pendentes e marcações [VERIFICAR] com localização.
function metricas(p) {
  const palavras = (s) => String(s || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  let n = 0;
  const conta = (x) => { if (typeof x === 'string') n += palavras(x); else if (Array.isArray(x)) x.forEach(conta); else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (k !== 'svg' && k !== 'viewBox' && k !== 'id') conta(v); };
  conta(p);
  const visuais = []; const quadros = {}; const imagens = []; const verificar = [];
  const marca = (onde, txt) => { let i = -1; while ((i = String(txt || '').indexOf(MARCA_VERIFICAR, i + 1)) >= 0) verificar.push({ onde, trecho: String(txt).slice(Math.max(0, i - 70), i + MARCA_VERIFICAR.length).replace(/\s+/g, ' ').trim() }); };
  for (const s of p.secoes || []) {
    for (const b of s.blocos || []) {
      if (b.tipo === 'visual') visuais.push({ formato: b.formato, titulo: b.titulo, secao: s.titulo });
      else if (b.tipo === 'destaque') quadros[b.estilo] = (quadros[b.estilo] || 0) + 1;
      else if (b.tipo === 'imagem') imagens.push({ secao: s.titulo, imagem: b.imagem, mostrar: b.mostrar, legenda: b.legenda, destacar: b.destacar });
    }
  }
  if (p.fechamento && p.fechamento.visual) visuais.push({ formato: p.fechamento.visual.formato, titulo: p.fechamento.visual.titulo, secao: 'Fechamento' });
  // [VERIFICAR] em qualquer campo de texto, com o caminho até ele.
  const anda = (x, caminho) => { if (typeof x === 'string') marca(caminho, x); else if (Array.isArray(x)) x.forEach((v, i) => anda(v, caminho + '[' + i + ']')); else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) anda(v, caminho ? caminho + '.' + k : k); };
  anda(p, '');
  // Nome legível da seção em vez do índice, quando der.
  for (const m of verificar) { const s = /^secoes\[(\d+)\]/.exec(m.onde); if (s && p.secoes[+s[1]]) m.onde = m.onde.replace(s[0], 'Seção "' + p.secoes[+s[1]].titulo + '"'); }
  return { palavras: n, visuais, quadros, imagensClinicas: imagens, verificar, formato: p.formato || 1 };
}

module.exports = { BLOCOS, ESTADOS, VISUAIS, DESTAQUES, MARCA_VERIFICAR, MAX_PARAGRAFOS_SEGUIDOS, MAX_CHARS_PARAGRAFO, problemasDaPagina, validarPagina, capa, blocoDeBusca, textosDoCorpo, textoDoSvg, svgDe, metricas, PALETA };
