// Gera o ROTEIRO falado do podcast (narração única, pt-BR) a partir de um artigo.
// O texto vira áudio no Cloud TTS, então o tamanho é limitado ao teto por áudio
// do orçamento (MAX_CHARS_PER_AUDIO). Modelo: Claude (Fable 5 por padrão).

const { request } = require('../_lib');
const { resolveModel } = require('./ai-config');
const { MAX_REQUEST_BYTES, byteLength } = require('./tts-budget');
const log = require('./logger');

const HOST = 'api.anthropic.com';

// Corta o texto para caber no limite de BYTES do TTS (5000 bytes/requisição),
// terminando no último fim de frase. Mede em bytes UTF-8 porque acentos pt-BR
// ocupam 2 bytes — String.length subestimaria e a API responderia 400.
function capScript(text) {
  const t = String(text || '').trim();
  if (byteLength(t) <= MAX_REQUEST_BYTES) return t;
  // Busca binária pelo maior prefixo (em caracteres) que cabe no limite de bytes.
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (byteLength(t.slice(0, mid)) <= MAX_REQUEST_BYTES) lo = mid; else hi = mid - 1;
  }
  const cut = t.slice(0, lo);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > lo * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim();
}

function fallbackScript(article, especialidade) {
  const titulo  = article.titulo_pt || article.titulo || 'um estudo recente';
  const impacto = (article.impacto_pratico || '').trim();
  // DIREITO AUTORAL: só narra o resumo PRÓPRIO (resumo_pt) — nunca o abstract
  // original, que é obra protegida da editora/autores.
  const resumo  = (article.resumo_pt || '').trim();
  const partes = [
    `Olá! No episódio de hoje do OdontoFeed sobre ${especialidade}, vamos falar sobre ${titulo}.`,
    resumo ? `Em resumo: ${resumo}` : '',
    impacto ? `Na prática clínica, isso significa o seguinte: ${impacto}` : '',
    `Lembrando: este episódio é informativo e não substitui a leitura do artigo original nem o seu julgamento clínico.`,
    `É isso por hoje. Bons estudos e até o próximo episódio.`,
  ].filter(Boolean);
  return capScript(partes.join(' '));
}

async function generateScript(article, especialidade, anthropicKey) {
  if (!anthropicKey) return capScript(fallbackScript(article, especialidade));

  const titulo   = article.titulo_pt || article.titulo || '';
  const resumo   = (article.resumo_pt || article.abstract || '').slice(0, 1500);
  const impacto  = article.impacto_pratico || '';
  const nivel    = article.nivel_evidencia || 'estudo recente';

  const system =
`Você escreve o roteiro FALADO de um micro-podcast diário do OdontoFeed para dentistas de ${especialidade}.
REGRAS:
- Português brasileiro, tom de locutor de podcast — natural, direto, sem ser acadêmico.
- APENAS o texto a ser narrado, em prosa corrida. SEM títulos, SEM marcadores, SEM asteriscos, SEM "[música]".
- Abra cumprimentando e citando o tema; feche com uma frase curta de despedida.
- Máximo ~600 palavras (o texto vira áudio de ~4 minutos e há limite rígido de tamanho).
- PROIBIDO citar p-valor, IC, OR, tamanhos de amostra ou estatística técnica.
- Explique por que o achado importa na prática clínica.
- DIREITO AUTORAL (obrigatório): o material recebido é apenas contexto — NÃO o leia, reproduza ou traduza literalmente; narre os achados inteiramente com suas próprias palavras.
- Antes da despedida, inclua UMA frase natural lembrando que o episódio é informativo e não substitui a leitura do artigo original nem o julgamento clínico.`;

  const user =
`Artigo (${nivel}):
Título: ${titulo}
Resumo: ${resumo}
${impacto ? `Relevância clínica: ${impacto}` : ''}`;

  try {
    const payload = JSON.stringify({ model: resolveModel('PODCAST_MODEL'), max_tokens: 1500, system, messages: [{ role: 'user', content: user }] });
    const buf = Buffer.from(payload, 'utf8');
    const res = await request({
      hostname: HOST, path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
    }, buf);
    if (res.status !== 200) { log.warn('[podcast-script] Claude erro', { status: res.status }); return capScript(fallbackScript(article, especialidade)); }
    const text = JSON.parse(res.body).content?.[0]?.text?.trim();
    return capScript(text || fallbackScript(article, especialidade));
  } catch (err) {
    log.warn('[podcast-script] falha, usando fallback', { err: err.message });
    return capScript(fallbackScript(article, especialidade));
  }
}

module.exports = { generateScript, capScript };
