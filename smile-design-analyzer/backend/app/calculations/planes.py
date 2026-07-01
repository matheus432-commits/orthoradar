"""
planes.py
=========

Analise de planos de referencia horizontais:

- Linha interpupilar (pupila direita <-> pupila esquerda);
- Plano oclusal / incisal (bordas incisais dos caninos, ou dos centrais);
- Paralelismo entre os dois planos.

Em estetica dental, a linha interpupilar e a principal referencia horizontal.
O plano incisal ideal deve ser paralelo a ela.
"""
from __future__ import annotations

from typing import Dict, Optional

from .geometry import (
    Point,
    acute_angle_to_horizontal,
    angle_between_lines,
)

PARALLELISM_TOLERANCE_DEG = 2.0


def analyze_interpupillary(points: Dict[str, Point]) -> Optional[dict]:
    """Inclinacao da linha interpupilar em relacao a horizontal."""
    pr = points.get("pupil_right")
    pl = points.get("pupil_left")
    if pr is None or pl is None:
        return None
    inclination = acute_angle_to_horizontal(pr, pl)
    return {
        "inclination_deg": round(inclination, 2),
        "level": "nivelada" if inclination <= PARALLELISM_TOLERANCE_DEG else "inclinada",
    }


def _occlusal_reference(points: Dict[str, Point]) -> Optional[tuple]:
    """Escolhe os dois pontos que definem o plano incisal/oclusal.

    Preferencia: cuspides dos caninos (13 e 23). Alternativa: bordas incisais
    dos centrais (11 e 21).
    """
    r = points.get("t13_incisal")
    l = points.get("t23_incisal")
    if r is not None and l is not None:
        return (r, l)
    r = points.get("t11_incisal")
    l = points.get("t21_incisal")
    if r is not None and l is not None:
        return (r, l)
    return None


def analyze_occlusal_plane(points: Dict[str, Point]) -> Optional[dict]:
    """Inclinacao e paralelismo do plano incisal em relacao a interpupilar."""
    occ = _occlusal_reference(points)
    if occ is None:
        return None
    r, l = occ
    inclination = acute_angle_to_horizontal(r, l)

    parallelism_deg: Optional[float] = None
    pr = points.get("pupil_right")
    pl = points.get("pupil_left")
    if pr is not None and pl is not None:
        parallelism_deg = angle_between_lines(pr, pl, r, l)

    result = {
        "inclination_deg": round(inclination, 2),
        "parallelism_deg": round(parallelism_deg, 2)
        if parallelism_deg is not None
        else None,
    }
    if parallelism_deg is not None:
        result["parallel"] = parallelism_deg <= PARALLELISM_TOLERANCE_DEG
    return result
