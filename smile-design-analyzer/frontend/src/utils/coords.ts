/**
 * utils/coords.ts
 * ---------------
 * Transformacoes entre coordenadas de TELA (canvas) e coordenadas da IMAGEM
 * original, considerando zoom (scale), deslocamento (pan) e rotacao.
 *
 * Modelo de transformacao (imagem -> tela):
 *   v = p - centroImagem
 *   v = escala * v
 *   v = rotacao(theta) * v
 *   tela = v + centroCanvas + pan
 *
 * A funcao inversa desfaz cada passo na ordem contraria.
 */

export interface ViewTransform {
  scale: number;
  rotationDeg: number;
  panX: number;
  panY: number;
  /** dimensoes da imagem original */
  imageWidth: number;
  imageHeight: number;
  /** dimensoes do canvas */
  canvasWidth: number;
  canvasHeight: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

function rotate(v: Vec2, deg: number): Vec2 {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Converte um ponto da imagem original para coordenadas de tela. */
export function imageToScreen(p: Vec2, t: ViewTransform): Vec2 {
  const cx = t.imageWidth / 2;
  const cy = t.imageHeight / 2;
  let v = { x: (p.x - cx) * t.scale, y: (p.y - cy) * t.scale };
  v = rotate(v, t.rotationDeg);
  return {
    x: v.x + t.canvasWidth / 2 + t.panX,
    y: v.y + t.canvasHeight / 2 + t.panY,
  };
}

/** Converte um ponto de tela (clique) para coordenadas da imagem original. */
export function screenToImage(p: Vec2, t: ViewTransform): Vec2 {
  const cx = t.imageWidth / 2;
  const cy = t.imageHeight / 2;
  let v = {
    x: p.x - t.canvasWidth / 2 - t.panX,
    y: p.y - t.canvasHeight / 2 - t.panY,
  };
  v = rotate(v, -t.rotationDeg);
  return { x: v.x / t.scale + cx, y: v.y / t.scale + cy };
}

/** Calcula uma escala inicial para enquadrar a imagem no canvas ("fit"). */
export function fitScale(t: Pick<ViewTransform,
  "imageWidth" | "imageHeight" | "canvasWidth" | "canvasHeight">): number {
  if (!t.imageWidth || !t.imageHeight) return 1;
  return Math.min(
    t.canvasWidth / t.imageWidth,
    t.canvasHeight / t.imageHeight,
  ) * 0.95;
}
