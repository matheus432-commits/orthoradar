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
    throw err;
  }
  return json;
}

// Espera um container ficar pronto (status_code === 'FINISHED'). A Meta baixa e
// processa a imagem de forma assíncrona; publicar antes da hora dá erro.
async function waitForContainer(containerId, accessToken, { tries = 20, delayMs = 3000 } = {}) {
  for (let i = 0; i < tries; i++) {
    const { status_code } = await graphGet(containerId, { fields: 'status_code' }, accessToken);
    if (status_code === 'FINISHED') return true;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new Error(`Container ${containerId} falhou com status ${status_code}`);
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error(`Container ${containerId} não ficou pronto a tempo`);
}

// Publica um CARROSSEL. imageUrls: array de URLs públicas (JPEG). caption: texto.
// Retorna { mediaId }.
async function publishCarousel(igUserId, accessToken, imageUrls, caption) {
  if (!Array.isArray(imageUrls) || imageUrls.length < 2) {
    throw new Error('Carrossel exige ao menos 2 imagens');
  }
  if (imageUrls.length > 10) imageUrls = imageUrls.slice(0, 10);

  // 1. Containers filhos (um por imagem).
  const childIds = [];
  for (const url of imageUrls) {
    const child = await graphPost(`${igUserId}/media`, {
      image_url: url,
      is_carousel_item: 'true',
    }, accessToken);
    if (!child.id) throw new Error('Falha ao criar container filho');
    await waitForContainer(child.id, accessToken);
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

  // 3. Publicar.
  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: carousel.id,
  }, accessToken);
  if (!published.id) throw new Error('Falha ao publicar o carrossel');

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

  const published = await graphPost(`${igUserId}/media_publish`, {
    creation_id: container.id,
  }, accessToken);
  if (!published.id) throw new Error('Falha ao publicar a imagem');

  log.info('[instagram] imagem publicada', { mediaId: published.id });
  return { mediaId: published.id };
}

// Renova o token de longa duração (válido ~60 dias). Deve ser chamado
// periodicamente para o token nunca expirar. Retorna { access_token, expires_in }.
async function refreshLongLivedToken(accessToken) {
  return graphGet('refresh_access_token', { grant_type: 'ig_refresh_token' }, accessToken);
}

module.exports = { publishCarousel, publishImage, refreshLongLivedToken, waitForContainer, _graphPost: graphPost, _graphGet: graphGet };
