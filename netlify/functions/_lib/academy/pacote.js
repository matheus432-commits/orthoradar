// ACADEMY — montagem do PACOTE DE ENTREGA (Etapa 8).
//
// Tudo gerado a partir do PROJETO aprovado pelo dentista — nenhum campo é
// inventado aqui (o que faltar sai como [PREENCHER], guardrail 2). A
// declaração de uso de IA segue o ICMJE 2026 (verificado 25/08/2026): IA
// nunca é autora; o uso é declarado NA COVER LETTER e NO MANUSCRITO; os
// autores respondem integralmente pelo conteúdo.

const { criarDocx, textoParaBlocos } = require('./docx');
const { criarPdf } = require('./pdf');
const { criarZip } = require('./zip');
const { formatarVancouver, referenciaVerificavel } = require('./referencias');
const { checklistPreenchida } = require('./care');
const { modeloTCLE, LINKS } = require('./conformidade');
const { CATALOGO } = require('./periodicos');

const DECLARACAO_IA =
  'Declaração de uso de inteligência artificial (ICMJE): durante a preparação deste trabalho, ' +
  'os autores utilizaram a plataforma OdontoFeed Academy (assistente de escrita baseado em ' +
  'modelo de linguagem Claude, Anthropic) como apoio metodológico à estruturação do manuscrito e ' +
  'à formatação das referências. Todo o conteúdo clínico, os dados e as conclusões são dos autores, ' +
  'que revisaram, editaram e aprovaram cada seção e assumem integral responsabilidade pelo conteúdo. ' +
  'A ferramenta de IA não é autora e não é listada como tal.';

const secaoTexto = (projeto, s) => (projeto.secoes && projeto.secoes[s] && projeto.secoes[s].texto) || '[PREENCHER]';

// Manuscrito na ordem de LEITURA (a ordem de ESCRITA foi outra, de propósito).
function blocosManuscrito(projeto) {
  const refs = (projeto.referencias || []).filter(referenciaVerificavel);
  const b = [
    { tipo: 'titulo1', texto: secaoTexto(projeto, 'titulo') },
    { tipo: 'paragrafo', texto: 'Autores: [PREENCHER — nomes, afiliações e ORCID na ordem acordada]' },
    { tipo: 'titulo2', texto: 'RESUMO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'resumo') },
    { tipo: 'titulo2', texto: 'INTRODUÇÃO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'introducao') },
    { tipo: 'titulo2', texto: 'RELATO DO CASO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'metodos') },
    { tipo: 'titulo2', texto: 'RESULTADOS E ACOMPANHAMENTO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'resultados') },
    { tipo: 'titulo2', texto: 'DISCUSSÃO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'discussao') },
    { tipo: 'titulo2', texto: 'CONCLUSÃO' },
    { tipo: 'paragrafo', texto: secaoTexto(projeto, 'conclusao') },
  ];
  if ((projeto.imagens || []).length) {
    b.push({ tipo: 'titulo2', texto: 'LEGENDAS DAS FIGURAS' });
    (projeto.imagens || []).forEach((img, i) => {
      b.push({ tipo: 'paragrafo', texto: `Figura ${i + 1}. ${img.legenda || '[PREENCHER legenda]'} (arquivo: figura-${String(i + 1).padStart(2, '0')})` });
    });
  }
  b.push({ tipo: 'titulo2', texto: 'DECLARAÇÃO DE USO DE INTELIGÊNCIA ARTIFICIAL' });
  b.push({ tipo: 'paragrafo', texto: DECLARACAO_IA });
  b.push({ tipo: 'titulo2', texto: 'REFERÊNCIAS' });
  if (refs.length) refs.forEach((r, i) => b.push({ tipo: 'paragrafo', texto: formatarVancouver(r, i + 1) }));
  else b.push({ tipo: 'paragrafo', texto: '[PREENCHER — nenhuma referência verificada no projeto]' });
  return b;
}

function coverLetter(projeto) {
  const p = CATALOGO.periodicos.find(x => x.id === projeto.periodico_alvo);
  return [
    `Ao Editor-Chefe — ${p ? p.nome : '[PREENCHER periódico]'}`,
    '',
    'Prezado(a) Editor(a),',
    '',
    `Submetemos à apreciação o manuscrito "${secaoTexto(projeto, 'titulo')}", um relato de caso ` +
    'seguindo a diretriz CARE (checklist preenchida em anexo). O caso traz contribuição prática ' +
    'direta ao clínico: [PREENCHER — 2 a 3 frases suas dizendo por que este caso importa].',
    '',
    'Declaramos que o manuscrito é original, não está em avaliação em outro periódico, e que o ' +
    'paciente consentiu formalmente com a publicação (termo assinado disponível ao editor).',
    '',
    DECLARACAO_IA,
    '',
    'Não há conflito de interesses a declarar. [PREENCHER se houver]',
    '',
    'Atenciosamente,',
    '[PREENCHER — autor correspondente, e-mail e telefone]',
  ].join('\n');
}

function roteiroSubmissao(projeto) {
  const p = CATALOGO.periodicos.find(x => x.id === projeto.periodico_alvo);
  return [
    'ROTEIRO DE SUBMISSÃO — PASSO A PASSO',
    '',
    `1. Confirme as instruções aos autores do periódico escolhido${p ? ` (${p.nome}): ${p.instrucoes}` : ': [PREENCHER link]'} — formato de figuras, limite de palavras e estilo de referências mudam sem aviso.`,
    '2. Revise o manuscrito uma última vez procurando os marcadores [PREENCHER] — nenhum pode sobrar.',
    '3. Tenha em mãos o TCLE assinado (o periódico pode pedir a via digitalizada).',
    `4. Se o periódico exigir aprovação ou dispensa de comitê de ética para relato de caso, resolva ANTES de submeter — Plataforma Brasil: ${LINKS.plataformaBrasil}`,
    '5. Crie sua conta no sistema de submissão do periódico (link nas instruções aos autores) e cadastre todos os autores na ordem final — mudar depois é burocrático.',
    '6. Suba: manuscrito, figuras numeradas, cover letter, checklist CARE e declarações.',
    '7. No campo de comentários/declarações, mantenha a declaração de uso de IA (exigência ICMJE/COPE).',
    '8. Guarde o número de protocolo. Tempo médio de resposta deste periódico: ' + (p ? p.tempoMedioResposta : '[PREENCHER]') + '.',
    '9. Se vier "major/minor revision": é o caminho NORMAL — responda ponto a ponto, com educação e literatura. O Academy te ajuda a montar a carta-resposta.',
    '',
    'Normas éticas (confirme a vigência — elas mudam):',
    `• Lei 14.874/2024: ${LINKS.lei14874}`,
    `• Resolução CNS 466/2012: ${LINKS.resolucao466}`,
    `• Resolução CNS 510/2016: ${LINKS.resolucao510}`,
    `• Plataforma Brasil: ${LINKS.plataformaBrasil}`,
  ].join('\n');
}

function declaracoes(projeto) {
  return [
    'DECLARAÇÕES',
    '',
    'CONFLITO DE INTERESSES',
    'Os autores declaram [PREENCHER: "não haver conflito de interesses" OU descrever].',
    '',
    'CONTRIBUIÇÃO DOS AUTORES (taxonomia CRediT)',
    '[PREENCHER — ex.: Fulano: conduta clínica, redação; Beltrano: revisão crítica…]',
    '',
    'FINANCIAMENTO',
    'Este trabalho [PREENCHER: "não recebeu financiamento específico" OU descrever].',
    '',
    'USO DE INTELIGÊNCIA ARTIFICIAL',
    DECLARACAO_IA,
  ].join('\n');
}

function manifestoFiguras(projeto) {
  const imgs = projeto.imagens || [];
  if (!imgs.length) return 'Este projeto não tem figuras anexadas.';
  return ['FIGURAS DO PROJETO (anonimizadas por padrão no upload)', '']
    .concat(imgs.map((img, i) => `figura-${String(i + 1).padStart(2, '0')} — ${img.legenda || '[PREENCHER legenda]'} — arquivo no seu projeto: ${img.objectPath}`))
    .concat(['', 'Baixe cada figura pela tela do projeto no Academy e confira a anonimização antes de submeter.'])
    .join('\n');
}

// Pacote completo → um ZIP com DOCX + PDF de cada peça.
function montarPacote(projeto) {
  const manuscrito = blocosManuscrito(projeto);
  const cl = textoParaBlocos('Cover letter', coverLetter(projeto));
  const rot = textoParaBlocos('Roteiro de submissão', roteiroSubmissao(projeto));
  const dec = textoParaBlocos('Declarações', declaracoes(projeto));
  const tcle = textoParaBlocos('Termo de Consentimento Livre e Esclarecido', modeloTCLE({}));
  const care = textoParaBlocos('Checklist CARE (preenchida)',
    checklistPreenchida(projeto).map(i => `${i.n}. [${i.contemplado ? 'X' : ' '}] ${i.item} — ${i.onde}`).join('\n\n'));

  return criarZip([
    { nome: 'manuscrito.docx', dados: criarDocx(manuscrito) },
    { nome: 'manuscrito.pdf', dados: criarPdf(manuscrito) },
    { nome: 'cover-letter.docx', dados: criarDocx(cl) },
    { nome: 'cover-letter.pdf', dados: criarPdf(cl) },
    { nome: 'checklist-care.pdf', dados: criarPdf(care) },
    { nome: 'tcle-modelo.docx', dados: criarDocx(tcle) },
    { nome: 'declaracoes.docx', dados: criarDocx(dec) },
    { nome: 'roteiro-de-submissao.pdf', dados: criarPdf(rot) },
    { nome: 'figuras.txt', dados: manifestoFiguras(projeto) },
  ]);
}

module.exports = { montarPacote, blocosManuscrito, coverLetter, roteiroSubmissao, declaracoes, DECLARACAO_IA };
