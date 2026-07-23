// Cliente Google Cloud Text-to-Speech (vozes Standard) COM orçamento embutido.
//
// A única forma de sintetizar é via synthesize(), que SEMPRE:
//   1. conta os caracteres do texto,
//   2. verifica o orçamento (checkBudget) ANTES de gastar,
//   3. só então chama a API,
//   4. registra o consumo (recordUsage) após o sucesso.
// Assim é impossível estourar o teto de 3,2M/mês (e muito menos os 4M do grátis).
//
// Auth: chave de API em GOOGLE_TTS_API_KEY (o endpoint text:synthesize aceita
// API key). Sem a chave, synthesize() retorna { skipped:true, reason:'no_api_key' }
// — nada quebra o pipeline. Formato de saída: MP3.

const { request } = require('../_lib');
const budget      = require('./tts-budget');
const log         = require('./logger');

const HOST = 'texttospeech.googleapis.com';

// Vozes pt-BR. Padrão: Chirp3-HD — a geração generativa mais natural do Google
// (bem menos "robótica" que a Neural2). Troque via env TTS_VOICE.
// FALLBACK_VOICE (Neural2) entra automaticamente se a voz primária retornar
// erro da API — assim a geração nunca quebra por um nome de voz indisponível.
const VOICES = {
  CHIRP_F:  'pt-BR-Chirp3-HD-Aoede',   // feminina generativa (mais natural)
  CHIRP_M:  'pt-BR-Chirp3-HD-Charon',  // masculina generativa
  A:        'pt-BR-Neural2-A',         // feminina (alta qualidade) — fallback
  B:        'pt-BR-Neural2-B',         // masculina (alta qualidade)
  C:        'pt-BR-Neural2-C',         // feminina
  STANDARD_A: 'pt-BR-Standard-A',      // barata (4M grátis/mês)
};
const DEFAULT_VOICE  = process.env.TTS_VOICE || VOICES.CHIRP_F;
const FALLBACK_VOICE = process.env.TTS_FALLBACK_VOICE || VOICES.A;

// Uma chamada ao endpoint de síntese com uma voz específica. Chirp3-HD não
// aceita speakingRate de forma consistente, então só enviamos audioConfig
// extra quando a taxa difere do padrão (1.0).
// timeoutMs 90s: a síntese GENERATIVA (Chirp3-HD) de ~3k chars passa dos 15s
// padrão do _lib — este código roda no GitHub Actions, sem o teto do Netlify.
async function callSynthesisAPI(apiKey, clean, voice, speakingRate) {
  const audioConfig = { audioEncoding: 'MP3' };
  if (speakingRate && speakingRate !== 1.0) audioConfig.speakingRate = speakingRate;
  const payload = JSON.stringify({
    input:       { text: clean },
    voice:       { languageCode: 'pt-BR', name: voice },
    audioConfig,
  });
  const buf = Buffer.from(payload, 'utf8');
  // maxRetries=0: o Cloud TTS cobra por tentativa bem-sucedida; sem retry cego.
  return request({
    hostname:  HOST,
    path:      '/v1/text:synthesize?key=' + apiKey,
    method:    'POST',
    timeoutMs: 90000,
    headers:   { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf, 0, 0);
}

// Sintetiza `text` respeitando o orçamento. `now` injetável para testes.
// Retorna { ok:true, audioBase64, chars, voice } ou { skipped:true, reason }.
async function synthesize(db, { text, voice = DEFAULT_VOICE, speakingRate = 1.0, now = new Date() } = {}) {
  const clean = String(text || '').trim();
  const chars = budget.billableChars(clean);

  // Limite HARD da API (5000 bytes/requisição). capScript já garante, mas checamos
  // de novo aqui para nunca enviar algo que retornaria 400.
  if (budget.byteLength(clean) > budget.MAX_REQUEST_BYTES) {
    log.warn('[tts] texto acima do limite de bytes da API — pulando', { bytes: budget.byteLength(clean) });
    return { skipped: true, reason: 'too_long_bytes', chars };
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    log.warn('[tts] GOOGLE_TTS_API_KEY não configurada — pulando síntese');
    return { skipped: true, reason: 'no_api_key', chars };
  }

  // ── GATE DE ORÇAMENTO ────────────────────────────────────────────────────
  const usage   = await budget.loadUsage(db, now);
  const verdict = budget.checkBudget(usage, chars, now);
  if (!verdict.ok) {
    log.warn('[tts] síntese BLOQUEADA pelo orçamento', { reason: verdict.reason, chars, monthUsed: usage.chars });
    return { skipped: true, reason: verdict.reason, chars, monthUsed: usage.chars };
  }

  // ── RESERVA o consumo ANTES de gastar ────────────────────────────────────
  // Assim o registrado é sempre >= o gasto real: se a API falhar depois, no
  // máximo super-contamos (direção segura) — NUNCA gastamos mais do que o teto.
  try {
    await budget.recordUsage(db, now, chars);
  } catch (e) {
    log.error('[tts] falha ao reservar orçamento — abortando síntese (sem gasto)', { err: e.message });
    return { skipped: true, reason: 'budget_write_failed', chars };
  }

  // Voz primária; se a API recusar OU a chamada lançar (timeout/queda de rede),
  // cai para a Neural2. A tentativa que FALHA não gera áudio → o Cloud TTS não
  // cobra por ela, então a reserva única acima cobre a síntese que acontece.
  let usedVoice = voice;
  let res;
  try {
    res = await callSynthesisAPI(apiKey, clean, voice, speakingRate);
  } catch (err) {
    res = { status: 0, body: err.message || 'network_error' };
  }
  if (res.status !== 200 && voice !== FALLBACK_VOICE) {
    log.warn('[tts] voz primária falhou — usando fallback', { voice, fallback: FALLBACK_VOICE, status: res.status, body: (res.body || '').slice(0, 160) });
    usedVoice = FALLBACK_VOICE;
    try {
      res = await callSynthesisAPI(apiKey, clean, FALLBACK_VOICE, speakingRate);
    } catch (err) {
      res = { status: 0, body: err.message || 'network_error' };
    }
  }

  if (res.status !== 200) {
    log.error('[tts] erro na API Cloud TTS', { status: res.status, body: (res.body || '').slice(0, 200) });
    return { skipped: true, reason: 'api_error', status: res.status, chars };
  }

  const audioBase64 = JSON.parse(res.body).audioContent || null;
  if (!audioBase64) return { skipped: true, reason: 'empty_audio', chars };

  log.info('[tts] áudio gerado', { chars, voice: usedVoice, monthUsadoAgora: (usage.chars || 0) + chars });
  return { ok: true, audioBase64, chars, voice: usedVoice };
}

// Divide um texto em pedaços que caibam no limite de BYTES da API, cada um
// terminando em fim de frase quando possível. Antes (incidente 23/07) o roteiro
// era TRUNCADO em 4500 bytes e o áudio cortava no meio; agora ele é sintetizado
// em partes e concatenado.
function splitForTts(text, maxBytes = budget.MAX_REQUEST_BYTES) {
  const t = String(text || '').trim();
  if (!t) return [];
  if (budget.byteLength(t) <= maxBytes) return [t];
  const chunks = [];
  let rest = t;
  while (budget.byteLength(rest) > maxBytes) {
    // Maior prefixo (em caracteres) que cabe em maxBytes (busca binária).
    let lo = 0, hi = rest.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (budget.byteLength(rest.slice(0, mid)) <= maxBytes) lo = mid; else hi = mid - 1;
    }
    let cut = rest.slice(0, lo);
    // Recua até o último fim de frase; se não houver, corta no último espaço
    // (nunca no meio de uma palavra).
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '),
                          cut.lastIndexOf('.\n'), cut.lastIndexOf('!\n'), cut.lastIndexOf('?\n'));
    if (stop > lo * 0.5) cut = cut.slice(0, stop + 1);
    else { const sp = cut.lastIndexOf(' '); if (sp > lo * 0.5) cut = cut.slice(0, sp); }
    chunks.push(cut.trim());
    rest = rest.slice(cut.length).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}

// Sintetiza um roteiro de qualquer tamanho: fatia no limite de bytes, sintetiza
// cada parte (com o gate de orçamento de synthesize) e concatena o MP3. MP3s do
// mesmo encoder/voz concatenam sem problema (players tocam em sequência; a
// duração soma — ver mp3DurationSecs). ALL-OR-NOTHING: se uma parte falhar/for
// bloqueada, retorna o skip (o chamador mantém o áudio anterior / pula), para
// nunca publicar um áudio parcial.
async function synthesizeLong(db, opts = {}) {
  const parts = splitForTts(opts.text || '');
  if (parts.length <= 1) return synthesize(db, opts);

  const buffers = [];
  let totalChars = 0, usedVoice = null;
  for (let i = 0; i < parts.length; i++) {
    const r = await synthesize(db, { ...opts, text: parts[i] });
    if (!r.ok) {
      log.warn('[tts] parte falhou — áudio longo abortado', { reason: r.reason, parte: i + 1, de: parts.length });
      return r;
    }
    buffers.push(Buffer.from(r.audioBase64, 'base64'));
    totalChars += r.chars;
    usedVoice = r.voice;
  }
  log.info('[tts] áudio longo concatenado (roteiro fatiado, nada truncado)', { partes: parts.length, chars: totalChars });
  return { ok: true, audioBase64: Buffer.concat(buffers).toString('base64'), chars: totalChars, voice: usedVoice, partes: parts.length };
}

module.exports = { synthesize, synthesizeLong, splitForTts, VOICES };
