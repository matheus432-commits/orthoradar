/**
 * services/api.ts
 * ---------------
 * Cliente HTTP para o backend FastAPI. Toda a logica de calculo, IA e
 * exportacao vive no servidor; aqui apenas fazemos as chamadas.
 */
import type { LandmarkDatabase, MarkedPoint, Patient } from "@/types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Erro ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Busca o banco de pontos. Usa o backend; se falhar, cai para /data local. */
export async function fetchLandmarks(): Promise<LandmarkDatabase> {
  try {
    const res = await fetch(`${API_URL}/api/landmarks`);
    if (res.ok) return json<LandmarkDatabase>(res);
  } catch {
    /* fallback abaixo */
  }
  const local = await fetch("/data/landmarks.json");
  return json<LandmarkDatabase>(local);
}

/** Executa a analise (todos os calculos). */
export async function analyze(
  points: MarkedPoint[],
  knownDistanceMm: number | null,
): Promise<Record<string, any>> {
  const res = await fetch(`${API_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, known_distance_mm: knownDistanceMm }),
  });
  const data = await json<{ report: Record<string, any> }>(res);
  return data.report;
}

/** Gera a conclusao clinica (IA ou regras). */
export async function generateConclusion(
  report: Record<string, any>,
): Promise<{ text: string; source: string; warning?: string }> {
  const res = await fetch(`${API_URL}/api/conclusion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report }),
  });
  return json(res);
}

/** Ajuste opcional de imagem via OpenCV no servidor. */
export async function adjustImage(
  image: string,
  brightness: number,
  contrast: number,
  rotationDeg: number,
): Promise<string> {
  const res = await fetch(`${API_URL}/api/image/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, brightness, contrast, rotation_deg: rotationDeg }),
  });
  const data = await json<{ image: string }>(res);
  return data.image;
}

interface ExportPayload {
  patient: Patient;
  report: Record<string, any>;
  conclusion: string;
  points: MarkedPoint[];
  image: string | null;
}

/** Exporta o relatorio em PDF (retorna um Blob). */
export async function exportPdf(payload: ExportPayload): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.blob();
}

/** Exporta a imagem anotada em PNG (retorna um Blob). */
export async function exportPng(payload: ExportPayload): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/export/png`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.blob();
}

/** Dispara o download de um Blob no navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
