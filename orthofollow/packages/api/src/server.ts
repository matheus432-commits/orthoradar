import { buildApp } from './app'

const PORT = Number(process.env['PORT'] ?? 3000)
const HOST = process.env['HOST'] ?? '0.0.0.0'

buildApp().then(async app => {
  try {
    await app.listen({ port: PORT, host: HOST })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}).catch(err => {
  console.error(err)
  process.exit(1)
})
