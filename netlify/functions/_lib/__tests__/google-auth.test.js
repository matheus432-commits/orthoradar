// Tests for google-auth.js and the Firestore auth interception in _lib.js.
// Run: node --test netlify/functions/_lib/__tests__/google-auth.test.js

const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const http   = require('http');

const googleAuth = require('../google-auth');

// ── Fixtures: real RSA keypair + local token endpoint ─────────────────────────

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

let tokenServer, tokenUri;
let serverHits = 0;
let lastAssertion = null;
let respondWith = null; // override per-test; null = default success

function startTokenServer() {
  return new Promise(resolve => {
    tokenServer = http.createServer((req, res) => {
      serverHits++;
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        lastAssertion = new URLSearchParams(body).get('assertion');
        const out = respondWith || { status: 200, body: JSON.stringify({ access_token: 'tok_' + serverHits, expires_in: 3600 }) };
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(out.body);
      });
    });
    tokenServer.listen(0, '127.0.0.1', () => {
      tokenUri = `http://127.0.0.1:${tokenServer.address().port}/token`;
      resolve();
    });
  });
}

function makeSAEnv(overrides = {}) {
  return JSON.stringify({
    type:         'service_account',
    client_email: 'fn@projeto.iam.gserviceaccount.com',
    private_key:  privateKey,
    token_uri:    tokenUri,
    ...overrides,
  });
}

beforeEach(async () => {
  if (!tokenServer) await startTokenServer();
  googleAuth._resetForTests();
  serverHits = 0;
  lastAssertion = null;
  respondWith = null;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

after(() => tokenServer && tokenServer.close());

// ── getAccessToken ────────────────────────────────────────────────────────────

describe('getAccessToken', () => {
  test('sem FIREBASE_SERVICE_ACCOUNT → null (modo legado)', async () => {
    assert.equal(await googleAuth.getAccessToken(), null);
    assert.equal(googleAuth.isConfigured(), false);
    assert.equal(serverHits, 0);
  });

  test('com service account → troca JWT por token', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    const token = await googleAuth.getAccessToken();
    assert.equal(token, 'tok_1');
    assert.equal(googleAuth.isConfigured(), true);
  });

  test('JWT assinado é verificável com a chave pública e tem claims corretas', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    await googleAuth.getAccessToken();

    const [h, c, s] = lastAssertion.split('.');
    const verified = crypto.createVerify('RSA-SHA256')
      .update(h + '.' + c)
      .verify(publicKey, Buffer.from(s, 'base64url'));
    assert.equal(verified, true, 'assinatura RS256 válida');

    const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
    assert.equal(claims.iss, 'fn@projeto.iam.gserviceaccount.com');
    assert.equal(claims.scope, 'https://www.googleapis.com/auth/datastore');
    assert.equal(claims.aud, tokenUri);
    assert.ok(claims.exp > claims.iat);
  });

  test('token é cacheado entre chamadas', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    const t1 = await googleAuth.getAccessToken();
    const t2 = await googleAuth.getAccessToken();
    assert.equal(t1, t2);
    assert.equal(serverHits, 1, 'endpoint de token chamado uma única vez');
  });

  test('aceita JSON em base64', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(makeSAEnv()).toString('base64');
    assert.equal(await googleAuth.getAccessToken(), 'tok_1');
  });

  test('JSON inválido → lança (não cai silenciosamente para anônimo)', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = '{broken';
    await assert.rejects(() => googleAuth.getAccessToken(), /FIREBASE_SERVICE_ACCOUNT invalida/);
  });

  test('falha na troca de token → lança (não cai para anônimo)', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    respondWith = { status: 403, body: '{"error":"denied"}' };
    await assert.rejects(() => googleAuth.getAccessToken(), /token exchange falhou: HTTP 403/);
  });
});

// ── _lib.js interception ──────────────────────────────────────────────────────

describe('_withFirestoreAuth', () => {
  test('injeta Bearer em chamadas ao Firestore quando SA configurada', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    const { _withFirestoreAuth } = require('../../_lib');
    const opts = await _withFirestoreAuth({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/x/databases/(default)/documents/cadastros?key=abc',
      headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(opts.headers.Authorization, 'Bearer tok_1');
    assert.equal(opts.headers['Content-Type'], 'application/json', 'headers existentes preservados');
  });

  test('não altera chamadas a outros hosts (Resend, Anthropic, PubMed)', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = makeSAEnv();
    const { _withFirestoreAuth } = require('../../_lib');
    for (const hostname of ['api.resend.com', 'api.anthropic.com', 'eutils.ncbi.nlm.nih.gov']) {
      const opts = await _withFirestoreAuth({ hostname, path: '/x' });
      assert.equal(opts.headers?.Authorization, undefined, hostname + ' sem Bearer');
    }
    assert.equal(serverHits, 0, 'nenhum token buscado para hosts não-Firestore');
  });

  test('sem SA configurada → opções intocadas (modo legado)', async () => {
    const { _withFirestoreAuth } = require('../../_lib');
    const original = { hostname: 'firestore.googleapis.com', path: '/v1/x?key=abc' };
    const opts = await _withFirestoreAuth(original);
    assert.equal(opts.headers?.Authorization, undefined);
  });
});
