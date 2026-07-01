import type { ClinicalCaseId, SessionLabel, ISO8601Timestamp, SHA256Hash } from '@orthofollow/shared'
import type { ResolvedFinding } from '@orthofollow/knw'

export type ReportSection =
  | 'SUMMARY'
  | 'FACIAL_ANALYSIS'
  | 'FINDINGS'
  | 'REFERRALS'
  | 'NEXT_STEPS'

export type ReportSectionContent = {
  readonly key:         ReportSection
  readonly title:       string
  readonly paragraphs:  string[]
  readonly findings:    ReportFindingEntry[]
}

export type ReportFindingEntry = {
  readonly findingId:      string
  readonly classification: string
  readonly severity:       string
  readonly priority:       number
  readonly text:           string
  readonly referral:       boolean
}

export type ReportContext = {
  readonly caseId:          ClinicalCaseId
  readonly sessionLabel:    SessionLabel
  readonly patientName:     string
  readonly patientAge:      number
  readonly patientSex:      'M' | 'F' | 'UNSPECIFIED'
  readonly orthodontistName: string
  readonly protocolId:      string
  readonly protocolName:    string
  readonly generatedAt:     ISO8601Timestamp
}

export type AssembledReport = {
  readonly reportId:       string
  readonly context:        ReportContext
  readonly sections:       ReportSectionContent[]
  readonly contentHash:    SHA256Hash
  readonly totalFindings:  number
  readonly criticalCount:  number
  readonly referralCount:  number
  readonly generatedAt:    ISO8601Timestamp
}

export type PCFRepository = {
  insertReport(params: {
    id:              string
    caseId:          string
    protocolId:      string
    sessionLabel:    string
    contentSnapshot: unknown
    contentHash:     string
    status:          'DRAFT' | 'READY'
  }): Promise<void>

  getFindings(caseId: string, sessionLabel: string): Promise<ResolvedFinding[]>
}
