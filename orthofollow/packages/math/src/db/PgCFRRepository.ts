import type { Pool } from 'pg'
import type { CFRRepository } from '../cfr/ClinicalFormulaEngine'
import type { ExecutionResult } from '../cfr/types'
import { Decimal } from '@orthofollow/shared'

export class PgCFRRepository implements CFRRepository {
  constructor(private pool: Pool) {}

  async insertExecutionLog(params: {
    id: string; formulaSlug: string; formulaVersion: string; caseId: string;
    sessionLabel: string; inputsHash: string; outputHash: string | null;
    status: string; numericResult: string | null; resultUnit: string | null;
    classification: string | null; resultPayload: unknown; cacheHit: boolean
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO math.execution_logs
         (id, formula_slug, formula_version, case_id, session_label,
          inputs_hash, output_hash, status, numeric_result, result_unit,
          classification, result_payload, cache_hit)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [params.id, params.formulaSlug, params.formulaVersion, params.caseId, params.sessionLabel,
       params.inputsHash, params.outputHash, params.status, params.numericResult, params.resultUnit,
       params.classification, JSON.stringify(params.resultPayload), params.cacheHit]
    )
  }

  async getCacheHit(inputsHash: string, formulaSlug: string): Promise<ExecutionResult | null> {
    const { rows } = await this.pool.query(
      `SELECT numeric_result, result_unit, classification, result_payload
       FROM math.execution_cache WHERE inputs_hash = $1 AND formula_slug = $2`,
      [inputsHash, formulaSlug]
    )
    if (!rows[0]) return null
    const r = rows[0]
    const flags = { cacheHit: true, preconditionSkipped: false, partialInputs: false, usedFallback: false }
    return {
      value:          r.numeric_result !== null ? new Decimal(r.numeric_result) : null,
      unit:           r.result_unit ?? 'NONE',
      precision:      0,
      classification: r.classification ?? null,
      flags
    }
  }

  async setCacheEntry(params: {
    inputsHash: string; formulaSlug: string; formulaVersion: string;
    numericResult: string | null; resultUnit: string | null;
    classification: string | null; resultPayload: unknown
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO math.execution_cache
         (inputs_hash, formula_slug, formula_version, numeric_result, result_unit, classification, result_payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (inputs_hash, formula_slug) DO UPDATE SET
         formula_version=$3, numeric_result=$4, result_unit=$5,
         classification=$6, result_payload=$7, cached_at=now()`,
      [params.inputsHash, params.formulaSlug, params.formulaVersion,
       params.numericResult, params.resultUnit, params.classification,
       JSON.stringify(params.resultPayload)]
    )
  }
}
