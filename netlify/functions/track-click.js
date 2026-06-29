// Email click tracker — logs the click event then immediately redirects.
// Endpoint: GET /.netlify/functions/track-click?d={digestId}&p={pmid}&e={ehash}&t={base64url(targetUrl)}

const { recordClick, logEvent } = require('./_lib/engagement');
const log                       = require('./_lib/logger');

const FALLBACK_URL = process.env.SITE_URL || 'https://odontofeed.com.br';

function safeDecodeTarget(t) {
  if (!t) return FALLBACK_URL;
  try {
    const url = Buffer.from(t, 'base64url').toString('utf8');
    // Only allow relative paths or same-origin URLs to prevent open redirect
    const allowed = [
      FALLBACK_URL,
      'https://odontofeed.com.br',
      'http://localhost',
      'https://pubmed.ncbi.nlm.nih.gov',
      'https://europepmc.org',
      'https://doi.org',
    ];
    if (url.startsWith('/') || allowed.some(base => url.startsWith(base))) {
      return url;
    }
    log.warn('[track-click] blocked redirect to external URL', { url: url.slice(0, 100) });
    return FALLBACK_URL;
  } catch {
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
