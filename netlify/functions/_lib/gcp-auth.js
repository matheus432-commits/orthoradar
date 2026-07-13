// Autenticação Google Cloud via service account (JWT RS256 → access token OAuth2).
// Sem dependências: assina o JWT com o módulo `crypto` nativo.
//
// Credencial: env GCP_SERVICE_ACCOUNT_JSON = o JSON da service account (cru ou
// base64). A mesma service account serve para o Cloud Storage (podcast) e,
// futuramente, para blindar o acesso ao Firestore.
//
// Sem a credencial, getAccessToken() retorna null e as camadas acima pulam a
// operação sem quebrar o pipeline.

const crypto = require('crypto');
const { request } = require('../_lib');

const TOKEN_HOST = 'oauth2.googleapis.com';
const TOKEN_PATH = '/token';

function loadServiceAccount() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let json = raw.trim();
  if (!json.startsWith('{')) {
    try { json = Buffer.from(json, 'base64').toString('utf8'); } catch { return null; }
  }
  try { return JSON.parse(json); } catch { return null; }
}

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let _cache = { token: null, exp: 0 };

async function getAccessToken(scope = 'https://www.googleapis.com/auth/devstorage.read_write') {
  const now = Math.floor(Date.now() / 1000);
  if (_cache.token && _cache.exp - 60 > now) return _cache.token;

  const sa = loadServiceAccount();
  if (!sa || !sa.client_email || !sa.private_key) return null;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope,
    aud:   'https://' + TOKEN_HOST + TOKEN_PATH,
    iat:   now,
    exp:   now + 3600,
  }));
  const signingInput = header + '.' + claims;
  const signature = b64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key));
  const assertion = signingInput + '.' + signature;

  const body = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') +
               '&assertion=' + encodeURIComponent(assertion);
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: TOKEN_HOST, path: TOKEN_PATH, method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': buf.length },
  }, buf);
  if (res.status !== 200) return null;

  const tok = JSON.parse(res.body);
  _cache = { token: tok.access_token, exp: now + (tok.expires_in || 3600) };
  return _cache.token;
}

// Bucket do Storage: env GCS_BUCKET ou o padrão do Firebase ({projectId}.appspot.com).
function bucketName() {
  if (process.env.GCS_BUCKET) return process.env.GCS_BUCKET;
  const sa = loadServiceAccount();
  return sa && sa.project_id ? sa.project_id + '.appspot.com' : null;
}

// Exposto para testes: gera o JWT assinado sem trocar por token.
function _buildAssertion(sa, now, scope = 'x') {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://' + TOKEN_HOST + TOKEN_PATH, iat: now, exp: now + 3600 }));
  const signingInput = header + '.' + claims;
  const signature = b64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key));
  return signingInput + '.' + signature;
}

module.exports = { getAccessToken, bucketName, loadServiceAccount, _buildAssertion };
