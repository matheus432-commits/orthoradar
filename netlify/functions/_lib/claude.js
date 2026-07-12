// Claude Haiku API client for article enrichment.
// Uses raw HTTPS via _lib.js (no npm dependency).

const { request } = require('../_lib');
const log = require('./logger');
const { resolveModel } = require('./ai-config');

const HOST          = 'api.anthropic.com';
const MODEL         = resolveModel('ENRICH_MODEL');
const MAX_TOKENS    = 1024;
// Cost guard: stop enriching if accumulated cost exceeds this per run
const MAX_COST_USD  = 0.50;
// Approximate token prices (USD per 1M tokens)
const PRICE_INPUT   = 0.25;
const PRICE_OUTPUT  = 1.25;

// Dental specialty names in Portuguese, used to build context
const EVIDENCE_LEVELS = [
  'Meta-análise', 'Revisão Sistemática', 'RCT', 'Estudo Coorte',
  'Caso Clínico', 'Revisão Narrativa', 'In Vitro', 'Estudo Animal',
];

function buildPrompt(article) {
  const abstract = (article.abstract || '').slice(0, 400);
  return (
    'Você é um editor científico especializado em Odontologia.\n' +
    'Dado o artigo abaixo, produza conteúdo ORIGINAL em português brasileiro para uma newsletter profissional.\n' +
    'Não reproduza o abstract — crie novo texto analítico e prático.\n\n' +
    `TÍTULO (inglês): ${article.titulo || article.title || ''}\n` +
    `CONTEXTO ABSTRACT (inglês, uso interno, max 400 chars): ${abstract}\n` +
    `ESPECIALIDADE: ${article.especialidade || ''}\n` +
    `PERIÓDICO: ${article.journal || ''}\n` +
    `ANO: ${article.year || ''}\n\n` +
    'Responda APENAS com JSON válido (sem markdown, sem código fence):\n' +
    '{\n' +
    '  "titulo_pt": "Título adaptado em português (máx 120 chars)",\n' +
    '  "resumo_pt": "Resumo transformativo original em PT (150-250 palavras). Comece pelo problema clínico. Descreva metodologia brevemente. Foque em achados práticos. Tom: colega explicando a colega.",\n' +
    '  "impacto_pratico": "1-2 frases: o que este estudo muda (ou confirma) na prática clínica",\n' +
    '  "achados_principais": ["achado 1", "achado 2", "achado 3"],\n' +
    `  "nivel_evidencia": "um de: ${EVIDENCE_LEVELS.join(' | ')}",\n` +
    '  "limitacoes": "Principais limitações em 1 frase",\n' +
    '  "tempo_leitura": 3\n' +
    '}'
  );
}

// ── Cost tracker (per process lifetime) ──────────────────────────────────────

let _runCostUsd = 0;

function addCost(inputTokens, outputTokens) {
  _runCostUsd += (inputTokens / 1_000_000) * PRICE_INPUT +
                 (outputTokens / 1_000_000) * PRICE_OUTPUT;
}

function currentCost() { return _runCostUsd; }
function resetCost()    { _runCostUsd = 0; }

// ── Core API call ─────────────────────────────────────────────────────────────

async function callClaude(prompt, attempt = 0) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = JSON.stringify({
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    messages:   [{ role: 'user', content: prompt }],
  });
  const buf = Buffer.from(body, 'utf8');

  const res = await request({
    hostname: HOST,
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
      'content-length':    buf.length,
    },
  }, buf);

  if (res.status === 429 || res.status === 529) {
    if (attempt < 3) {
      const delay = 2000 * Math.pow(2, attempt);
      log.warn('[claude] Rate limited, retrying', { attempt, delay_ms: delay });
      await new Promise(r => setTimeout(r, delay));
      return callClaude(prompt, attempt + 1);
    }
    throw new Error(`Claude rate limit after ${attempt} retries`);
  }

  if (res.status === 400) {
    // Log the specific error — often a malformed message
    log.error('[claude] 400 Bad Request', { body: res.body.slice(0, 400) });
    throw new Error(`Claude 400: ${res.body.slice(0, 200)}`);
  }

  if (res.status !== 200) {
    throw new Error(`Claude ${res.status}: ${res.body.slice(0, 200)}`);
  }

  const json = JSON.parse(res.body);
  const text = json.content?.[0]?.text || '';
  const usage = json.usage || {};
  addCost(usage.input_tokens || 0, usage.output_tokens || 0);

  return { text, inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 };
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Enriches a raw article with Claude Haiku.
 * Returns enriched fields object, or null on failure.
 */
async function enrichArticle(article) {
  if (_runCostUsd >= MAX_COST_USD) {
    log.warn('[claude] Cost limit reached, skipping enrichment', { cost_usd: _runCostUsd.toFixed(4) });
    return null;
  }

  const prompt = buildPrompt(article);

  let raw;
  try {
    raw = await callClaude(prompt);
  } catch (err) {
    log.error('[claude] enrichArticle failed', { pmid: article.pmid, err: err.message });
    return null;
  }

  // Strip accidental markdown code fences
  let jsonStr = raw.text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let enriched;
  try {
    enriched = JSON.parse(jsonStr);
  } catch (parseErr) {
    log.error('[claude] JSON parse failed', {
      pmid:    article.pmid,
      preview: jsonStr.slice(0, 200),
      err:     parseErr.message,
    });
    return null;
  }

  log.debug('[claude] Enriched article', {
    pmid:          article.pmid,
    input_tokens:  raw.inputTokens,
    output_tokens: raw.outputTokens,
    cost_usd:      _runCostUsd.toFixed(4),
  });

  return {
    titulo_pt:         String(enriched.titulo_pt          || '').slice(0, 200),
    resumo_pt:         String(enriched.resumo_pt           || '').slice(0, 2000),
    impacto_pratico:   String(enriched.impacto_pratico     || '').slice(0, 500),
    achados_principais: Array.isArray(enriched.achados_principais) ? enriched.achados_principais.slice(0, 5).map(String) : [],
    nivel_evidencia:   EVIDENCE_LEVELS.includes(enriched.nivel_evidencia) ? enriched.nivel_evidencia : 'Revisão Narrativa',
    limitacoes:        String(enriched.limitacoes          || '').slice(0, 500),
    tempo_leitura:     Number.isInteger(enriched.tempo_leitura) ? enriched.tempo_leitura : 3,
  };
}

module.exports = { enrichArticle, currentCost, resetCost, MODEL };
