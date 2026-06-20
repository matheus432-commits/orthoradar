import type { Pool } from 'pg'
import { Decimal } from '@orthofollow/shared'
import type { CMFRepository } from '../cmf/ClinicalMeasurementEngine'

type StoredRow = {
  id:           string
  analysisId:   string
  valueType:    string
  numericValue: string | null
  unit:         string | null
  valuePayload: unknown
  recordedAt:   Date
}

export class PgCMFRepository implements CMFRepository {
  constructor(private pool: Pool) {}

  async insertMeasurement(p: {
    id: string; caseId: string; sessionSnapshotId: string | null; analysisId: string
    protocolId: string; valueType: string; numericValue: Decimal | null
    unit: string | null; valuePayload: unknown; recordedAt: Date; recordedBy: string
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO ca.measurements
         (id, case_id, session_snapshot_id, analysis_id, protocol_id,
          value_type, numeric_value, unit, value_payload, recorded_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.id, p.caseId, p.sessionSnapshotId, p.analysisId, p.protocolId,
       p.valueType, p.numericValue?.toString() ?? null, p.unit,
       JSON.stringify(p.valuePayload), p.recordedAt, p.recordedBy]
    )
  }

  async supersedeMeasurement(caseId: string, analysisId: string, _sessionLabel: string): Promise<void> {
    await this.pool.query(
      `UPDATE ca.measurements SET is_current = FALSE
       WHERE case_id = $1 AND analysis_id = $2 AND is_current = TRUE`,
      [caseId, analysisId]
    )
  }

  async fetchCurrentMeasurements(caseId: string, analysisIds: string[]): Promise<StoredRow[]> {
    const { rows } = await this.pool.query(
      `SELECT id, analysis_id, value_type, numeric_value, unit, value_payload, recorded_at
       FROM ca.measurements
       WHERE case_id = $1 AND analysis_id = ANY($2) AND is_current = TRUE
       ORDER BY recorded_at DESC`,
      [caseId, analysisIds]
    )
    return rows.map((r: Record<string, unknown>) => ({
      id:           r['id'] as string,
      analysisId:   r['analysis_id'] as string,
      valueType:    r['value_type'] as string,
      numericValue: r['numeric_value'] as string | null,
      unit:         r['unit'] as string | null,
      valuePayload: r['value_payload'],
      recordedAt:   r['recorded_at'] as Date,
    }))
  }
}
