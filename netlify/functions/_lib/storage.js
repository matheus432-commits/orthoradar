// Upload de áudio no Google Cloud Storage / Firebase Storage.
//
// Estratégia de entrega (sem consumir banda do Netlify): o objeto recebe um
// `firebaseStorageDownloadTokens` (uuid) e o áudio é servido DIRETO pela URL de
// download do Firebase. O get-podcast só entrega essa URL a assinantes Pro.
//
// Rotação: o path é fixo por especialidade (podcasts/{esp}/latest.mp3). Cada
// geração SOBRESCREVE o objeto e gera um TOKEN NOVO — então a URL do dia anterior
// para de funcionar automaticamente (não sobra áudio antigo nem link válido).

const crypto = require('crypto');
const { request } = require('../_lib');
const { getAccessToken, bucketName } = require('./gcp-auth');
const log = require('./logger');

const UPLOAD_HOST = 'storage.googleapis.com';
const FB_HOST     = 'firebasestorage.googleapis.com';

function newDownloadToken() {
  return crypto.randomUUID();
}

// URL de download do Firebase (servida direto do Storage/CDN, fora do Netlify).
function firebaseDownloadUrl(bucket, objectPath, token) {
  return `https://${FB_HOST}/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

// Sobe um mp3 e retorna { ok, url, downloadToken } ou { skipped, reason }.
// downloadToken é o UUID público do Firebase (NÃO o token de acesso OAuth) —
// é ele que vai na URL de download e deve ser persistido pelo chamador.
async function uploadMp3(objectPath, audioBuffer, downloadToken = newDownloadToken()) {
  const accessToken = await getAccessToken('https://www.googleapis.com/auth/devstorage.read_write');
  const bucket = bucketName();
  if (!accessToken || !bucket) return { skipped: true, reason: 'no_credentials' };

  const boundary = 'of_' + crypto.randomBytes(12).toString('hex');
  const metadata = JSON.stringify({
    name: objectPath,
    contentType: 'audio/mpeg',
    cacheControl: 'private, max-age=0, no-store',
    metadata: { firebaseStorageDownloadTokens: downloadToken },
  });

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: audio/mpeg\r\n\r\n`,
    'utf8'
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, audioBuffer, epilogue]);

  const res = await request({
    hostname: UPLOAD_HOST,
    path: `/upload/storage/v1/b/${bucket}/o?uploadType=multipart`,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary,
      'Content-Length': body.length,
    },
  }, body);

  if (res.status !== 200) {
    log.error('[storage] upload falhou', { status: res.status, body: (res.body || '').slice(0, 200) });
    return { skipped: true, reason: 'upload_error', status: res.status };
  }
  // Devolve o UUID de download (público, não expira) — NUNCA o accessToken OAuth.
  return { ok: true, url: firebaseDownloadUrl(bucket, objectPath, downloadToken), downloadToken };
}

// Sobe uma imagem (JPEG/PNG) e retorna { ok, url, downloadToken }.
// Usado pela automação do Instagram: a API do Instagram só publica a partir de
// uma URL PÚBLICA da imagem, então renderizamos os slides, subimos aqui e
// passamos a URL de download do Firebase para o endpoint de publicação.
async function uploadImage(objectPath, imageBuffer, contentType = 'image/jpeg', downloadToken = newDownloadToken()) {
  const accessToken = await getAccessToken('https://www.googleapis.com/auth/devstorage.read_write');
  const bucket = bucketName();
  if (!accessToken || !bucket) return { skipped: true, reason: 'no_credentials' };

  const boundary = 'of_' + crypto.randomBytes(12).toString('hex');
  const metadata = JSON.stringify({
    name: objectPath,
    contentType,
    // Pública e cacheável: o Instagram baixa a imagem uma vez para publicar.
    cacheControl: 'public, max-age=86400',
    metadata: { firebaseStorageDownloadTokens: downloadToken },
  });

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`,
    'utf8'
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  const body = Buffer.concat([preamble, imageBuffer, epilogue]);

  const res = await request({
    hostname: UPLOAD_HOST,
    path: `/upload/storage/v1/b/${bucket}/o?uploadType=multipart`,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary,
      'Content-Length': body.length,
    },
  }, body);

  if (res.status !== 200) {
    log.error('[storage] upload de imagem falhou', { status: res.status, body: (res.body || '').slice(0, 200) });
    return { skipped: true, reason: 'upload_error', status: res.status };
  }
  return { ok: true, url: firebaseDownloadUrl(bucket, objectPath, downloadToken), downloadToken };
}

// Remove um objeto do bucket (usado para limpar podcasts de especialidades sem
// Pro ativo — invalida o token de download órfão). Best-effort.
async function deleteObject(objectPath) {
  const token = await getAccessToken('https://www.googleapis.com/auth/devstorage.read_write');
  const bucket = bucketName();
  if (!token || !bucket) return { skipped: true, reason: 'no_credentials' };
  const res = await request({
    hostname: UPLOAD_HOST,
    path: `/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`,
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  // 200/204 = removido; 404 = já não existe (idempotente).
  return { ok: res.status === 200 || res.status === 204 || res.status === 404, status: res.status };
}

module.exports = { uploadMp3, uploadImage, deleteObject, firebaseDownloadUrl, newDownloadToken, _bucketName: bucketName };
