import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyToken } from './token'

export interface AuthedOrthodontist {
  id: string
}

declare module 'fastify' {
  interface FastifyRequest {
    orthodontist?: AuthedOrthodontist
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  const claims = token ? verifyToken(token) : null
  if (!claims) {
    await reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Login necessário.' } })
    return
  }
  req.orthodontist = { id: claims.orthodontistId }
}
