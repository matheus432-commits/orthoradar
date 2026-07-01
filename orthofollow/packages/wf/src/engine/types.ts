import type { ClinicalCaseId, SessionLabel } from '@orthofollow/shared'

export type WorkflowStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'AWAITING_INPUT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type WorkflowProgress = {
  MEASUREMENTS_STARTED?:  { at: string }
  BUNDLE_BUILT?:          { at: string; bundleHash: string }
  FORMULAS_EXECUTING?:    { at: string; total: number; done: number }
  FORMULAS_EXECUTED?:     { at: string; success: number; failure: number; skipped: number }
  FINDINGS_RESOLVING?:    { at: string }
  FINDINGS_RESOLVED?:     { at: string; total: number; critical: number }
  REPORT_GENERATING?:     { at: string }
  REPORT_READY?:          { at: string; reportVersionId: string }
}

export type WorkflowState = {
  id:           string
  caseId:       ClinicalCaseId
  protocolId:   string
  sessionLabel: SessionLabel
  status:       WorkflowStatus
  progress:     WorkflowProgress
  startedAt?:   string
  completedAt?: string
  updatedAt:    string
}

export type JobType =
  | 'EXECUTE_FORMULAS'
  | 'RESOLVE_FINDINGS'
  | 'GENERATE_REPORT'
  | 'FREEZE_CASE'
  | 'RETRY_PROTOCOL'

export type JobPayload = {
  EXECUTE_FORMULAS:  { bundleId: string; caseId: string; protocolId: string; sessionLabel: SessionLabel }
  RESOLVE_FINDINGS:  { executionReportId: string; caseId: string; protocolId: string; sessionLabel: SessionLabel }
  GENERATE_REPORT:   { caseId: string; protocolId: string; sessionLabel: SessionLabel }
  FREEZE_CASE:       { caseId: string }
  RETRY_PROTOCOL:    { caseId: string; protocolId: string; sessionLabel: SessionLabel }
}

export type Job<T extends JobType = JobType> = {
  id:           string
  type:         T
  payload:      JobPayload[T]
  status:       'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED'
  attempts:     number
  lastError?:   string
  enqueuedAt:   string
  startedAt?:   string
  completedAt?: string
}
