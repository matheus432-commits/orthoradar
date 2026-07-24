// Gera o ROTEIRO falado do podcast (narração única, pt-BR) a partir de um artigo.
// O texto vira áudio no Cloud TTS, então o tamanho é limitado ao teto por áudio
// do orçamento (MAX_CHARS_PER_AUDIO).
//
// FIDELIDADE CIENTÍFICA (incidente real 07/2026): um roteiro afirmou que um
// PROTOCOLO de RCT "avaliou se o laceback funciona" — o estudo nem tinha
// resultados; ele media placa/dor/intercorrências. Distorção inaceitável.
// Defesas em camadas:
//   1. O prompt proíbe inventar/extrapolar; protocolos são narrados como
//      protocolos (o que SERÁ medido), nunca como estudos com resultados.
//   2. Todo roteiro passa por um VERIFICADOR de fidelidade (modelo separado)
//      que compara com o material-fonte (abstract original incluído).
//      Reprovado → 1 regeneração com o feedback; reprovado de novo → fallback
//      determinístico (só narra o resumo próprio, sem criação).
//   3. Modelo do roteiro: Sonnet por padrão (PODCAST_MODEL para trocar).

const { request } = require('../_lib');
const { MAX_CHARS_PER_AUDIO } = require('./tts-budget');
const { corrigirTermosBR } = require('./claude');
const { extractAnthropicText } = require('./anthropic-text');
const log = require('./logger');

const HOST = 'api.anthropic.com';
// Roteiro: Sonnet por padrão (é o conteúdo mais consumido do produto; Haiku
// mostrou alucinação em caso real). Verificador: Haiku é suficiente para
// conferência objetiva e mantém o custo baixo.
const SCRIPT_MODEL = process.env.PODCAST_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const VERIFY_MODEL = process.env.PODCAST_VERIFY_MODEL || 'claude-haiku-4-5-20251001';

// Limita o roteiro ao TETO DE ORÇAMENTO por áudio (MAX_CHARS_PER_AUDIO = 5000
// caracteres ≈ ~4-4,5 min), terminando no último fim de frase. NÃO usamos mais
// o limite de BYTES da API aqui — isso truncava roteiros densos e cortava o
// áudio no meio (incidente 23/07). O limite de bytes da API agora é resolvido
// no TTS por FATIAMENTO+concatenação (synthesizeLong), sem perder conteúdo.
function capScript(text) {
  let t = String(text || '').trim();
  if (t.length > MAX_CHARS_PER_AUDIO) {
    const cut = t.slice(0, MAX_CHARS_PER_AUDIO);
    const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = (lastStop > MAX_CHARS_PER_AUDIO * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim();
  }
  return ensureCompleteEnding(t);
}

// GARANTIA ABSOLUTA: o áudio NUNCA termina no meio de uma frase. Se o roteiro
// não fecha em pontuação terminal (ex.: geração truncada pelo teto de tokens —
// incidente recorrente com revisões densas: "cortou no meio"), recua até o
// último fim de frase COMPLETO. Melhor um roteiro sem a despedida do que um
// áudio cortado no meio de uma palavra/frase.
function ensureCompleteEnding(text) {
  const s = String(text || '').trim();
  if (!s) return s;
  // Já termina em . ! ? … (com aspas/parênteses de fechamento opcionais)?
  if (/[.!?…]["'”’»)\]]?$/.test(s)) return s;
  let idx = -1;
  for (const ch of ['.', '!', '?', '…']) idx = Math.max(idx, s.lastIndexOf(ch));
  return idx > 0 ? s.slice(0, idx + 1).trim() : s;
}

// Há material suficiente para NARRAR? Sem resumo próprio substancial (ou ao
// menos 2 achados), não existe episódio possível — narrar só a saudação gerou
// o áudio de 24s de 15/07 ("não trouxe nada sobre o artigo"). O chamador deve
// PULAR o episódio quando isto retornar false.
function hasNarratableMaterial(article) {
  const resumo  = String(article.resumo_completo || article.resumo_pt || '').trim();
  const achados = Array.isArray(article.achados_principais) ? article.achados_principais.filter(Boolean) : [];
  const temTituloPt = String(article.titulo_pt || '').trim().length >= 10;
  return temTituloPt && (resumo.length >= 200 || achados.length >= 2);
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

// Chamada simples à API Anthropic. Retorna o texto ou null.
async function callModel(anthropicKey, model, system, user, maxTokens) {
  const payload = JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
  const buf = Buffer.from(payload, 'utf8');
  const res = await request({
    hostname: HOST, path: '/v1/messages', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length, 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
  }, buf);
  if (res.status !== 200) { log.warn('[podcast-script] Claude erro', { model, status: res.status }); return null; }
  // Junta todos os blocos de texto (content[0] pode ser bloco de raciocínio) —
  // ver _lib/anthropic-text.js. Roteiro vazio deixava a especialidade SEM PODCAST.
  return extractAnthropicText(JSON.parse(res.body)) || null;
}

// Material-fonte usado tanto para GERAR quanto para VERIFICAR o roteiro.
// O abstract ORIGINAL entra na verificação como fonte primária de verdade.
function buildMaterial(article) {
  const titulo   = article.titulo_pt || article.titulo || '';
  const resumo   = (article.resumo_completo || article.resumo_pt || '').slice(0, 2200);
  const abstract = (article.abstract || '').slice(0, 1800);
  const impacto  = article.impacto_pratico || '';
  const nivel    = article.nivel_evidencia || 'estudo recente';
  const achados  = Array.isArray(article.achados_principais)
    ? article.achados_principais.filter(Boolean).slice(0, 5)
    : [];
  return { titulo, resumo, abstract, impacto, nivel, achados };
}

// ── Verificador de fidelidade ────────────────────────────────────────────────
// Compara o roteiro com o material-fonte. Retorna { ok, problemas } — e
// { ok:false } também em falha de rede/parse (FAIL-CLOSED: sem verificação
// confiável, o roteiro criativo não vai ao ar; usa-se o fallback).
async function verifyScriptFidelity(anthropicKey, material, roteiro) {
  const system =
`Você é um VERIFICADOR de fidelidade científica de roteiros de podcast odontológico.
Compare o ROTEIRO com o MATERIAL-FONTE e REPROVE se o roteiro:
1. Afirmar um OBJETIVO diferente do que o estudo declara (ex.: dizer que avaliou eficácia quando o estudo mediu placa/dor/intercorrências);
2. Enunciar RESULTADOS ou CONCLUSÕES que não constam no material — atenção especial a PROTOCOLOS de estudo (ainda sem resultados): apresentá-los como estudo concluído é reprovação automática;
3. Citar números que não estão no material;
4. Atribuir ao estudo comparações, populações ou desfechos que ele não tem;
5. OMITIR O VEREDITO de uma comparação: se o material (abstract/resumo/achados) INDICA qual grupo, técnica ou material foi MELHOR ou PIOR em um desfecho, e o roteiro diz apenas que "houve diferença" (ou equivalente) SEM nomear o vencedor daquele desfecho, REPROVE e liste no problema qual desfecho ficou sem veredito e qual é a direção correta segundo o material.
Reformulação de estilo/linguagem NÃO é motivo de reprovação — apenas infidelidade de CONTEÚDO ou omissão de veredito (regra 5).
Responda APENAS com JSON válido: {"aprovado": true|false, "problemas": ["descrição curta de cada problema"]}`;

  const user =
`MATERIAL-FONTE:
Título: ${material.titulo}
Tipo/nível de evidência: ${material.nivel}
Abstract original (fonte primária): ${material.abstract || '(indisponível)'}
Resumo editorial: ${material.resumo}
${material.achados.length ? `Achados listados: ${material.achados.join('; ')}` : 'Achados listados: (nenhum)'}

ROTEIRO A VERIFICAR:
${roteiro}`;

  try {
    let raw = await callModel(anthropicKey, VERIFY_MODEL, system, user, 400);
    if (!raw) return { ok: false, problemas: ['verificador indisponível'] };
    if (raw.startsWith('```')) raw = raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
    // Parse TOLERANTE: o modelo às vezes anexa texto após o JSON ("{...} Nota:")
    // — recorta do primeiro '{' ao '}' balanceado antes de parsear (incidente
    // 22/07: parse quebrava e derrubava roteiro bom para o fallback).
    const ini = raw.indexOf('{');
    const fim = raw.lastIndexOf('}');
    const parsed = JSON.parse(ini >= 0 && fim > ini ? raw.slice(ini, fim + 1) : raw);
    return { ok: parsed.aprovado === true, problemas: Array.isArray(parsed.problemas) ? parsed.problemas : [] };
  } catch (err) {
    log.warn('[podcast-script] verificador falhou — fail-closed', { err: err.message });
    return { ok: false, problemas: ['verificador falhou: ' + err.message] };
  }
}

function buildSystemPrompt(especialidade, sponsorText, fixNote) {
  return `Você escreve o roteiro FALADO de um micro-podcast diário do OdontoFeed para dentistas de ${especialidade}.
O ouvinte é um DENTISTA que quer a essência do estudo em poucos minutos — cada frase precisa carregar informação do artigo. ZERO enrolação.

FIDELIDADE (regra MÁXIMA, acima de todas): narre APENAS o que está no material.
- NUNCA invente, extrapole ou "complete" objetivo, resultados ou conclusões.
- O OBJETIVO narrado deve ser EXATAMENTE o que o estudo declara — não o que seria mais interessante. Ex.: se o estudo mediu placa, dor e intercorrências, é ISSO que você diz; não transforme em "avaliou se a técnica funciona".
- Se o artigo é um PROTOCOLO ou estudo ainda SEM resultados: diga explicitamente que se trata de um protocolo, narre o que o estudo VAI medir e por quê — e NADA de resultados.
- Se ficar em dúvida se uma informação está no material, NÃO a inclua.

ESTRUTURA (nesta ordem, em prosa corrida — sem títulos, marcadores, asteriscos ou "[música]"):
1. Saudação de UMA frase já citando o tema.
2. OBJETIVO: o que o estudo declara que quis responder (1-2 frases, fiel ao material).
3. MATERIAIS E MÉTODOS: desenho do estudo, quem/o que foi estudado, grupos comparados, tempo de acompanhamento e o que foi medido — quando esses dados estiverem no material (2-3 frases).
4. RESULTADOS: quando o material CONTÉM resultados, enunciá-los é OBRIGATÓRIO — o que os autores encontraram, em linguagem clínica direta, com os números do material por extenso. Se o estudo COMPARA grupos, técnicas ou materiais, você DEVE dizer o VEREDITO em voz alta: qual grupo se saiu MELHOR e qual foi PIOR em cada desfecho. É PROIBIDO parar em "houve diferença significativa entre os grupos" sem dizer quem venceu — essa é a informação que o dentista mais quer ouvir. (Se o material genuinamente não indicar a direção, diga isso; nunca invente o vencedor.) Quando NÃO contém resultados (protocolo/em andamento), diga isso claramente e descreva os desfechos que serão avaliados.
5. RELEVÂNCIA CLÍNICA: o que muda (ou o que se espera saber) no consultório (1-2 frases).
6. UMA frase: o episódio é informativo e não substitui a leitura do artigo original nem o julgamento clínico. Despedida em UMA frase curta.

PROIBIDO (enrolação): frases de enchimento ("isso é fascinante", "vamos mergulhar", "fique com a gente"), repetir a mesma ideia, promessas vagas, introduções longas. Se uma frase não traz informação do estudo, corte-a.

REGRAS:
- Português brasileiro, tom de locutor de podcast — natural e direto, sem soar acadêmico nem traduzido.
- Números do material são bem-vindos (por extenso). NUNCA invente números.
- NÃO recite notação estatística técnica (valor de p, intervalo de confiança, odds ratio) — traduza para linguagem clínica.
- Alvo: 350-500 palavras, densas (o texto vira áudio de ~3 minutos e há limite rígido de tamanho).
- DIREITO AUTORAL (obrigatório): o material recebido é apenas contexto — NÃO o leia, reproduza ou traduza literalmente; narre inteiramente com suas próprias palavras.${sponsorText ? `
- PATROCÍNIO: logo após a saudação inicial, leia naturalmente esta mensagem de patrocínio, identificando-a como tal, sem alterá-la: "${sponsorText}"` : ''}${fixNote ? `

ATENÇÃO — a versão anterior do roteiro foi REPROVADA pelo verificador de fidelidade pelos motivos abaixo. Corrija TODOS:
${fixNote}` : ''}`;
}

async function generateScript(article, especialidade, anthropicKey, opts = {}) {
  // Sem material narratável não há episódio — retorna null e o chamador pula.
  if (!hasNarratableMaterial(article)) {
    log.warn('[podcast-script] artigo SEM material narratável (não enriquecido?) — sem roteiro', {
      pmid: article.pmid || article.id, titulo: String(article.titulo || article.titulo_pt || '').slice(0, 70),
    });
    return null;
  }

  const sponsorText = (opts.sponsorText || '').trim();
  if (!anthropicKey) {
    const base = fallbackScript(article, especialidade);
    return capScript(sponsorText ? base.replace('vamos falar sobre', `${sponsorText} Hoje vamos falar sobre`) : base);
  }

  const material = buildMaterial(article);
  // O abstract original entra como CONTEXTO FACTUAL (nunca para tradução
  // literal): é nele que está a DIREÇÃO dos resultados (qual grupo venceu) —
  // sem ele o roteiro não tinha como declarar o veredito quando o resumo
  // editorial vinha vago (bug recorrente 20-21/07).
  const user =
`Artigo (${material.nivel}):
Título: ${material.titulo}
Resumo: ${material.resumo}
${material.abstract ? `Abstract original (APENAS contexto factual — proibido traduzir/reproduzir literalmente; use-o para números e para a DIREÇÃO dos resultados):\n${material.abstract}` : ''}
${material.achados.length ? `Principais achados/resultados listados no material:\n- ${material.achados.join('\n- ')}` : 'Achados/resultados listados: (nenhum — se o material não trouxer resultados, trate como estudo sem resultados)'}
${material.impacto ? `Relevância clínica: ${material.impacto}` : ''}`;

  try {
    let fixNote = null;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      // max_tokens 2400: 1500 truncava a ÚLTIMA FRASE de roteiros densos em
      // português (a tokenização pt gasta ~2 chars/token, então ~2.7k chars já
      // se aproximavam do teto e o áudio "cortava no meio" — revisões
      // sistemáticas/RCTs longos). O tamanho final continua limitado por capScript.
      const roteiro = await callModel(anthropicKey, SCRIPT_MODEL, buildSystemPrompt(especialidade, sponsorText, fixNote), user, 2400);
      if (!roteiro) break; // erro de geração → fallback

      // Sinal de truncamento: roteiro que não fecha em pontuação terminal veio
      // cortado. capScript recupera a última frase completa, mas registramos.
      if (!/[.!?…]["'”’»)\]]?\s*$/.test(roteiro.trim())) {
        log.warn('[podcast-script] roteiro possivelmente truncado (sem pontuação final) — será fechado na última frase completa', {
          pmid: article.pmid || article.id, tentativa, chars: roteiro.trim().length,
        });
      }

      const check = await verifyScriptFidelity(anthropicKey, material, roteiro);
      if (check.ok) {
        if (tentativa > 1) log.info('[podcast-script] aprovado na 2ª tentativa após correção');
        // Terminologia BR determinística (ex.: prostodontista→protesista) —
        // o narrado deve soar como um professor brasileiro da área.
        return capScript(corrigirTermosBR(roteiro));
      }
      log.warn('[podcast-script] roteiro REPROVADO pelo verificador de fidelidade', {
        pmid: article.pmid || article.id, tentativa, problemas: check.problemas.slice(0, 5),
      });
      fixNote = '- ' + check.problemas.slice(0, 5).join('\n- ');
    }
  } catch (err) {
    log.warn('[podcast-script] falha, usando fallback', { err: err.message });
  }

  // MODO ESTRITO (correções pontuais): NÃO cai no fallback determinístico —
  // se a fidelidade não foi confirmada (timeout da API, verificador indisponível
  // ou 2 reprovações), retorna null para o chamador ABORTAR sem publicar. Isso
  // impede que uma correção republique um roteiro sem veredito (incidente 22/07:
  // o FORCE_REGEN degradou p/ fallback em timeout e reintroduziu "houve diferença"
  // sem dizer quem venceu).
  if (opts.strict) {
    log.warn('[podcast-script] STRICT — fidelidade não confirmada, retornando null (sem fallback)', { pmid: article.pmid || article.id });
    return null;
  }

  // FAIL-CLOSED: sem roteiro aprovado, narra apenas o material próprio, sem criação.
  log.warn('[podcast-script] usando fallback determinístico (fidelidade não confirmada)', { pmid: article.pmid || article.id });
  return capScript(fallbackScript(article, especialidade));
}

module.exports = { generateScript, capScript, verifyScriptFidelity, buildMaterial, hasNarratableMaterial };
