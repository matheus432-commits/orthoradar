import type { WorkflowRepository } from './WorkflowRepository'
import type { ClinicalCaseId, SessionLabel } from '@orthofollow/shared'

export class WorkflowEngine {
  constructor(private repo: WorkflowRepository) {}

  async requestRecalculation(params: {
    caseId:       string
    protocolId:   string
    sessionLabel: string
    requestedBy:  string
    reason:       string
  }): Promise<void> {
    await this.repo.insertAuditLog({
      actorId:    params.requestedBy,
      actorType:  'ORTHODONTIST',
      action:     'REQUEST_RECALCULATION',
      targetType: 'WORKFLOW_STATE',
      targetId:   params.caseId,
      metadata:   { protocolId: params.protocolId, sessionLabel: params.sessionLabel, reason: params.reason }
    })
  }

  async startProtocol(params: {
    caseId:       string
    protocolId:   string
    sessionLabel: string
    startedBy:    string
  }): Promise<{ workflowStateId: string }> {
    const state = await this.repo.upsertState(
      params.caseId as ClinicalCaseId,
      params.protocolId,
      params.sessionLabel as SessionLabel,
      'IN_PROGRESS',
      { MEASUREMENTS_STARTED: { at: new Date().toISOString() } }
    )

    await this.repo.insertAuditLog({
      actorId:    params.startedBy,
      actorType:  'ORTHODONTIST',
      action:     'START_PROTOCOL',
      targetType: 'WORKFLOW_STATE',
      targetId:   state.id,
      metadata:   { caseId: params.caseId, protocolId: params.protocolId, sessionLabel: params.sessionLabel }
    })

    return { workflowStateId: state.id }
  }
}
