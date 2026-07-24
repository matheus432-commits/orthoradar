// TALKING HEAD REALISTA — cliente da API do HeyGen (modo pay-as-you-go).
//
// Transforma UMA FOTO (o retrato oficial da apresentadora) + o ÁUDIO real do
// episódio num vídeo de pessoa falando com lip-sync fotorrealista. É o upgrade
// "extremamente realista" da metade de baixo do Reel com Avatar — o resto do
// pipeline (cenas em cima, montagem, sincronia) não muda.
//
// CUSTO (por isso é opt-in, nunca default): HeyGen cobra por segundo de vídeo
// gerado (~US$1–3/min conforme o engine). O chamador DEVE aplicar o teto
// AVATAR_MAX_SECS antes de chamar. estimateCostUsd() dá a estimativa p/ log.
//
// Fluxo: upload do áudio (asset) → upload da foto (talking_photo, cacheável —
// 1x por retrato) → generate (v2) → poll até completed → download do MP4.
// Endpoints/host são os documentados do HeyGen; overridáveis por env caso a
// API mude (vira ajuste de configuração, sem deploy de código).
//
// Envs: HEYGEN_API_KEY (obrigatória p/ usar), HEYGEN_API_HOST, HEYGEN_UPLOAD_HOST,
// HEYGEN_USD_POR_MIN (estimativa de custo p/ log; default 3).

const https = require('https');
const { request } = require('../_lib');
const log = require('./logger');

const API_HOST    = process.env.HEYGEN_API_HOST    || 'api.heygen.com';
const UPLOAD_HOST = process.env.HEYGEN_UPLOAD_HOST || 'upload.heygen.com';

// ── Partes puras (testáveis) ─────────────────────────────────────────────────

// Payload do v2/video/generate: personagem = talking_photo; voz = ÁUDIO próprio
// (nunca TTS do HeyGen — a narração já existe e é a identidade do OdontoFeed).
function buildGeneratePayload({ talkingPhotoId, audioAssetId, width = 1080, height = 960 }) {
  if (!talkingPhotoId || !audioAssetId) throw new Error('talkingPhotoId e audioAssetId são obrigatórios');
  return {
    video_inputs: [{
      character: { type: 'talking_photo', talking_photo_id: talkingPhotoId },
      voice:     { type: 'audio', audio_asset_id: audioAssetId },
    }],
    dimension: { width, height },
  };
}

// Normaliza a resposta do video_status.get (a API varia data.status/data.error).
function parseVideoStatus(json) {
  const d = (json && json.data) || {};
  const status = String(d.status || '').toLowerCase();
  return {
    done:     status === 'completed',
    failed:   status === 'failed' || !!d.error,
    status:   status || 'unknown',
    videoUrl: d.video_url || d.video_url_caption || null,
    error:    d.error ? (d.error.message || JSON.stringify(d.error)).slice(0, 200) : null,
  };
}

function estimateCostUsd(secs, usdPorMin = Number(process.env.HEYGEN_USD_POR_MIN) || 3) {
  return Math.round((Math.max(0, secs) / 60) * usdPorMin * 100) / 100;
}

// ── Chamadas HTTP ────────────────────────────────────────────────────────────

async function apiJson(key, host, path, method, bodyObj) {
  const body = bodyObj ? Buffer.from(JSON.stringify(bodyObj), 'utf8') : null;
  const res = await request({
    hostname: host, path, method,
    timeoutMs: 120000,
    headers: {
      'x-api-key': key, 'accept': 'application/json',
      ...(body ? { 'content-type': 'application/json', 'content-length': body.length } : {}),
    },
  }, body);
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* deixa null */ }
  return { status: res.status, json, raw: res.body };
}

async function uploadBinary(key, path, buffer, contentType) {
  const res = await request({
    hostname: UPLOAD_HOST, path, method: 'POST',
    timeoutMs: 180000,
    headers: { 'x-api-key': key, 'content-type': contentType, 'content-length': buffer.length },
  }, buffer);
  let json = null;
  try { json = JSON.parse(res.body); } catch { /* deixa null */ }
  if (res.status !== 200 || !json?.data) {
    throw new Error(`HeyGen upload ${path} → ${res.status}: ${String(res.body || '').slice(0, 200)}`);
  }
  return json.data;
}

// Áudio do episódio → asset id.
async function uploadAudioAsset(key, audioBuffer) {
  const d = await uploadBinary(key, '/v1/asset', audioBuffer, 'audio/mpeg');
  const id = d.id || d.asset_id || d.url;
  if (!id) throw new Error('HeyGen asset sem id na resposta');
  return id;
}

// Foto do retrato → talking_photo_id (cacheável — sobe 1x por retrato).
async function uploadTalkingPhoto(key, imageBuffer, mime = 'image/jpeg') {
  const d = await uploadBinary(key, '/v1/talking_photo', imageBuffer, mime);
  const id = d.talking_photo_id || d.id;
  if (!id) throw new Error('HeyGen talking_photo sem id na resposta');
  return id;
}

async function createVideo(key, payload) {
  const { status, json, raw } = await apiJson(key, API_HOST, '/v2/video/generate', 'POST', payload);
  const videoId = json?.data?.video_id;
  if (status !== 200 || !videoId) {
    throw new Error(`HeyGen generate → ${status}: ${String(raw || '').slice(0, 200)}`);
  }
  return videoId;
}

async function waitForVideo(key, videoId, { timeoutMs = 12 * 60 * 1000, intervalMs = 15000 } = {}) {
  const t0 = Date.now();
  for (;;) {
    const { status, json } = await apiJson(key, API_HOST, `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, 'GET', null);
    if (status === 200) {
      const st = parseVideoStatus(json);
      if (st.done && st.videoUrl) return st;
      if (st.failed) throw new Error('HeyGen render falhou: ' + (st.error || st.status));
      log.info('[talking-head] render em andamento', { videoId, status: st.status });
    } else {
      log.warn('[talking-head] status HTTP inesperado no poll', { videoId, status });
    }
    if (Date.now() - t0 > timeoutMs) throw new Error('HeyGen render excedeu o tempo limite');
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

function downloadBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return downloadBinary(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('download ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// Orquestração completa: retorna { ok, buffer (MP4), talkingPhotoId } ou lança.
// photo: { buffer, mime } OU { talkingPhotoId } (cache).
async function generateTalkingHead(key, { photo, audioBuffer, width = 1080, height = 960 }) {
  if (!key) throw new Error('HEYGEN_API_KEY não configurada');
  const talkingPhotoId = photo.talkingPhotoId ||
    await uploadTalkingPhoto(key, photo.buffer, photo.mime || 'image/jpeg');
  const audioAssetId = await uploadAudioAsset(key, audioBuffer);
  const videoId = await createVideo(key, buildGeneratePayload({ talkingPhotoId, audioAssetId, width, height }));
  log.info('[talking-head] render iniciado', { videoId, talkingPhotoId });
  const st = await waitForVideo(key, videoId);
  const buffer = await downloadBinary(st.videoUrl);
  log.info('[talking-head] vídeo pronto', { videoId, mb: (buffer.length / 1e6).toFixed(1) });
  return { ok: true, buffer, talkingPhotoId, videoId };
}

module.exports = {
  buildGeneratePayload, parseVideoStatus, estimateCostUsd,
  uploadAudioAsset, uploadTalkingPhoto, createVideo, waitForVideo,
  generateTalkingHead,
};
