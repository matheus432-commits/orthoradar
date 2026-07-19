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
  const achados = Array.isArray(article.achados_principais) ? article.achados_principais.filter(Boolean) : [];
  const partes = [
    `Olá! No episódio de hoje do OdontoFeed sobre ${especialidade}, vamos falar sobre ${titulo}.`,
    resumo ? `Em resumo: ${resumo}` : '',
    // O RESULTADO é o motivo de o dentista ouvir — sempre presente quando há achados.
    achados.length ? `O que o estudo encontrou: ${achados.join('; ')}.` : '',
    impacto ? `Na prática clínica, isso significa o seguinte: ${impacto}` : '',
    `Lembrando: este episódio é informativo e não substitui a leitura do artigo original nem o seu julgamento clínico.`,
    `É isso por hoje. Bons estudos e até o próximo episódio.`,
  ].filter(Boolean);
  return capScript(partes.join(' '));
}

async function generateScript(article, especialidade, anthropicKey, opts = {}) {
  const sponsorText = (opts.sponsorText || '').trim();
  if (!anthropicKey) {
    const base = fallbackScript(article, especialidade);
    return capScript(sponsorText ? base.replace('vamos falar sobre', `${sponsorText} Hoje vamos falar sobre`) : base);
  }

  const titulo   = article.titulo_pt || article.titulo || '';
  const resumo   = (article.resumo_pt || article.abstract || '').slice(0, 1500);
  const impacto  = article.impacto_pratico || '';
  const nivel    = article.nivel_evidencia || 'estudo recente';
  const achados  = Array.isArray(article.achados_principais)
    ? article.achados_principais.filter(Boolean).slice(0, 5)
    : [];

  const system =
`Você escreve o roteiro FALADO de um micro-podcast diário do OdontoFeed para dentistas de ${especialidade}.

ESTRUTURA (nesta ordem, tudo em prosa corrida — sem títulos, marcadores, asteriscos ou "[música]"):
1. Saudação curta citando o tema do episódio.
2. Em 1-2 frases: o problema clínico e o que o estudo investigou.
3. O RESULTADO PRINCIPAL — a parte MAIS IMPORTANTE e OBRIGATÓRIA: diga com clareza O QUE OS AUTORES ENCONTRARAM, em linguagem clínica direta. Ex.: "os alinhadores foram tão eficazes quanto o aparelho fixo depois de dezoito meses" ou "a carga imediata teve sobrevivência de cerca de noventa e oito por cento em três anos". O dentista ouve o episódio JUSTAMENTE para saber o resultado — NUNCA termine sem enunciá-lo.
4. Por que esse resultado importa na prática clínica.
5. Uma frase natural lembrando que o episódio é informativo e não substitui a leitura do artigo original nem o julgamento clínico.
6. Despedida curta.

REGRAS:
- Português brasileiro, tom de locutor de podcast — natural, humano, direto, sem soar acadêmico nem traduzido.
- Você PODE (e deve, quando for o resultado de destaque) dizer números que estejam no material: percentuais, "quase o dobro", "reduziu pela metade", tempos de acompanhamento. Escreva os números por extenso para a locução soar melhor. NUNCA invente números que não estejam no material.
- NÃO recite notação estatística técnica (valor de p, intervalo de confiança, odds ratio, "n igual a") — traduza para linguagem clínica.
- Máximo ~600 palavras (o texto vira áudio de ~4 minutos e há limite rígido de tamanho).
- DIREITO AUTORAL (obrigatório): o material recebido é apenas contexto — NÃO o leia, reproduza ou traduza literalmente; narre os achados inteiramente com suas próprias palavras.${sponsorText ? `
- PATROCÍNIO: logo após a saudação inicial, leia naturalmente esta mensagem de patrocínio, identificando-a como tal, sem alterá-la: "${sponsorText}"` : ''}`;

  const user =
`Artigo (${nivel}):
Título: ${titulo}
Resumo: ${resumo}
${achados.length ? `Principais achados/resultados do estudo (USE-OS explicitamente no roteiro):\n- ${achados.join('\n- ')}` : ''}
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
