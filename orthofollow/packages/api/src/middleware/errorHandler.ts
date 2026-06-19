import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'

export function errorHandler(
  error: FastifyError,
  _req: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode ?? 500
  const message    = statusCode < 500 ? error.message : 'Internal server error'

  if (statusCode >= 500) {
    reply.log.error(error)
  }

  reply.status(statusCode).send({
    error: {
      code:    error.code ?? 'INTERNAL_ERROR',
      message,
      ...(process.env['NODE_ENV'] === 'development' && statusCode >= 500 ? { detail: error.message } : {})
    }
  })
}
