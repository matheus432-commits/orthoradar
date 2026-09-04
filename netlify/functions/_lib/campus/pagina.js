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

function erro(lista, cond, msg) { if (!cond) lista.push(msg); }

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
    estado: p.estado, cor: PALETA[h % PALETA.length],
    resumo: (p.umMinuto && p.umMinuto.frases && p.umMinuto.frases[0]) || '',
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
  const tokens = new Set(normalizar(partes.filter(Boolean).join(' ')).split(' ').filter(Boolean));
  return [...tokens].join(' ');
}

module.exports = { BLOCOS, ESTADOS, problemasDaPagina, validarPagina, capa, blocoDeBusca, PALETA };
