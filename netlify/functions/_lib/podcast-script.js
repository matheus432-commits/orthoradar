// Gera o ROTEIRO falado do podcast (narração única, pt-BR) a partir de um artigo.
// O texto vira áudio no Cloud TTS, então o tamanho é limitado ao teto por áudio
// do orçamento (MAX_CHARS_PER_AUDIO). Modelo: Claude (Fable 5 por padrão).

const { request } = require('../_lib');
const { resolveModel } = require('./ai-config');
const { MAX_CHARS_PER_AUDIO } = require('./tts-budget');
const log = require('./logger');

const HOST = 'api.anthropic.com';

// Corta no último ponto final antes do limite, para não terminar no meio da frase.
function capScript(text) {
  const t = String(text || '').trim();
  if (t.length <= MAX_CHARS_PER_AUDIO) return t;
  const cut = t.slice(0, MAX_CHARS_PER_AUDIO);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (lastStop > MAX_CHARS_PER_AUDIO * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim();
}

function fallbackScript(article, especialidade) {
  const titulo  = article.titulo_pt || article.titulo || 'um estudo recente';
  const impacto = (article.impacto_pratico || '').trim();
  const resumo  = (article.resumo_pt || article.abstract || '').trim();
  const partes = [
    `Olá! No episódio de hoje do OdontoFeed sobre ${especialidade}, vamos falar sobre ${titulo}.`,
    resumo ? `Em resumo: ${resumo}` : '',
    impacto ? `Na prática clínica, isso significa o seguinte: ${impacto}` : '',
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
- Máximo ~850 palavras (o texto será convertido em áudio de ~5 minutos).
- PROIBIDO citar p-valor, IC, OR, tamanhos de amostra ou estatística técnica.
- Explique por que o achado importa na prática clínica.`;

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
