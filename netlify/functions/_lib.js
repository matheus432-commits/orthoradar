const https = require('https');
const http  = require('http');
const { getAccessToken, isConfigured } = require('./_lib/google-auth');

const FIRESTORE_HOST = 'firestore.googleapis.com';
let _authModeLogged = false;

// Timeout padrão POR HOST. Firestore/PubMed respondem rápido (15s basta), mas a
// geração da Anthropic (roteiros do podcast e resumo_completo com Sonnet) leva
// 20-40s+ e era MORTA aos 15s — causa-raiz do incidente 24/07: praticamente
// TODA chamada de resumo_completo dava "Request timeout" (parecia instabilidade
// da API, mas era o nosso próprio teto curto), deixando artigos sem resumo e
// especialidades sem podcast. Chamadas generativas ganham um teto largo; ainda
// pode ser sobrescrito por timeoutMs explícito na própria chamada.
function _defaultTimeoutMs(options) {
  if (options.timeoutMs) return options.timeoutMs;
  if (options.hostname === 'api.anthropic.com') return 180000; // 3 min p/ geração
  return 15000;
}

async function _doRequest(options, body) {
  const mod = options.protocol === 'http:' ? http : https; // http apenas para testes
  return new Promise((resolve, reject) => {
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    // timeoutMs configurável por chamada; senão, teto padrão por host (acima).
    req.setTimeout(_defaultTimeoutMs(options), () => {
      // NUNCA logar a query string — pode conter ?key=<API_KEY> (Firestore/TTS).
      const safePath = (options.path || '').split('?')[0].substring(0, 80);
      req.destroy(new Error('Request timeout: ' + (options.hostname || '') + safePath));
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
// maxRetries=0 desativa o retry — necessário para operações NÃO idempotentes na
// cobrança (ex.: Cloud TTS cobra cada tentativa mesmo que a resposta se perca).
async function request(options, body, _attempt = 0, maxRetries = 2) {
  try {
    const authed = await _withFirestoreAuth(options);
    return await _doRequest(authed, body);
  } catch (err) {
    if (_attempt < maxRetries) {
      const delay = 1000 * Math.pow(2, _attempt);
      console.warn(`[_lib] Retry ${_attempt + 1}/${maxRetries} after ${delay}ms (${(options.hostname || '')}): ${err.message.substring(0, 80)}`);
      await new Promise(r => setTimeout(r, delay));
      return request(options, body, _attempt + 1, maxRetries);
    }
    throw err;
  }
}

module.exports = { request, firestoreAuthConfigured: isConfigured, _withFirestoreAuth, _defaultTimeoutMs };
