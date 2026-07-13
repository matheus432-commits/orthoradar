const https = require('https');

async function _doRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.setTimeout(15000, () => {
      // NUNCA logar a query string — pode conter ?key=<API_KEY> (Firestore/TTS).
      const safePath = (options.path || '').split('?')[0].substring(0, 80);
      req.destroy(new Error('Request timeout: ' + (options.hostname || '') + safePath));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Retry on network errors (ECONNRESET, timeout, etc.) with exponential backoff.
// Does NOT retry on HTTP error status codes to avoid duplicate side effects (email, writes).
// maxRetries=0 desativa o retry — necessário para operações NÃO idempotentes na
// cobrança (ex.: Cloud TTS cobra cada tentativa mesmo que a resposta se perca).
async function request(options, body, _attempt = 0, maxRetries = 2) {
  try {
    return await _doRequest(options, body);
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

module.exports = { request };
