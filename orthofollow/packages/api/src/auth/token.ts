import { createHmac, timingSafeEqual } from 'node:crypto'

// Minimal HMAC-signed session token (not a full JWT library) — appropriate for a
// small clinic's internal-network app. Payload is `${orthodontistId}.${expiresAtMs}`,
// signed with AUTH_SECRET so a token can't be forged or its expiry extended without
// the secret. Set AUTH_SECRET in production; the fallback is fine for local/dev use
// only.
const SECRET = process.env['AUTH_SECRET'] ?? 'orthofollow-dev-secret-change-me'
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('base64url')
}

export function issueToken(orthodontistId: string): string {
  const payload = `${orthodontistId}.${Date.now() + TOKEN_TTL_MS}`
  const sig = sign(payload)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

export function verifyToken(token: string): { orthodontistId: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const parts = decoded.split('.')
    if (parts.length !== 3) return null
    const [orthodontistId, expiresAtStr, sig] = parts as [string, string, string]
    const expected = sign(`${orthodontistId}.${expiresAtStr}`)
    const sigBuf = Buffer.from(sig)
    const expectedBuf = Buffer.from(expected)
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null
    if (Date.now() > Number(expiresAtStr)) return null
    return { orthodontistId }
  } catch {
    return null
  }
}
