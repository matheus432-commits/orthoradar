import { Decimal } from '@orthofollow/shared'
import type { BundleEntry, ExecutionResult } from '@orthofollow/shared'
import type { FormulaSpec } from '../cfr/types'

const FLAGS = { cacheHit: false, preconditionSkipped: false, partialInputs: false, usedFallback: false } as const

function classificationResult(classification: string): ExecutionResult {
  return { value: null, unit: 'NONE', precision: 0, classification, flags: FLAGS }
}

function scalarResult(value: Decimal, unit: ExecutionResult['unit']): ExecutionResult {
  return { value, unit, precision: 4, classification: null, flags: FLAGS }
}

function getClassification(inputs: Map<string, BundleEntry>, analysisId: string): string {
  const e = inputs.get(analysisId)
  if (e === undefined || e.value.type !== 'CLASSIFICATION') {
    throw new Error(`Missing classification input for ${analysisId}`)
  }
  return e.value.classification
}

function getNumeric(inputs: Map<string, BundleEntry>, analysisId: string): Decimal {
  const e = inputs.get(analysisId)
  if (e === undefined || e.numericValue === null) {
    throw new Error(`Missing numeric input for ${analysisId}`)
  }
  return e.numericValue
}

export const P01_FORMULAS: FormulaSpec[] = [
  {
    slug: 'facial-vertical-symmetry', version: '1.0.0', name: 'Simetria Facial Vertical',
    inputAnalysisIds: ['P01.A01'],
    compute: (inputs) => classificationResult(getClassification(inputs, 'P01.A01')),
  },
  {
    slug: 'midline-deviation', version: '1.0.0', name: 'Desvio de Linha Média',
    inputAnalysisIds: ['P01.A02'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A02'), 'MM'),
  },
  {
    slug: 'facial-thirds-upper', version: '1.0.0', name: 'Terço Superior Facial',
    inputAnalysisIds: ['P01.A03'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A03'), 'PERCENT'),
  },
  {
    slug: 'facial-thirds-middle', version: '1.0.0', name: 'Terço Médio Facial',
    inputAnalysisIds: ['P01.A04'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A04'), 'PERCENT'),
  },
  {
    slug: 'facial-thirds-lower', version: '1.0.0', name: 'Terço Inferior Facial',
    inputAnalysisIds: ['P01.A05'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A05'), 'PERCENT'),
  },
  {
    slug: 'facial-profile', version: '1.0.0', name: 'Perfil Facial',
    inputAnalysisIds: ['P01.A06'],
    compute: (inputs) => classificationResult(getClassification(inputs, 'P01.A06')),
  },
  {
    slug: 'nasolabial-angle', version: '1.0.0', name: 'Ângulo Nasolabial',
    inputAnalysisIds: ['P01.A07'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A07'), 'DEGREES'),
  },
  {
    slug: 'chin-projection', version: '1.0.0', name: 'Projeção do Mento',
    inputAnalysisIds: ['P01.A08'],
    compute: (inputs) => classificationResult(getClassification(inputs, 'P01.A08')),
  },
  {
    slug: 'nasal-symmetry', version: '1.0.0', name: 'Simetria Nasal',
    inputAnalysisIds: ['P01.A09'],
    compute: (inputs) => classificationResult(getClassification(inputs, 'P01.A09')),
  },
  {
    slug: 'lip-ratio', version: '1.0.0', name: 'Razão Labial',
    inputAnalysisIds: ['P01.A10'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A10'), 'RATIO'),
  },
  {
    slug: 'lip-competence', version: '1.0.0', name: 'Competência Labial',
    inputAnalysisIds: ['P01.A11'],
    compute: (inputs) => classificationResult(getClassification(inputs, 'P01.A11')),
  },
  {
    slug: 'smile-exposure', version: '1.0.0', name: 'Exposição no Sorriso',
    inputAnalysisIds: ['P01.A12'],
    compute: (inputs) => scalarResult(getNumeric(inputs, 'P01.A12'), 'MM'),
  },
]
