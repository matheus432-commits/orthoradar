/**
 * components/LandmarkPanel.tsx
 * Lista de pontos anatomicos a marcar, agrupados por categoria. Mostra o ponto
 * ativo, os ja marcados (check) e o progresso dos obrigatorios.
 */
"use client";
import type { LandmarkCategory, LandmarkDef, MarkedPoint } from "@/types";

interface Props {
  categories: LandmarkCategory[];
  landmarks: LandmarkDef[];
  points: MarkedPoint[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onRemove: (id: string) => void;
}

export default function LandmarkPanel({
  categories,
  landmarks,
  points,
  activeId,
  onSelect,
  onRemove,
}: Props) {
  const marked = new Set(points.map((p) => p.id));
  const requiredTotal = landmarks.filter((l) => l.required).length;
  const requiredDone = landmarks.filter((l) => l.required && marked.has(l.id)).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Pontos anatomicos</h2>
        <p className="text-xs text-slate-500">
          Selecione um ponto e clique na foto para marca-lo.
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${requiredTotal ? (requiredDone / requiredTotal) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Obrigatorios: {requiredDone}/{requiredTotal}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {categories.map((cat) => {
          const items = landmarks.filter((l) => l.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: cat.color }}
                />
                {cat.label}
              </div>
              <ul className="space-y-1">
                {items.map((lm) => {
                  const done = marked.has(lm.id);
                  const active = activeId === lm.id;
                  return (
                    <li key={lm.id}>
                      <button
                        onClick={() => onSelect(active ? null : lm.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          active
                            ? "bg-brand text-white"
                            : done
                            ? "bg-emerald-50 text-slate-700"
                            : "hover:bg-slate-100"
                        }`}
                        title={lm.description}
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: lm.color }}
                        >
                          {lm.number}
                        </span>
                        <span className="flex-1 truncate">
                          {lm.name}
                          {lm.required && (
                            <span className="ml-1 text-[10px] text-red-400">*</span>
                          )}
                        </span>
                        {done && (
                          <span
                            className={active ? "text-white" : "text-emerald-500"}
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemove(lm.id);
                            }}
                            title="Remover ponto"
                          >
                            ✕
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
