const https = require('https');

const _SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function corsHeaders(extra) {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Content-Type': 'application/json',
    ..._SEC,
    ...(extra || {})
  };
}

function preflight(methods) {
  return {
    statusCode: 200,
    headers: corsHeaders({
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': methods || 'POST, OPTIONS'
    }),
    body: ''
  };
}

async function _doRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
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

// Retry on network errors (ECONNRESET, timeout, etc.) with exponential backoff.
// Does NOT retry on HTTP error status codes to avoid duplicate side effects (email, writes).
async function request(options, body, _attempt = 0) {
  try {
    return await _doRequest(options, body);
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

module.exports = { request, corsHeaders, preflight };
