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

// VERIFICA que a URL pública de download realmente SERVE o objeto (incidente
// 04/08 — player 0:00 no site: doc apontava para áudio que o navegador não
// carregava). Pede só o 1º byte (Range) — não baixa o arquivo. 200/206 = ok.
async function verifyDownloadUrl(bucket, objectPath, token) {
  return verifyUrl(firebaseDownloadUrl(bucket, objectPath, token));
}

// Verifica uma URL de download JÁ PRONTA (a string persistida no doc — a mesma
// que o navegador vai usar). Incidente 05/08: verificar uma URL REMONTADA no
// job não prova nada sobre a URL que o leitor remonta em outro ambiente; a
// prova válida é sobre a string exata que ficou gravada.
async function verifyUrl(url) {
  try {
    const u = new URL(String(url || ''));
    const res = await request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    }, null);
    return { ok: res.status === 200 || res.status === 206, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, err: err.message };
  }
}

// URL de áudio de um episódio/doc: SEMPRE a URL persistida (`url`, gravada e
// verificada byte-a-byte na geração); a remontagem por bucket/token é só o
// fallback para docs legados. Causa-raiz dos players 0:00 de 04-05/08: o job
// gera com o bucket do Actions e cada leitor REMONTAVA com o bucket do
// ambiente Netlify — qualquer divergência de env quebrava o áudio no site.
function audioUrlDe(doc, bucket) {
  if (doc && doc.url) return doc.url;
  if (doc && doc.objectPath && doc.downloadToken) return firebaseDownloadUrl(bucket, doc.objectPath, doc.downloadToken);
  return null;
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
    // CACHEÁVEL 1h (incidentes 04-10/08 — player 0:00 intermitente no celular):
    // o `no-store` antigo era da época do path fixo latest.mp3 (sobrescrito
    // diariamente); com paths DATADOS ele só restou como hostilidade ao mobile
    // — stream sempre-fresco, sem cache parcial, sem Range eficiente. 1h de
    // cache mantém regens cirúrgicas visíveis em até uma hora.
    cacheControl: 'public, max-age=3600',
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

// Copia um objeto dentro do bucket (GCS rewrite) aplicando um downloadToken
// NOVO no destino. Usado pela retenção para preservar áudios de artigos salvos
// na biblioteca (podcasts/salvos/{artigoId}.mp3) antes de limpar o original.
async function copyObject(srcPath, destPath, downloadToken = newDownloadToken()) {
  const accessToken = await getAccessToken('https://www.googleapis.com/auth/devstorage.read_write');
  const bucket = bucketName();
  if (!accessToken || !bucket) return { skipped: true, reason: 'no_credentials' };

  const body = Buffer.from(JSON.stringify({
    cacheControl: 'public, max-age=86400',
    metadata: { firebaseStorageDownloadTokens: downloadToken },
  }), 'utf8');

  const res = await request({
    hostname: UPLOAD_HOST,
    path: `/storage/v1/b/${bucket}/o/${encodeURIComponent(srcPath)}/rewriteTo/b/${bucket}/o/${encodeURIComponent(destPath)}`,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  }, body);

  if (res.status !== 200) {
    log.error('[storage] copyObject falhou', { status: res.status, src: srcPath, body: (res.body || '').slice(0, 200) });
    return { skipped: true, reason: 'copy_error', status: res.status };
  }
  return { ok: true, url: firebaseDownloadUrl(bucket, destPath, downloadToken), downloadToken };
}

// Atualiza SÓ o cacheControl de um objeto existente (PATCH de metadados) —
// preserva o firebaseStorageDownloadTokens, então a URL persistida continua
// válida. Usado pelo backfill para curar os MP3 antigos gravados com
// `no-store` (incidentes 04-10/08) sem rotacionar token nenhum.
async function patchCacheControl(objectPath, cacheControl = 'public, max-age=3600') {
  // full_control, não read_write: o PATCH de metadados de objeto no GCS pode
  // tocar ACLs e por isso exige o escopo cheio — com read_write a API devolve
  // 403 "Provided scope(s) are not authorized" (runs #2-#3 do backfill, 10/08).
  const accessToken = await getAccessToken('https://www.googleapis.com/auth/devstorage.full_control');
  const bucket = bucketName();
  if (!accessToken || !bucket) return { skipped: true, reason: 'no_credentials' };
  const body = Buffer.from(JSON.stringify({ cacheControl }), 'utf8');
  const res = await request({
    hostname: UPLOAD_HOST,
    path: `/storage/v1/b/${bucket}/o/${encodeURIComponent(objectPath)}`,
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  }, body);
  if (res.status !== 200) return { ok: false, status: res.status, body: (res.body || '').slice(0, 200) };
  return { ok: true, status: 200 };
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

module.exports = { uploadMp3, uploadImage, copyObject, deleteObject, patchCacheControl, firebaseDownloadUrl, verifyDownloadUrl, verifyUrl, audioUrlDe, newDownloadToken, _bucketName: bucketName };
