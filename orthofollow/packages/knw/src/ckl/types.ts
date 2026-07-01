import type { ExecutionResult } from '@orthofollow/shared'

export type FindingSeverity = 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

export type FindingRule = {
  readonly when:              (result: ExecutionResult) => boolean
  readonly severity:          FindingSeverity
  readonly classification:    string
  readonly priority:          number
  readonly referralRequired:  boolean
  readonly referralSpecialty?: string
  readonly referralUrgency?:   string
}

export type TextTemplate = {
  readonly id:             string
  readonly severity:       string
  readonly classification: string
  readonly text:           string
}

export type KnowledgeRecord = {
  readonly id:          string
  readonly version:     string
  readonly formulaSlug: string
  readonly displayName: string
  readonly rules:       FindingRule[]
  readonly templates:   TextTemplate[]
}

export type ResolvedFinding = {
  readonly id:                string
  readonly knowledgeRecordId: string
  readonly classification:    string
  readonly severity:          string
  readonly priority:          number
  readonly referralRequired:  boolean
  readonly referralSpecialty: string | null
  readonly referralUrgency:   string | null
  readonly selectedTemplate:  { readonly id: string; readonly resolvedText: string }
  readonly inputExecutionIds: string[]
}
