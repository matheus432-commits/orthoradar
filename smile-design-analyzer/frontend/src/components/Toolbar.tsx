/**
 * components/Toolbar.tsx
 * Controles de zoom, rotacao, brilho, contraste e reset da visualizacao.
 */
"use client";
import type { EditorView } from "./PhotoEditor";

interface Props {
  view: EditorView;
  setView: (v: EditorView) => void;
  onReset: () => void;
  showLines: boolean;
  setShowLines: (v: boolean) => void;
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col text-xs text-slate-600">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-slate-400">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-brand"
      />
    </label>
  );
}

export default function Toolbar({
  view,
  setView,
  onReset,
  showLines,
  setShowLines,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary py-1"
          onClick={() => setView({ ...view, scale: view.scale * 1.2 })}
          title="Zoom +"
        >
          ＋
        </button>
        <button
          className="btn-secondary py-1"
          onClick={() => setView({ ...view, scale: Math.max(0.05, view.scale / 1.2) })}
          title="Zoom -"
        >
          －
        </button>
        <span className="ml-1 text-xs text-slate-400">
          {(view.scale * 100).toFixed(0)}%
        </span>
      </div>

      <div className="w-36">
        <Slider
          label="Rotacao"
          min={-45}
          max={45}
          step={0.5}
          value={view.rotationDeg}
          suffix="°"
          onChange={(v) => setView({ ...view, rotationDeg: v })}
        />
      </div>
      <div className="w-36">
        <Slider
          label="Brilho"
          min={-100}
          max={100}
          step={1}
          value={view.brightness}
          onChange={(v) => setView({ ...view, brightness: v })}
        />
      </div>
      <div className="w-36">
        <Slider
          label="Contraste"
          min={0}
          max={200}
          step={1}
          value={view.contrast}
          suffix="%"
          onChange={(v) => setView({ ...view, contrast: v })}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={showLines}
          onChange={(e) => setShowLines(e.target.checked)}
          className="accent-brand"
        />
        Linhas de referencia
      </label>

      <button className="btn-ghost py-1" onClick={onReset} title="Resetar visualizacao">
        ↺ Reset
      </button>
    </div>
  );
}
