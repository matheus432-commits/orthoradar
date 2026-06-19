import { createHash } from 'crypto'
import type { SHA256Hash } from '../types/primitives'

export function sha256(input: string): SHA256Hash {
  return createHash('sha256').update(input, 'utf8').digest('hex') as SHA256Hash
}

export function sha256Buffer(input: Buffer): SHA256Hash {
  return createHash('sha256').update(input).digest('hex') as SHA256Hash
}

export function isValidSHA256(hash: string): hash is SHA256Hash {
  return /^[0-9a-f]{64}$/.test(hash)
}
