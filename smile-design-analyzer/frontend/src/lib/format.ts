/**
 * lib/format.ts
 * Utilitarios de formatacao reutilizaveis na interface.
 */

/** Formata um numero com N casas decimais, ou "—" se nulo. */
export function fmtNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(decimals);
}

/** Formata um valor em milimetros. */
export function fmtMm(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(2)} mm`;
}

/** Formata um valor percentual. */
export function fmtPercent(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)}%`;
}

/** Formata um angulo em graus. */
export function fmtDeg(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)}°`;
}
