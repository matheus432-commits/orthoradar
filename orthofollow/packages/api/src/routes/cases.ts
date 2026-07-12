import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPool } from '../db/pool'
import { requireAuth } from '../auth/requireAuth'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const RegisterCaseBody = z.object({
  patientGivenName:  z.string().min(1),
  patientFamilyName: z.string().min(1),
  patientBirthDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  patientSex:        z.enum(['M', 'F', 'UNSPECIFIED']),
  chiefComplaint:    z.string().optional(),
  sessionLabel:      z.string().default('T0'),
})

export async function casesRoutes(app: FastifyInstance): Promise<void> {

  // POST /api/v1/cases/register
  app.post('/cases/register', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = RegisterCaseBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }
    const body = parsed.data
    const orthodontistId = req.orthodontist!.id
    const pool = getPool()

    const { rows: patRows } = await pool.query<{ id: string }>(
      `INSERT INTO ca.patients (given_name, family_name, birth_date, biological_sex, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [body.patientGivenName, body.patientFamilyName, body.patientBirthDate, body.patientSex, TENANT_ID]
    )
    const patient = patRows[0]
    if (!patient) return reply.status(500).send({ error: { code: 'DB_ERROR', message: 'Patient insert failed' } })

    const { rows: caseRows } = await pool.query<{ id: string }>(
      `INSERT INTO ca.clinical_cases (patient_id, orthodontist_id, chief_complaint)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [patient.id, orthodontistId, body.chiefComplaint ?? null]
    )
    const cas = caseRows[0]
    if (!cas) return reply.status(500).send({ error: { code: 'DB_ERROR', message: 'Case insert failed' } })

    await pool.query(
      `INSERT INTO ca.session_snapshots (case_id, label, session_date)
       VALUES ($1, $2, CURRENT_DATE)`,
      [cas.id, body.sessionLabel]
    )

    return reply.status(201).send({ caseId: cas.id, patientId: patient.id, sessionLabel: body.sessionLabel })
  })

  // GET /api/v1/cases
  app.get('/cases', async (_req, reply) => {
    const pool = getPool()
    const { rows } = await pool.query(
      `SELECT cc.id                                            AS "caseId",
              p.given_name || ' ' || p.family_name            AS "patientName",
              p.birth_date                                     AS "birthDate",
              p.biological_sex                                 AS "sex",
              cc.status,
              cc.chief_complaint                               AS "chiefComplaint",
              cc.opened_at                                     AS "openedAt",
              o.full_name                                      AS "orthodontistName",
              COUNT(DISTINCT ss.label)::int                    AS "sessionCount"
       FROM ca.clinical_cases cc
       JOIN ca.patients        p  ON p.id  = cc.patient_id
       JOIN ca.orthodontists   o  ON o.id  = cc.orthodontist_id
       LEFT JOIN ca.session_snapshots ss ON ss.case_id = cc.id
       GROUP BY cc.id, p.given_name, p.family_name, p.birth_date, p.biological_sex,
                cc.status, cc.chief_complaint, cc.opened_at, o.full_name
       ORDER BY cc.opened_at DESC
       LIMIT 200`
    )
    return reply.send({ cases: rows })
  })
}
