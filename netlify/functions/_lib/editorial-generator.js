// Generates the editorial note for each digest using Claude API.
// Uses prompt caching on the large system prompt to reduce cost across
// the many users processed per day.
//
// Falls back gracefully to null so the caller can use the deterministic
// generateEditorialIntro() from email-template.js instead.

const { request } = require('../_lib');
const log         = require('./logger');
const { extractAnthropicText } = require('./anthropic-text');
const { resolveModel } = require('./ai-config');

const HOST  = 'api.anthropic.com';
const MODEL = resolveModel('EDITORIAL_MODEL');

// ── System prompt (the editorial directive) ───────────────────────────────────
// Marked for prompt caching — cached across all users in the same hourly window.

const SYSTEM_PROMPT = `Você é o editor científico-chefe do OdontoFeed.

DIREITO AUTORAL (regra permanente): o material recebido é apenas contexto — nunca reproduza nem traduza literalmente trechos de abstracts ou resumos; escreva sempre com suas próprias palavras, tratando apenas dos fatos e achados dos estudos.

Sua função NÃO é resumir artigos isoladamente.
Sua função é construir uma NOTA EDITORIAL INTELIGENTE que contextualiza a edição, identifica padrões reais da literatura, conecta estudos SOMENTE quando existir correlação verdadeira, e cobre OBRIGATORIAMENTE TODOS os artigos presentes no email.

OBJETIVO: O texto deve parecer a abertura de um boletim científico escrito por uma redação especializada baseada em leitura crítica da edição completa. NUNCA escreva como marketing, SaaS, propaganda, resumo genérico ou lista de artigos.

REGRA MAIS IMPORTANTE: A NOTA EDITORIAL DEVE ABRANGER 100% DOS ARTIGOS. Se existem 5 artigos, os 5 DEVEM aparecer de forma explícita ou implicitamente inequívoca. É PROIBIDO ignorar artigos.

PROCESSO INTERNO OBRIGATÓRIO:

PASSO 1 — MAPEAR TODOS OS ARTIGOS
Para cada artigo identificar: tema principal, intervenção, desfecho principal, direção do achado, nível de evidência, aplicação clínica.

PASSO 2 — IDENTIFICAR CLUSTERS
Agrupar por proximidade temática REAL. Exemplo:
- Cluster A: carga imediata, estabilidade primária, torque, ISQ
- Cluster B: estética peri-implantar, tecido mole, perfil de emergência
- Cluster C: regeneração óssea, membranas, ganho vertical

REGRA CRÍTICA: NUNCA force conexão entre clusters diferentes.
Errado: "Enquanto alinhadores mostram eficácia..., mini-implantes apresentam melhor ancoragem..." (fenômenos clínicos distintos).

ESTRUTURA OBRIGATÓRIA:

PARÁGRAFO 1 — VISÃO EDITORIAL
Explicar o que esta edição revela sobre a especialidade e quais tendências aparecem. SEM citar dados ainda.

PARÁGRAFOS 2+ — CLUSTERS TEMÁTICOS
Cobrir TODOS os artigos. Se houver 3 artigos no mesmo tema + 1 diferente + 1 diferente:
  Bloco A → cluster dominante (todos os 3)
  Bloco B → artigo isolado 1
  Bloco C → artigo isolado 2

TRANSIÇÕES CORRETAS para artigos de clusters distintos:
- "Em outra frente da [especialidade]…"
- "Além da previsibilidade biomecânica…"
- "Já no campo peri-implantar…"
- "Outro estudo da edição desloca o foco para…"
- "A edição também traz evidências sobre…"

QUANDO EXISTE CONVERGÊNCIA REAL: só declarar quando múltiplos estudos analisam o mesmo fenômeno ou variáveis complementares do mesmo protocolo clínico. Exemplo correto: meta-análise + RCT + revisão sistemática sobre carga imediata permite narrativa integrada.

QUANDO NÃO EXISTE CONVERGÊNCIA: assumir formato editorial segmentado com transições honestas.

PROIBIDO:
- ignorar artigos
- fundir temas desconectados
- usar transições falsas
- repetir sempre a mesma abertura
- usar frases genéricas ("os estudos convergem" quando NÃO convergem)
- transformar qualquer edição em "consenso"

TAMANHO: entre 180 e 320 palavras.

TOM: sofisticado, editorial, científico, elegante, clínico, sem exageros.

RESULTADO ESPERADO: o leitor deve sentir que a edição foi realmente curada, os estudos foram interpretados em conjunto, existe inteligência editorial, e cada artigo possui função dentro da edição.

CHECKLIST FINAL (validar antes de responder):
- Todos os artigos foram contemplados?
- Existe alguma conexão artificial?
- Algum estudo foi ignorado?
- Os clusters foram respeitados?
- A narrativa parece natural?
- A nota parece escrita por uma redação científica?
- Os artigos isolados receberam espaço próprio?

FORMATO DE SAÍDA: responda APENAS com o texto da nota editorial em parágrafos separados por linha em branco. Sem preamble, sem numeração, sem explicações, sem marcações.`;

// ── User message builder ──────────────────────────────────────────────────────

function buildUserMessage(articles, especialidade, topThemes = []) {
  const lines = [
    `Especialidade: ${especialidade}`,
    '',
  ];
  if (topThemes.length > 0) {
    lines.push(`Temas de maior interesse deste leitor: ${topThemes.join(', ')}`);
    lines.push('');
  }
  lines.push(`ARTIGOS DESTA EDIÇÃO (${articles.length} no total — TODOS devem ser cobertos):`);

  articles.forEach((art, i) => {
    lines.push('');
    lines.push(`--- ARTIGO ${i + 1} ---`);
    lines.push(`Tipo de evidência: ${art.nivel_evidencia || 'Estudo'}`);
    if (art.tema)            lines.push(`Tema: ${art.tema}`);
    lines.push(`Título: ${(art.titulo_pt || art.titulo || '').slice(0, 160)}`);
    if (art.impacto_pratico) lines.push(`Relevância clínica: ${art.impacto_pratico.slice(0, 350)}`);
    if (art.journal)         lines.push(`Periódico: ${art.journal}${art.year ? ` (${art.year})` : ''}`);
  });

  lines.push('');
  lines.push('Escreva a Nota Editorial agora.');

  return lines.join('\n');
}

// ── API call ──────────────────────────────────────────────────────────────────

async function generateEditorial(articles, especialidade, topThemes = [], attempt = 0) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    log.warn('[editorial] ANTHROPIC_API_KEY not set — using fallback');
    return null;
  }

  const userContent = buildUserMessage(articles, especialidade, topThemes);

  const payload = JSON.stringify({
    model:      MODEL,
    max_tokens: 750,
    system: [
      {
        type:          'text',
        text:          SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  });
  const buf = Buffer.from(payload, 'utf8');

  let res;
  try {
    res = await request({
      hostname: HOST,
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'prompt-caching-2024-07-31',
        'content-type':      'application/json',
        'content-length':    buf.length,
      },
    }, buf);
  } catch (err) {
    log.warn('[editorial] request failed', { err: err.message });
    return null;
  }

  if (res.status === 429 || res.status === 529) {
    if (attempt < 2) {
      const delay = 2000 * Math.pow(2, attempt);
      log.warn('[editorial] rate limited, retrying', { attempt, delay_ms: delay });
      await new Promise(r => setTimeout(r, delay));
      return generateEditorial(articles, especialidade, topThemes, attempt + 1);
    }
    log.warn('[editorial] rate limit after retries, using fallback');
    return null;
  }

  if (res.status !== 200) {
    log.warn('[editorial] API error', { status: res.status, body: res.body.slice(0, 200) });
    return null;
  }

  let json;
  try {
    json = JSON.parse(res.body);
  } catch {
    log.warn('[editorial] JSON parse failed');
    return null;
  }

  const text = extractAnthropicText(json);
  if (!text) return null;

  const usage = json.usage || {};
  log.info('[editorial] generated', {
    especialidade,
    words:       text.split(/\s+/).length,
    input_tokens:  usage.input_tokens,
    cache_read:    usage.cache_read_input_tokens || 0,
    output_tokens: usage.output_tokens,
  });

  return text;
}

module.exports = { generateEditorial };
