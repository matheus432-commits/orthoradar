// ACADEMY — TRAVA DE CONFORMIDADE ÉTICA (bloqueante; guardrail 5).
//
// BASE NORMATIVA (verificada em 25/08/2026 — a spec manda pesquisar, não
// assumir; as normas MUDARAM recentemente):
//   • Lei nº 14.874/2024 (marco legal da pesquisa com seres humanos),
//     regulamentada pelo Decreto nº 12.651/2025: institui o Sistema Nacional
//     de Ética em Pesquisa (Sinep), que substitui gradualmente o CEP/CONEP.
//     Na transição, os CEPs credenciados MANTÊM a condição e a CONEP segue
//     como instância recursal.
//   • A PLATAFORMA BRASIL segue como via única de registro e submissão —
//     os procedimentos NÃO mudaram com a lei nova.
//   • Resoluções CNS 466/2012 e 510/2016 seguem como referência ética na
//     transição.
// A interface SEMPRE avisa que a regra vigente deve ser confirmada na fonte
// (links abaixo) — este módulo orienta, não substitui o CEP.
//
// REGRAS DO MVP (relato de caso):
//   1. Imagem/dado identificável de paciente → TCLE assinado é OBRIGATÓRIO
//      (sem ele, nenhum periódico sério aceita — e não seguimos).
//   2. Relato de caso ISOLADO em geral dispensa aprovação prévia de CEP, mas
//      VÁRIOS periódicos exigem aprovação ou dispensa formal — a checagem da
//      política do periódico entra na etapa 7 e o roteiro de submissão cobra.
//   3. Mais que relato isolado (série, coleta de dados) → aprovação do CEP
//      via Plataforma Brasil ANTES da coleta.
//   4. Dados já coletados sem aprovação prévia → dizemos com franqueza e
//      apresentamos os caminhos (não seguimos fingindo que está tudo bem).

const LINKS = {
  plataformaBrasil: 'https://plataformabrasil.saude.gov.br/',
  conep: 'https://conselho.saude.gov.br/comissoes-cns/conep',
  resolucao466: 'https://conselho.saude.gov.br/resolucoes/2012/Reso466.pdf',
  resolucao510: 'https://conselho.saude.gov.br/resolucoes/2016/Reso510.pdf',
  lei14874: 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/l14874.htm',
};

// Avalia as respostas de conformidade e devolve o veredito + pendências em
// linguagem clínica. Puro e determinístico — testável sem rede.
function avaliarConformidade({ pacienteIdentificavel, tcleDisponivel, envolveAlemDoRelato, coletaPreAprovacao }) {
  const pendencias = [];
  const caminhos = [];
  let liberado = true;

  if (pacienteIdentificavel && !tcleDisponivel) {
    liberado = false;
    pendencias.push('Há foto ou dado que identifica o paciente e ainda não existe TCLE assinado. Sem esse termo, nenhum periódico sério publica — e nós não seguimos sem ele.');
    caminhos.push('Baixe o modelo de TCLE que preparamos, colha a assinatura do paciente (ou responsável) e volte aqui — o projeto fica salvo esperando.');
    caminhos.push('Se não for possível localizar o paciente, dá para avaliar anonimização TOTAL (sem rosto, sem dados que permitam reconhecer) — mas muitos periódicos exigem o TCLE mesmo assim; o roteiro de submissão vai checar isso no periódico escolhido.');
  }

  if (envolveAlemDoRelato) {
    if (coletaPreAprovacao) {
      liberado = false;
      pendencias.push('O trabalho vai além de um relato isolado e os dados foram coletados SEM aprovação prévia do comitê de ética. Sendo direto: aprovação ética retroativa não existe — o CEP precisa aprovar ANTES da coleta.');
      caminhos.push('Caminho 1 — converter em RELATO DE CASO (um paciente, com TCLE): é publicável e aproveita seu material.');
      caminhos.push('Caminho 2 — converter em REVISÃO DE LITERATURA sobre o tema: nenhum dado de paciente, nenhuma exigência de CEP.');
      caminhos.push('Caminho 3 — consultar o CEP da sua região sobre análise retrospectiva de prontuários (alguns aceitam com dispensa de TCLE via Plataforma Brasil, mas a decisão é deles, caso a caso).');
    } else {
      liberado = false;
      pendencias.push('O trabalho envolve mais que um relato isolado: precisa de aprovação do Comitê de Ética (CEP) via Plataforma Brasil ANTES de coletar os dados.');
      caminhos.push('Cadastre o projeto na Plataforma Brasil (link abaixo) — o Academy gera o protocolo resumido para te ajudar. Depois da aprovação, é só voltar.');
    }
  }

  return {
    liberado,
    pendencias,
    caminhos,
    avisoNormas: 'Orientação baseada na Lei 14.874/2024 (regulamentada pelo Decreto 12.651/2025 — Sinep em transição, Plataforma Brasil mantida) e nas Resoluções CNS 466/2012 e 510/2016. Confirme a regra vigente nos links oficiais — normas mudam.',
    links: LINKS,
  };
}

// Modelo de TCLE para RELATO DE CASO com imagens — placeholders [PREENCHER]
// nunca são inferidos (guardrail 2).
function modeloTCLE({ nomeDentista, instituicao } = {}) {
  return [
    'TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO — PUBLICAÇÃO DE RELATO DE CASO',
    '',
    'Eu, [PREENCHER: nome completo do paciente], documento [PREENCHER: CPF/RG],',
    'declaro que fui informado(a), de forma clara e em linguagem acessível, de que o(a)',
    `cirurgião(ã)-dentista ${nomeDentista || '[PREENCHER: nome do profissional]'}${instituicao ? ' (' + instituicao + ')' : ''}`,
    'pretende publicar, em revista científica, um relato do meu caso clínico, incluindo',
    'fotografias, radiografias e demais imagens do meu tratamento.',
    '',
    'Fui esclarecido(a) de que:',
    '1. Minha identidade será preservada: nome, iniciais e qualquer dado que permita',
    '   me identificar serão omitidos; imagens serão editadas para impedir o',
    '   reconhecimento sempre que possível.',
    '2. A publicação tem finalidade exclusivamente científica e educacional.',
    '3. Não terei qualquer despesa nem receberei pagamento pela publicação.',
    '4. Posso retirar este consentimento a qualquer momento antes da publicação,',
    '   sem qualquer prejuízo ao meu atendimento.',
    '5. Recebi uma via deste termo.',
    '',
    'Local e data: [PREENCHER]',
    '',
    'Assinatura do paciente (ou responsável legal): ________________________________',
    '',
    'Assinatura do profissional: ________________________________',
    '',
    'Base: Lei nº 14.874/2024; Resoluções CNS nº 466/2012 e nº 510/2016.',
    'Confirme exigências específicas do periódico e do CEP local antes de usar.',
  ].join('\n');
}

module.exports = { avaliarConformidade, modeloTCLE, LINKS };
