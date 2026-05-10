const https = require('https');

function request(options, body) {
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

module.exports = { request };
