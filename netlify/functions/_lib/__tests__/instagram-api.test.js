// Tests do cliente de publicação do Instagram (mockando o helper de rede).
// Run: node --test netlify/functions/_lib/__tests__/instagram-api.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const lib = require('../../_lib');
const apiPath = require.resolve('../instagram-api');

// Instala um mock de rede e devolve a lista de chamadas + a API recarregada.
function loadWithMock(responder) {
  const calls = [];
  lib.request = async (options, body) => {
    const bodyStr = body ? body.toString('utf8') : '';
    calls.push({ path: options.path, method: options.method, body: bodyStr });
    return responder({ path: options.path, method: options.method, body: bodyStr }) ||
      { status: 200, body: '{}' };
  };
  delete require.cache[apiPath];
  const api = require('../instagram-api');
  return { api, calls };
}

describe('instagram-api — publishCarousel', () => {
  beforeEach(() => { /* cada teste instala seu mock */ });

  test('cria 1 container por imagem, depois o carrossel, depois publica', async () => {
    let childSeq = 0;
    const { api, calls } = loadWithMock(({ path, method, body }) => {
      if (method === 'POST' && path.includes('/media_publish')) return { status: 200, body: JSON.stringify({ id: 'MEDIA_FINAL' }) };
      if (method === 'POST' && /\/media$/.test(path) && body.includes('is_carousel_item')) return { status: 200, body: JSON.stringify({ id: 'child_' + (++childSeq) }) };
      if (method === 'POST' && /\/media$/.test(path) && body.includes('CAROUSEL')) return { status: 200, body: JSON.stringify({ id: 'CAROUSEL_1' }) };
      if (method === 'GET') return { status: 200, body: JSON.stringify({ status_code: 'FINISHED' }) };
      return { status: 200, body: '{}' };
    });

    const res = await api.publishCarousel('IGID', 'TOKEN', ['http://a/1.jpg', 'http://a/2.jpg', 'http://a/3.jpg'], 'legenda');
    assert.equal(res.mediaId, 'MEDIA_FINAL');
    assert.equal(res.slides, 3);

    // 3 filhos (is_carousel_item) + 1 carrossel + 1 publish = 5 POSTs de escrita
    const posts = calls.filter(c => c.method === 'POST');
    assert.equal(posts.filter(c => c.body.includes('is_carousel_item')).length, 3);
    assert.equal(posts.filter(c => c.body.includes('media_type=CAROUSEL')).length, 1);
    assert.equal(posts.filter(c => c.path.includes('media_publish')).length, 1);
    // a legenda vai no container do carrossel
    assert.ok(posts.find(c => c.body.includes('media_type=CAROUSEL')).body.includes('legenda'));
    // token presente nas chamadas
    assert.ok(posts.every(c => c.body.includes('access_token=TOKEN')));
  });

  test('exige ao menos 2 imagens', async () => {
    const { api } = loadWithMock(() => ({ status: 200, body: '{}' }));
    await assert.rejects(() => api.publishCarousel('IGID', 'TOKEN', ['http://a/1.jpg'], 'x'), /ao menos 2/);
  });

  test('propaga erro da API (status >= 400)', async () => {
    const { api } = loadWithMock(({ body }) => {
      if (body.includes('is_carousel_item')) return { status: 400, body: JSON.stringify({ error: { message: 'imagem inválida' } }) };
      return { status: 200, body: '{}' };
    });
    await assert.rejects(() => api.publishCarousel('IGID', 'TOKEN', ['http://a/1.jpg', 'http://a/2.jpg'], 'x'), /imagem inválida/);
  });

  test('publishReel: container REELS com video_url + espera FINISHED + publica', async () => {
    const { api, calls } = loadWithMock(({ path, method }) => {
      if (method === 'POST' && path.includes('/media_publish')) return { status: 200, body: JSON.stringify({ id: 'REEL_1' }) };
      if (method === 'POST') return { status: 200, body: JSON.stringify({ id: 'CR_1' }) };
      if (method === 'GET') return { status: 200, body: JSON.stringify({ status_code: 'FINISHED' }) };
      return { status: 200, body: '{}' };
    });
    const res = await api.publishReel('IGID', 'TOKEN', 'http://a/v.mp4', 'legenda reel');
    assert.equal(res.mediaId, 'REEL_1');
    const create = calls.find(c => c.method === 'POST' && !c.path.includes('media_publish'));
    assert.ok(create.body.includes('media_type=REELS'));
    assert.ok(create.body.includes(encodeURIComponent('http://a/v.mp4')));
    assert.ok(create.body.includes('legenda+reel') || create.body.includes('legenda%20reel'));
  });

  test('getValidToken: renova quando o guardado tem >24h e persiste o novo', async () => {
    const { api, calls } = loadWithMock(({ path, method }) => {
      if (method === 'GET' && path.includes('refresh_access_token')) {
        return { status: 200, body: JSON.stringify({ access_token: 'TOK_NOVO', expires_in: 5183944 }) };
      }
      return { status: 200, body: '{}' };
    });
    const sets = [];
    const db = {
      async getDoc() { return { access_token: 'TOK_VELHO', refreshedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString() }; },
      async setDoc(coll, id, val) { sets.push({ coll, id, val }); },
    };
    const tok = await api.getValidToken(db, 'TOK_ENV');
    assert.equal(tok, 'TOK_NOVO');
    assert.equal(sets[0].coll, 'instagram_config');
    assert.equal(sets[0].val.access_token, 'TOK_NOVO');
    assert.ok(calls.some(c => c.path.includes('refresh_access_token')));
  });

  test('getValidToken: token recente (<24h) não renova', async () => {
    const { api, calls } = loadWithMock(() => ({ status: 200, body: '{}' }));
    const db = {
      async getDoc() { return { access_token: 'TOK_ATUAL', refreshedAt: new Date().toISOString() }; },
      async setDoc() { throw new Error('não deveria gravar'); },
    };
    const tok = await api.getValidToken(db, 'TOK_ENV');
    assert.equal(tok, 'TOK_ATUAL');
    assert.equal(calls.length, 0);
  });

  test('publishImage: cria container e publica', async () => {
    const { api, calls } = loadWithMock(({ path, method }) => {
      if (method === 'POST' && path.includes('/media_publish')) return { status: 200, body: JSON.stringify({ id: 'M1' }) };
      if (method === 'POST') return { status: 200, body: JSON.stringify({ id: 'C1' }) };
      if (method === 'GET') return { status: 200, body: JSON.stringify({ status_code: 'FINISHED' }) };
      return { status: 200, body: '{}' };
    });
    const res = await api.publishImage('IGID', 'TOKEN', 'http://a/x.jpg', 'cap');
    assert.equal(res.mediaId, 'M1');
    assert.ok(calls.some(c => c.path.includes('media_publish')));
  });
});
