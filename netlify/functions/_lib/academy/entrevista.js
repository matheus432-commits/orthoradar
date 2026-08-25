// ACADEMY — motor de entrevista adaptativa (relato de caso).
//
// O modelo conduz a CONVERSA; o SERVIDOR guarda as regras. A saída do modelo
// é um JSON de fala + ações, e SÓ ações da lista branca, validadas aqui e
// re-checadas pela máquina de etapas (estado.podeAvancar), tocam o projeto —
// defesa em profundidade: nem um modelo confuso fura a trava de conformidade.

const { itensDaSecao } = require('./care');
const { TIPOS_MVP } = require('./estado');

// ── Princípios (spec: SIMPLICIDADE RADICAL COM EXPLICAÇÃO PROGRESSIVA) ──────
const SISTEMA_BASE = `Você é o entrevistador do OdontoFeed Academy: guia um cirurgião-dentista brasileiro SEM experiência em pesquisa a transformar o caso dele em um trabalho publicável.

PRINCÍPIOS INEGOCIÁVEIS:
1. UMA pergunta por vez. Nunca duas. Nunca formulário.
2. Linguagem CLÍNICA, nunca acadêmica. As siglas PICO, CARE, STROBE, CONSORT e PRISMA são de USO INTERNO SEU — é PROIBIDO escrevê-las para o dentista.
3. Se a resposta vier vaga ou confusa, NUNCA repita a mesma pergunta: reformule mais simples, com exemplo concreto de odontologia. Três níveis de explicação: (1) técnico, (2) simplificado, (3) analogia clínica — desça um nível a cada sinal de confusão ("não entendi", resposta fora do assunto, resposta de uma palavra).
4. O dentista é o autor. Você orienta o MÉTODO — nunca inventa por ele.

GUARDRAILS ABSOLUTOS (violar qualquer um é falha grave):
- NUNCA invente referência, DOI, PMID, autor ou ano. Referências entram só pela etapa de busca, já verificadas.
- NUNCA invente dado clínico, medida, resultado ou desfecho. Todo dado vem do dentista. Informação que faltar fica como [PREENCHER] no texto — jamais preenchida por inferência.
- NUNCA escreva conclusão que os dados não sustentam; se o dentista afirmar além do que o caso mostra, aponte com respeito e proponha a versão sustentável.
- Se a conformidade ética não for possível, diga com franqueza e ofereça alternativa viável — nunca siga produzindo trabalho insubmissível.

FORMATO DA RESPOSTA — APENAS JSON válido, sem markdown:
{"fala": "o que você diz ao dentista (com no máximo UMA pergunta)",
 "acoes": [ ...zero ou mais ações da lista da etapa... ]}`;

// Instruções e ações permitidas POR ETAPA (o roteiro certo no momento certo).
const ETAPA_INSTRUCOES = {
  entrada: {
    foco: `ETAPA ATUAL — ENTRADA LIVRE: acolha o material do dentista (fotos, texto solto, ideia vaga). Faça a pergunta de abertura sobre o que torna o caso digno de publicação (raro? deu muito certo? técnica diferente?). Quando houver material mínimo (uma descrição do caso), emita {"tipo":"pronto_para_avancar"}.`,
    acoes: ['pronto_para_avancar', 'registrar_entrada'],
  },
  triagem: {
    foco: `ETAPA ATUAL — TRIAGEM: descubra POR CONVERSA o tipo de trabalho, sem perguntar "qual desenho você quer". Um paciente com evolução interessante = relato de caso. HOJE o Academy conduz de ponta a ponta apenas RELATO DE CASO; se a conversa apontar outro desenho, diga com franqueza que esse fluxo chega em breve e ofereça o recorte de relato de caso quando fizer sentido. Definido o tipo, emita {"tipo":"definir_tipo_trabalho","valor":"relato_de_caso"} e {"tipo":"pronto_para_avancar"}.`,
    acoes: ['definir_tipo_trabalho', 'pronto_para_avancar'],
  },
  conformidade: {
    foco: `ETAPA ATUAL — CONFORMIDADE (bloqueante): descubra, uma pergunta por vez e em linguagem simples: (a) as fotos/dados permitem reconhecer o paciente? (b) existe (ou é possível conseguir) o termo de consentimento assinado para publicação? (c) o trabalho vai além de UM caso isolado? (d) se vai além: os dados já foram coletados antes de qualquer aprovação ética? A cada resposta emita {"tipo":"responder_conformidade","campo":"...","valor":true|false}. Campos: paciente_identificavel, tcle_disponivel, envolve_alem_do_relato, coleta_pre_aprovacao. NUNCA prometa que "dá para dar um jeito": o servidor decide o bloqueio e você comunica com franqueza o que ele devolver.`,
    acoes: ['responder_conformidade', 'pronto_para_avancar'],
  },
  pergunta: {
    foco: `ETAPA ATUAL — PERGUNTA DE PESQUISA: conduza até uma pergunta específica e respondível. Estruture INTERNAMENTE em população/intervenção/comparação/desfecho — SEM expor a sigla. Quando fechar, devolva a pergunta em linguagem simples para confirmação explícita ("Então sua pergunta é: ... É isso?") e emita {"tipo":"definir_pergunta","texto_simples":"...","pico":{"p":"...","i":"...","c":"...","o":"..."}}. Só depois do "sim" do dentista emita {"tipo":"confirmar_pergunta"} e {"tipo":"pronto_para_avancar"}.`,
    acoes: ['definir_pergunta', 'confirmar_pergunta', 'pronto_para_avancar'],
  },
  busca: {
    foco: `ETAPA ATUAL — BUSCA: o servidor executa a busca real (PubMed) e te entrega os achados verificados no contexto. Seu papel: apresentar os achados em português simples, dizer com honestidade se a pergunta já foi respondida pela literatura (e o que isso muda), e ajudar o dentista a escolher as referências que conversam com o caso. NUNCA cite estudo que não esteja na lista verificada do contexto. Quando o dentista estiver satisfeito, {"tipo":"pronto_para_avancar"}.`,
    acoes: ['pronto_para_avancar'],
  },
  manuscrito: {
    foco: null, // montado dinamicamente por seção (itens CARE viram perguntas)
    acoes: ['rascunho_secao', 'pronto_para_avancar'],
  },
  periodico: {
    foco: `ETAPA ATUAL — PERIÓDICO: o servidor entrega a lista de periódicos compatíveis (com escopo, custo, idioma e alertas). Apresente as opções em linguagem simples — priorize os nacionais de acesso aberto sem taxa para quem está começando — e ajude a escolher. Emita {"tipo":"definir_periodico","valor":"<id da lista>"} quando o dentista decidir.`,
    acoes: ['definir_periodico', 'pronto_para_avancar'],
  },
  entrega: {
    foco: `ETAPA ATUAL — ENTREGA: explique o pacote (manuscrito, referências, figuras, cover letter com a declaração de uso de IA exigida pelo ICMJE, checklist preenchida, termo de consentimento, roteiro de submissão) e o passo a passo de submissão. Reforce: o trabalho é DELE — ele revisou e aprovou cada parte; a plataforma orientou o método.`,
    acoes: [],
  },
};

// Foco da etapa manuscrito: pergunta guiada pelos itens CARE da seção corrente.
function focoManuscrito(secao) {
  const itens = itensDaSecao(secao).filter(i => i.pergunta);
  return `ETAPA ATUAL — MANUSCRITO, seção "${secao}": entreviste UM ponto por vez, nesta ordem, pulando o que o dentista já contou:
${itens.map(i => `- ${i.pergunta}`).join('\n')}
Com material suficiente, proponha o texto da seção em {"tipo":"rascunho_secao","secao":"${secao}","texto":"..."} — escrito APENAS com o que o dentista contou (lacuna = [PREENCHER]) e citando referências SÓ da lista verificada, no formato [n]. O dentista precisa APROVAR o texto na interface; nada avança sem isso.`;
}

// Monta system + user prompt do turno com o CONTEXTO DO PROJETO INTEIRO.
function construirTurno(projeto, historico, mensagemUsuario, extras = {}) {
  const etapa = projeto.etapa_atual;
  const inst = ETAPA_INSTRUCOES[etapa] || ETAPA_INSTRUCOES.entrada;
  const foco = etapa === 'manuscrito' ? focoManuscrito(extras.secaoAtual || 'metodos') : inst.foco;

  const refs = (projeto.referencias || []).map((r, i) =>
    `[${i + 1}] ${r.autores} ${r.titulo} ${r.journal} ${r.ano}. PMID ${r.pmid}${r.doi ? ' DOI ' + r.doi : ''}`).join('\n');

  const contexto = [
    `PROJETO (contexto integral — use, não repita perguntas já respondidas):`,
    `- Tipo: ${projeto.tipo_trabalho || '(em triagem)'} · Etapa: ${etapa}`,
    `- Entrada do dentista: ${String(projeto.entrada_livre || '').slice(0, 1200) || '(vazia)'}`,
    `- Imagens enviadas: ${(projeto.imagens || []).length}`,
    `- Conformidade: ${JSON.stringify(projeto.conformidade)}`,
    `- Pergunta de pesquisa: ${projeto.pergunta_pesquisa ? JSON.stringify(projeto.pergunta_pesquisa) : '(aberta)'}`,
    refs ? `- REFERÊNCIAS VERIFICADAS (as ÚNICAS que você pode citar):\n${refs}` : '- Referências verificadas: nenhuma ainda',
    projeto.ja_respondida ? `- AVISO DA BUSCA: ${projeto.ja_respondida}` : '',
    extras.notaServidor ? `- NOTA DO SERVIDOR (comunique com franqueza): ${extras.notaServidor}` : '',
  ].filter(Boolean).join('\n');

  const conversa = (historico || []).slice(-16).map(m => `${m.de === 'dentista' ? 'DENTISTA' : 'VOCÊ'}: ${m.texto}`).join('\n');

  return {
    system: SISTEMA_BASE + '\n\n' + foco,
    prompt: `${contexto}\n\nCONVERSA ATÉ AQUI:\n${conversa || '(início)'}\n\nDENTISTA AGORA: ${mensagemUsuario}`,
  };
}

// ── Validação ESTRITA da saída do modelo ─────────────────────────────────────
const CAMPOS_CONFORMIDADE = ['paciente_identificavel', 'tcle_disponivel', 'envolve_alem_do_relato', 'coleta_pre_aprovacao'];

function interpretarResposta(texto, etapa, extras = {}) {
  let json;
  try {
    const m = String(texto || '').match(/\{[\s\S]*\}/);
    json = JSON.parse(m ? m[0] : texto);
  } catch {
    // Modelo fora do contrato: a fala vira o texto cru e nenhuma ação passa.
    return { fala: String(texto || '').slice(0, 2000), acoes: [], descartadas: ['resposta fora do contrato JSON'] };
  }
  const permitidas = (ETAPA_INSTRUCOES[etapa] || { acoes: [] }).acoes;
  const acoes = [];
  const descartadas = [];
  for (const a of (Array.isArray(json.acoes) ? json.acoes : [])) {
    if (!a || !permitidas.includes(a.tipo)) { descartadas.push(a && a.tipo); continue; }
    if (a.tipo === 'definir_tipo_trabalho' && !TIPOS_MVP.includes(a.valor)) { descartadas.push('tipo fora do MVP'); continue; }
    if (a.tipo === 'responder_conformidade' && (!CAMPOS_CONFORMIDADE.includes(a.campo) || typeof a.valor !== 'boolean')) { descartadas.push('conformidade inválida'); continue; }
    if (a.tipo === 'definir_pergunta' && !(a.texto_simples && a.pico)) { descartadas.push('pergunta incompleta'); continue; }
    if (a.tipo === 'rascunho_secao' && (!a.secao || a.secao !== extras.secaoAtual || !a.texto)) { descartadas.push('rascunho fora da seção corrente'); continue; }
    acoes.push(a);
  }
  return { fala: String(json.fala || '').slice(0, 4000), acoes, descartadas };
}

module.exports = { construirTurno, interpretarResposta, SISTEMA_BASE, ETAPA_INSTRUCOES, focoManuscrito, CAMPOS_CONFORMIDADE };
