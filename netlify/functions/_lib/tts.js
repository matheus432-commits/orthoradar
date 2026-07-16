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

// Vozes pt-BR. Padrão: Neural2 (alta qualidade, US$16/1M após 1M grátis —
// decisão de produto 07/2026). Troque sem deploy via env TTS_VOICE
// (ex.: TTS_VOICE=pt-BR-Standard-A para voltar ao modo gratuito).
const VOICES = {
  A: 'pt-BR-Neural2-A', // feminina (alta qualidade)
  B: 'pt-BR-Neural2-B', // masculina (alta qualidade)
  C: 'pt-BR-Neural2-C', // feminina
  STANDARD_A: 'pt-BR-Standard-A', // fallback barato (4M grátis/mês)
};
const DEFAULT_VOICE = process.env.TTS_VOICE || VOICES.A;

// Sintetiza `text` respeitando o orçamento. `now` injetável para testes.
// Retorna { ok:true, audioBase64, chars } ou { skipped:true, reason }.
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

  const payload = JSON.stringify({
    input:       { text: clean },
    voice:       { languageCode: 'pt-BR', name: voice },
    audioConfig: { audioEncoding: 'MP3', speakingRate },
  });
  const buf = Buffer.from(payload, 'utf8');
  // maxRetries=0: o Cloud TTS cobra por tentativa; um retry após timeout/queda
  // cobraria em dobro sem reservar — o que furaria o teto. Uma tentativa só.
  const res = await request({
    hostname: HOST,
    path:     '/v1/text:synthesize?key=' + apiKey,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf, 0, 0);

  if (res.status !== 200) {
    log.error('[tts] erro na API Cloud TTS', { status: res.status, body: res.body.slice(0, 200) });
    return { skipped: true, reason: 'api_error', status: res.status, chars };
  }

  const audioBase64 = JSON.parse(res.body).audioContent || null;
  if (!audioBase64) return { skipped: true, reason: 'empty_audio', chars };

  log.info('[tts] áudio gerado', { chars, voice, monthUsadoAgora: (usage.chars || 0) + chars });
  return { ok: true, audioBase64, chars };
}

module.exports = { synthesize, VOICES };
