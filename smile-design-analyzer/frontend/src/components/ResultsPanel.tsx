/**
 * components/ResultsPanel.tsx
 * Exibe o relatorio de medidas em tabelas + graficos + conclusao.
 */
"use client";
import type { Conclusion } from "@/types";

import { BarChart } from "./Charts";

interface Props {
  report: Record<string, any> | null;
  conclusion: Conclusion | null;
}

function Row({ label, value }: { label: string; value: any }) {
  const display =
    value === null || value === undefined
      ? "—"
      : typeof value === "boolean"
      ? value
        ? "Sim"
        : "Nao"
      : String(value);
  return (
    <div className="flex justify-between border-b border-slate-100 py-1 text-sm last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{display}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h4 className="mb-2 text-sm font-semibold text-brand">{title}</h4>
      {children}
    </div>
  );
}

export default function ResultsPanel({ report, conclusion }: Props) {
  if (!report) {
    return (
      <div className="card text-center text-sm text-slate-500">
        Marque os pontos e clique em <b>Calcular análise</b> para ver as medidas.
      </div>
    );
  }

  const md = report.midline;
  const ge = report.gingival_exposure;
  const bc = report.buccal_corridor;
  const sa = report.smile_arc;
  const ss = report.smile_symmetry;
  const ip = report.interpupillary;
  const op = report.occlusal_plane;
  const cd = report.central_dominance;
  const dims = report.tooth_dimensions || {};
  const gp = report.golden_proportion;

  const goldenBars = [];
  for (const side of ["direito", "esquerdo"]) {
    const sd = gp?.[side];
    if (sd?.lateral_central_ratio != null) {
      goldenBars.push({
        label: `Lat/Cen ${side}`,
        value: sd.lateral_central_ratio,
        ideal: sd.lateral_central_ideal,
      });
    }
  }

  return (
    <div className="space-y-3">
      {md && (
        <Section title="Linha média">
          <Row label="Desvio (mm)" value={md.deviation_mm ?? `${md.deviation_px} px`} />
          <Row label="Lado" value={md.side} />
          <Row label="Ângulo" value={md.angle_deg != null ? `${md.angle_deg}°` : null} />
          <Row label="Classificação" value={md.classification} />
        </Section>
      )}

      {ge && (
        <Section title="Exposição gengival">
          <Row label="Exposição" value={ge.exposure_mm != null ? `${ge.exposure_mm} mm` : `${ge.exposure_px} px`} />
          <Row label="Classificação" value={ge.classification} />
        </Section>
      )}

      {bc && bc.symmetry_percent != null && (
        <Section title="Corredor bucal">
          <Row label="Direito (%)" value={bc.right_percent} />
          <Row label="Esquerdo (%)" value={bc.left_percent} />
          <Row label="Simetria (%)" value={bc.symmetry_percent} />
          <Row label="Classificação" value={bc.classification} />
        </Section>
      )}

      {(ip || op) && (
        <Section title="Planos horizontais">
          {ip && <Row label="Inclinação interpupilar" value={`${ip.inclination_deg}°`} />}
          {op && <Row label="Inclinação plano incisal" value={`${op.inclination_deg}°`} />}
          {op && op.parallelism_deg != null && (
            <Row label="Paralelismo" value={`${op.parallelism_deg}°`} />
          )}
        </Section>
      )}

      {sa && (
        <Section title="Arco / linha do sorriso">
          <Row label="Forma do arco" value={sa.arc_shape} />
          <Row label="Linha do sorriso" value={sa.smile_line} />
        </Section>
      )}

      {ss && (
        <Section title="Simetria do sorriso">
          <Row label="Simetria global (%)" value={ss.overall_percent} />
          <Row label="Classificação" value={ss.classification} />
        </Section>
      )}

      {cd && (
        <Section title="Dominância do incisivo central">
          <Row label="Índice" value={cd.dominance_index} />
          <Row label="Ideal" value={cd.ideal} />
          <Row label="Interpretação" value={cd.interpretation} />
        </Section>
      )}

      {Object.keys(dims).length > 0 && (
        <Section title="Dimensões dentárias">
          {["13", "12", "11", "21", "22", "23"].map((t) => {
            const d = dims[t];
            if (!d) return null;
            const w = d.width_mm != null ? `${d.width_mm} mm` : d.width_px != null ? `${d.width_px} px` : "—";
            const h = d.height_mm != null ? `${d.height_mm} mm` : d.height_px != null ? `${d.height_px} px` : "—";
            return (
              <Row
                key={t}
                label={`Dente ${t}`}
                value={`L ${w} · A ${h} · L/A ${d.width_height_ratio ?? "—"}`}
              />
            );
          })}
        </Section>
      )}

      {goldenBars.length > 0 && (
        <BarChart title="Proporção áurea (largura relativa)" bars={goldenBars} />
      )}

      {bc && bc.symmetry_percent != null && (
        <BarChart
          title="Corredor bucal (%)"
          unit="%"
          bars={[
            { label: "Direito", value: bc.right_percent },
            { label: "Esquerdo", value: bc.left_percent },
          ]}
        />
      )}

      {conclusion && (
        <Section title="Conclusão clínica">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {conclusion.text}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Fonte: {conclusion.source === "ai" ? "IA (Claude)" : "baseada em regras"}
            {conclusion.warning ? ` · ${conclusion.warning}` : ""}
          </p>
        </Section>
      )}
    </div>
  );
}
