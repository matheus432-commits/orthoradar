// Email open tracker — returns a 1×1 transparent GIF while logging the open event.
// Endpoint: GET /.netlify/functions/track-open?d={digestId}&e={emailHash}

const { recordOpen, logEvent, updateStreak } = require('./_lib/engagement');
const log                      = require('./_lib/logger');

// 1×1 transparent GIF (42 bytes)
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const HEADERS = {
  'Content-Type':  'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma':        'no-cache',
  'Expires':       '0',
};

const EHASH_RE = /^[a-f0-9]{16}$/;

exports.handler = async (event) => {
  const qs       = event.queryStringParameters || {};
  const digestId = qs.d || null;
  const rawEhash = (qs.e || '').toLowerCase().trim();
  const ehash    = EHASH_RE.test(rawEhash) ? rawEhash : null;
  const ip       = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;

  if (digestId) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
    const apiKey    = process.env.FIREBASE_API_KEY;

    if (apiKey) {
      // Core tracking: fire-and-wait with timeout — pixel response must not stall
      const timerId = setTimeout(() => {}, 1500);
      const coreTracking = Promise.allSettled([
        recordOpen(projectId, apiKey, digestId),
        logEvent(projectId, apiKey, { digestId, email: null, eventType: 'open', ip }),
      ]);
      await Promise.race([coreTracking, new Promise(r => setTimeout(r, 1500))]);
      clearTimeout(timerId);

      // Streak update is best-effort — runs after pixel is returned, never delays response
      if (ehash) {
        updateStreak(projectId, apiKey, ehash, digestId)
          .catch(err => log.warn('[track-open] updateStreak failed', { ehash, err: err.message }));
      }
    }
    log.debug('[track-open] open recorded', { digestId, ehash });
  }

  return {
    statusCode:       200,
    headers:          HEADERS,
    body:             PIXEL.toString('base64'),
    isBase64Encoded:  true,
  };
};
