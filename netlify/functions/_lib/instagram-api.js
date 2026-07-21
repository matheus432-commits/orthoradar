// Cliente da API de publicação do Instagram (Instagram API with Instagram Login).
//
// Host: graph.instagram.com. O token é o Instagram User Access Token gerado no
// painel de desenvolvedores (segredo INSTAGRAM_ACCESS_TOKEN) e o id é o
// Instagram Business Account ID (INSTAGRAM_BUSINESS_ACCOUNT_ID).
//
// Fluxo de publicação de CARROSSEL (2–10 imagens):
//   1. Para cada imagem: cria um "container filho" (is_carousel_item=true) a
//      partir de uma URL PÚBLICA de imagem (JPEG) → retorna um creation id.
//   2. Cria o container do CARROSSEL agrupando os filhos + legenda.
//   3. Aguarda o container ficar FINISHED (a Meta processa de forma assíncrona).
//   4. Publica o container (media_publish) → retorna o id da mídia publicada.
//
// Referência: developers.facebook.com/docs/instagram-platform/content-publishing
// Requisitos de imagem: JPEG, 320–1440px de largura, proporção entre 4:5 e
// 1.91:1. Nossos slides são 1080×1350 (4:5) — dentro do limite.

const { request } = require('../_lib');
const log = require('./logger');

const HOST = 'graph.instagram.com';
const API_VERSION = 'v21.0';

// POST form-urlencoded para o Graph. Params grandes (caption) vão no corpo,
// evitando estourar o tamanho da URL. Retorna o JSON já parseado.
async function graphPost(path, params, accessToken) {
  const form = new URLSearchParams({ ...params, access_token: accessToken }).toString();
  const body = Buffer.from(form, 'utf8');
  const res = await request({
    hostname: HOST,
    path: `/${API_VERSION}/${path}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': body.length,
    },
  }, body);

  let json = {};
  try { json = JSON.parse(res.body || '{}'); } catch { /* corpo não-JSON */ }
  if (res.status >= 400) {
    const msg = json?.error?.message || `HTTP ${res.status}`;
    const err = new Error(`Instagram API: ${msg}`);
    err.status = res.status;
    err.detail = json?.error;
    throw err;
  }
  return json;
}

async function graphGet(path, params, accessToken) {
  const qs = new URLSearchParams({ ...params, access_token: accessToken }).toString();
  const res = await request({
    hostname: HOST,
    path: `/${API_VERSION}/${path}?${qs}`,
    method: 'GET',
  });
  let json = {};
  try { json = JSON.parse(res.body || '{}'); } catch { /* */ }
  if (res.status >= 400) {
    const err = new Error(`Instagram API: ${json?.error?.message || res.status}`);
    err.status = res.status;
    err.detail = json?.error;
    throw err;
  }
  return json;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Bug conhecido e recorrente da Meta (code 100 / subcode 33): GET em objetos
// RECÉM-CRIADOS (container/mídia) devolve "Object ... does not exist" mesmo o
// objeto existindo e os POSTs funcionando. Tratamos como TRANSITÓRIO.
function isTransientMeta(err) {
  const d = err && err.detail;
  return !!d && (d.code === 100 && (d.error_subcode === 33 || d.error_subcode === 2207032))
    || (err && err.status === 500); // 5xx da Meta também é transitório
}

// Espera um container ficar pronto (status_code === 'FINISHED'), TOLERANTE ao
// bug 100/33 do GET. Nunca lança por causa desse bug: se não confirmar
// FINISHED a tempo, retorna false e o chamador segue para publicar (imagens
// processam em segundos; a publicação tem retentativa própria).
async function waitForContainer(containerId, accessToken, { tries = 20, delayMs = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const { status_code } = await graphGet(containerId, { fields: 'status_code' }, accessToken);
      if (status_code === 'FINISHED') return true;
      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        throw new Error(`Container ${containerId} falhou com status ${status_code}`);
      }
    } catch (e) {
      if (!isTransientMeta(e)) throw e; // erro real (status ERROR/EXPIRED, etc.)
      // 100/33 transitório → ignora e continua o polling.
    }
    await sleep(delayMs);
  }
  return false; // não confirmou (provável bug do GET) — segue para publicar
}

// Publica um creation_id com retentativas: o POST de media_publish pode falhar
// transitoriamente (100/33) ou porque a mídia ainda está processando; tenta
// algumas vezes antes de desistir. Retorna o JSON com { id }.
async function mediaPublishWithRetry(igUserId, accessToken, creationId, { tries = 8, delayMs = 5000 } = {}) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      const p = await graphPost(`${igUserId}/media_publish`, { creation_id: creationId }, accessToken);
      if (p.id) return p;
    } catch (e) {
      lastErr = e;
      const notReady = e.detail && (e.detail.code === 9007 || e.detail.error_subcode === 2207027);
      if (!isTransientMeta(e) && !notReady) throw e; // erro real → propaga
    }
    await sleep(delayMs);
  }
  throw lastErr || new Error('media_publish não confirmou a publicação');
}

// Publica um CARROSSEL. imageUrls: array de URLs públicas (JPEG). caption: texto.
// Retorna { mediaId }.
async function publishCarousel(igUserId, accessToken, imageUrls, caption) {
  if (!Array.isArray(imageUrls) || imageUrls.length < 2) {
    throw new Error('Carrossel exige ao menos 2 imagens');
  }
  if (imageUrls.length > 10) imageUrls = imageUrls.slice(0, 10);

  // 1. Containers filhos (um por imagem). O POST cria; a confirmação de status
  // é tolerante ao bug 100/33 (não bloqueia).
  const childIds = [];
  for (const url of imageUrls) {
    const child = await graphPost(`${igUserId}/media`, {
      image_url: url,
      is_carousel_item: 'true',
    }, accessToken);
    if (!child.id) throw new Error('Falha ao criar container filho');
    await waitForContainer(child.id, accessToken, { tries: 5, delayMs: 3000 }); // imagens são rápidas
    childIds.push(child.id);
  }

  // 2. Container do carrossel.
  const carousel = await graphPost(`${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption: caption || '',
  }, accessToken);
  if (!carousel.id) throw new Error('Falha ao criar container do carrossel');
  await waitForContainer(carousel.id, accessToken);

  // 3. Publicar (com retentativas — resiliente ao 100/33 e ao processamento).
  const published = await mediaPublishWithRetry(igUserId, accessToken, carousel.id);
  log.info('[instagram] carrossel publicado', { mediaId: published.id, slides: childIds.length });
  return { mediaId: published.id, slides: childIds.length };
}

// Publica uma ÚNICA imagem (post simples). Retorna { mediaId }.
async function publishImage(igUserId, accessToken, imageUrl, caption) {
  const container = await graphPost(`${igUserId}/media`, {
    image_url: imageUrl,
    caption: caption || '',
  }, accessToken);
  if (!container.id) throw new Error('Falha ao criar container de imagem');
  await waitForContainer(container.id, accessToken);

  const published = await mediaPublishWithRetry(igUserId, accessToken, container.id);
  log.info('[instagram] imagem publicada', { mediaId: published.id });
  return { mediaId: published.id };
}

// Publica um REEL a partir de uma URL pública de MP4 (H.264/AAC, 9:16).
// O processamento de vídeo na Meta é mais lento que o de imagem — espera até
// ~5 min pelo container. Retorna { mediaId }.
async function publishReel(igUserId, accessToken, videoUrl, caption) {
  const container = await graphPost(`${igUserId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption: caption || '',
    share_to_feed: 'true',
    // Miniatura do Reel = frame da CAPA (500ms, já sem fade a partir do preto),
    // para o feed exibir a especialidade em vez de um quadro escuro.
    thumb_offset: '500',
  }, accessToken);
  if (!container.id) throw new Error('Falha ao criar container do reel');
  // Vídeo processa mais devagar — espera mais e publica com retentativas longas.
  await waitForContainer(container.id, accessToken, { tries: 60, delayMs: 5000 });

  const published = await mediaPublishWithRetry(igUserId, accessToken, container.id, { tries: 12, delayMs: 8000 });
  log.info('[instagram] reel publicado', { mediaId: published.id });
  return { mediaId: published.id };
}

// Renova o token de longa duração (válido ~60 dias). Deve ser chamado
// periodicamente para o token nunca expirar. Retorna { access_token, expires_in }.
async function refreshLongLivedToken(accessToken) {
  return graphGet('refresh_access_token', { grant_type: 'ig_refresh_token' }, accessToken);
}

// Resolve o ID da conta a usar nas publicações. Com Instagram Login, o id
// correto para os endpoints /media e /media_publish é o `user_id` retornado por
// GET /me — que pode diferir do número exibido no painel. Loga tudo para
// diagnóstico; se /me falhar (token inválido), cai no id do ambiente.
async function resolveIgUserId(accessToken, fallbackId) {
  try {
    const me = await graphGet('me', { fields: 'user_id,username' }, accessToken);
    const id = me.user_id || me.id || fallbackId;
    log.info('[instagram] conta resolvida via /me', {
      username: me.username, user_id: me.user_id, me_id: me.id, envId: fallbackId, usando: id,
    });
    return id;
  } catch (e) {
    log.warn('[instagram] /me falhou — usando id do ambiente', { err: e.message, detail: e.detail });
    return fallbackId;
  }
}

// Token válido com auto-renovação (compartilhado por carrossel e reel). O token
// de longa duração expira em ~60 dias; como os jobs rodam diariamente, renovamos
// quando o guardado passa de 24h e gravamos o novo no Firestore
// (instagram_config/token). O segredo do GitHub é só a semente inicial.
async function getValidToken(db, envToken) {
  let stored = null;
  try { stored = await db.getDoc('instagram_config', 'token'); } catch { /* sem doc ainda */ }
  let token = stored?.access_token || envToken;
  const ageMs = stored?.refreshedAt ? (Date.now() - new Date(stored.refreshedAt).getTime()) : Infinity;

  // ig_refresh_token exige token com >24h; renova no máximo 1×/dia.
  if (ageMs > 24 * 3600 * 1000) {
    try {
      const r = await refreshLongLivedToken(token);
      if (r?.access_token) {
        token = r.access_token;
        await db.setDoc('instagram_config', 'token', {
          access_token: token, refreshedAt: new Date().toISOString(),
          expiresIn: r.expires_in || null,
        }).catch(() => {});
        log.info('[instagram] token renovado', { expiresIn: r.expires_in });
      }
    } catch (e) {
      log.warn('[instagram] falha ao renovar token (seguindo com o atual)', { err: e.message });
    }
  }
  return token;
}

module.exports = { publishCarousel, publishImage, publishReel, refreshLongLivedToken, getValidToken, resolveIgUserId, waitForContainer, mediaPublishWithRetry, isTransientMeta, _graphPost: graphPost, _graphGet: graphGet };
