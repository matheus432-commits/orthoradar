// Email click tracker — logs the click event then immediately redirects.
// Endpoint: GET /.netlify/functions/track-click?d={digestId}&p={pmid}&e={ehash}&t={base64url(targetUrl)}

const { recordClick, logEvent } = require('./_lib/engagement');
const log                       = require('./_lib/logger');

const FALLBACK_URL = process.env.SITE_URL || 'https://odontofeed.com.br';

// Hostname-based allowlist — immune to prefix-bypass attacks (e.g. evil.pubmed.com, //evil.com)
const ALLOWED_HOSTS = new Set([
  'odontofeed.com.br',
  'pubmed.ncbi.nlm.nih.gov',
  'europepmc.org',
  'doi.org',
]);
try { ALLOWED_HOSTS.add(new URL(FALLBACK_URL).hostname); } catch {}

function safeDecodeTarget(t) {
  if (!t) return FALLBACK_URL;
  try {
    // Strip CRLF before the URL reaches the Location header (header injection defence)
    const url = Buffer.from(t, 'base64url').toString('utf8').replace(/[\r\n]/g, '');
    // Site-relative path — explicitly reject protocol-relative //host URLs
    if (url.startsWith('/') && !url.startsWith('//')) return url;
    // Parse and validate the absolute URL by hostname
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname)) return url;
    if (parsed.protocol === 'http:' && parsed.hostname === 'localhost'
        && process.env.NODE_ENV !== 'production') return url;
    log.warn('[track-click] blocked redirect to external URL', { url: url.slice(0, 100) });
    return FALLBACK_URL;
  } catch (err) {
    log.warn('[track-click] failed to decode target param', { len: t?.length, err: err.message });
    return FALLBACK_URL;
  }
}

exports.handler = async (event) => {
  const qs       = event.queryStringParameters || {};
  const digestId = qs.d || null;
  const pmid     = qs.p || null;
  const target   = safeDecodeTarget(qs.t);
  const ip       = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;

  if (digestId || pmid) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
    const apiKey    = process.env.FIREBASE_API_KEY;

    if (apiKey) {
      const timeout  = new Promise(resolve => setTimeout(resolve, 1500));
      const tracking = Promise.allSettled([
        recordClick(projectId, apiKey, digestId, pmid),
        logEvent(projectId, apiKey, { digestId, pmid, eventType: 'click', ip }),
      ]);
      await Promise.race([tracking, timeout]);
    }
    log.debug('[track-click] click recorded', { digestId, pmid });
  }

  return {
    statusCode: 302,
    headers:    { Location: target, 'Cache-Control': 'no-store' },
    body:       '',
  };
};
