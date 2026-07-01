/**
 * Tela 3 — Editor + Analise.
 * Reune editor de fotografia, marcacao de pontos, calibracao, calculo das
 * medidas, conclusao por IA e exportacao (PDF/PNG/JSON).
 */
"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import CalibrationPanel from "@/components/CalibrationPanel";
import LandmarkPanel from "@/components/LandmarkPanel";
import PhotoEditor, { EditorView } from "@/components/PhotoEditor";
import ResultsPanel from "@/components/ResultsPanel";
import Toolbar from "@/components/Toolbar";
import { useLandmarks } from "@/hooks/useLandmarks";
import * as api from "@/services/api";
import { getCase, saveCase } from "@/services/storage";
import type { CaseRecord, Conclusion, MarkedPoint } from "@/types";

const DEFAULT_VIEW: EditorView = {
  scale: 0.5,
  rotationDeg: 0,
  panX: 0,
  panY: 0,
  brightness: 0,
  contrast: 100,
};

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { db, index } = useLandmarks();

  const [record, setRecord] = useState<CaseRecord | null>(null);
  const [points, setPoints] = useState<MarkedPoint[]>([]);
  const [knownDistanceMm, setKnownDistanceMm] = useState<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<EditorView>(DEFAULT_VIEW);
  const [showLines, setShowLines] = useState(true);
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [conclusion, setConclusion] = useState<Conclusion | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Carrega o caso.
  useEffect(() => {
    const c = getCase(id);
    if (!c) {
      router.push("/");
      return;
    }
    setRecord(c);
    setPoints(c.points);
    setKnownDistanceMm(c.knownDistanceMm);
    setReport(c.report);
    setConclusion(c.conclusion);
  }, [id, router]);

  const persist = useCallback(
    (patch: Partial<CaseRecord>) => {
      setRecord((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        saveCase(next);
        return next;
      });
    },
    [],
  );

  // Coloca / reposiciona um ponto.
  const onPlace = useCallback(
    (pid: string, x: number, y: number) => {
      setPoints((prev) => {
        const next = prev.filter((p) => p.id !== pid);
        next.push({ id: pid, x, y });
        persist({ points: next });
        return next;
      });
      // avanca automaticamente para o proximo ponto obrigatorio nao marcado
      setActiveId((cur) => nextRequired(db?.landmarks ?? [], points, cur));
    },
    [db, points, persist],
  );

  const onRemove = useCallback(
    (pid: string) => {
      setPoints((prev) => {
        const next = prev.filter((p) => p.id !== pid);
        persist({ points: next });
        return next;
      });
    },
    [persist],
  );

  const resetView = useCallback(() => {
    setView((v) => ({ ...DEFAULT_VIEW, scale: v.scale }));
  }, []);

  // ---- Acoes ----
  async function runAnalysis() {
    setBusy("Calculando...");
    setMessage(null);
    try {
      const rep = await api.analyze(points, knownDistanceMm);
      setReport(rep);
      persist({ points, knownDistanceMm, report: rep });
    } catch (e) {
      setMessage(`Erro na análise: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  async function makeConclusion() {
    if (!report) {
      setMessage("Calcule a análise primeiro.");
      return;
    }
    setBusy("Gerando conclusão...");
    try {
      const c = await api.generateConclusion(report);
      setConclusion(c);
      persist({ conclusion: c });
    } catch (e) {
      setMessage(`Erro ao gerar conclusão: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  function exportJson() {
    const blob = new Blob(
      [JSON.stringify({ ...record, points, knownDistanceMm, report, conclusion }, null, 2)],
      { type: "application/json" },
    );
    api.downloadBlob(blob, `${record?.patient.name || "caso"}.json`);
  }

  async function exportPdf() {
    if (!record) return;
    setBusy("Gerando PDF...");
    try {
      const blob = await api.exportPdf({
        patient: record.patient,
        report: report || {},
        conclusion: conclusion?.text || "",
        points,
        image: record.imageDataUrl,
      });
      api.downloadBlob(blob, `${record.patient.name || "caso"}.pdf`);
    } catch (e) {
      setMessage(`Erro no PDF: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  async function exportPng() {
    if (!record) return;
    setBusy("Gerando PNG...");
    try {
      const blob = await api.exportPng({
        patient: record.patient,
        report: report || {},
        conclusion: conclusion?.text || "",
        points,
        image: record.imageDataUrl,
      });
      api.downloadBlob(blob, `${record.patient.name || "caso"}.png`);
    } catch (e) {
      setMessage(`Erro no PNG: ${e}`);
    } finally {
      setBusy(null);
    }
  }

  const activeName = useMemo(
    () => (activeId ? index[activeId]?.name : null),
    [activeId, index],
  );

  if (!record || !db) {
    return <p className="text-slate-500">Carregando…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {record.patient.name || "Caso sem nome"}
          </h1>
          <p className="text-xs text-slate-500">
            {record.patient.sex} · {record.patient.date} · {points.length} pontos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={!!busy} onClick={runAnalysis}>
            Calcular análise
          </button>
          <button className="btn-secondary" disabled={!!busy} onClick={makeConclusion}>
            Gerar conclusão (IA)
          </button>
          <button className="btn-secondary" disabled={!!busy} onClick={exportPdf}>
            PDF
          </button>
          <button className="btn-secondary" disabled={!!busy} onClick={exportPng}>
            PNG
          </button>
          <button className="btn-secondary" onClick={exportJson}>
            JSON
          </button>
        </div>
      </div>

      {(busy || message) && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {busy || message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_340px]">
        {/* Painel de pontos */}
        <aside className="card h-[78vh] overflow-hidden">
          <LandmarkPanel
            categories={db.categories}
            landmarks={db.landmarks}
            points={points}
            activeId={activeId}
            onSelect={setActiveId}
            onRemove={onRemove}
          />
        </aside>

        {/* Editor */}
        <section className="space-y-3">
          <Toolbar
            view={view}
            setView={setView}
            onReset={resetView}
            showLines={showLines}
            setShowLines={setShowLines}
          />
          {activeName && (
            <div className="rounded-lg bg-brand/10 px-3 py-1.5 text-sm text-brand">
              Clique na foto para marcar: <b>{activeName}</b>
            </div>
          )}
          <div className="h-[62vh] overflow-hidden rounded-xl ring-1 ring-slate-200">
            {record.imageDataUrl && (
              <PhotoEditor
                imageDataUrl={record.imageDataUrl}
                points={points}
                landmarkIndex={index}
                view={view}
                setView={setView}
                activeLandmarkId={activeId}
                onPlace={onPlace}
                onSelectPoint={(pid) => setActiveId(pid)}
                showReferenceLines={showLines}
                onFitScale={(scale) =>
                  setView((v) => ({ ...v, scale, panX: 0, panY: 0 }))
                }
              />
            )}
          </div>
          <CalibrationPanel
            points={points}
            knownDistanceMm={knownDistanceMm}
            setKnownDistanceMm={(v) => {
              setKnownDistanceMm(v);
              persist({ knownDistanceMm: v });
            }}
          />
        </section>

        {/* Resultados */}
        <aside className="h-[78vh] overflow-y-auto pr-1">
          <ResultsPanel report={report} conclusion={conclusion} />
        </aside>
      </div>
    </div>
  );
}

/** Retorna o proximo landmark obrigatorio ainda nao marcado, apos ``current``. */
function nextRequired(
  landmarks: { id: string; required: boolean }[],
  points: MarkedPoint[],
  current: string | null,
): string | null {
  const marked = new Set(points.map((p) => p.id));
  const required = landmarks.filter((l) => l.required);
  const startIdx = current
    ? required.findIndex((l) => l.id === current) + 1
    : 0;
  for (let i = startIdx; i < required.length; i++) {
    if (!marked.has(required[i].id)) return required[i].id;
  }
  // procura do inicio
  for (const l of required) {
    if (!marked.has(l.id) && l.id !== current) return l.id;
  }
  return null;
}
