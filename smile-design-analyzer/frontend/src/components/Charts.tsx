/**
 * components/Charts.tsx
 * Graficos simples em SVG (sem dependencias externas) para o relatorio.
 */
"use client";

interface Bar {
  label: string;
  value: number;
  ideal?: number;
  max?: number;
}

export function BarChart({ title, bars, unit }: { title: string; bars: Bar[]; unit?: string }) {
  const max = Math.max(...bars.map((b) => Math.max(b.value, b.ideal ?? 0, b.max ?? 0)), 1);
  return (
    <div className="card">
      <h4 className="mb-3 text-sm font-semibold text-slate-700">{title}</h4>
      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="mb-0.5 flex justify-between text-xs text-slate-500">
              <span>{b.label}</span>
              <span className="tabular-nums">
                {b.value}
                {unit}
                {b.ideal != null && (
                  <span className="ml-1 text-slate-400">(ideal {b.ideal})</span>
                )}
              </span>
            </div>
            <div className="relative h-3 rounded bg-slate-100">
              <div
                className="absolute h-full rounded bg-brand"
                style={{ width: `${(b.value / max) * 100}%` }}
              />
              {b.ideal != null && (
                <div
                  className="absolute top-[-2px] h-[16px] w-0.5 bg-amber-500"
                  style={{ left: `${(b.ideal / max) * 100}%` }}
                  title={`Ideal: ${b.ideal}`}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
