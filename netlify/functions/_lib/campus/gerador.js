'use strict';
// OdontoFeed CAMPUS — gerador de página de apostila.
//
// Fluxo (spec 01/09): tema da árvore → evidência (Biblioteca + PubMed) →
// rascunho com Claude nos 9 blocos → validação humana (fora deste módulo).
// Regras de ferro:
//   • o modelo NUNCA cita PMID nem inventa referência: o bloco "O que a
//     pesquisa diz hoje" é dinâmico e vem da Biblioteca na hora de exibir;
//     o modelo só recebe títulos reais como CONTEXTO para escrever;
//   • toda página sai como 'rascunho'; nada fica visível sem validação;
//   • sem disparo automático: só por chamada explícita do admin.
//
// O prompt e o parser são puros e testáveis sem rede. `gerarPagina` é a
// única função que chama a API.

const { taxonomia } = require('../ensino/taxonomia');
const { problemasDaPagina } = require('./pagina');

const MAX_TOKENS = 6000;

function localizarPagina(temaOuPaginaId) {
  for (const a of taxonomia().areas) for (const m of a.modulos) for (const t of m.temas) for (const p of t.paginas) {
    if (p.id === temaOuPaginaId) return { area: a, modulo: m, tema: t, pagina: p, irmas: t.paginas.filter((x) => x.id !== p.id).map((x) => x.nome) };
  }
  return null;
}

// Evidência de contexto: só TÍTULOS reais (com ano e periódico) da Biblioteca.
// Quem chama decide de onde tira (acervo Firestore, PubMed verificado…).
function montarPrompt(alvo, evidencias = []) {
  const { area, modulo, tema, pagina, irmas } = alvo;
  const ev = evidencias.slice(0, 12).map((e, i) => `${i + 1}. ${e.titulo} (${e.journal || 'periódico'}, ${e.year || 's.d.'})`).join('\n') || '(nenhum artigo recente localizado; escreva com base em consenso de livro-texto e diga isso no bloco 1)';
  return `Você escreve apostilas ilustradas do OdontoFeed Campus para estudantes de odontologia do Brasil. Escreva em português do Brasil, em linguagem de sala de aula, sem emojis, sem sigla antes da palavra por extenso. Termo canônico: "Distalização" (nunca "Distanciamento").

PÁGINA A ESCREVER
Área: ${area.nome} (${area.statusRotulo})
Módulo: ${modulo.nome}
Tema (aula): ${tema.nome}
Página (assunto da aula): ${pagina.nome}
Páginas irmãs do mesmo tema (NÃO repita o conteúdo delas; apenas remeta quando fizer sentido): ${irmas.join('; ') || 'nenhuma'}

EVIDÊNCIA RECENTE DISPONÍVEL NA BIBLIOTECA (títulos reais; use como contexto do que é consenso e do que é novidade; NÃO cite números de PMID nem invente referências):
${ev}

REGRAS
- Conteúdo clínico correto e atual. Onde houver controvérsia ou tradição de escola sem evidência forte, diga isso explicitamente.
- Nada de foto: infográfico e fluxograma são estruturas de texto que viram desenho vetorial.
- Nunca escreva "PMID". O bloco "O que a pesquisa diz hoje" é montado pela plataforma.
- Responda SOMENTE com um JSON válido, sem markdown, exatamente com estas chaves:
{
  "titulo": "título curto da página, como o aluno buscaria",
  "umMinuto": { "frases": ["5 frases que resumem o tema"], "caiNaProva": ["3 a 5 itens que caem em prova"], "porQueImporta": "por que importa na clínica, 1 a 2 frases" },
  "infografico": { "titulo": "…", "itens": [ { "rotulo": "…", "texto": "…" } ] },
  "fluxograma": { "titulo": "…", "nos": [ { "id": "n1", "tipo": "inicio|decisao|acao|fim", "texto": "…" } ], "arestas": [ { "de": "n1", "para": "n2", "rotulo": "sim|não|…" } ] },
  "passoAPasso": [ { "passo": "…", "confira": "o que conferir antes de seguir" } ],
  "macetes": [ { "titulo": "…", "texto": "…" } ],
  "ondeErra": [ { "erro": "…", "porque": "…", "certo": "…" } ],
  "autoteste": [ { "pergunta": "…", "alternativas": ["A", "B", "C", "D"], "correta": 0, "explicacoes": ["por que A…", "por que B…", "por que C…", "por que D…"] } ],
  "pesquisa": { "termos": ["2 a 4 termos de busca na Biblioteca, sem acento obrigatório"] }
}
Exatamente 5 questões no autoteste, no estilo ENADE ou residência, com 4 alternativas cada e uma explicação por alternativa. Entre 3 e 8 passos, 2 a 5 macetes, 3 a 6 erros comuns, 3 a 8 itens no infográfico e 4 a 12 nós no fluxograma.`;
}

// Extrai o JSON da resposta (tolera cercas de markdown) e monta a página
// completa com os campos que vêm da árvore, sempre como rascunho.
function interpretar(texto, alvo) {
  const m = String(texto || '').match(/\{[\s\S]*\}/);
  if (!m) throw new Error('resposta sem JSON');
  let j;
  try { j = JSON.parse(m[0]); } catch (e) { throw new Error('JSON inválido: ' + e.message); }
  const { area, modulo, tema, pagina } = alvo;
  const p = {
    id: pagina.id, areaId: area.id, area: area.nome, modulo: modulo.nome, tema: tema.nome,
    titulo: j.titulo || pagina.nome,
    estado: 'rascunho', versao: 1, geradoEm: new Date().toISOString(),
    umMinuto: j.umMinuto, infografico: j.infografico, fluxograma: j.fluxograma,
    passoAPasso: j.passoAPasso, macetes: j.macetes, ondeErra: j.ondeErra, autoteste: j.autoteste,
    pesquisa: { termos: (j.pesquisa && j.pesquisa.termos) || [tema.nome] },
    validacao: { validadoPor: null, data: null },
  };
  const problemas = problemasDaPagina(p);
  if (problemas.length) throw new Error('rascunho fora do esqueleto: ' + problemas.join('; '));
  return p;
}

// Chamada real. `chamar` é injetável para teste; default = callClaude do pipeline.
async function gerarPagina({ paginaId, evidencias = [], dryRun = false, chamar } = {}) {
  const alvo = localizarPagina(paginaId);
  if (!alvo) throw new Error('página não existe na árvore: ' + paginaId);
  const prompt = montarPrompt(alvo, evidencias);
  if (dryRun) return { prompt, alvo: { area: alvo.area.nome, modulo: alvo.modulo.nome, tema: alvo.tema.nome, pagina: alvo.pagina.nome } };
  const fn = chamar || (async (pr) => require('../claude').callClaude(pr, 0, undefined, MAX_TOKENS, 'campus'));
  const texto = await fn(prompt);
  return interpretar(texto, alvo);
}

module.exports = { localizarPagina, montarPrompt, interpretar, gerarPagina, MAX_TOKENS };
