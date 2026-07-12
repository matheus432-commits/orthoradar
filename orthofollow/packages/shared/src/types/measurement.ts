import type { Decimal } from './primitives'

export type MeasurementUnit =
  | 'MM' | 'DEGREES' | 'PERCENT' | 'RATIO' | 'INDEX' | 'COUNT' | 'BOOLEAN' | 'NONE'

export type MeasurementValueType =
  | 'SCALAR_MM'
  | 'SCALAR_DEGREES'
  | 'SCALAR_PERCENT'
  | 'SCALAR_RATIO'
  | 'SCALAR_INDEX'
  | 'CLASSIFICATION'
  | 'FLAG_SET'
  | 'ODONTOGRAM_MAP'
  | 'FORM_ENTRY'

export type ScalarValue = {
  readonly type:         'SCALAR_MM' | 'SCALAR_DEGREES' | 'SCALAR_PERCENT' | 'SCALAR_RATIO' | 'SCALAR_INDEX'
  readonly numericValue: Decimal
  readonly unit:         MeasurementUnit
}

export type ClassificationValue = {
  readonly type:           'CLASSIFICATION'
  readonly classification: string
  readonly unit:           'NONE'
}

export type FlagSetValue = {
  readonly type:   'FLAG_SET'
  readonly flags:  Record<string, boolean>
  readonly unit:   'NONE'
}

export type OdontogramMapValue = {
  readonly type:     'ODONTOGRAM_MAP'
  readonly teeth:    Record<string, string>
  readonly unit:     'NONE'
}

export type FormEntryValue = {
  readonly type:    'FORM_ENTRY'
  readonly fields:  Record<string, string | number | boolean>
  readonly unit:    MeasurementUnit
}

export type MeasurementValue =
  | ScalarValue
  | ClassificationValue
  | FlagSetValue
  | OdontogramMapValue
  | FormEntryValue

export function isScalar(v: MeasurementValue): v is ScalarValue {
  return ['SCALAR_MM','SCALAR_DEGREES','SCALAR_PERCENT','SCALAR_RATIO','SCALAR_INDEX']
    .includes(v.type)
}

export function numericValueOf(v: MeasurementValue): Decimal | null {
  if (isScalar(v)) return v.numericValue
  return null
}
