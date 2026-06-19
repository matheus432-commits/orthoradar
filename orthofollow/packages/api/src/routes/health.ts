import type { FastifyInstance } from 'fastify'
import { getPool } from '../db/pool'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    try {
      await getPool().query('SELECT 1')
      return reply.send({ status: 'ok', db: 'connected', ts: new Date().toISOString() })
    } catch {
      return reply.status(503).send({ status: 'error', db: 'disconnected' })
    }
  })

  app.get('/health/ready', async (_req, reply) => {
    return reply.send({ status: 'ready' })
  })
}
