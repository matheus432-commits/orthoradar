import type { WorkflowRepository } from '../engine/WorkflowRepository'

const POLL_INTERVAL_MS = 2000

export class OutboxPoller {
  private running = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private repo:    WorkflowRepository,
    private deliver: (eventType: string, payload: unknown) => Promise<void>
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.scheduleNext()
  }

  stop(): void {
    this.running = false
    if (this.timer !== null) { clearTimeout(this.timer); this.timer = null }
  }

  private scheduleNext(): void {
    if (!this.running) return
    this.timer = setTimeout(async () => {
      await this.pollOnce()
      this.scheduleNext()
    }, POLL_INTERVAL_MS)
  }

  async pollOnce(): Promise<number> {
    const events = await this.repo.getPendingEvents(10)
    let delivered = 0
    for (const event of events) {
      try {
        await this.deliver(event.eventType, event.payload)
        await this.repo.markEventDelivered(event.id)
        delivered++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await this.repo.markEventFailed(event.id, msg, event.retryCount + 1)
      }
    }
    return delivered
  }
}
