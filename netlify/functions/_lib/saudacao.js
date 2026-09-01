// SAUDAÇÃO DE ABERTURA da edição diária — substitui a Nota Editorial.
//
// Diretriz do fundador (01/09): "existe uma adoção muito pequena na nota
// editorial que estamos realizando e nos consome crédito. vamos eliminar a
// nota editorial, faça somente uma breve saudação para convidar a edição do
// dia."
//
// Antes: uma chamada ao Claude POR ESPECIALIDADE POR DIA (system prompt longo
// + até 750 tokens de saída) gerava 4-5 parágrafos que quase ninguém lia.
// Agora: texto determinístico, montado aqui — CUSTO ZERO de IA, sem latência
// e sem ponto de falha no caminho do envio.
//
// Uma linha, convidando à leitura. A abertura varia com a data (não com
// aleatório) para que a mesma edição, regerada, produza exatamente o mesmo
// texto — regeneração e reenvio precisam ser idempotentes.

const ABERTURAS = [
  'Sua curadoria de {esp} de hoje traz',
  'Na sua edição de {esp} de hoje,',
  'Hoje, na curadoria de {esp}:',
  'Chegou sua edição de {esp}, com',
  'A edição de {esp} de hoje reúne',
];

const FECHOS = [
  'Boa leitura.',
  'Bons estudos.',
  'Aproveite a leitura.',
];

// Índice estável derivado da data (AAAA-MM-DD): dias diferentes variam, o
// mesmo dia sempre repete.
function indiceDoDia(data, tamanho) {
  const digitos = String(data || '').replace(/\D/g, '');
  let soma = 0;
  for (const d of digitos) soma += Number(d);
  return tamanho ? soma % tamanho : 0;
}

/**
 * Saudação curta de abertura da edição.
 * @param {Object} o
 * @param {string} o.especialidade  ex.: 'Ortodontia'
 * @param {number} o.n              quantos estudos a edição traz
 * @param {string} o.data           'AAAA-MM-DD' (define a variação do dia)
 * @returns {string} uma frase, sem quebras de linha
 */
function saudacaoDoDia({ especialidade, n, data } = {}) {
  const esp = String(especialidade || '').trim() || 'sua especialidade';
  const qtd = Math.max(0, Number(n) || 0);
  const i = indiceDoDia(data, ABERTURAS.length);
  const abertura = ABERTURAS[i].replace('{esp}', esp);
  const fecho = FECHOS[indiceDoDia(data, FECHOS.length)];
  // Sem estudos não há o que convidar a ler — o chamador não deve montar
  // edição vazia, mas a frase nunca pode sair quebrada.
  if (!qtd) return `${abertura} a seleção do dia. ${fecho}`;
  const estudos = qtd === 1 ? '1 estudo selecionado' : `${qtd} estudos selecionados`;
  return `${abertura} ${estudos} da literatura científica mais recente. ${fecho}`;
}

module.exports = { saudacaoDoDia, ABERTURAS, FECHOS };
