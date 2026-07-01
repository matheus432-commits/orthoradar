"""
image_service.py
================

Manipulacao de imagem com OpenCV (unico uso do OpenCV no projeto, conforme
requisito). Duas responsabilidades:

1. Ajustes de imagem (brilho, contraste, rotacao) — endpoint opcional para o
   editor. O editor tambem faz previa no cliente via canvas; aqui garantimos
   uma versao processada de alta qualidade quando necessario.
2. Renderizacao das anotacoes (pontos, numeros e linhas de referencia) sobre a
   fotografia para compor o relatorio final (imagem com todas as linhas).

Todas as coordenadas de pontos estao em pixels da imagem ORIGINAL.
"""
from __future__ import annotations

import base64
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

Point = Tuple[float, float]


def decode_image(data: bytes) -> np.ndarray:
    """Decodifica bytes (JPEG/PNG) em uma matriz BGR do OpenCV."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Imagem invalida ou formato nao suportado.")
    return img


def decode_data_url(data_url: str) -> np.ndarray:
    """Decodifica uma data URL base64 (data:image/...;base64,....)."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return decode_image(base64.b64decode(data_url))


def encode_png(img: np.ndarray) -> bytes:
    """Codifica uma matriz BGR em PNG (bytes)."""
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise ValueError("Falha ao codificar imagem em PNG.")
    return buf.tobytes()


def encode_png_data_url(img: np.ndarray) -> str:
    """Codifica em PNG e retorna como data URL base64."""
    return "data:image/png;base64," + base64.b64encode(encode_png(img)).decode()


def get_dimensions(img: np.ndarray) -> Dict[str, int]:
    """Retorna largura e altura da imagem."""
    h, w = img.shape[:2]
    return {"width": int(w), "height": int(h)}


def adjust_image(
    img: np.ndarray,
    brightness: float = 0.0,
    contrast: float = 1.0,
    rotation_deg: float = 0.0,
) -> np.ndarray:
    """Aplica brilho, contraste e rotacao.

    Args:
        brightness: deslocamento aditivo [-100, 100] aplicado a cada pixel.
        contrast: fator multiplicativo (1.0 = sem alteracao).
        rotation_deg: rotacao em graus (sentido anti-horario), preservando
            o tamanho do quadro.

    Formula de brilho/contraste (por pixel):
        out = clamp(contrast * pixel + brightness, 0, 255)
    """
    out = cv2.convertScaleAbs(img, alpha=contrast, beta=brightness)

    if abs(rotation_deg) > 1e-3:
        h, w = out.shape[:2]
        center = (w / 2.0, h / 2.0)
        mat = cv2.getRotationMatrix2D(center, rotation_deg, 1.0)
        out = cv2.warpAffine(
            out, mat, (w, h), flags=cv2.INTER_LINEAR,
            borderMode=cv2.BORDER_CONSTANT, borderValue=(20, 20, 20),
        )
    return out


# ---------------------------------------------------------------------------
# Renderizacao de anotacoes para o relatorio
# ---------------------------------------------------------------------------

def _bgr(hex_color: str) -> Tuple[int, int, int]:
    """Converte '#RRGGBB' em tupla BGR para o OpenCV."""
    hex_color = hex_color.lstrip("#")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (b, g, r)


def _pt(p: Optional[Point]) -> Optional[Tuple[int, int]]:
    return (int(round(p[0])), int(round(p[1]))) if p else None


def render_annotations(
    img: np.ndarray,
    points: List[dict],
    landmark_index: Dict[str, dict],
) -> np.ndarray:
    """Desenha pontos, numeros e linhas de referencia sobre a imagem.

    Args:
        img: imagem original (BGR).
        points: lista [{id, x, y}] marcados.
        landmark_index: dict id->definicao do landmark (para cor e numero).

    Returns:
        Nova imagem com as anotacoes desenhadas.
    """
    canvas = img.copy()
    h, w = canvas.shape[:2]
    radius = max(4, int(min(h, w) * 0.006))
    thickness = max(1, int(min(h, w) * 0.002))

    pmap: Dict[str, Point] = {
        p["id"]: (float(p["x"]), float(p["y"])) for p in points if "x" in p and "y" in p
    }

    # --- Linhas de referencia ---
    line_color = (0, 255, 255)  # amarelo
    _draw_line(canvas, pmap.get("glabella"), pmap.get("subnasale"), (60, 60, 255), thickness)  # linha media facial (vermelho)
    _draw_vertical_through(canvas, pmap.get("dental_midline_upper"), (0, 200, 0), thickness)   # linha media dentaria
    _draw_line(canvas, pmap.get("pupil_right"), pmap.get("pupil_left"), (255, 180, 0), thickness)  # interpupilar
    _draw_line(canvas, pmap.get("commissure_right"), pmap.get("commissure_left"), (200, 0, 200), thickness)
    # plano incisal (caninos ou centrais)
    inc_r = pmap.get("t13_incisal") or pmap.get("t11_incisal")
    inc_l = pmap.get("t23_incisal") or pmap.get("t21_incisal")
    _draw_line(canvas, inc_r, inc_l, line_color, thickness)

    # --- Pontos e numeros ---
    for p in points:
        lm = landmark_index.get(p["id"], {})
        color = _bgr(lm.get("color", "#22D3EE"))
        center = _pt((float(p["x"]), float(p["y"])))
        if center is None:
            continue
        cv2.circle(canvas, center, radius, color, -1, cv2.LINE_AA)
        cv2.circle(canvas, center, radius, (255, 255, 255), 1, cv2.LINE_AA)
        num = str(lm.get("number", ""))
        if num:
            cv2.putText(
                canvas, num, (center[0] + radius + 2, center[1] - radius),
                cv2.FONT_HERSHEY_SIMPLEX, min(h, w) * 0.0006 + 0.3,
                (255, 255, 255), thickness, cv2.LINE_AA,
            )
    return canvas


def _draw_line(canvas, a, b, color, thickness):
    pa, pb = _pt(a), _pt(b)
    if pa and pb:
        cv2.line(canvas, pa, pb, color, thickness, cv2.LINE_AA)


def _draw_vertical_through(canvas, p, color, thickness):
    """Desenha uma linha vertical (topo->base) passando pelo ponto p."""
    pp = _pt(p)
    if pp:
        h = canvas.shape[0]
        cv2.line(canvas, (pp[0], 0), (pp[0], h), color, thickness, cv2.LINE_AA)
