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
  // resumo_completo (quando existe) traz a METODOLOGIA — essencial para o bloco
  // de materiais e métodos do roteiro; senão, cai no resumo curto/abstract.
  const resumo   = (article.resumo_completo || article.resumo_pt || article.abstract || '').slice(0, 2200);
  const impacto  = article.impacto_pratico || '';
  const nivel    = article.nivel_evidencia || 'estudo recente';
  const achados  = Array.isArray(article.achados_principais)
    ? article.achados_principais.filter(Boolean).slice(0, 5)
    : [];

  const system =
`Você escreve o roteiro FALADO de um micro-podcast diário do OdontoFeed para dentistas de ${especialidade}.
O ouvinte é um DENTISTA que quer a essência do estudo em poucos minutos — cada frase precisa carregar informação do artigo. ZERO enrolação.

ESTRUTURA (nesta ordem, em prosa corrida — sem títulos, marcadores, asteriscos ou "[música]"):
1. Saudação de UMA frase já citando o tema.
2. OBJETIVO: o que o estudo quis responder e por quê (1-2 frases).
3. MATERIAIS E MÉTODOS: desenho do estudo, quem/o que foi estudado, grupos comparados, tempo de acompanhamento e o que foi medido — quando esses dados estiverem no material (2-3 frases).
4. RESULTADOS — a parte central e OBRIGATÓRIA: o que os autores ENCONTRARAM, em linguagem clínica direta, com os números do material ditos por extenso. Ex.: "os alinhadores foram tão eficazes quanto o aparelho fixo depois de dezoito meses". O dentista ouve JUSTAMENTE para saber o resultado — NUNCA termine sem enunciá-lo.
5. RELEVÂNCIA CLÍNICA: o que muda (ou se confirma) no consultório (1-2 frases).
6. UMA frase: o episódio é informativo e não substitui a leitura do artigo original nem o julgamento clínico. Despedida em UMA frase curta.

PROIBIDO (enrolação): frases de enchimento ("isso é fascinante", "vamos mergulhar", "fique com a gente", "como todos sabemos"), repetir a mesma ideia com outras palavras, promessas vagas ("resultados surpreendentes") sem dizer o resultado, e introduções longas. Se uma frase não traz informação do estudo, corte-a.

REGRAS:
- Português brasileiro, tom de locutor de podcast — natural e direto, sem soar acadêmico nem traduzido.
- Números do material são bem-vindos (percentuais, tamanho da amostra, tempo de acompanhamento, "quase o dobro"), sempre por extenso para a locução. NUNCA invente números que não estejam no material.
- NÃO recite notação estatística técnica (valor de p, intervalo de confiança, odds ratio) — traduza para linguagem clínica.
- Alvo: 350-500 palavras, densas (o texto vira áudio de ~3 minutos e há limite rígido de tamanho).
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
