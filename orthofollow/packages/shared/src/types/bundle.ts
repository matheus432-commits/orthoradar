import type {
  AnalysisId, MeasurementId, ISO8601Timestamp, SHA256Hash,
  ClinicalCaseId, SessionLabel, PatientContext, ProtocolId
} from './primitives'
import type { MeasurementValue, MeasurementUnit } from './measurement'
import type { Decimal } from './primitives'

export type BundleEntry = {
  readonly analysisId:    AnalysisId
  readonly measurementId: MeasurementId
  readonly value:         MeasurementValue
  readonly numericValue:  Decimal | null
  readonly unit:          MeasurementUnit | null
  readonly recordedAt:    ISO8601Timestamp
}

export type CompletenessReport = {
  readonly protocolId:  ProtocolId
  readonly total:       number
  readonly present:     number
  readonly missing:     AnalysisId[]
  readonly optional:    AnalysisId[]
  readonly invalid:     unknown[]
  readonly isComplete:  boolean
}

export type MeasurementBundle = {
  readonly bundleId:       string
  readonly caseId:         ClinicalCaseId
  readonly sessionLabel:   SessionLabel
  readonly patientContext: PatientContext
  readonly protocolId:     ProtocolId
  readonly entries:        BundleEntry[]
  readonly completeness:   CompletenessReport
  readonly inputsHash:     SHA256Hash
  readonly builtAt:        ISO8601Timestamp
}
