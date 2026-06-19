import type { WorkflowRepository } from '../engine/WorkflowRepository'
import type { Job, JobType } from '../engine/types'

const MAX_JOB_RETRIES = 3
const POLL_INTERVAL_MS = 1000

export interface JobHandlers {
  EXECUTE_FORMULAS(payload: Job<'EXECUTE_FORMULAS'>['payload']): Promise<void>
  RESOLVE_FINDINGS(payload: Job<'RESOLVE_FINDINGS'>['payload']): Promise<void>
  GENERATE_REPORT(payload: Job<'GENERATE_REPORT'>['payload']): Promise<void>
  FREEZE_CASE(payload: Job<'FREEZE_CASE'>['payload']): Promise<void>
  RETRY_PROTOCOL(payload: Job<'RETRY_PROTOCOL'>['payload']): Promise<void>
}

export class JobRunner {
  private running = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private repo: WorkflowRepository, private handlers: JobHandlers) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNext()
  }

  stop(): void {
    this.running = false
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
  }

  private scheduleNext(): void {
    if (!this.running) return
    this.timer = setTimeout(async () => { await this.runOnce(); this.scheduleNext() }, POLL_INTERVAL_MS)
  }

  async runOnce(): Promise<number> {
    let processed = 0
    while (true) {
      const job = await this.repo.claimNextJob()
      if (!job) break
      try {
        await this.dispatch(job)
        await this.repo.completeJob(job.id)
        processed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await this.repo.failJob(job.id, msg)
        if (job.attempts >= MAX_JOB_RETRIES) {
          console.error(`[JobRunner] DEAD_LETTER job ${job.id} type=${job.type} attempts=${job.attempts}`)
        }
      }
    }
    return processed
  }

  private async dispatch(job: Job): Promise<void> {
    switch (job.type as JobType) {
      case 'EXECUTE_FORMULAS': return this.handlers.EXECUTE_FORMULAS(job.payload as Job<'EXECUTE_FORMULAS'>['payload'])
      case 'RESOLVE_FINDINGS': return this.handlers.RESOLVE_FINDINGS(job.payload as Job<'RESOLVE_FINDINGS'>['payload'])
      case 'GENERATE_REPORT':  return this.handlers.GENERATE_REPORT(job.payload as Job<'GENERATE_REPORT'>['payload'])
      case 'FREEZE_CASE':      return this.handlers.FREEZE_CASE(job.payload as Job<'FREEZE_CASE'>['payload'])
      case 'RETRY_PROTOCOL':   return this.handlers.RETRY_PROTOCOL(job.payload as Job<'RETRY_PROTOCOL'>['payload'])
      default: console.warn(`[JobRunner] unknown job type: ${(job as Job).type}`)
    }
  }
}
