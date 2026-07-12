import { newUUID } from '@orthofollow/shared'
import type { Pool } from 'pg'
import type { ClinicalCaseId, SessionLabel } from '@orthofollow/shared'
import type { WorkflowRepository } from '../engine/WorkflowRepository'
import type { WorkflowState, WorkflowStatus, WorkflowProgress, Job, JobType, JobPayload } from '../engine/types'

export class PgWorkflowRepository implements WorkflowRepository {
  constructor(private pool: Pool) {}

  async getState(
    caseId: ClinicalCaseId, protocolId: string, sessionLabel: SessionLabel
  ): Promise<WorkflowState | null> {
    const { rows } = await this.pool.query(
      `SELECT id, case_id, protocol_id, session_label, status, progress,
              started_at, completed_at, updated_at
       FROM wf.workflow_states
       WHERE case_id = $1 AND protocol_id = $2 AND session_label = $3`,
      [caseId, protocolId, sessionLabel]
    )
    const r = rows[0]
    return r !== undefined ? this.toState(r) : null
  }

  async upsertState(
    caseId: ClinicalCaseId, protocolId: string, sessionLabel: SessionLabel,
    status: WorkflowStatus, progress: WorkflowProgress
  ): Promise<WorkflowState> {
    const { rows } = await this.pool.query(
      `INSERT INTO wf.workflow_states
         (id, case_id, protocol_id, session_label, status, progress, started_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now(),now())
       ON CONFLICT (case_id, protocol_id, session_label) DO UPDATE
         SET status=$5, progress=$6, updated_at=now()
       RETURNING *`,
      [newUUID(), caseId, protocolId, sessionLabel, status, JSON.stringify(progress)]
    )
    return this.toState(rows[0])
  }

  async transitionState(
    stateId: string, from: WorkflowStatus, to: WorkflowStatus, progress?: Partial<WorkflowProgress>
  ): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE wf.workflow_states
       SET status=$2, progress = progress || $3::jsonb, updated_at=now()
       WHERE id=$1 AND status=$4`,
      [stateId, to, JSON.stringify(progress ?? {}), from]
    )
    return (rowCount ?? 0) > 0
  }

  async insertEvent(params: {
    id: string; eventType: string; aggregateType: string
    aggregateId: string; sourceBc: string; payload: unknown
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO wf.domain_events
         (id, event_type, aggregate_type, aggregate_id, source_bc, payload)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [params.id, params.eventType, params.aggregateType,
       params.aggregateId, params.sourceBc, JSON.stringify(params.payload)]
    )
  }

  async markEventDelivered(eventId: string): Promise<void> {
    await this.pool.query(
      `UPDATE wf.domain_events SET status='DELIVERED', delivered_at=now() WHERE id=$1`,
      [eventId]
    )
  }

  async markEventFailed(eventId: string, error: string, retryCount: number): Promise<void> {
    const status = retryCount >= 3 ? 'DEAD_LETTER' : 'FAILED'
    await this.pool.query(
      `UPDATE wf.domain_events
       SET status=$2, last_error=$3, retry_count=$4, next_retry_at=now() + interval '30 seconds'
       WHERE id=$1`,
      [eventId, status, error, retryCount]
    )
  }

  async getPendingEvents(limit: number): Promise<Array<{
    id: string; eventType: string; payload: unknown; retryCount: number; occurredAt: Date
  }>> {
    const { rows } = await this.pool.query(
      `SELECT id, event_type, payload, retry_count, occurred_at
       FROM wf.domain_events
       WHERE status IN ('PENDING','FAILED') AND (next_retry_at IS NULL OR next_retry_at <= now())
       ORDER BY occurred_at ASC LIMIT $1`,
      [limit]
    )
    return rows.map((r: Record<string, unknown>) => ({
      id:         r['id'] as string,
      eventType:  r['event_type'] as string,
      payload:    r['payload'],
      retryCount: r['retry_count'] as number,
      occurredAt: r['occurred_at'] as Date,
    }))
  }

  async enqueueJob<T extends JobType>(type: T, payload: JobPayload[T]): Promise<string> {
    const id = newUUID()
    await this.pool.query(
      `INSERT INTO wf.jobs (id, type, payload) VALUES ($1,$2,$3)`,
      [id, type, JSON.stringify(payload)]
    )
    return id
  }

  async claimNextJob(): Promise<Job | null> {
    const { rows } = await this.pool.query(
      `UPDATE wf.jobs
       SET status='RUNNING', attempts=attempts+1, started_at=now()
       WHERE id = (
         SELECT id FROM wf.jobs
         WHERE status IN ('QUEUED','FAILED') AND attempts < 3
         ORDER BY enqueued_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
       )
       RETURNING *`
    )
    const r = rows[0]
    return r !== undefined ? this.toJob(r) : null
  }

  async completeJob(jobId: string): Promise<void> {
    await this.pool.query(
      `UPDATE wf.jobs SET status='DONE', completed_at=now() WHERE id=$1`,
      [jobId]
    )
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await this.pool.query(
      `UPDATE wf.jobs SET status='FAILED', last_error=$2 WHERE id=$1`,
      [jobId, error]
    )
  }

  async insertAuditLog(params: {
    actorId: string; actorType: string; action: string
    targetType: string; targetId: string; metadata: unknown
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO wf.audit_logs
         (id, actor_id, actor_type, action, target_type, target_id, metadata, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
      [newUUID(), params.actorId, params.actorType, params.action,
       params.targetType, params.targetId, JSON.stringify(params.metadata)]
    )
  }

  private toState(r: Record<string, unknown>): WorkflowState {
    return {
      id:           r['id'] as string,
      caseId:       r['case_id'] as ClinicalCaseId,
      protocolId:   r['protocol_id'] as string,
      sessionLabel: r['session_label'] as SessionLabel,
      status:       r['status'] as WorkflowStatus,
      progress:     r['progress'] as WorkflowProgress,
      updatedAt:    this.toIso(r['updated_at']),
      ...(r['started_at'] !== null && r['started_at'] !== undefined
        ? { startedAt: this.toIso(r['started_at']) } : {}),
      ...(r['completed_at'] !== null && r['completed_at'] !== undefined
        ? { completedAt: this.toIso(r['completed_at']) } : {}),
    }
  }

  private toJob(r: Record<string, unknown>): Job {
    return {
      id:         r['id'] as string,
      type:       r['type'] as JobType,
      payload:    r['payload'] as JobPayload[JobType],
      status:     r['status'] as Job['status'],
      attempts:   r['attempts'] as number,
      enqueuedAt: this.toIso(r['enqueued_at']),
      ...(r['last_error'] !== null && r['last_error'] !== undefined
        ? { lastError: r['last_error'] as string } : {}),
      ...(r['started_at'] !== null && r['started_at'] !== undefined
        ? { startedAt: this.toIso(r['started_at']) } : {}),
      ...(r['completed_at'] !== null && r['completed_at'] !== undefined
        ? { completedAt: this.toIso(r['completed_at']) } : {}),
    }
  }

  private toIso(v: unknown): string {
    if (v instanceof Date) return v.toISOString()
    return String(v)
  }
}
