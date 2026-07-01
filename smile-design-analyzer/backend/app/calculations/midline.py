"""
midline.py
==========

Analise das linhas medias facial e dentaria.

- Linha media facial: reta que passa por glabela e subnasal (pontos da linha
  media anatomica). Se ``menton`` existir, ele nao e usado aqui (a facial e
  definida pelo terco medio), mas fica disponivel para proporcao facial.
- Linha media dentaria: ponto de contato entre os incisivos centrais.

Metricas calculadas:
    * desvio (mm e px) da linha media dentaria em relacao a facial;
    * lado do desvio (direita / esquerda / centrada);
    * angulo (canto/inclinacao) da linha media dentaria em relacao a facial;
    * distancia interpupilar de referencia.
"""
from __future__ import annotations

from typing import Dict, Optional

from .calibration import Calibration
from .geometry import (
    Point,
    angle_between_lines,
    signed_point_line_distance,
)

# Limiar (em mm) abaixo do qual o desvio e considerado clinicamente imperceptivel.
MIDLINE_DEVIATION_NORMAL_MM = 1.0


def analyze_midline(
    points: Dict[str, Point],
    calibration: Calibration,
) -> Optional[dict]:
    """Calcula o desvio e a inclinacao da linha media dentaria.

    Args:
        points: dicionario id->(x, y) apenas com os pontos ja marcados.
        calibration: fator de conversao px->mm.

    Returns:
        dict com as metricas, ou ``None`` se faltarem pontos essenciais.
    """
    glabella = points.get("glabella")
    subnasale = points.get("subnasale")
    dental = points.get("dental_midline_upper")

    if glabella is None or subnasale is None or dental is None:
        return None

    # Distancia COM SINAL do ponto dentario ate a reta facial (glabela->subnasal).
    # Convencionamos: valor positivo => dente deslocado para a DIREITA da imagem.
    signed_px = signed_point_line_distance(dental, glabella, subnasale)

    # A "direita do paciente" e a esquerda da imagem (foto frontal, espelhada).
    # Aqui reportamos em relacao ao PACIENTE, que e o padrao clinico:
    #   x maior na imagem  = lado esquerdo do paciente.
    if abs(signed_px) < 1e-6:
        side = "centrada"
    elif signed_px > 0:
        side = "esquerda"  # deslocada para a esquerda do paciente
    else:
        side = "direita"

    deviation_px = abs(signed_px)
    deviation_mm = calibration.to_mm(deviation_px)

    # Angulo (canting) entre a linha media dentaria e a facial.
    # A linha media dentaria e aproximada pela reta dental->subnasal projetada;
    # como so temos um ponto dentario, usamos o incisal do 11/21 se disponivel
    # para dar direcao. Caso contrario, medimos a inclinacao dente->facial base.
    tooth_axis_bottom = _dental_axis_reference(points, dental)
    angle_deg: Optional[float] = None
    if tooth_axis_bottom is not None:
        angle_deg = angle_between_lines(
            glabella, subnasale, dental, tooth_axis_bottom
        )

    classification = _classify_deviation(deviation_mm)

    return {
        "deviation_px": round(deviation_px, 2),
        "deviation_mm": round(deviation_mm, 2) if deviation_mm is not None else None,
        "side": side,
        "angle_deg": round(angle_deg, 2) if angle_deg is not None else None,
        "classification": classification,
        "threshold_mm": MIDLINE_DEVIATION_NORMAL_MM,
    }


def _dental_axis_reference(
    points: Dict[str, Point], dental: Point
) -> Optional[Point]:
    """Retorna um ponto que ajuda a definir o eixo vertical da linha media dentaria.

    Preferimos o ponto medio entre as bordas incisais dos centrais; se nao
    houver, usamos nada (angulo nao calculado).
    """
    inc_r = points.get("t11_incisal")
    inc_l = points.get("t21_incisal")
    if inc_r is not None and inc_l is not None:
        return ((inc_r[0] + inc_l[0]) / 2.0, (inc_r[1] + inc_l[1]) / 2.0)
    return None


def _classify_deviation(deviation_mm: Optional[float]) -> str:
    """Classifica o desvio da linha media."""
    if deviation_mm is None:
        return "nao calibrado"
    if deviation_mm <= MIDLINE_DEVIATION_NORMAL_MM:
        return "dentro da normalidade"
    if deviation_mm <= 2.0:
        return "desvio leve"
    if deviation_mm <= 4.0:
        return "desvio moderado"
    return "desvio acentuado"
