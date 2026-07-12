import { newUUID, sha256, numericValueOf, Decimal } from '@orthofollow/shared'
import type {
  ClinicalCaseId, SessionLabel, MeasurementValue, PatientContext,
  MeasurementUnit, MeasurementId
} from '@orthofollow/shared'
import type { AnalysisDefinition, AnalysisStatus, ValidationError, BundleEntry, CompletenessReport } from './types'
import type { MeasurementBundle } from '@orthofollow/shared'
import { analysisRegistry } from './registry'

type StoredMeasurement = {
  id:           string
  analysisId:   string
  valueType:    string
  numericValue: string | null
  unit:         string | null
  valuePayload: unknown
  recordedAt:   Date
}

export interface CMFRepository {
  insertMeasurement(p: {
    id:                string
    caseId:            string
    sessionSnapshotId: string | null
    analysisId:        string
    protocolId:        string
    valueType:         string
    numericValue:      Decimal | null
    unit:              string | null
    valuePayload:      unknown
    recordedAt:        Date
    recordedBy:        string
  }): Promise<void>
  supersedeMeasurement(caseId: string, analysisId: string, sessionLabel: string): Promise<void>
  fetchCurrentMeasurements(caseId: string, analysisIds: string[]): Promise<StoredMeasurement[]>
}

export type RecordMeasurementCommand = {
  caseId:             ClinicalCaseId
  sessionLabel:       SessionLabel
  analysisId:         string
  value:              MeasurementValue
  recordedBy:         string
  sessionSnapshotId?: string
  landmarkRefs?:      string[]
}

export type RecordMeasurementResult = {
  measurementId?: string
  analysisId:     string
  validation:     { passed: boolean; errors: ValidationError[] }
  completeness:   CompletenessReport
}

export class ClinicalMeasurementEngine {
  constructor(private repo: CMFRepository) {}

  async recordMeasurement(cmd: RecordMeasurementCommand): Promise<RecordMeasurementResult> {
    const def = analysisRegistry.get(cmd.analysisId)
    if (!def) {
      const completeness = await this.checkCompleteness(cmd.caseId, 'P01', cmd.sessionLabel)
      return {
        analysisId: cmd.analysisId,
        validation: {
          passed: false,
          errors: [{ analysisId: cmd.analysisId, code: 'UNKNOWN_ANALYSIS', message: `Unknown analysisId: ${cmd.analysisId}` }]
        },
        completeness
      }
    }

    const errors = this.validate(def, cmd.value)
    if (errors.length > 0) {
      const completeness = await this.checkCompleteness(cmd.caseId, def.protocolId, cmd.sessionLabel)
      return { analysisId: cmd.analysisId, validation: { passed: false, errors }, completeness }
    }

    const id          = newUUID()
    const numericValue = numericValueOf(cmd.value)
    const unit         = 'unit' in cmd.value ? (cmd.value.unit as string | null) : null

    await this.repo.insertMeasurement({
      id,
      caseId:            cmd.caseId,
      sessionSnapshotId: cmd.sessionSnapshotId ?? null,
      analysisId:        cmd.analysisId,
      protocolId:        def.protocolId,
      valueType:         cmd.value.type,
      numericValue,
      unit,
      valuePayload:      cmd.value,
      recordedAt:        new Date(),
      recordedBy:        cmd.recordedBy,
    })

    const completeness = await this.checkCompleteness(cmd.caseId, def.protocolId, cmd.sessionLabel)
    return {
      measurementId: id,
      analysisId:    cmd.analysisId,
      validation:    { passed: true, errors: [] },
      completeness
    }
  }

  async buildBundle(
    caseId:         ClinicalCaseId,
    protocolId:     string,
    sessionLabel:   SessionLabel,
    patientContext: PatientContext
  ): Promise<MeasurementBundle> {
    const defs       = analysisRegistry.forProtocol(protocolId)
    const analysisIds = defs.map(d => d.id)
    const rows        = await this.repo.fetchCurrentMeasurements(caseId, analysisIds)

    // de-dup: latest measurement per analysisId
    const byAnalysis = new Map<string, StoredMeasurement>()
    for (const row of rows) {
      const existing = byAnalysis.get(row.analysisId)
      if (existing === undefined || row.recordedAt > existing.recordedAt) {
        byAnalysis.set(row.analysisId, row)
      }
    }
    const deduped = [...byAnalysis.values()]

    const entries: BundleEntry[] = deduped.map(r => ({
      analysisId:    r.analysisId,
      measurementId: r.id as MeasurementId,
      value:         r.valuePayload as MeasurementValue,
      numericValue:  r.numericValue !== null ? new Decimal(r.numericValue) : null,
      unit:          (r.unit ?? null) as MeasurementUnit | null,
      recordedAt:    r.recordedAt.toISOString(),
    }))

    const completeness = this.computeCompleteness(protocolId, defs, deduped)
    const inputsHash   = sha256(JSON.stringify(
      entries.map(e => ({ a: e.analysisId, v: e.value }))
    ))

    return {
      bundleId:       newUUID(),
      caseId,
      sessionLabel,
      patientContext,
      protocolId,
      entries,
      completeness,
      inputsHash,
      builtAt:        new Date().toISOString(),
    }
  }

  async checkCompleteness(
    caseId:       ClinicalCaseId,
    protocolId:   string,
    sessionLabel: SessionLabel
  ): Promise<CompletenessReport> {
    const defs = analysisRegistry.forProtocol(protocolId)
    const rows = await this.repo.fetchCurrentMeasurements(caseId, defs.map(d => d.id))
    return this.computeCompleteness(protocolId, defs, rows)
  }

  async listAnalysisStatus(
    caseId:       ClinicalCaseId,
    protocolId:   string,
    sessionLabel: SessionLabel
  ): Promise<AnalysisStatus[]> {
    const defs   = analysisRegistry.forProtocol(protocolId)
    const rows   = await this.repo.fetchCurrentMeasurements(caseId, defs.map(d => d.id))
    const rowMap = new Map(rows.map(r => [r.analysisId, r]))

    return defs.map(def => {
      const row = rowMap.get(def.id)
      if (row === undefined) {
        return {
          analysisId:  def.id,
          displayName: def.displayName,
          state:       (def.isRequired ? 'MISSING_REQUIRED' : 'MISSING_OPTIONAL') as AnalysisStatus['state'],
        }
      }
      return {
        analysisId:  def.id,
        displayName: def.displayName,
        state:       'RECORDED' as const,
        measurement: {
          analysisId:    row.analysisId,
          measurementId: row.id as MeasurementId,
          value:         row.valuePayload as MeasurementValue,
          numericValue:  row.numericValue !== null ? new Decimal(row.numericValue) : null,
          unit:          (row.unit ?? null) as MeasurementUnit | null,
          recordedAt:    row.recordedAt.toISOString(),
        }
      }
    })
  }

  private validate(def: AnalysisDefinition, value: MeasurementValue): ValidationError[] {
    const errors: ValidationError[] = []

    if (value.type === 'CLASSIFICATION') {
      const allowed = def.constraint.allowedValues
      if (allowed !== undefined && !allowed.includes(value.classification)) {
        errors.push({
          analysisId: def.id,
          code:       'INVALID_CLASSIFICATION',
          message:    `Classification '${value.classification}' not allowed. Allowed: ${allowed.join(', ')}`
        })
      }
    } else if (
      value.type === 'SCALAR_MM' || value.type === 'SCALAR_DEGREES' ||
      value.type === 'SCALAR_PERCENT' || value.type === 'SCALAR_RATIO' || value.type === 'SCALAR_INDEX'
    ) {
      const { min, max, minInclusive, maxInclusive } = def.constraint
      const num = value.numericValue
      if (min !== undefined) {
        const violated = minInclusive ? num.lt(min) : num.lte(min)
        if (violated) {
          errors.push({ analysisId: def.id, code: 'VALUE_BELOW_MINIMUM', message: `Value ${num} is below minimum ${min}` })
        }
      }
      if (max !== undefined) {
        const violated = maxInclusive ? num.gt(max) : num.gte(max)
        if (violated) {
          errors.push({ analysisId: def.id, code: 'VALUE_ABOVE_MAXIMUM', message: `Value ${num} is above maximum ${max}` })
        }
      }
    }

    return errors
  }

  private computeCompleteness(
    protocolId: string,
    defs:       AnalysisDefinition[],
    rows:       StoredMeasurement[]
  ): CompletenessReport {
    const presentIds = new Set(rows.map(r => r.analysisId))
    const missing    = defs.filter(d => d.isRequired && !presentIds.has(d.id)).map(d => d.id)
    const optional   = defs.filter(d => !d.isRequired && !presentIds.has(d.id)).map(d => d.id)

    return {
      protocolId,
      total:      defs.length,
      present:    presentIds.size,
      missing,
      optional,
      invalid:    [],
      isComplete: missing.length === 0,
    }
  }
}
