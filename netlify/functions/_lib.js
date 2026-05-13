const https = require('https');

const _SEC = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function corsHeaders(extra) {
  return {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'https://odontofeed.com',
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

function stripeEncode(params) {
  return Object.entries(params)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}

async function stripeRequest(path, method, params) {
  const body = params ? stripeEncode(params) : null;
  const buf = body ? Buffer.from(body, 'utf8') : null;
  const headers = { 'Authorization': 'Bearer ' + (process.env.STRIPE_SECRET_KEY || '') };
  if (buf) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = buf.length;
  }
  return request({ hostname: 'api.stripe.com', path, method: method || 'GET', headers }, buf);
}

module.exports = { request, corsHeaders, preflight, stripeRequest };
