/**
 * components/PhotoEditor.tsx
 * --------------------------
 * Editor de fotografia baseado em <canvas>. Suporta:
 *   - zoom (roda do mouse), pan (arrastar), rotacao, brilho e contraste;
 *   - marcacao manual de pontos: com um landmark ativo, cada clique posiciona
 *     (ou reposiciona) o ponto correspondente nas coordenadas da imagem ORIGINAL;
 *   - selecao de ponto existente (clique proximo, sem landmark ativo);
 *   - desenho das linhas de referencia (linha media, interpupilar, etc.).
 *
 * O estado de visualizacao (view) e controlado pela pagina para que a barra de
 * ferramentas possa manipula-lo.
 */
"use client";
import { useCallback, useEffect, useRef } from "react";

import type { LandmarkDef, MarkedPoint } from "@/types";
import {
  fitScale,
  imageToScreen,
  screenToImage,
  ViewTransform,
} from "@/utils/coords";

export interface EditorView {
  scale: number;
  rotationDeg: number;
  panX: number;
  panY: number;
  brightness: number; // -100..100 (aplicado via filtro CSS do canvas)
  contrast: number; // 0..200 (%)
}

interface Props {
  imageDataUrl: string;
  points: MarkedPoint[];
  landmarkIndex: Record<string, LandmarkDef>;
  view: EditorView;
  setView: (v: EditorView) => void;
  activeLandmarkId: string | null;
  onPlace: (id: string, x: number, y: number) => void;
  onSelectPoint?: (id: string) => void;
  showReferenceLines: boolean;
  /** Recebe a escala de enquadramento ("fit") assim que a imagem carrega. */
  onFitScale?: (scale: number) => void;
}

const DRAG_THRESHOLD = 4;

export default function PhotoEditor({
  imageDataUrl,
  points,
  landmarkIndex,
  view,
  setView,
  activeLandmarkId,
  onPlace,
  onSelectPoint,
  showReferenceLines,
  onFitScale,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const fittedRef = useRef(false);

  const maybeAutoFit = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || fittedRef.current || !onFitScale) return;
    if (!canvas.width || !canvas.height) return;
    fittedRef.current = true;
    onFitScale(
      fitScale({
        imageWidth: img.naturalWidth,
        imageHeight: img.naturalHeight,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      }),
    );
  }, [onFitScale]);

  // Carrega a imagem.
  useEffect(() => {
    fittedRef.current = false;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      maybeAutoFit();
      draw();
    };
    img.src = imageDataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl]);

  const transform = useCallback((): ViewTransform => {
    const canvas = canvasRef.current!;
    const img = imgRef.current;
    return {
      scale: view.scale,
      rotationDeg: view.rotationDeg,
      panX: view.panX,
      panY: view.panY,
      imageWidth: img?.naturalWidth || 1,
      imageHeight: img?.naturalHeight || 1,
      canvasWidth: canvas?.width || 1,
      canvasHeight: canvas?.height || 1,
    };
  }, [view]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenha a imagem sob a transformacao (zoom/rotacao/pan) e filtros.
    ctx.save();
    ctx.filter = `brightness(${100 + view.brightness}%) contrast(${view.contrast}%)`;
    const cx = canvas.width / 2 + view.panX;
    const cy = canvas.height / 2 + view.panY;
    ctx.translate(cx, cy);
    ctx.rotate((view.rotationDeg * Math.PI) / 180);
    ctx.scale(view.scale, view.scale);
    ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    const t = transform();

    // Linhas de referencia.
    if (showReferenceLines) {
      drawReferenceLines(ctx, points, t);
    }

    // Pontos (tamanho fixo em tela).
    ctx.filter = "none";
    for (const p of points) {
      const lm = landmarkIndex[p.id];
      const s = imageToScreen({ x: p.x, y: p.y }, t);
      const color = lm?.color || "#22d3ee";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(String(lm?.number ?? ""), s.x + 8, s.y - 6);
    }
  }, [view, points, landmarkIndex, showReferenceLines, transform]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Redimensiona o canvas ao container.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const resize = () => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      maybeAutoFit();
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw, maybeAutoFit]);

  // ---- Interacoes ----
  function pointerPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    drag.current = { x: p.x, y: p.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const p = pointerPos(e);
    const dx = p.x - drag.current.x;
    const dy = p.y - drag.current.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.current.moved = true;
      setView({ ...view, panX: view.panX + dx, panY: view.panY + dy });
      drag.current.x = p.x;
      drag.current.y = p.y;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return; // foi um pan, nao um clique
    const p = pointerPos(e);
    const img = screenToImage(p, transform());
    // clique fora da imagem: ignora
    const w = imgRef.current?.naturalWidth || 0;
    const h = imgRef.current?.naturalHeight || 0;
    if (img.x < 0 || img.y < 0 || img.x > w || img.y > h) return;

    if (activeLandmarkId) {
      onPlace(activeLandmarkId, Math.round(img.x), Math.round(img.y));
    } else if (onSelectPoint) {
      const near = nearestPoint(p, points, transform());
      if (near) onSelectPoint(near.id);
    }
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(0.05, Math.min(20, view.scale * factor));
    setView({ ...view, scale: newScale });
  }

  return (
    <canvas
      ref={canvasRef}
      className={activeLandmarkId ? "cursor-crosshair" : "cursor-grab"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    />
  );
}

function nearestPoint(
  screenPos: { x: number; y: number },
  points: MarkedPoint[],
  t: ViewTransform,
): MarkedPoint | null {
  let best: MarkedPoint | null = null;
  let bestD = 14;
  for (const p of points) {
    const s = imageToScreen({ x: p.x, y: p.y }, t);
    const d = Math.hypot(s.x - screenPos.x, s.y - screenPos.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function line(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number } | undefined,
  b: { x: number; y: number } | undefined,
  t: ViewTransform,
  color: string,
) {
  if (!a || !b) return;
  const sa = imageToScreen(a, t);
  const sb = imageToScreen(b, t);
  ctx.beginPath();
  ctx.moveTo(sa.x, sa.y);
  ctx.lineTo(sb.x, sb.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawReferenceLines(
  ctx: CanvasRenderingContext2D,
  points: MarkedPoint[],
  t: ViewTransform,
) {
  const map: Record<string, { x: number; y: number }> = {};
  points.forEach((p) => (map[p.id] = { x: p.x, y: p.y }));

  line(ctx, map["glabella"], map["subnasale"], t, "#ef4444"); // linha media facial
  line(ctx, map["pupil_right"], map["pupil_left"], t, "#3b82f6"); // interpupilar
  line(ctx, map["commissure_right"], map["commissure_left"], t, "#ec4899");

  // plano incisal
  const incR = map["t13_incisal"] || map["t11_incisal"];
  const incL = map["t23_incisal"] || map["t21_incisal"];
  line(ctx, incR, incL, t, "#f59e0b");

  // linha media dentaria (vertical passando pelo ponto)
  const dm = map["dental_midline_upper"];
  if (dm) {
    const top = imageToScreen({ x: dm.x, y: 0 }, t);
    const bottom = imageToScreen({ x: dm.x, y: t.imageHeight }, t);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
