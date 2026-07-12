import Decimal from 'decimal.js'

// Decimal config — 10 casas de precisão interna, arredondamento HALF_EVEN
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN, toExpPos: 20 })

export { Decimal }

// Branded types — UUID strings tipadas por domínio
export type PatientId       = string & { readonly _brand: 'PatientId' }
export type OrthodontistId  = string & { readonly _brand: 'OrthodontistId' }
export type ClinicalCaseId  = string & { readonly _brand: 'ClinicalCaseId' }
export type MeasurementId   = string & { readonly _brand: 'MeasurementId' }
export type SessionId       = string & { readonly _brand: 'SessionId' }
export type ExecutionLogId  = string & { readonly _brand: 'ExecutionLogId' }
export type FindingId       = string & { readonly _brand: 'FindingId' }
export type ReportId        = string & { readonly _brand: 'ReportId' }
export type ReportVersionId = string & { readonly _brand: 'ReportVersionId' }
export type FormulaId       = string & { readonly _brand: 'FormulaId' }
export type KnowledgeId     = string & { readonly _brand: 'KnowledgeId' }

export type AnalysisId  = string  // ex: "P01.A03"
export type ProtocolId  = string  // ex: "P01"
export type FormulaSlug = string  // ex: "facial-thirds-ratio"

export type ISO8601Timestamp = string
export type SHA256Hash = string   // 64 hex chars

// Shared Kernel value objects
export type SessionLabel = 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'TN'

export type BiologicalSex = 'M' | 'F' | 'UNSPECIFIED'

export type PatientContext = {
  readonly sex:       BiologicalSex
  readonly ethnicity: string | null
  readonly birthDate: string   // ISO date "YYYY-MM-DD"
  ageAt(date: Date): number
}

export function makePatientContext(
  sex: BiologicalSex,
  birthDate: string,
  ethnicity: string | null = null
): PatientContext {
  return {
    sex,
    ethnicity,
    birthDate,
    ageAt(date: Date): number {
      const birth = new Date(birthDate)
      let age = date.getFullYear() - birth.getFullYear()
      const m = date.getMonth() - birth.getMonth()
      if (m < 0 || (m === 0 && date.getDate() < birth.getDate())) age--
      return age
    }
  }
}

export type VersionNumber = {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

export function parseVersion(v: string): VersionNumber {
  const parts = v.split('.')
  if (parts.length !== 3) throw new Error(`invalid version: ${v}`)
  const [major, minor, patch] = parts.map(Number)
  if (major === undefined || minor === undefined || patch === undefined ||
      isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`invalid version: ${v}`)
  }
  return { major, minor, patch }
}

export function versionString(v: VersionNumber): string {
  return `${v.major}.${v.minor}.${v.patch}`
}
