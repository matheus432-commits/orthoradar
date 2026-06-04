// Centralized retry and timeout utilities for the digest pipeline.
// Used by daily-digest.js to make every external call resilient.

// ── Timeout guard ─────────────────────────────────────────────────────────────

// Wraps a promise with an explicit deadline. If the promise doesn't settle
// within ms, rejects with a descriptive timeout error.
function withTimeout(promise, ms, label) {
  let timer;
  const race = new Promise((resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Timeout(${ms}ms): ${label}`)),
      ms
    );
    promise.then(
      v  => { clearTimeout(timer); resolve(v); },
      e  => { clearTimeout(timer); reject(e); }
    );
  });
  return race;
}

// ── Error classification ──────────────────────────────────────────────────────

// HTTP status codes that indicate transient infrastructure issues.
const TEMPORARY_HTTP_CODES = new Set([429, 500, 502, 503, 504, 529]);

// Error message fragments that identify transient network failures.
const TEMPORARY_PATTERNS = [
  'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED',
  'timeout', 'socket hang up', 'fetch failed', 'network error',
];

function isTemporaryError(err, httpStatus) {
  if (httpStatus && TEMPORARY_HTTP_CODES.has(httpStatus)) return true;
  if (err?.message) {
    const msg = err.message.toLowerCase();
    if (TEMPORARY_PATTERNS.some(p => msg.includes(p.toLowerCase()))) return true;
  }
  return false;
}

// ── Retry with exponential backoff ────────────────────────────────────────────

// Calls fn(attempt) up to maxAttempts times.
// Retries only on errors classified as temporary by isTemporaryError.
// Permanent errors are thrown immediately without retry.
async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 1000, label = 'op' } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const isLast    = attempt >= maxAttempts - 1;
      const isTemp    = isTemporaryError(err, err.httpStatus);

      if (isLast || !isTemp) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(
        `[retry] ${label} attempt ${attempt + 1}/${maxAttempts} failed, retrying in ${delay}ms: ${err.message}`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

module.exports = { withTimeout, withRetry, isTemporaryError };
