import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { getPool } from '../db/pool'
import { issueToken } from '../auth/token'
import { requireAuth } from '../auth/requireAuth'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const LoginBody = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})

const RegisterDentistBody = z.object({
  fullName: z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(6),
  cro:      z.string().optional(),
})

export async function authRoutes(app: FastifyInstance): Promise<void> {

  // POST /auth/login
  app.post('/auth/login', async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }
    const { email, password } = parsed.data
    const pool = getPool()
    const { rows } = await pool.query<{ id: string; full_name: string; email: string; password_hash: string | null }>(
      `SELECT id, full_name, email, password_hash FROM ca.orthodontists WHERE email = $1`,
      [email]
    )
    const row = rows[0]
    if (!row || !row.password_hash) {
      return reply.status(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } })
    }
    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) {
      return reply.status(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } })
    }
    const token = issueToken(row.id)
    return reply.status(200).send({
      token,
      orthodontist: { id: row.id, fullName: row.full_name, email: row.email }
    })
  })

  // GET /auth/me — lets the frontend validate a stored token on load
  app.get('/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const pool = getPool()
    const { rows } = await pool.query<{ id: string; full_name: string; email: string }>(
      `SELECT id, full_name, email FROM ca.orthodontists WHERE id = $1`,
      [req.orthodontist!.id]
    )
    const row = rows[0]
    if (!row) return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Conta não encontrada.' } })
    return reply.status(200).send({ orthodontist: { id: row.id, fullName: row.full_name, email: row.email } })
  })

  // POST /auth/dentists — creates a new dentist account. Requires an existing
  // logged-in dentist (any of them can add a colleague) rather than being open
  // to the public, since this app runs on the clinic's local network — except
  // when there are no accounts with a password set yet, so the very first
  // account isn't a chicken-and-egg lockout.
  app.post('/auth/dentists', async (req, reply) => {
    const pool0 = getPool()
    const { rows: countRows } = await pool0.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ca.orthodontists WHERE password_hash IS NOT NULL`
    )
    const hasAnyAccount = Number(countRows[0]?.n ?? '0') > 0
    if (hasAnyAccount) {
      await requireAuth(req, reply)
      if (reply.sent) return
    }

    const parsed = RegisterDentistBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }
    const { fullName, email, password, cro } = parsed.data
    const pool = getPool()
    const passwordHash = await bcrypt.hash(password, 10)
    try {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO ca.orthodontists (full_name, email, cro, tenant_id, password_hash)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [fullName, email, cro ?? null, TENANT_ID, passwordHash]
      )
      return reply.status(201).send({ id: rows[0]!.id, fullName, email })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('duplicate key')) {
        return reply.status(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Já existe uma conta com este e-mail ou CRO.' } })
      }
      throw err
    }
  })
}
