import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getPool } from '../db/pool'
import { requireAuth } from '../auth/requireAuth'

const PHOTO_KEYS = ['frontal', 'perfil', 'sorriso', 'intrabucal'] as const

const SavePhotoBody = z.object({
  imageData: z.string().min(1),
  points:    z.record(z.string(), z.object({ x: z.number(), y: z.number() })).default({}),
  natWidth:  z.number().nullable().optional(),
  natHeight: z.number().nullable().optional(),
})

export async function photosRoutes(app: FastifyInstance): Promise<void> {

  // PUT /cases/:caseId/sessions/:sessionLabel/photos/:photoKey
  app.put<{
    Params: { caseId: string; sessionLabel: string; photoKey: string }
    Body:   z.infer<typeof SavePhotoBody>
  }>('/cases/:caseId/sessions/:sessionLabel/photos/:photoKey', { preHandler: requireAuth }, async (req, reply) => {
    const { caseId, sessionLabel, photoKey } = req.params
    if (!(PHOTO_KEYS as readonly string[]).includes(photoKey)) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: `Unknown photoKey: ${photoKey}` } })
    }
    const parsed = SavePhotoBody.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: parsed.error.message } })
    }
    const body = parsed.data
    const pool = getPool()

    await pool.query(
      `INSERT INTO ca.case_photos (case_id, session_label, photo_key, image_data, points, nat_width, nat_height, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (case_id, session_label, photo_key) DO UPDATE SET
         image_data = EXCLUDED.image_data, points = EXCLUDED.points,
         nat_width = EXCLUDED.nat_width, nat_height = EXCLUDED.nat_height, updated_at = now()`,
      [caseId, sessionLabel, photoKey, body.imageData, JSON.stringify(body.points), body.natWidth ?? null, body.natHeight ?? null]
    )

    return reply.status(200).send({ saved: true })
  })

  // GET /cases/:caseId/sessions/:sessionLabel/photos
  app.get<{
    Params: { caseId: string; sessionLabel: string }
  }>('/cases/:caseId/sessions/:sessionLabel/photos', async (req, reply) => {
    const { caseId, sessionLabel } = req.params
    const pool = getPool()

    const { rows } = await pool.query(
      `SELECT photo_key AS "photoKey", image_data AS "imageData", points,
              nat_width AS "natWidth", nat_height AS "natHeight"
       FROM ca.case_photos WHERE case_id = $1 AND session_label = $2`,
      [caseId, sessionLabel]
    )

    const photos: Record<string, unknown> = {}
    for (const row of rows) {
      photos[row.photoKey] = {
        imageData: row.imageData,
        points:    row.points,
        natWidth:  row.natWidth,
        natHeight: row.natHeight,
      }
    }

    return reply.status(200).send({ photos })
  })
}
