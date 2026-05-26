// Email open tracker — returns a 1×1 transparent GIF while logging the open event.
// Endpoint: GET /.netlify/functions/track-open?d={digestId}&e={emailHash}

const { recordOpen, logEvent } = require('./_lib/engagement');
const log                      = require('./_lib/logger');

// 1×1 transparent GIF (35 bytes)
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const HEADERS = {
  'Content-Type':  'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma':        'no-cache',
  'Expires':       '0',
};

exports.handler = async (event) => {
  const qs       = event.queryStringParameters || {};
  const digestId = qs.d || null;
  const ehash    = qs.e || null;
  const ip       = event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;

  if (digestId) {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
    const apiKey    = process.env.FIREBASE_API_KEY;

    // Fire-and-wait with timeout — we can't drop the Lambda prematurely
    const timeout = new Promise(resolve => setTimeout(resolve, 1500));
    const tracking = apiKey
      ? Promise.allSettled([
          recordOpen(projectId, apiKey, digestId),
          logEvent(projectId, apiKey, { digestId, email: null, eventType: 'open', ip }),
        ])
      : Promise.resolve();

    await Promise.race([tracking, timeout]);
    log.debug('[track-open] open recorded', { digestId, ehash });
  }

  return {
    statusCode:       200,
    headers:          HEADERS,
    body:             PIXEL.toString('base64'),
    isBase64Encoded:  true,
  };
};
