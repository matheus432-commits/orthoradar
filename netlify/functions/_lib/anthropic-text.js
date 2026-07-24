// Extrai o TEXTO de uma resposta da Anthropic Messages API.
//
// A resposta `content` é um ARRAY de blocos e pode conter blocos NÃO-textuais
// ANTES do texto (bloco de raciocínio/thinking do modelo, uso de ferramenta de
// servidor, etc.). Pegar só `content[0].text` devolvia STRING VAZIA justamente
// quando o modelo emitia um bloco de raciocínio primeiro — com a API já cobrada.
//
// Foi a causa-raiz de dois incidentes:
//   - 19/07: o Wakai só devolvia as fontes, sem o texto (corrigido lá isolado);
//   - 24/07: resumos_completos e roteiros de podcast vindo VAZIOS ("FALHOU sem
//     resumo" silencioso, "sem podcast"), quando o Sonnet passou a emitir blocos
//     de raciocínio antes do texto.
//
// Este helper é o ponto ÚNICO de extração — junta TODOS os blocos de texto, na
// ordem, ignorando os não-textuais. Use-o em todo parser de resposta da
// Anthropic para que o bug nunca mais reapareça em um call site novo.
function extractAnthropicText(json) {
  const blocks = json && Array.isArray(json.content) ? json.content : [];
  return blocks
    .filter(b => b && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('\n')
    .trim();
}

module.exports = { extractAnthropicText };
