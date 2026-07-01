import type { Pool } from 'pg'
import { newUUID } from '@orthofollow/shared'
import type { CKLRepository } from '../ckl/ClinicalKnowledgeEngine'

export class PgCKLRepository implements CKLRepository {
  constructor(private pool: Pool) {}

  async insertFinding(params: {
    id: string; caseId: string; sessionLabel: string;
    knowledgeRecordId: string; knowledgeRecordVersion: string;
    classification: string; severity: string; priority: number;
    inputExecutionIds: string[]; availableTemplateIds: string[];
    referralRequired: boolean; referralSpecialty: string | null;
    referralUrgency: string | null; resolvedAt: Date
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO knw.findings
         (id, case_id, session_label, knowledge_record_id, knowledge_record_version,
          classification, severity, priority, input_execution_ids, available_template_ids,
          referral_required, referral_specialty, referral_urgency, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [params.id, params.caseId, params.sessionLabel, params.knowledgeRecordId,
       params.knowledgeRecordVersion, params.classification, params.severity, params.priority,
       JSON.stringify(params.inputExecutionIds), JSON.stringify(params.availableTemplateIds),
       params.referralRequired, params.referralSpecialty, params.referralUrgency, params.resolvedAt]
    )
  }
}
