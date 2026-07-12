import { newUUID } from '@orthofollow/shared'
import type { ExecutionReport, PatientContext } from '@orthofollow/shared'
import type { KnowledgeRecord, ResolvedFinding } from './types'

export interface CKLRepository {
  insertFinding(params: {
    id: string; caseId: string; sessionLabel: string
    knowledgeRecordId: string; knowledgeRecordVersion: string
    classification: string; severity: string; priority: number
    inputExecutionIds: string[]; availableTemplateIds: string[]
    referralRequired: boolean; referralSpecialty: string | null
    referralUrgency: string | null; resolvedAt: Date
  }): Promise<void>
}

export class ClinicalKnowledgeEngine {
  constructor(
    private repo:     CKLRepository,
    private registry: Map<string, KnowledgeRecord>
  ) {}

  async resolveFindings(
    report:         ExecutionReport,
    _patientContext: PatientContext
  ): Promise<ResolvedFinding[]> {
    const findings: ResolvedFinding[] = []

    for (const [, kr] of this.registry) {
      const result = report.results.get(kr.formulaSlug)
      if (result === undefined) continue

      const matched = kr.rules.find(rule => rule.when(result))
      if (matched === undefined) continue

      const template =
        kr.templates.find(t => t.severity === matched.severity && t.classification === matched.classification) ??
        kr.templates.find(t => t.severity === matched.severity) ??
        kr.templates[0]

      if (template === undefined) continue

      const id = newUUID()

      await this.repo.insertFinding({
        id,
        caseId:                 report.caseId,
        sessionLabel:           report.sessionLabel,
        knowledgeRecordId:      kr.id,
        knowledgeRecordVersion: kr.version,
        classification:         matched.classification,
        severity:               matched.severity,
        priority:               matched.priority,
        inputExecutionIds:      report.executionLogIds,
        availableTemplateIds:   kr.templates.map(t => t.id),
        referralRequired:       matched.referralRequired,
        referralSpecialty:      matched.referralSpecialty ?? null,
        referralUrgency:        matched.referralUrgency ?? null,
        resolvedAt:             new Date(),
      })

      findings.push({
        id,
        knowledgeRecordId: kr.id,
        classification:    matched.classification,
        severity:          matched.severity,
        priority:          matched.priority,
        referralRequired:  matched.referralRequired,
        referralSpecialty: matched.referralSpecialty ?? null,
        referralUrgency:   matched.referralUrgency ?? null,
        selectedTemplate:  { id: template.id, resolvedText: template.text },
        inputExecutionIds: report.executionLogIds,
      })
    }

    findings.sort((a, b) => b.priority - a.priority)
    return findings
  }
}
