const { corsHeaders, preflight } = require('./_lib');

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight('GET, OPTIONS');
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  if (!publicKey) return { statusCode: 503, headers, body: JSON.stringify({ error: 'Push notifications not configured' }) };

  return { statusCode: 200, headers, body: JSON.stringify({ publicKey }) };
};
