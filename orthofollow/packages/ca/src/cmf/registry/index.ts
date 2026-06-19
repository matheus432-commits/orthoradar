import type { AnalysisId, ProtocolId } from '@orthofollow/shared'
import type { AnalysisDefinition } from '../types'
import { P01_ANALYSES } from './P01'

const ALL_ANALYSES: AnalysisDefinition[] = [
  ...P01_ANALYSES,
]

class AnalysisRegistry {
  private byId:       Map<AnalysisId, AnalysisDefinition>
  private byProtocol: Map<ProtocolId, AnalysisDefinition[]>

  constructor(analyses: AnalysisDefinition[]) {
    this.byId       = new Map(analyses.map(a => [a.id, a]))
    this.byProtocol = new Map()
    for (const a of analyses) {
      const list = this.byProtocol.get(a.protocolId) ?? []
      list.push(a)
      this.byProtocol.set(a.protocolId, list)
    }
  }

  get(analysisId: AnalysisId): AnalysisDefinition | undefined { return this.byId.get(analysisId) }
  getOrThrow(analysisId: AnalysisId): AnalysisDefinition {
    const def = this.byId.get(analysisId)
    if (!def) throw new Error(`AnalysisDefinition not found: ${analysisId}`)
    return def
  }
  forProtocol(protocolId: ProtocolId): AnalysisDefinition[] { return this.byProtocol.get(protocolId) ?? [] }
  hasProtocol(protocolId: ProtocolId): boolean { return this.byProtocol.has(protocolId) }
  protocolOf(analysisId: AnalysisId): ProtocolId | undefined { return this.byId.get(analysisId)?.protocolId }
}

export const analysisRegistry = new AnalysisRegistry(ALL_ANALYSES)
