'use strict';
// Cache em memória do contêiner da função, com TTL e deduplicação de trabalho.
//
// POR QUE ISTO EXISTE (incidente 04/09): o Firestore parou o site inteiro com
// "Quota exceeded / RESOURCE_EXHAUSTED". Login, painel e biblioteca caíram
// juntos porque a cota é do projeto, não da função. A origem era a leitura
// COMPLETA de coleções a cada requisição: uma visita a /biblioteca varria
// `artigos` inteira (mais de 5.000 documentos) + todos os episódios de
// podcast. Poucas visitas por dia bastam para consumir a cota diária.
//
// O catálogo é IGUAL para todos os leitores e só muda quando o pipeline do dia
// roda. Reconstruí-lo a cada visita é desperdício puro. Aqui ele é construído
// uma vez e reaproveitado enquanto estiver fresco.
//
// Limites honestos: o cache vive no contêiner. Netlify recicla contêineres e
// pode manter vários em paralelo, então isto NÃO garante uma leitura por
// janela — garante que a mesma leitura não se repita a cada clique. É a
// diferença entre milhares e dezenas de varreduras por dia.

const TTL_PADRAO = 10 * 60 * 1000; // 10 min: o acervo muda uma vez por dia

const guardados = new Map(); // chave → { valor, expiraEm }
const emVoo = new Map();     // chave → Promise (dedupe de construções simultâneas)

// Executa `construir` no máximo uma vez por janela de TTL para a mesma chave.
// Requisições concorrentes esperam a MESMA construção em vez de disparar N
// varreduras iguais (era o que acontecia quando várias abas abriam juntas).
async function memo(chave, construir, { ttl = TTL_PADRAO, agora = Date.now } = {}) {
  const t = agora();
  const guardado = guardados.get(chave);
  if (guardado && guardado.expiraEm > t) return guardado.valor;

  const voando = emVoo.get(chave);
  if (voando) return voando;

  const p = (async () => construir())();
  emVoo.set(chave, p);
  try {
    const valor = await p;
    guardados.set(chave, { valor, expiraEm: agora() + ttl });
    return valor;
  } catch (err) {
    // Falhou: nada é guardado. Se houver valor velho, ele serve de rede de
    // segurança — biblioteca desatualizada é melhor que biblioteca vazia
    // (durante a queda de cota, o `catch` silencioso devolvia lista vazia e
    // parecia que o acervo tinha sumido).
    if (guardado) return guardado.valor;
    throw err;
  } finally {
    emVoo.delete(chave);
  }
}

// Só para teste e para o job diário invalidar o catálogo após publicar.
function esquecer(chave) { if (chave === undefined) { guardados.clear(); emVoo.clear(); } else { guardados.delete(chave); emVoo.delete(chave); } }
function tamanho() { return guardados.size; }

module.exports = { memo, esquecer, tamanho, TTL_PADRAO };
