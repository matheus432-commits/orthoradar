import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { makePatientContext } from '@orthofollow/shared'
import type { ClinicalCaseId, SessionLabel, BiologicalSex } from '@orthofollow/shared'
import { getPool } from '../db/pool'
import { requireAuth } from '../auth/requireAuth'

const TriggerExecutionBody = z.object({
  protocolId:       z.string().default('P01'),
  patientBirthDate: z.string(),
  patientSex:       z.enum(['M', 'F', 'UNSPECIFIED']),
  patientEthnicity: z.string().nullable().optional(),
  // startedBy is derived from the authenticated session now; kept optional so
  // older cached frontend bundles that still send it don't fail validation.
  startedBy:        z.string().uuid().optional()
})

export async function executionRoutes(app: FastifyInstance): Promise<void> {

  // POST /cases/:caseId/sessions/:sessionLabel/execute
  // Builds bundle → runs CFR → resolves findings → assembles report
  app.post<{
    Params: { caseId: string; sessionLabel: string }
    Body:   z.infer<typeof TriggerExecutionBody>
  }>('/cases/:caseId/sessions/:sessionLabel/execute', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = TriggerExecutionBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }

    const { caseId, sessionLabel } = req.params
    const body = parsed.data

    try {

    const patientContext = makePatientContext(
      body.patientSex as BiologicalSex,
      body.patientBirthDate,
      body.patientEthnicity ?? null
    )

    // 1. Register workflow start
    const { workflowStateId } = await app.wfEngine.startProtocol({
      caseId,
      protocolId:   body.protocolId,
      sessionLabel,
      startedBy:    req.orthodontist!.id
    })

    // 2. Build measurement bundle
    const bundle = await app.cmf.buildBundle(
      caseId as ClinicalCaseId,
      body.protocolId,
      sessionLabel as SessionLabel,
      patientContext
    )

    if (!bundle.completeness.isComplete) {
      return reply.status(422).send({
        error: {
          code:    'BUNDLE_INCOMPLETE',
          message: 'Protocol bundle is incomplete — missing required measurements',
          missing:  bundle.completeness.missing
        }
      })
    }

    // 3. Execute formulas (CFR)
    const executionReport = await app.cfr.execute(bundle)

    // 4. Resolve findings (CKL)
    const findings = await app.ckl.resolveFindings(executionReport, patientContext)

    // 5. Assemble report (PCF)
    const patientRow = await fetchPatientName(caseId)
    const assembled  = app.assembler.assemble(
      {
        caseId:           caseId as ClinicalCaseId,
        sessionLabel:     sessionLabel as SessionLabel,
        patientName:      patientRow.patientName,
        patientAge:       patientContext.ageAt(new Date()),
        patientSex:       body.patientSex as 'M' | 'F' | 'UNSPECIFIED',
        orthodontistName: patientRow.orthodontistName,
        protocolId:       body.protocolId
      },
      findings
    )

    return reply.status(200).send({
      workflowStateId,
      executionSummary: executionReport.summary,
      findings: findings.map(f => ({
        id:             f.id,
        classification: f.classification,
        severity:       f.severity,
        priority:       f.priority,
        text:           f.selectedTemplate.resolvedText,
        referral:       f.referralRequired
      })),
      report: {
        reportId:      assembled.reportId,
        totalFindings: assembled.totalFindings,
        criticalCount: assembled.criticalCount,
        referralCount: assembled.referralCount,
        contentHash:   assembled.contentHash,
        sections:      assembled.sections.map(s => ({
          key:    s.key,
          title:  s.title,
          count:  s.findings.length
        }))
      }
    })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'execute route error')
      return reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: msg } })
    }
  })

  // GET /cases/:caseId/sessions/:sessionLabel/report/text
  // Returns a rendered text preview of the last assembled report for this session
  app.get<{
    Params:      { caseId: string; sessionLabel: string }
    Querystring: {
      protocolId?:       string
      patientBirthDate?: string
      patientSex?:       string
      patientEthnicity?: string
    }
  }>('/cases/:caseId/sessions/:sessionLabel/report/text', async (req, reply) => {
    const { caseId, sessionLabel } = req.params
    const protocolId     = req.query.protocolId     ?? 'P01'
    const patientBirthDate = req.query.patientBirthDate ?? '1990-01-01'
    const patientSex     = (req.query.patientSex    ?? 'UNSPECIFIED') as BiologicalSex

    const patientContext = makePatientContext(patientSex, patientBirthDate)

    const bundle  = await app.cmf.buildBundle(
      caseId as ClinicalCaseId,
      protocolId,
      sessionLabel as SessionLabel,
      patientContext
    )

    const executionReport = await app.cfr.execute(bundle)
    const findings        = await app.ckl.resolveFindings(executionReport, patientContext)
    const patientRow      = await fetchPatientName(caseId)

    const assembled = app.assembler.assemble(
      {
        caseId:           caseId as ClinicalCaseId,
        sessionLabel:     sessionLabel as SessionLabel,
        patientName:      patientRow.patientName,
        patientAge:       patientContext.ageAt(new Date()),
        patientSex:       patientSex === 'M' || patientSex === 'F' ? patientSex : 'UNSPECIFIED',
        orthodontistName: patientRow.orthodontistName,
        protocolId
      },
      findings
    )

    const text = app.renderer.render(assembled)
    return reply.type('text/plain; charset=utf-8').send(text)
  })
}

// Minimal lookup — production would join patients + cases + orthodontists
async function fetchPatientName(caseId: string): Promise<{ patientName: string; orthodontistName: string }> {
  const pool = getPool()
  const { rows } = await pool.query(
    `SELECT p.given_name || ' ' || p.family_name AS patient_name,
            o.full_name AS orthodontist_name
     FROM ca.clinical_cases cc
     JOIN ca.patients        p ON p.id = cc.patient_id
     JOIN ca.orthodontists   o ON o.id = cc.orthodontist_id
     WHERE cc.id = $1`,
    [caseId]
  )

  if (!rows[0]) return { patientName: 'Paciente', orthodontistName: 'Ortodontista' }
  return { patientName: rows[0].patient_name, orthodontistName: rows[0].orthodontist_name }
}
