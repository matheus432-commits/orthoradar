/**
 * components/CalibrationPanel.tsx
 * Define a distancia real (mm) entre os pontos de calibracao A e B.
 */
"use client";
import type { MarkedPoint } from "@/types";

interface Props {
  points: MarkedPoint[];
  knownDistanceMm: number | null;
  setKnownDistanceMm: (v: number | null) => void;
}

export default function CalibrationPanel({
  points,
  knownDistanceMm,
  setKnownDistanceMm,
}: Props) {
  const a = points.find((p) => p.id === "calibration_a");
  const b = points.find((p) => p.id === "calibration_b");
  const px =
    a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
  const mmPerPx =
    px && knownDistanceMm ? (knownDistanceMm / px).toFixed(4) : null;

  return (
    <div className="card space-y-2">
      <h3 className="text-sm font-semibold text-slate-700">Calibracao</h3>
      <p className="text-xs text-slate-500">
        Marque os pontos 37 e 38 sobre uma distancia conhecida (ex.: largura real
        de um dente) e informe o valor em mm.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.1"
          min="0"
          className="input"
          placeholder="mm"
          value={knownDistanceMm ?? ""}
          onChange={(e) =>
            setKnownDistanceMm(e.target.value ? Number(e.target.value) : null)
          }
        />
        <span className="text-xs text-slate-500">mm = A↔B</span>
      </div>
      <div className="text-xs text-slate-400">
        {px ? `Distancia A-B: ${px.toFixed(1)} px` : "Pontos A/B nao marcados"}
        {mmPerPx && <span className="ml-2 text-emerald-600">✓ {mmPerPx} mm/px</span>}
      </div>
    </div>
  );
}
