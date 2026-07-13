const https = require('https');
const http  = require('http');
const { getAccessToken, isConfigured } = require('./_lib/google-auth');

const FIRESTORE_HOST = 'firestore.googleapis.com';
let _authModeLogged = false;

async function _doRequest(options, body) {
  const mod = options.protocol === 'http:' ? http : https; // http apenas para testes
  return new Promise((resolve, reject) => {
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error('Request timeout: ' + (options.hostname || '') + (options.path || '').substring(0, 60)));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Toda chamada ao Firestore passa por aqui — ponto único de autenticação.
// Com FIREBASE_SERVICE_ACCOUNT configurada, injeta Authorization: Bearer
// (acesso administrativo via IAM; as security rules podem ficar travadas em
// deny-all). Sem ela, mantém o modo legado anônimo com ?key= na URL.
async function _withFirestoreAuth(options) {
  if (options.hostname !== FIRESTORE_HOST) return options;

  const token = await getAccessToken(); // null = service account não configurada
  if (!_authModeLogged) {
    _authModeLogged = true;
    console.log(token
      ? '[_lib] Firestore auth: service account (Bearer)'
      : '[_lib] Firestore auth: API key anonima (legado) — configure FIREBASE_SERVICE_ACCOUNT');
  }
  if (!token) return options;

  return {
    ...options,
    headers: { ...(options.headers || {}), Authorization: 'Bearer ' + token },
  };
}

// Retry on network errors (ECONNRESET, timeout, etc.) with exponential backoff.
// Does NOT retry on HTTP error status codes to avoid duplicate side effects (email, writes).
async function request(options, body, _attempt = 0) {
  try {
    const authed = await _withFirestoreAuth(options);
    return await _doRequest(authed, body);
  } catch (err) {
    if (_attempt < 2) {
      const delay = 1000 * Math.pow(2, _attempt);
      console.warn(`[_lib] Retry ${_attempt + 1}/2 after ${delay}ms (${(options.hostname || '')}): ${err.message.substring(0, 80)}`);
      await new Promise(r => setTimeout(r, delay));
      return request(options, body, _attempt + 1);
    }
    throw err;
  }
}

module.exports = { request, firestoreAuthConfigured: isConfigured, _withFirestoreAuth };
