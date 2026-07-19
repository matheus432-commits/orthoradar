// Regressão de segurança: uploadMp3 NUNCA pode devolver o token de acesso OAuth
// (ya29...) — só o UUID de download público do Firebase. O bug real expunha a
// credencial da conta de serviço no feed RSS e quebrava os áudios em ~1h.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const STORAGE = path.join(__dirname, '..', 'storage.js');

const LIB_DIR = path.dirname(STORAGE);                 // netlify/functions/_lib
const GCP_AUTH = path.join(LIB_DIR, 'gcp-auth.js');
const LIB_JS   = path.join(LIB_DIR, '..', '_lib.js');  // netlify/functions/_lib.js

function loadStorageWith(getAccessTokenImpl, bucket) {
  // Injeta mocks de gcp-auth e _lib no require.cache antes de carregar storage.js
  require.cache[GCP_AUTH] = {
    id: GCP_AUTH, filename: GCP_AUTH, loaded: true,
    exports: { getAccessToken: getAccessTokenImpl, bucketName: () => bucket },
  };
  require.cache[LIB_JS] = {
    id: LIB_JS, filename: LIB_JS, loaded: true,
    exports: { request: async () => ({ status: 200, body: '{}' }) },
  };
  delete require.cache[require.resolve(STORAGE)];
  return require(STORAGE);
}

describe('uploadMp3 — token de download seguro', () => {
  test('devolve UUID de download, NUNCA o access token OAuth', async () => {
    const ACCESS = 'ya29.c0AZ4bNpaceefSENSIVEL_NAO_PODE_VAZAR';
    const storage = loadStorageWith(async () => ACCESS, 'orthoradar.firebasestorage.app');

    const r = await storage.uploadMp3('podcasts/Ortodontia/2026-07-19/ep1.mp3', Buffer.from('audio'));

    assert.equal(r.ok, true);
    assert.ok(r.downloadToken, 'deve retornar downloadToken');
    assert.notEqual(r.downloadToken, ACCESS, 'downloadToken não pode ser o access token');
    assert.ok(!String(r.downloadToken).startsWith('ya29.'), 'downloadToken não pode ter prefixo ya29.');
    // UUID v4
    assert.match(r.downloadToken, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    // O access token não pode aparecer em lugar nenhum do retorno (nem na url)
    assert.ok(!JSON.stringify(r).includes(ACCESS), 'access token não pode vazar no retorno');
    assert.ok(r.url.includes('token=' + r.downloadToken), 'a URL usa o downloadToken');
    assert.equal(r.token, undefined, 'campo token (ambíguo) não deve mais existir');
  });

  test('respeita um downloadToken fornecido e o usa na URL', async () => {
    const storage = loadStorageWith(async () => 'ya29.qualquer', 'b');
    const uuid = '11111111-2222-4333-8444-555555555555';
    const r = await storage.uploadMp3('p/x.mp3', Buffer.from('a'), uuid);
    assert.equal(r.downloadToken, uuid);
    assert.ok(r.url.includes('token=' + uuid));
  });

  test('sem credenciais → skipped, sem vazar nada', async () => {
    const storage = loadStorageWith(async () => null, 'b');
    const r = await storage.uploadMp3('p/x.mp3', Buffer.from('a'));
    assert.equal(r.skipped, true);
    assert.equal(r.reason, 'no_credentials');
    assert.equal(r.downloadToken, undefined);
  });
});
