// ODONTOFEED ACADEMY — máquina de etapas do projeto acadêmico (MVP: RELATO
// DE CASO ponta a ponta; os demais desenhos entram depois).
//
// ARQUITETURA (decisões da spec 25/08):
//   • ROTA /academy no mesmo site (não subdomínio): autenticação compartilhada
//     sai de graça (mesma origem, mesma sessão of_email/of_token do dashboard),
//     zero DNS/certificado novo, um deploy só. Subdomínio ficaria justificado
//     quando o Academy tiver marca/venda próprias para instituições.
//   • PERSISTÊNCIA no Firestore (o "Netlify KV" da spec — o banco real da
//     plataforma): coleções academy_projetos (estado) e academy_mensagens
//     (histórico da entrevista, 1 doc por turno). O dentista retoma semanas
//     depois exatamente de onde parou.
//
// ETAPAS (ordem fixa; conformidade é BLOQUEANTE por construção — o motor não
// avança para redação sem ela resolvida):
const ETAPAS = [
  'entrada',       // upload/texto livre — o que o dentista TEM
  'triagem',       // conversa determina o tipo de trabalho (MVP força relato_de_caso)
  'conformidade',  // TCLE/ética — trava bloqueante
  'pergunta',      // pergunta de pesquisa (PICO por baixo, sem sigla)
  'busca',         // literatura verificável (PMID/DOI)
  'manuscrito',    // seções CARE, uma a uma, com aprovação humana
  'periodico',     // escolha do periódico
  'entrega',       // pacote final
];

// Seções do manuscrito na ordem que reduz retrabalho (spec, Etapa 6).
const SECOES = ['metodos', 'resultados', 'discussao', 'introducao', 'conclusao', 'resumo', 'titulo'];

const TIPOS_DE_TRABALHO = [
  'relato_de_caso', 'serie_de_casos', 'transversal', 'retrospectivo',
  'revisao_narrativa', 'revisao_sistematica', 'ensaio_clinico',
];
const TIPOS_MVP = ['relato_de_caso']; // únicos com fluxo completo hoje

// Documento novo em academy_projetos — estrutura da spec.
function novoProjeto(usuarioEmail) {
  const agora = new Date().toISOString();
  return {
    usuario_email: String(usuarioEmail || '').toLowerCase(),
    tipo_trabalho: null,             // preenchido na triagem
    etapa_atual: 'entrada',
    // Conformidade: null = não avaliada; só `liberado:true` destrava a redação.
    conformidade: {
      avaliada: false,
      liberado: false,
      paciente_identificavel: null,  // imagem/dado identificável?
      tcle_disponivel: null,         // dentista TEM/consegue o TCLE assinado?
      envolve_alem_do_relato: null,  // mais que relato isolado → CEP prévio
      coleta_pre_aprovacao: null,    // dados coletados antes de aprovação?
      pendencias: [],                // o que falta, em linguagem clínica
    },
    entrada_livre: '',               // texto inicial do dentista
    imagens: [],                     // [{id, objectPath, legenda, anonimizada:true}]
    pergunta_pesquisa: null,         // { texto_simples, pico: {p,i,c,o}, confirmada }
    estrategia_busca: null,          // { termos, executadaEm }
    referencias: [],                 // SÓ verificadas: {pmid, doi, titulo, autores, journal, ano, ...}
    ja_respondida: null,             // aviso honesto quando a literatura já respondeu
    secoes: {},                      // {metodos: {texto, aprovada, care_itens[]}, ...}
    periodico_alvo: null,            // id do data/academy-periodicos.json
    declaracao_ia: true,             // ICMJE 2026: divulgação SEMPRE (cover letter + manuscrito)
    criado_em: agora,
    atualizado_em: agora,
  };
}

// Pré-condições de cada etapa — a transição só acontece se a anterior fechou.
// Devolve null quando pode avançar, ou a pendência (em linguagem clínica).
function podeAvancar(projeto, para) {
  const de = projeto.etapa_atual;
  const idxDe = ETAPAS.indexOf(de), idxPara = ETAPAS.indexOf(para);
  if (idxPara === -1) return 'etapa desconhecida';
  if (idxPara <= idxDe) return null; // voltar/rever é sempre permitido
  if (idxPara !== idxDe + 1) return 'as etapas andam uma de cada vez';

  switch (para) {
    case 'triagem':
      return (projeto.entrada_livre || (projeto.imagens || []).length) ? null
        : 'me conte primeiro o que você tem em mãos (fotos ou uma descrição do caso)';
    case 'conformidade':
      if (!projeto.tipo_trabalho) return 'ainda estamos definindo o tipo de trabalho';
      if (!TIPOS_MVP.includes(projeto.tipo_trabalho)) {
        return 'por enquanto o Academy conduz relatos de caso de ponta a ponta — os outros desenhos chegam em breve';
      }
      return null;
    case 'pergunta':
      // TRAVA BLOQUEANTE (guardrail 5): sem conformidade liberada, nada de redação.
      return projeto.conformidade && projeto.conformidade.liberado ? null
        : 'antes de escrever qualquer linha precisamos resolver a parte ética (TCLE/CEP)';
    case 'busca':
      return projeto.pergunta_pesquisa && projeto.pergunta_pesquisa.confirmada ? null
        : 'primeiro vamos fechar juntos a pergunta que o seu caso responde';
    case 'manuscrito':
      return (projeto.referencias || []).length ? null
        : 'sem literatura verificada ainda — a busca vem antes do texto';
    case 'periodico': {
      const faltam = SECOES.filter(s => !(projeto.secoes && projeto.secoes[s] && projeto.secoes[s].aprovada));
      return faltam.length ? `ainda faltam seções aprovadas por você: ${faltam.join(', ')}` : null;
    }
    case 'entrega':
      return projeto.periodico_alvo ? null : 'falta escolher o periódico de destino';
    default:
      return null;
  }
}

// Progresso legível para a interface (o dentista vê onde está).
function progresso(projeto) {
  const idx = ETAPAS.indexOf(projeto.etapa_atual);
  return {
    etapas: ETAPAS.map((e, i) => ({
      id: e,
      feita: i < idx,
      atual: i === idx,
    })),
    secoes: SECOES.map(s => ({
      id: s,
      aprovada: !!(projeto.secoes && projeto.secoes[s] && projeto.secoes[s].aprovada),
      temTexto: !!(projeto.secoes && projeto.secoes[s] && projeto.secoes[s].texto),
    })),
  };
}

module.exports = { ETAPAS, SECOES, TIPOS_DE_TRABALHO, TIPOS_MVP, novoProjeto, podeAvancar, progresso };
