import { newUUID, sha256 } from '@orthofollow/shared'
import type { FormulaSlug, MeasurementBundle, ExecutionReport, ExecutionResult, BundleEntry } from '@orthofollow/shared'
import type { FormulaSpec } from './types'

export interface CFRRepository {
  insertExecutionLog(params: {
    id: string; formulaSlug: string; formulaVersion: string; caseId: string
    sessionLabel: string; inputsHash: string; outputHash: string | null
    status: string; numericResult: string | null; resultUnit: string | null
    classification: string | null; resultPayload: unknown; cacheHit: boolean
  }): Promise<void>
  getCacheHit(inputsHash: string, formulaSlug: string): Promise<ExecutionResult | null>
  setCacheEntry(params: {
    inputsHash: string; formulaSlug: string; formulaVersion: string
    numericResult: string | null; resultUnit: string | null
    classification: string | null; resultPayload: unknown
  }): Promise<void>
}

export class ClinicalFormulaEngine {
  constructor(
    private repo:     CFRRepository,
    private registry: Map<FormulaSlug, FormulaSpec>
  ) {}

  async execute(bundle: MeasurementBundle): Promise<ExecutionReport> {
    const startMs = Date.now()
    const results  = new Map<FormulaSlug, ExecutionResult>()
    const logIds:  string[] = []

    let success = 0, failure = 0, skipped = 0, cacheHits = 0

    const entryMap = new Map<string, BundleEntry>(
      bundle.entries.map(e => [e.analysisId, e])
    )

    for (const [slug, spec] of this.registry) {
      const inputs = new Map<string, BundleEntry>()
      for (const id of spec.inputAnalysisIds) {
        const e = entryMap.get(id)
        if (e !== undefined) inputs.set(id, e)
      }

      const inputsHash = sha256(
        JSON.stringify({ slug, inputs: [...inputs.entries()].map(([k, v]) => ({ k, v: v.value })) })
      )

      const cached = await this.repo.getCacheHit(inputsHash, slug)

      let result: ExecutionResult
      let wasCacheHit = false
      let execStatus: 'SUCCESS' | 'FAILURE' | 'PRECONDITION_FAILED' = 'SUCCESS'

      if (cached !== null) {
        result = cached
        wasCacheHit = true
        cacheHits++
        success++
        execStatus = 'SUCCESS'
      } else if (spec.precondition !== undefined && !spec.precondition(inputs)) {
        result = {
          value:          null,
          unit:           'NONE',
          precision:      0,
          classification: null,
          flags:          { cacheHit: false, preconditionSkipped: true, partialInputs: false, usedFallback: false },
        }
        skipped++
        execStatus = 'PRECONDITION_FAILED'
      } else {
        try {
          result = spec.compute(inputs, bundle.patientContext)
          success++
          execStatus = 'SUCCESS'
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          result = {
            value:          null,
            unit:           'NONE',
            precision:      0,
            classification: null,
            flags:          { cacheHit: false, preconditionSkipped: false, partialInputs: false, usedFallback: false },
            errorCode:      'COMPUTE_ERROR',
            errorDesc:      msg,
          }
          failure++
          execStatus = 'FAILURE'
        }

        if (execStatus === 'SUCCESS') {
          await this.repo.setCacheEntry({
            inputsHash,
            formulaSlug:    slug,
            formulaVersion: spec.version,
            numericResult:  result.value?.toString() ?? null,
            resultUnit:     result.unit !== 'NONE' ? result.unit : null,
            classification: result.classification,
            resultPayload:  result,
          })
        }
      }

      const logId = newUUID()
      const outputHash = result.value !== null
        ? sha256(result.value.toString())
        : result.classification !== null
          ? sha256(result.classification)
          : null

      await this.repo.insertExecutionLog({
        id:             logId,
        formulaSlug:    slug,
        formulaVersion: spec.version,
        caseId:         bundle.caseId,
        sessionLabel:   bundle.sessionLabel,
        inputsHash,
        outputHash,
        status:         execStatus,
        numericResult:  result.value?.toString() ?? null,
        resultUnit:     result.unit !== 'NONE' ? result.unit : null,
        classification: result.classification,
        resultPayload:  result,
        cacheHit:       wasCacheHit,
      })

      logIds.push(logId)
      results.set(slug, result)
    }

    return {
      reportId:        newUUID(),
      bundleId:        bundle.bundleId,
      caseId:          bundle.caseId,
      sessionLabel:    bundle.sessionLabel,
      protocolId:      bundle.protocolId,
      results,
      executionLogIds: logIds,
      summary: {
        total:      results.size,
        success,
        failure,
        skipped,
        cacheHits,
        durationMs: Date.now() - startMs,
      },
      completedAt: new Date().toISOString(),
    }
  }
}
