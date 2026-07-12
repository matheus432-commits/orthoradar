import type { Decimal } from './primitives'
import type { MeasurementUnit } from './measurement'
import type { ClinicalCaseId, SessionLabel, FormulaSlug, ISO8601Timestamp } from './primitives'

export type ExecutionFlags = {
  readonly cacheHit:            boolean
  readonly preconditionSkipped: boolean
  readonly partialInputs:       boolean
  readonly usedFallback:        boolean
}

export type ExecutionResult = {
  readonly value:          Decimal | null
  readonly unit:           MeasurementUnit
  readonly precision:      number
  readonly uncertainty?:   Decimal
  readonly classification: string | null
  readonly flags:          ExecutionFlags
  readonly errorCode?:     string
  readonly errorDesc?:     string
}

export type ExecutionReport = {
  readonly reportId:        string
  readonly bundleId:        string
  readonly caseId:          ClinicalCaseId
  readonly sessionLabel:    SessionLabel
  readonly protocolId:      string
  readonly results:         Map<FormulaSlug, ExecutionResult>
  readonly executionLogIds: string[]
  readonly summary: {
    readonly total:      number
    readonly success:    number
    readonly failure:    number
    readonly skipped:    number
    readonly cacheHits:  number
    readonly durationMs: number
  }
  readonly completedAt: ISO8601Timestamp
}
