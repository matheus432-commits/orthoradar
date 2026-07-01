import type {
  ClinicalCaseId, MeasurementId, ExecutionLogId, FindingId,
  ReportVersionId, AnalysisId, FormulaSlug, SessionLabel, ISO8601Timestamp
} from './primitives'
import type { MeasurementUnit } from './measurement'

export type DomainEvent = {
  readonly eventId:   string
  readonly eventType: string
  readonly occurredAt: ISO8601Timestamp
}

export type MeasurementRecorded = DomainEvent & {
  readonly eventType:    'MeasurementRecorded'
  readonly measurementId: MeasurementId
  readonly caseId:        ClinicalCaseId
  readonly analysisId:    AnalysisId
  readonly sessionLabel:  SessionLabel
  readonly value: {
    readonly type:         string
    readonly numericValue: string | null
    readonly unit:         MeasurementUnit | null
    readonly rawPayload:   unknown
  }
  readonly recordedAt:  ISO8601Timestamp
  readonly landmarkIds: string[]
}

export type ProtocolReadyForExecution = DomainEvent & {
  readonly eventType:   'ProtocolReadyForExecution'
  readonly caseId:      ClinicalCaseId
  readonly protocolId:  string
  readonly sessionLabel: SessionLabel
  readonly bundleHash:  string
}

export type FormulaExecuted = DomainEvent & {
  readonly eventType:       'FormulaExecuted'
  readonly executionId:     ExecutionLogId
  readonly formulaRecordId: string
  readonly formulaSlug:     FormulaSlug
  readonly version:         string
  readonly caseId:          ClinicalCaseId
  readonly sessionLabel:    SessionLabel
  readonly status:          'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILURE' | 'PRECONDITION_FAILED'
  readonly outputValue:     string | null
  readonly unit:            MeasurementUnit | null
  readonly classification:  string | null
  readonly flags: {
    readonly cacheHit:            boolean
    readonly preconditionSkipped: boolean
    readonly partialInputs:       boolean
    readonly usedFallback:        boolean
  }
  readonly errorCode:       string | null
}

export type ProtocolExecutionCompleted = DomainEvent & {
  readonly eventType:    'ProtocolExecutionCompleted'
  readonly reportId:     string
  readonly caseId:       ClinicalCaseId
  readonly protocolId:   string
  readonly sessionLabel: SessionLabel
  readonly successCount: number
  readonly failureCount: number
  readonly skippedCount: number
}

export type FindingResolved = DomainEvent & {
  readonly eventType:              'FindingResolved'
  readonly findingId:              FindingId
  readonly caseId:                 ClinicalCaseId
  readonly sessionLabel:           SessionLabel
  readonly knowledgeRecordId:      string
  readonly knowledgeRecordVersion: string
  readonly classification:         string
  readonly severity:               string
  readonly priority:               number
  readonly category:               string
  readonly availableTemplates:     string[]
  readonly referralRequired:       boolean
  readonly referralSpecialty:      string | null
  readonly referralUrgency:        'ROUTINE' | 'PRIORITY' | 'URGENT' | null
}

export type FindingSetCompleted = DomainEvent & {
  readonly eventType:    'FindingSetCompleted'
  readonly caseId:       ClinicalCaseId
  readonly protocolId:   string
  readonly sessionLabel: SessionLabel
  readonly totalFindings: number
  readonly criticalCount: number
  readonly referralCount: number
}

export type ReportVersionReady = DomainEvent & {
  readonly eventType:       'ReportVersionReady'
  readonly reportVersionId: ReportVersionId
  readonly reportId:        string
  readonly caseId:          ClinicalCaseId
  readonly sessionLabel:    SessionLabel
  readonly pdfStorageKey:   string
  readonly contentHash:     string
  readonly fluencyModel:    string
}

export type ClinicalCaseArchived = DomainEvent & {
  readonly eventType: 'ClinicalCaseArchived'
  readonly caseId:    ClinicalCaseId
  readonly archivedBy: string
  readonly reason:    string | null
}
