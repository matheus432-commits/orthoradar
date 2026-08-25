// ACADEMY — diretriz CARE (CAse REport) por baixo do capô.
//
// O dentista NUNCA precisa saber o que é CARE (princípio de design central):
// cada item vira pergunta de entrevista em linguagem clínica, e o checklist
// preenchido sai no pacote final (a maioria dos periódicos exige anexá-lo).
// Itens conforme o CARE checklist 2013 (13 itens) — care-statement.org.

const CARE_ITENS = [
  { n: 1,  id: 'titulo',            secao: 'titulo',     item: 'Título — a palavra "relato de caso" (case report) e a área de interesse no título',
    pergunta: 'Se o seu caso fosse uma manchete curta, o que não poderia faltar nela?' },
  { n: 2,  id: 'palavras-chave',    secao: 'resumo',     item: 'Palavras-chave — 2 a 5 palavras-chave',
    pergunta: 'Que 3 a 5 termos um colega digitaria para encontrar um caso como o seu?' },
  { n: 3,  id: 'resumo',            secao: 'resumo',     item: 'Resumo — introdução, o caso e a mensagem principal, sem referências',
    pergunta: 'Em poucas frases: qual era o problema, o que você fez e o que aconteceu?' },
  { n: 4,  id: 'introducao',        secao: 'introducao', item: 'Introdução — por que este caso é novo ou importante, com referências',
    pergunta: 'O que um colega aprende com este caso que ainda não sabe?' },
  { n: 5,  id: 'info-paciente',     secao: 'metodos',    item: 'Informações do paciente — dados demográficos anonimizados, queixa principal, histórico relevante',
    pergunta: 'Me conte do paciente sem identificá-lo: idade, sexo, o que ele buscava e o que havia de relevante no histórico?' },
  { n: 6,  id: 'achados-clinicos',  secao: 'metodos',    item: 'Achados clínicos — o exame físico e os achados relevantes',
    pergunta: 'No exame clínico, o que você viu e mediu? (sondagem, mobilidade, lesões, oclusão…)' },
  { n: 7,  id: 'linha-do-tempo',    secao: 'metodos',    item: 'Linha do tempo — datas e marcos do caso em sequência',
    pergunta: 'Vamos montar a linha do tempo: primeira consulta, procedimentos e retornos — quando aconteceu cada um?' },
  { n: 8,  id: 'diagnostico',       secao: 'metodos',    item: 'Avaliação diagnóstica — métodos, desafios e diagnóstico (com diferenciais)',
    pergunta: 'Como você chegou ao diagnóstico? Que exames pediu e o que quase te enganou?' },
  { n: 9,  id: 'intervencao',       secao: 'metodos',    item: 'Intervenção terapêutica — tipo, administração, mudanças ao longo do caso',
    pergunta: 'Descreva o tratamento passo a passo, como se ensinasse um colega a repetir: materiais, técnica, sequência.' },
  { n: 10, id: 'desfecho',          secao: 'resultados', item: 'Acompanhamento e desfechos — resultados avaliados, adesão, eventos adversos',
    pergunta: 'E o resultado? O que você mediu/observou nos retornos, por quanto tempo, e houve alguma complicação?' },
  { n: 11, id: 'discussao',         secao: 'discussao',  item: 'Discussão — pontos fortes e limitações, literatura relevante, justificativa das conclusões',
    pergunta: 'Comparando com o que a literatura mostra, o que o seu caso confirma, contradiz ou acrescenta? E o que ele NÃO permite afirmar?' },
  { n: 12, id: 'perspectiva',       secao: 'discussao',  item: 'Perspectiva do paciente — quando possível, a avaliação do próprio paciente',
    pergunta: 'O paciente comentou como foi a experiência dele? (se tiver, vale ouro no relato)' },
  { n: 13, id: 'consentimento',     secao: 'metodos',    item: 'Consentimento informado — o paciente consentiu com a publicação (obrigatório)',
    pergunta: null }, // resolvido na trava de conformidade — nunca reperguntar
];

const itensDaSecao = (secao) => CARE_ITENS.filter(i => i.secao === secao);

// Checklist preenchida para o pacote final: item + onde foi contemplado.
function checklistPreenchida(projeto) {
  return CARE_ITENS.map(i => {
    const sec = projeto.secoes && projeto.secoes[i.secao];
    const contemplado = i.id === 'consentimento'
      ? !!(projeto.conformidade && projeto.conformidade.liberado)
      : !!(sec && sec.aprovada);
    return {
      n: i.n, item: i.item,
      contemplado,
      onde: i.id === 'consentimento' ? 'Conformidade ética (TCLE)' : `Seção: ${i.secao}`,
    };
  });
}

module.exports = { CARE_ITENS, itensDaSecao, checklistPreenchida };
