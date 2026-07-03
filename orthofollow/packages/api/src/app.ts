import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { healthRoutes }      from './routes/health'
import { measurementsRoutes } from './routes/measurements'
import { executionRoutes }    from './routes/execution'
import { workflowRoutes }     from './routes/workflow'
import { casesRoutes }        from './routes/cases'
import { photosRoutes }       from './routes/photos'
import { authRoutes }         from './routes/auth'
import { errorHandler }       from './middleware/errorHandler'
import enginesPlugin          from './plugins/engines'

export async function buildApp() {
  const isDev = process.env['NODE_ENV'] === 'development'
  const app = Fastify({
    logger: isDev
      ? { level: 'debug', transport: { target: 'pino-pretty' } }
      : { level: process.env['LOG_LEVEL'] ?? 'info' },
    // Photo uploads are sent as base64 data URLs (frontal/perfil/sorriso/intrabucal),
    // which comfortably exceed Fastify's 1MB default body limit.
    bodyLimit: 20 * 1024 * 1024
  })

  // Plugins
  await app.register(enginesPlugin)

  // Error handler
  app.setErrorHandler(errorHandler as Parameters<typeof app.setErrorHandler>[0])

  // Routes (must be registered before static so they take precedence)
  const prefix = '/api/v1'
  await app.register(healthRoutes)
  await app.register(authRoutes,         { prefix })
  await app.register(measurementsRoutes, { prefix })
  await app.register(executionRoutes,    { prefix })
  await app.register(workflowRoutes,     { prefix })
  await app.register(casesRoutes,        { prefix })
  await app.register(photosRoutes,       { prefix })

  // Serve frontend static files (registered last so API routes take precedence)
  const webRoot = process.env['WEB_ROOT'] ?? path.join(__dirname, '../../../../apps/web')
  await app.register(fastifyStatic, { root: webRoot, prefix: '/', wildcard: false })

  return app
}
