import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { PgWorkflowRepository } from '@orthofollow/wf'
import type { ClinicalCaseId, SessionLabel } from '@orthofollow/shared'
import { getPool } from '../db/pool'

const RecalculationBody = z.object({
  protocolId:   z.string().default('P01'),
  requestedBy:  z.string().uuid(),
  reason:       z.string().min(1)
})

export async function workflowRoutes(app: FastifyInstance): Promise<void> {

  // GET /cases/:caseId/sessions/:sessionLabel/workflow
  app.get<{
    Params:      { caseId: string; sessionLabel: string }
    Querystring: { protocolId?: string }
  }>('/cases/:caseId/sessions/:sessionLabel/workflow', async (req, reply) => {
    const { caseId, sessionLabel } = req.params
    const protocolId = req.query.protocolId ?? 'P01'
    const pool = getPool()
    const repo = new PgWorkflowRepository(pool)

    const state = await repo.getState(
      caseId as ClinicalCaseId,
      protocolId,
      sessionLabel as SessionLabel
    )

    if (!state) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Workflow state not found' } })
    }

    return reply.send({ workflowState: state })
  })

  // POST /cases/:caseId/sessions/:sessionLabel/recalculate
  app.post<{
    Params: { caseId: string; sessionLabel: string }
    Body:   z.infer<typeof RecalculationBody>
  }>('/cases/:caseId/sessions/:sessionLabel/recalculate', async (req, reply) => {
    const parsed = RecalculationBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }

    const { caseId, sessionLabel } = req.params
    const body = parsed.data

    await app.wfEngine.requestRecalculation({
      caseId,
      protocolId:   body.protocolId,
      sessionLabel,
      requestedBy:  body.requestedBy,
      reason:       body.reason
    })

    return reply.status(202).send({ status: 'RECALCULATION_QUEUED' })
  })
}
