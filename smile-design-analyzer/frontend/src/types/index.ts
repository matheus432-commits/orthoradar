/**
 * types/index.ts
 * Tipos compartilhados no front-end.
 */

/** Definicao de um ponto anatomico (banco de pontos). */
export interface LandmarkDef {
  id: string;
  number: number;
  name: string;
  description: string;
  category: string;
  color: string;
  required: boolean;
  tooth?: string;
}

export interface LandmarkCategory {
  id: string;
  label: string;
  color: string;
}

export interface ToothDef {
  id: string;
  name: string;
  type: string;
  side: string;
  golden_group: string;
}

export interface LandmarkDatabase {
  version: string;
  description: string;
  categories: LandmarkCategory[];
  landmarks: LandmarkDef[];
  teeth: ToothDef[];
}

/** Ponto marcado (coordenadas em pixels da imagem ORIGINAL). */
export interface MarkedPoint {
  id: string;
  x: number;
  y: number;
}

/** Dados de cadastro do paciente. */
export interface Patient {
  name: string;
  sex: string;
  date: string;
  notes: string;
}

/** Conclusao clinica gerada pela IA (ou por regras). */
export interface Conclusion {
  text: string;
  source: string;
  warning?: string;
}

/** Caso clinico completo persistido localmente. */
export interface CaseRecord {
  id: string;
  patient: Patient;
  imageDataUrl: string | null;
  points: MarkedPoint[];
  knownDistanceMm: number | null;
  report: Record<string, any> | null;
  conclusion: Conclusion | null;
  createdAt: string;
  updatedAt: string;
}
