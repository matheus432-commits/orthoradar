/**
 * services/storage.ts
 * -------------------
 * Persistencia local (localStorage) dos casos clinicos. Mantem o projeto
 * "pronto para rodar" sem exigir banco de dados. Cada caso guarda paciente,
 * imagem, pontos, relatorio e conclusao.
 */
import type { CaseRecord, Patient } from "@/types";

const KEY = "sda_cases";

function read(): CaseRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(cases: CaseRecord[]): void {
  localStorage.setItem(KEY, JSON.stringify(cases));
}

export function listCases(): CaseRecord[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(id: string): CaseRecord | undefined {
  return read().find((c) => c.id === id);
}

export function createCase(patient: Patient, imageDataUrl: string | null): CaseRecord {
  const now = new Date().toISOString();
  const record: CaseRecord = {
    id: `case_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patient,
    imageDataUrl,
    points: [],
    knownDistanceMm: null,
    report: null,
    conclusion: null,
    createdAt: now,
    updatedAt: now,
  };
  const cases = read();
  cases.push(record);
  write(cases);
  return record;
}

export function saveCase(record: CaseRecord): void {
  const cases = read();
  const idx = cases.findIndex((c) => c.id === record.id);
  record.updatedAt = new Date().toISOString();
  if (idx >= 0) cases[idx] = record;
  else cases.push(record);
  write(cases);
}

export function deleteCase(id: string): void {
  write(read().filter((c) => c.id !== id));
}
