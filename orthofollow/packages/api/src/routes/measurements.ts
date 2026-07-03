import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Decimal } from '@orthofollow/shared'
import type { ClinicalCaseId, SessionLabel, MeasurementValue } from '@orthofollow/shared'
import { requireAuth } from '../auth/requireAuth'

const ScalarSchema = z.object({
  type:         z.enum(['SCALAR_MM','SCALAR_DEGREES','SCALAR_PERCENT','SCALAR_RATIO','SCALAR_INDEX']),
  numericValue: z.string(),   // Decimal serialized as string
  unit:         z.string()
})

const ClassificationSchema = z.object({
  type:           z.literal('CLASSIFICATION'),
  classification: z.string(),
  unit:           z.literal('NONE')
})

const FlagSetSchema = z.object({
  type:  z.literal('FLAG_SET'),
  flags: z.record(z.string(), z.boolean()),
  unit:  z.literal('NONE')
})

const MeasurementValueSchema = z.discriminatedUnion('type', [
  ScalarSchema, ClassificationSchema, FlagSetSchema
])

const RecordMeasurementBody = z.object({
  analysisId:        z.string(),
  value:             MeasurementValueSchema,
  // recordedBy is derived from the authenticated session (req.orthodontist), not
  // trusted from the client, so it's no longer read from the body — kept optional
  // here only so older cached frontend bundles that still send it don't fail validation.
  recordedBy:        z.string().uuid().optional(),
  sessionSnapshotId: z.string().uuid().optional(),
  landmarkRefs:      z.array(z.string()).optional()
})

export async function measurementsRoutes(app: FastifyInstance): Promise<void> {

  // POST /cases/:caseId/sessions/:sessionLabel/measurements
  app.post<{
    Params: { caseId: string; sessionLabel: string }
    Body:   z.infer<typeof RecordMeasurementBody>
  }>('/cases/:caseId/sessions/:sessionLabel/measurements', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = RecordMeasurementBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }

    const { caseId, sessionLabel } = req.params
    const body = parsed.data

    // Coerce Decimal from string for scalar values
    const value = coerceValue(body.value)

    const result = await app.cmf.recordMeasurement({
      caseId:           caseId as ClinicalCaseId,
      sessionLabel:     sessionLabel as SessionLabel,
      analysisId:       body.analysisId,
      value,
      recordedBy:       req.orthodontist!.id,
      ...(body.sessionSnapshotId ? { sessionSnapshotId: body.sessionSnapshotId } : {}),
      ...(body.landmarkRefs      ? { landmarkRefs:      body.landmarkRefs }      : {})
    })

    const status = result.validation.passed ? 201 : 422

    return reply.status(status).send({
      measurementId: result.measurementId || null,
      analysisId:    result.analysisId,
      validation:    result.validation,
      completeness:  result.completeness
    })
  })

  // GET /cases/:caseId/sessions/:sessionLabel/completeness
  app.get<{
    Params:      { caseId: string; sessionLabel: string }
    Querystring: { protocolId?: string }
  }>('/cases/:caseId/sessions/:sessionLabel/completeness', async (req, reply) => {
    const { caseId, sessionLabel } = req.params
    const protocolId = req.query.protocolId ?? 'P01'

    const report = await app.cmf.checkCompleteness(
      caseId as ClinicalCaseId,
      protocolId,
      sessionLabel as SessionLabel
    )

    return reply.send({ completeness: report })
  })

  // GET /cases/:caseId/sessions/:sessionLabel/analyses
  app.get<{
    Params:      { caseId: string; sessionLabel: string }
    Querystring: { protocolId?: string }
  }>('/cases/:caseId/sessions/:sessionLabel/analyses', async (req, reply) => {
    const { caseId, sessionLabel } = req.params
    const protocolId = req.query.protocolId ?? 'P01'

    const statuses = await app.cmf.listAnalysisStatus(
      caseId as ClinicalCaseId,
      protocolId,
      sessionLabel as SessionLabel
    )

    return reply.send({ analyses: statuses })
  })
}

function coerceValue(v: z.infer<typeof MeasurementValueSchema>): MeasurementValue {
  if (v.type === 'CLASSIFICATION' || v.type === 'FLAG_SET') return v as MeasurementValue
  return {
    ...v,
    numericValue: new Decimal(v.numericValue)
  } as MeasurementValue
}
