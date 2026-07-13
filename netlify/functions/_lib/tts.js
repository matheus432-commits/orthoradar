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

// Vozes Standard pt-BR (as mais baratas — 4M chars/mês grátis).
const VOICES = {
  A: 'pt-BR-Standard-A', // feminina
  B: 'pt-BR-Standard-B', // masculina
  C: 'pt-BR-Standard-C',
};

// Sintetiza `text` respeitando o orçamento. `now` injetável para testes.
// Retorna { ok:true, audioBase64, chars } ou { skipped:true, reason }.
async function synthesize(db, { text, voice = VOICES.A, speakingRate = 1.0, now = new Date() } = {}) {
  const clean = String(text || '').trim();
  const chars = budget.billableChars(clean);

  // ── GATE DE ORÇAMENTO (antes de qualquer gasto) ──────────────────────────
  const usage   = await budget.loadUsage(db, now);
  const verdict = budget.checkBudget(usage, chars, now);
  if (!verdict.ok) {
    log.warn('[tts] síntese BLOQUEADA pelo orçamento', { reason: verdict.reason, chars, monthUsed: usage.chars });
    return { skipped: true, reason: verdict.reason, chars, monthUsed: usage.chars };
  }

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    log.warn('[tts] GOOGLE_TTS_API_KEY não configurada — pulando síntese');
    return { skipped: true, reason: 'no_api_key', chars };
  }

  const payload = JSON.stringify({
    input:       { text: clean },
    voice:       { languageCode: 'pt-BR', name: voice },
    audioConfig: { audioEncoding: 'MP3', speakingRate },
  });
  const buf = Buffer.from(payload, 'utf8');
  const res = await request({
    hostname: HOST,
    path:     '/v1/text:synthesize?key=' + apiKey,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);

  if (res.status !== 200) {
    log.error('[tts] erro na API Cloud TTS', { status: res.status, body: res.body.slice(0, 200) });
    return { skipped: true, reason: 'api_error', status: res.status, chars };
  }

  const audioBase64 = JSON.parse(res.body).audioContent || null;
  if (!audioBase64) return { skipped: true, reason: 'empty_audio', chars };

  // ── REGISTRA O CONSUMO só após o sucesso ─────────────────────────────────
  await budget.recordUsage(db, now, chars);
  log.info('[tts] áudio gerado', { chars, voice, monthUsedAgora: (usage.chars || 0) + chars });

  return { ok: true, audioBase64, chars };
}

module.exports = { synthesize, VOICES };
