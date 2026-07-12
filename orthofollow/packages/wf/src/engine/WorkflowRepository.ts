import type { ClinicalCaseId, SessionLabel } from '@orthofollow/shared'
import type { WorkflowState, WorkflowStatus, WorkflowProgress, Job, JobType, JobPayload } from './types'

export interface WorkflowRepository {
  getState(caseId: ClinicalCaseId, protocolId: string, sessionLabel: SessionLabel): Promise<WorkflowState | null>
  upsertState(caseId: ClinicalCaseId, protocolId: string, sessionLabel: SessionLabel, status: WorkflowStatus, progress: WorkflowProgress): Promise<WorkflowState>
  transitionState(stateId: string, from: WorkflowStatus, to: WorkflowStatus, progress?: Partial<WorkflowProgress>): Promise<boolean>
  insertEvent(params: { id: string; eventType: string; aggregateType: string; aggregateId: string; sourceBc: string; payload: unknown }): Promise<void>
  markEventDelivered(eventId: string): Promise<void>
  markEventFailed(eventId: string, error: string, retryCount: number): Promise<void>
  getPendingEvents(limit: number): Promise<Array<{ id: string; eventType: string; payload: unknown; retryCount: number; occurredAt: Date }>>
  enqueueJob<T extends JobType>(type: T, payload: JobPayload[T]): Promise<string>
  claimNextJob(): Promise<Job | null>
  completeJob(jobId: string): Promise<void>
  failJob(jobId: string, error: string): Promise<void>
  insertAuditLog(params: { actorId: string; actorType: string; action: string; targetType: string; targetId: string; metadata: unknown }): Promise<void>
}
