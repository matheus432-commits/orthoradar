"""
facial.py
=========

Proporcao facial e simetria labial.

- Proporcao facial: usa glabela, subnasal e menton para estimar os tercos
  faciais medio e inferior (idealmente iguais).
- Simetria labial: compara as alturas das comissuras em relacao a linha
  interpupilar / horizontal.
"""
from __future__ import annotations

from typing import Dict, Optional

from .geometry import Point, distance, mean


def analyze_facial_proportion(points: Dict[str, Point]) -> Optional[dict]:
    """Relacao entre o terco medio (glabela->subnasal) e o inferior (subnasal->menton)."""
    glabella = points.get("glabella")
    subnasale = points.get("subnasale")
    menton = points.get("menton")
    if glabella is None or subnasale is None or menton is None:
        return None

    middle_third = distance(glabella, subnasale)
    lower_third = distance(subnasale, menton)
    if middle_third <= 0 or lower_third <= 0:
        return None

    ratio = lower_third / middle_third
    return {
        "middle_third_px": round(middle_third, 2),
        "lower_third_px": round(lower_third, 2),
        "lower_middle_ratio": round(ratio, 3),
        "balanced": abs(ratio - 1.0) <= 0.1,
        "note": "Tercos medio e inferior idealmente equivalentes (razao ~1.0).",
    }


def analyze_lip_symmetry(points: Dict[str, Point]) -> Optional[dict]:
    """Simetria labial: diferenca vertical entre as comissuras.

    Referencia horizontal: media do y das pupilas se disponivel, senao a media
    das proprias comissuras.
    """
    comm_r = points.get("commissure_right")
    comm_l = points.get("commissure_left")
    if comm_r is None or comm_l is None:
        return None

    diff_px = abs(comm_r[1] - comm_l[1])
    lower_side = None
    if comm_r[1] > comm_l[1]:
        lower_side = "direita"
    elif comm_l[1] > comm_r[1]:
        lower_side = "esquerda"

    return {
        "commissure_height_diff_px": round(diff_px, 2),
        "lower_commissure_side": lower_side,
        "classification": "simetrico" if diff_px <= 3.0 else "assimetria labial",
    }
