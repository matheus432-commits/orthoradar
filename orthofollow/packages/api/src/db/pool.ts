import { Pool } from 'pg'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env['DATABASE_URL'],
      max:              20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }
  return _pool
}
