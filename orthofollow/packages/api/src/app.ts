import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { healthRoutes }      from './routes/health'
import { measurementsRoutes } from './routes/measurements'
import { executionRoutes }    from './routes/execution'
import { workflowRoutes }     from './routes/workflow'
import { casesRoutes }        from './routes/cases'
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

  // Serve frontend static files
  const webRoot = process.env['WEB_ROOT'] ?? path.join(__dirname, '../../../../apps/web')
  await app.register(fastifyStatic, { root: webRoot, prefix: '/' })

  // Error handler
  app.setErrorHandler(errorHandler as Parameters<typeof app.setErrorHandler>[0])

  // Routes
  const prefix = '/api/v1'
  await app.register(healthRoutes)
  await app.register(measurementsRoutes, { prefix })
  await app.register(executionRoutes,    { prefix })
  await app.register(workflowRoutes,     { prefix })
  await app.register(casesRoutes,        { prefix })

  return app
}
