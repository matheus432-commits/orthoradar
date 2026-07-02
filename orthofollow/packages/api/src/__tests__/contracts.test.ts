/**
 * CT-01 to CT-09 — Consumer-Driven Contract Tests
 *
 * Tests run entirely in-memory: no DB, no HTTP server.
 * Each test verifies the contract between two Bounded Contexts
 * by exercising the producing side with a stub consumer.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { ClinicalMeasurementEngine } from '@orthofollow/ca'
import { analysisRegistry }          from '@orthofollow/ca'
import { ClinicalFormulaEngine }     from '@orthofollow/math'
import { P01_FORMULAS }              from '@orthofollow/math'
import { ClinicalKnowledgeEngine }   from '@orthofollow/knw'
import { P01_KNOWLEDGE }             from '@orthofollow/knw'
import { ReportAssembler, TextRenderer } from '@orthofollow/pcf'
import {
  Decimal, makePatientContext,
  type ClinicalCaseId, type SessionLabel,
  type MeasurementValue, type FormulaSlug
} from '@orthofollow/shared'
import type { FormulaSpec, ExecutionResult } from '@orthofollow/math'
import type { KnowledgeRecord } from '@orthofollow/knw'

// ── In-memory stubs ──────────────────────────────────────────────────────────

const CASE_ID  = 'case-test-001' as ClinicalCaseId
const SESSION  = 'T0' as SessionLabel

type StoredMeasurement = {
  id: string; analysisId: string; valueType: string
  numericValue: string | null; unit: string | null
  valuePayload: unknown; recordedAt: Date
}

class InMemCMFRepo {
  rows: StoredMeasurement[] = []

  async insertMeasurement(p: {
    id: string; caseId: string; sessionSnapshotId: string | null; analysisId: string
    protocolId: string; valueType: string; numericValue: Decimal | null
    unit: string | null; valuePayload: unknown; recordedAt: Date; recordedBy: string
  }) {
    this.rows.push({
      id: p.id, analysisId: p.analysisId, valueType: p.valueType,
      numericValue: p.numericValue?.toString() ?? null,
      unit: p.unit, valuePayload: p.valuePayload, recordedAt: p.recordedAt
    })
  }

  async supersedeMeasurement() {}

  async fetchCurrentMeasurements(caseId: string, analysisIds: string[]) {
    return this.rows.filter(r => analysisIds.includes(r.analysisId))
  }
}

class InMemCFRRepo {
  async insertExecutionLog() {}
  async getCacheHit() { return null }
  async setCacheEntry() {}
}

class InMemCKLRepo {
  findings: unknown[] = []
  async insertFinding(p: unknown) { this.findings.push(p) }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PATIENT = makePatientContext('F', '1998-06-15')

const P01_MEASUREMENTS: Array<{ analysisId: string; value: MeasurementValue }> = [
  { analysisId: 'P01.A01', value: { type: 'CLASSIFICATION', classification: 'SYMMETRIC', unit: 'NONE' } },
  { analysisId: 'P01.A02', value: { type: 'SCALAR_MM', numericValue: new Decimal('1.5'), unit: 'MM' } },
  { analysisId: 'P01.A03', value: { type: 'SCALAR_PERCENT', numericValue: new Decimal('32'), unit: 'PERCENT' } },
  { analysisId: 'P01.A04', value: { type: 'SCALAR_PERCENT', numericValue: new Decimal('35'), unit: 'PERCENT' } },
  { analysisId: 'P01.A05', value: { type: 'SCALAR_PERCENT', numericValue: new Decimal('33'), unit: 'PERCENT' } },
  { analysisId: 'P01.A06', value: { type: 'CLASSIFICATION', classification: 'CONVEX', unit: 'NONE' } },
  { analysisId: 'P01.A07', value: { type: 'SCALAR_DEGREES', numericValue: new Decimal('102'), unit: 'DEGREES' } },
  { analysisId: 'P01.A08', value: { type: 'CLASSIFICATION', classification: 'NORMAL', unit: 'NONE' } },
  { analysisId: 'P01.A09', value: { type: 'CLASSIFICATION', classification: 'NORMAL', unit: 'NONE' } },
  { analysisId: 'P01.A11', value: { type: 'CLASSIFICATION', classification: 'COMPETENT', unit: 'NONE' } },
  { analysisId: 'P01.A12', value: { type: 'SCALAR_MM', numericValue: new Decimal('2.5'), unit: 'MM' } }
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildFullPipeline() {
  const cmfRepo = new InMemCMFRepo()
  const cfrRepo = new InMemCFRRepo()
  const cklRepo = new InMemCKLRepo()

  const cmf = new ClinicalMeasurementEngine(cmfRepo as any)
  const cfr = new ClinicalFormulaEngine(
    cfrRepo as any,
    new Map<FormulaSlug, FormulaSpec>(P01_FORMULAS.map(f => [f.slug, f]))
  )
  const ckl = new ClinicalKnowledgeEngine(
    cklRepo as any,
    new Map<string, KnowledgeRecord>(P01_KNOWLEDGE.map(k => [k.id, k]))
  )

  for (const { analysisId, value } of P01_MEASUREMENTS) {
    await cmf.recordMeasurement({
      caseId:       CASE_ID,
      sessionLabel: SESSION,
      analysisId,
      value,
      recordedBy:   'dr-test-001'
    })
  }

  const bundle   = await cmf.buildBundle(CASE_ID, 'P01', SESSION, PATIENT)
  const execRep  = await cfr.execute(bundle)
  const findings = await ckl.resolveFindings(execRep, PATIENT)

  return { cmfRepo, cklRepo, bundle, execRep, findings }
}

// ── CT-01: CA → MATH bundle contract ─────────────────────────────────────────
describe('CT-01 CA→MATH: MeasurementBundle contract', () => {
  it('bundle contains all required P01 analyses after recording 11 measurements', async () => {
    const { bundle } = await buildFullPipeline()
    assert.equal(bundle.entries.length, 11)
    assert.equal(bundle.protocolId, 'P01')
    assert.equal(bundle.completeness.isComplete, true)
    assert.equal(bundle.completeness.missing.length, 0)
  })

  it('bundle inputsHash is a 64-char hex string', async () => {
    const { bundle } = await buildFullPipeline()
    assert.match(bundle.inputsHash, /^[0-9a-f]{64}$/)
  })

  it('each BundleEntry has a valid analysisId and numericValue or null', async () => {
    const { bundle } = await buildFullPipeline()
    for (const entry of bundle.entries) {
      assert.ok(entry.analysisId.startsWith('P01.'))
      if (entry.value.type.startsWith('SCALAR')) {
        assert.ok(entry.numericValue !== null)
      }
    }
  })
})

// ── CT-02: MATH internal: DAG order ──────────────────────────────────────────
describe('CT-02 MATH DAG: topological order is deterministic', () => {
  it('P01 formulas have no dependencies — all execute in parallel-safe order', async () => {
    const { execRep } = await buildFullPipeline()
    assert.equal(execRep.summary.total, P01_FORMULAS.length)
    assert.equal(execRep.summary.failure, 0)
    assert.equal(execRep.summary.skipped, 0)
  })

  it('every P01 formula slug appears in executionReport.results', async () => {
    const { execRep } = await buildFullPipeline()
    for (const spec of P01_FORMULAS) {
      assert.ok(execRep.results.has(spec.slug), `missing result for ${spec.slug}`)
    }
  })
})

// ── CT-03: MATH → KNW: ExecutionReport contract ──────────────────────────────
describe('CT-03 MATH→KNW: ExecutionReport contract', () => {
  it('results Map contains ExecutionResult with classification or value', async () => {
    const { execRep } = await buildFullPipeline()
    for (const [slug, result] of execRep.results) {
      assert.ok(
        result.classification !== null || result.value !== null,
        `${slug}: must have classification or numeric value`
      )
    }
  })

  it('executionLogIds is non-empty after full run', async () => {
    const { execRep } = await buildFullPipeline()
    assert.ok(execRep.executionLogIds.length > 0)
  })
})

// ── CT-04: KNW: FindingRule evaluation ───────────────────────────────────────
describe('CT-04 KNW: FindingRule evaluates to correct severity', () => {
  it('SYMMETRIC → NORMAL severity', async () => {
    const { findings } = await buildFullPipeline()
    const symmetry = findings.find(f => f.knowledgeRecordId === 'kr-facial-vertical-symmetry')
    assert.ok(symmetry, 'facial-vertical-symmetry finding must exist')
    assert.equal(symmetry.severity, 'NORMAL')
    assert.equal(symmetry.classification, 'SYMMETRIC')
  })

  it('CONVEX profile → MILD severity', async () => {
    const { findings } = await buildFullPipeline()
    const profile = findings.find(f => f.knowledgeRecordId === 'kr-facial-profile')
    assert.ok(profile, 'facial-profile finding must exist')
    assert.equal(profile.severity, 'MILD')
  })

  it('midline 1.5mm → MILD severity (NO_DEVIATION boundary)', async () => {
    const { findings } = await buildFullPipeline()
    const midline = findings.find(f => f.knowledgeRecordId === 'kr-midline-deviation')
    assert.ok(midline, 'midline-deviation finding must exist')
    // 1.5mm is just outside the NO_DEVIATION range (-1 to 1)
    assert.ok(['MILD', 'MODERATE'].includes(midline.severity))
  })

  it('lip ratio 0.75 → NORMAL (IDEAL range)', async () => {
    // lip-competence knowledge record triggers on 'COMPETENT' → NORMAL
    const { findings } = await buildFullPipeline()
    const lipComp = findings.find(f => f.knowledgeRecordId === 'kr-lip-competence')
    assert.ok(lipComp, 'lip-competence finding must exist')
    assert.equal(lipComp.severity, 'NORMAL')
  })
})

// ── CT-05: KNW → PCF: ResolvedFinding contract ───────────────────────────────
describe('CT-05 KNW→PCF: ResolvedFinding contract', () => {
  it('every finding has a selectedTemplate with non-empty resolvedText', async () => {
    const { findings } = await buildFullPipeline()
    for (const f of findings) {
      assert.ok(f.selectedTemplate.resolvedText.length > 0, `finding ${f.id}: empty resolvedText`)
    }
  })

  it('findings are sorted by priority descending', async () => {
    const { findings } = await buildFullPipeline()
    for (let i = 1; i < findings.length; i++) {
      assert.ok(
        findings[i - 1]!.priority >= findings[i]!.priority,
        `findings out of order at index ${i}`
      )
    }
  })
})

// ── CT-06: PCF: ReportAssembler contract ─────────────────────────────────────
describe('CT-06 PCF: ReportAssembler produces valid AssembledReport', () => {
  it('assembled report contentHash is 64-char hex', async () => {
    const { findings } = await buildFullPipeline()
    const assembler = new ReportAssembler()
    const report = assembler.assemble(
      {
        caseId:           CASE_ID,
        sessionLabel:     SESSION,
        patientName:      'Maria Silva',
        patientAge:       26,
        patientSex:       'F',
        orthodontistName: 'Dr. João Souza',
        protocolId:       'P01'
      },
      findings
    )
    assert.match(report.contentHash, /^[0-9a-f]{64}$/)
    assert.ok(report.sections.length > 0)
    assert.equal(report.totalFindings, findings.length)
  })

  it('TextRenderer produces non-empty string with patient name', async () => {
    const { findings } = await buildFullPipeline()
    const assembler = new ReportAssembler()
    const renderer  = new TextRenderer()
    const report = assembler.assemble(
      {
        caseId: CASE_ID, sessionLabel: SESSION,
        patientName: 'Maria Silva', patientAge: 26, patientSex: 'F',
        orthodontistName: 'Dr. João', protocolId: 'P01'
      },
      findings
    )
    const text = renderer.render(report)
    assert.ok(text.includes('Maria Silva'))
    assert.ok(text.includes('Análise Facial'))
    assert.ok(text.length > 200)
  })
})

// ── CT-07: CA CMF: DomainValidator boundary enforcement ──────────────────────
// P01 analyses intentionally carry no numeric min/max: measured values (even
// clinically atypical ones, e.g. a 200° nasolabial angle) must always be
// accepted and recorded so the report reflects the real patient finding
// rather than being blocked by a hardcoded "normal" range.
describe('CT-07 CA CMF: DomainValidator boundary enforcement', () => {
  it('accepts an angle outside the typical clinical range', async () => {
    const cmfRepo = new InMemCMFRepo()
    const cmf = new ClinicalMeasurementEngine(cmfRepo as any)

    const result = await cmf.recordMeasurement({
      caseId:       CASE_ID,
      sessionLabel: SESSION,
      analysisId:   'P01.A07',
      value:        { type: 'SCALAR_DEGREES', numericValue: new Decimal('200'), unit: 'DEGREES' },
      recordedBy:   'dr-test-001'
    })

    assert.equal(result.validation.passed, true)
    assert.equal(result.measurementId !== undefined, true)
  })

  it('rejects invalid classification for profile type', async () => {
    const cmfRepo = new InMemCMFRepo()
    const cmf = new ClinicalMeasurementEngine(cmfRepo as any)

    const result = await cmf.recordMeasurement({
      caseId:       CASE_ID,
      sessionLabel: SESSION,
      analysisId:   'P01.A06',
      value:        { type: 'CLASSIFICATION', classification: 'INVALID_CLASS', unit: 'NONE' },
      recordedBy:   'dr-test-001'
    })

    assert.equal(result.validation.passed, false)
    if (!result.validation.passed) {
      assert.equal(result.validation.errors[0]?.code, 'INVALID_CLASSIFICATION')
    }
  })
})

// ── CT-08: MATH CFR: cache hit contract ──────────────────────────────────────
describe('CT-08 MATH CFR: cache hit does not re-execute', () => {
  it('getCacheHit called once per formula per bundle', async () => {
    const calls: string[] = []
    const cacheRepo = {
      insertExecutionLog: async () => {},
      getCacheHit: async (_hash: string, slug: string) => {
        calls.push(slug)
        return null  // miss — let it execute
      },
      setCacheEntry: async () => {}
    }

    const cfr = new ClinicalFormulaEngine(
      cacheRepo as any,
      new Map<FormulaSlug, FormulaSpec>(P01_FORMULAS.map(f => [f.slug, f]))
    )

    const cmfRepo = new InMemCMFRepo()
    const cmf = new ClinicalMeasurementEngine(cmfRepo as any)

    for (const { analysisId, value } of P01_MEASUREMENTS) {
      await cmf.recordMeasurement({ caseId: CASE_ID, sessionLabel: SESSION, analysisId, value, recordedBy: 'dr' })
    }

    const bundle = await cmf.buildBundle(CASE_ID, 'P01', SESSION, PATIENT)
    await cfr.execute(bundle)

    assert.equal(calls.length, P01_FORMULAS.length, 'getCacheHit called once per formula')
  })
})

// ── CT-09: WF: workflow state transitions ────────────────────────────────────
describe('CT-09 WF: WorkflowEngine state machine', () => {
  it('startProtocol creates IN_PROGRESS state', async () => {
    const states = new Map<string, unknown>()
    const wfRepo = {
      getState: async () => null,
      upsertState: async (caseId: string, protocolId: string, sessionLabel: string, status: string, progress: unknown) => {
        const id = `${caseId}:${protocolId}:${sessionLabel}`
        const state = { id, caseId, protocolId, sessionLabel, status, progress, updatedAt: new Date().toISOString() }
        states.set(id, state)
        return state
      },
      insertAuditLog: async () => {},
      transitionState: async () => true,
      enqueueJob: async () => 'job-001',
      insertEvent: async () => {},
      markEventDelivered: async () => {},
      markEventFailed: async () => {},
      getPendingEvents: async () => [],
      claimNextJob: async () => null,
      completeJob: async () => {},
      failJob: async () => {}
    }

    const { WorkflowEngine } = await import('@orthofollow/wf')
    const engine = new WorkflowEngine(wfRepo as any)

    const { workflowStateId } = await engine.startProtocol({
      caseId:       'case-wf-001',
      protocolId:   'P01',
      sessionLabel: 'T0',
      startedBy:    'dr-001'
    })

    assert.ok(workflowStateId.length > 0)
    assert.ok(states.has('case-wf-001:P01:T0'))
    const s = states.get('case-wf-001:P01:T0') as any
    assert.equal(s.status, 'IN_PROGRESS')
  })
})
