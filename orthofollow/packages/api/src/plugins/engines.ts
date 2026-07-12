import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { ClinicalMeasurementEngine, PgCMFRepository } from '@orthofollow/ca'
import { ClinicalFormulaEngine, PgCFRRepository, P01_FORMULAS } from '@orthofollow/math'
import { ClinicalKnowledgeEngine, PgCKLRepository, P01_KNOWLEDGE } from '@orthofollow/knw'
import { WorkflowEngine, PgWorkflowRepository } from '@orthofollow/wf'
import { ReportAssembler, TextRenderer } from '@orthofollow/pcf'
import type { FormulaSlug } from '@orthofollow/shared'
import type { FormulaSpec } from '@orthofollow/math'
import type { KnowledgeRecord } from '@orthofollow/knw'
import { getPool } from '../db/pool'

declare module 'fastify' {
  interface FastifyInstance {
    cmf:      ClinicalMeasurementEngine
    cfr:      ClinicalFormulaEngine
    ckl:      ClinicalKnowledgeEngine
    wfEngine: WorkflowEngine
    assembler: ReportAssembler
    renderer:  TextRenderer
  }
}

export default fp(async function engines(app: FastifyInstance) {
  const pool = getPool()

  const cmfRepo = new PgCMFRepository(pool)
  const cfrRepo = new PgCFRRepository(pool)
  const cklRepo = new PgCKLRepository(pool)
  const wfRepo  = new PgWorkflowRepository(pool)

  // Formula registry: all protocols merged
  const formulaRegistry = new Map<FormulaSlug, FormulaSpec>([
    ...P01_FORMULAS.map((f): [FormulaSlug, FormulaSpec] => [f.slug, f])
  ])

  // Knowledge registry: all protocols merged
  const knowledgeRegistry = new Map<string, KnowledgeRecord>(
    P01_KNOWLEDGE.map(k => [k.id, k])
  )

  app.decorate('cmf',       new ClinicalMeasurementEngine(cmfRepo))
  app.decorate('cfr',       new ClinicalFormulaEngine(cfrRepo, formulaRegistry))
  app.decorate('ckl',       new ClinicalKnowledgeEngine(cklRepo, knowledgeRegistry))
  app.decorate('wfEngine',  new WorkflowEngine(wfRepo))
  app.decorate('assembler', new ReportAssembler())
  app.decorate('renderer',  new TextRenderer())
})
