// Email click tracker — logs the click event then immediately redirects.
// Endpoint: GET /.netlify/functions/track-click?d={digestId}&p={pmid}&e={ehash}&t={base64url(targetUrl)}

const { recordClick, logEvent, updateBadges } = require('./_lib/engagement');
const log                       = require('./_lib/logger');

const FALLBACK_URL = process.env.SITE_URL || 'https://odontofeed.com';
const EHASH_RE     = /^[a-f0-9]{16}$/;

// Hostname-based allowlist — immune to prefix-bypass attacks (e.g. evil.pubmed.com, //evil.com)
const ALLOWED_HOSTS = new Set([
  'odontofeed.com',
  'pubmed.ncbi.nlm.nih.gov',
  'europepmc.org',
  'doi.org',
]);
try { ALLOWED_HOSTS.add(new URL(FALLBACK_URL).hostname); } catch { log.warn('[track-click] SITE_URL is not a valid URL, ignoring', { SITE_URL: process.env.SITE_URL }); }

function safeDecodeTarget(t) {
  if (!t) return FALLBACK_URL;
  try {
    // Strip control characters before the URL reaches the Location header (header injection defence)
    const url = Buffer.from(t, 'base64url').toString('utf8').replace(/[\x00-\x1f]/g, '');
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
  const rawEhash = (qs.e || '').toLowerCase().trim();
  const ehash    = EHASH_RE.test(rawEhash) ? rawEhash : null;
  const target   = safeDecodeTarget(qs.t);
  const ip       = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;

  // Decode tema from base64url (th param) — strip control chars and replacement chars
  let tema = null;
  if (qs.th) {
    try {
      const decoded = Buffer.from(qs.th, 'base64url').toString('utf8')
        .replace(/[\x00-\x1f�]/g, '').trim();
      tema = decoded || null;
    } catch { /* ignore malformed */ }
  }

  if (digestId || pmid) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
    const apiKey    = process.env.FIREBASE_API_KEY;

    if (apiKey) {
      // Core tracking: fire-and-wait with timeout — redirect must not stall
      const timerId = setTimeout(() => {}, 1500);
      const coreTracking = Promise.allSettled([
        recordClick(projectId, apiKey, digestId, pmid),
        logEvent(projectId, apiKey, { digestId, pmid, eventType: 'click', ip }),
      ]);
      await Promise.race([coreTracking, new Promise(r => setTimeout(r, 1500))]);
      clearTimeout(timerId);

      // Badge update is best-effort — runs after redirect, never delays response
      if (ehash && tema) {
        updateBadges(projectId, apiKey, ehash, tema, digestId)
          .catch(err => log.warn('[track-click] updateBadges failed', { ehash, err: err.message }));
      }
    }
    log.debug('[track-click] click recorded', { digestId, pmid, tema });
  }

  return {
    statusCode: 302,
    headers:    { Location: target, 'Cache-Control': 'no-store' },
    body:       '',
  };
};
