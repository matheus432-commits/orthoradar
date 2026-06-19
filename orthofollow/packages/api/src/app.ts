import Fastify from 'fastify'
import { healthRoutes }      from './routes/health'
import { measurementsRoutes } from './routes/measurements'
import { executionRoutes }    from './routes/execution'
import { workflowRoutes }     from './routes/workflow'
import { errorHandler }       from './middleware/errorHandler'
import enginesPlugin          from './plugins/engines'

export async function buildApp() {
  const isDev = process.env['NODE_ENV'] === 'development'
  const app = Fastify({
    logger: isDev
      ? { level: 'debug', transport: { target: 'pino-pretty' } }
      : { level: process.env['LOG_LEVEL'] ?? 'info' }
  })

  // Plugins
  await app.register(enginesPlugin)

  // Error handler
  app.setErrorHandler(errorHandler as Parameters<typeof app.setErrorHandler>[0])

  // Routes
  const prefix = '/api/v1'
  await app.register(healthRoutes)
  await app.register(measurementsRoutes, { prefix })
  await app.register(executionRoutes,    { prefix })
  await app.register(workflowRoutes,     { prefix })

  return app
}
