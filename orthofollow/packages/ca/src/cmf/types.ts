import type {
  AnalysisId, ProtocolId, FormulaSlug,
  MeasurementValueType, MeasurementUnit,
  BundleEntry, MeasurementBundle, CompletenessReport,
  Decimal
} from '@orthofollow/shared'

export type { BundleEntry, MeasurementBundle, CompletenessReport }

export type DomainConstraint = {
  readonly min?:           Decimal
  readonly max?:           Decimal
  readonly minInclusive:   boolean
  readonly maxInclusive:   boolean
  readonly allowedValues?: string[]
  readonly customRule?:    string
}

export type AnalysisDefinition = {
  readonly id:              AnalysisId
  readonly protocolId:      ProtocolId
  readonly displayName:     string
  readonly valueType:       MeasurementValueType
  readonly unit:            MeasurementUnit
  readonly constraint:      DomainConstraint
  readonly isRequired:      boolean
  readonly conditionalOn?:  AnalysisId[]
  readonly landmarkRefs?:   string[]
  readonly formulaInputFor: FormulaSlug[]
}

export type ValidationError = {
  readonly analysisId: AnalysisId
  readonly code:       string
  readonly message:    string
}

export type AnalysisStatus = {
  readonly analysisId:   AnalysisId
  readonly displayName:  string
  readonly state:        'RECORDED' | 'MISSING_REQUIRED' | 'MISSING_OPTIONAL' | 'INVALID'
  readonly measurement?: BundleEntry
  readonly error?:       ValidationError
}
