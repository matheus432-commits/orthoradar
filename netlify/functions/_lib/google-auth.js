// Autenticação de service account para o Firestore — OAuth2 JWT-bearer, sem
// dependências (assinatura RS256 via node:crypto).
//
// MODELO DE ACESSO
//   Com FIREBASE_SERVICE_ACCOUNT configurada, todas as chamadas ao Firestore
//   (interceptadas em _lib.js) levam `Authorization: Bearer <token>` e passam
//   a ser acesso ADMINISTRATIVO via IAM — as security rules deixam de se
//   aplicar e podem ser travadas em `allow read, write: if false`.
//   Sem a variável, o comportamento antigo (anônimo + ?key=) é mantido, o que
//   permite deployar este código ANTES de criar a service account.
//
// FIREBASE_SERVICE_ACCOUNT = JSON da chave da service account (o arquivo
// baixado do console GCP), em texto puro ou base64. A service account precisa
// do papel "Cloud Datastore User" (roles/datastore.user) no projeto.

const crypto = require('crypto');
const https  = require('https');
const http   = require('http');

const TOKEN_SCOPE       = 'https://www.googleapis.com/auth/datastore';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // renova 5 min antes de expirar

let _sa;                              // undefined = ainda não lida; null = ausente/inválida
let _cache = { token: null, exp: 0 };

function loadServiceAccount() {
  if (_sa !== undefined) return _sa;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) { _sa = null; return null; }
  try {
    const jsonStr = raw.trim().startsWith('{')
      ? raw
      : Buffer.from(raw.trim(), 'base64').toString('utf8');
    const sa = JSON.parse(jsonStr);
    if (!sa.client_email || !sa.private_key) {
      throw new Error('client_email/private_key ausentes');
    }
    _sa = sa;
  } catch (err) {
    // Configuração quebrada é erro de operação: melhor falhar alto do que
    // seguir silenciosamente como acesso anônimo.
    throw new Error('[google-auth] FIREBASE_SERVICE_ACCOUNT invalida: ' + err.message);
  }
  return _sa;
}

function isConfigured() {
  return loadServiceAccount() !== null;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function buildJwt(sa, nowSec) {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss:   sa.client_email,
    scope: TOKEN_SCOPE,
    aud:   sa.token_uri || DEFAULT_TOKEN_URI,
    iat:   nowSec,
    exp:   nowSec + 3600,
  }));
  const signingInput = header + '.' + claims;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key);
  return signingInput + '.' + b64url(signature);
}

function postForm(uri, formBody) {
  const url = new URL(uri);
  const mod = url.protocol === 'http:' ? http : https; // http apenas para testes
  const payload = Buffer.from(formBody, 'utf8');
  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: url.hostname,
      port:     url.port || undefined,
      path:     url.pathname + url.search,
      method:   'POST',
      headers: {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': payload.length,
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('token request timeout')));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Retorna um access token válido (cacheado entre invocações no mesmo processo),
// ou null quando a service account não está configurada (modo legado ?key=).
// Se a service account ESTÁ configurada mas a troca de token falha, lança erro:
// com as rules travadas, cair para acesso anônimo só produziria PERMISSION_DENIED.
async function getAccessToken() {
  const sa = loadServiceAccount();
  if (!sa) return null;

  const now = Date.now();
  if (_cache.token && now < _cache.exp - REFRESH_MARGIN_MS) return _cache.token;

  const jwt = buildJwt(sa, Math.floor(now / 1000));
  const form = 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')
             + '&assertion=' + encodeURIComponent(jwt);

  const res = await postForm(sa.token_uri || DEFAULT_TOKEN_URI, form);
  if (res.status !== 200) {
    throw new Error('[google-auth] token exchange falhou: HTTP ' + res.status + ' ' + res.body.slice(0, 200));
  }
  const json = JSON.parse(res.body);
  if (!json.access_token) {
    throw new Error('[google-auth] resposta sem access_token');
  }
  _cache = {
    token: json.access_token,
    exp:   now + (Number(json.expires_in) || 3600) * 1000,
  };
  return _cache.token;
}

// Para testes: limpa o estado do módulo (SA e token cacheados).
function _resetForTests() {
  _sa = undefined;
  _cache = { token: null, exp: 0 };
}

module.exports = { getAccessToken, isConfigured, _resetForTests };
