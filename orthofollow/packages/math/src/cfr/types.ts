import type { PatientContext, ExecutionResult, FormulaSlug, BundleEntry } from '@orthofollow/shared'

export type { ExecutionResult }
export type { ExecutionReport } from '@orthofollow/shared'

export type FormulaSpec = {
  readonly slug:             FormulaSlug
  readonly version:          string
  readonly name:             string
  readonly inputAnalysisIds: string[]
  readonly precondition?:    (inputs: Map<string, BundleEntry>) => boolean
  readonly compute:          (inputs: Map<string, BundleEntry>, ctx: PatientContext) => ExecutionResult
}
