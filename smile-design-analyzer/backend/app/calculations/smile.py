"""
smile.py
========

Analise do sorriso propriamente dito:

- Linha do sorriso / arco do sorriso: relacao entre a curva das bordas incisais
  superiores e o labio inferior. Classificada em consonante (paralela ao labio),
  reta ou reversa; e a forma do arco em convexa / plana / concava.
- Corredor bucal (buccal corridor): espacos escuros entre os dentes posteriores
  visiveis e as comissuras. Calculado em percentual e simetria.
- Simetria do sorriso: comparacao direita x esquerda a partir da linha media.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .geometry import (
    Point,
    curvature_of_three_points,
    distance,
    mean,
)

# Ordem dos dentes da direita do paciente para a esquerda (esquerda->direita na imagem).
INCISAL_SEQUENCE_RIGHT = ["t13_incisal", "t12_incisal", "t11_incisal"]
INCISAL_SEQUENCE_LEFT = ["t21_incisal", "t22_incisal", "t23_incisal"]


def analyze_smile_arc(points: Dict[str, Point]) -> Optional[dict]:
    """Classifica o arco do sorriso e a linha do sorriso.

    Usa as bordas incisais dos centrais e caninos para medir a curvatura, e
    compara com o labio inferior quando disponivel.
    """
    incisals = _ordered_incisals(points)
    if len(incisals) < 3:
        return None

    left = incisals[0]
    mid = incisals[len(incisals) // 2]
    right = incisals[-1]

    # Curvatura com sinal. Na convencao de imagem (y para baixo), uma curva
    # cujos cantos sobem em relacao ao centro (sorriso "feliz") tem area com
    # sinal negativo -> tratamos o sinal para classificar concavidade.
    curv = curvature_of_three_points(left, mid, right)

    # Amplitude vertical: quanto o centro esta abaixo da linha dos cantos.
    chord_mid_y = (left[1] + right[1]) / 2.0
    sagitta = mid[1] - chord_mid_y  # >0 => centro mais baixo (arco convexo p/ baixo)

    if abs(sagitta) < 2.0:
        arc_shape = "plano"
    elif sagitta > 0:
        arc_shape = "convexo"  # bordas incisais acompanham curva para baixo
    else:
        arc_shape = "concavo"  # reverso (cantos mais baixos que o centro)

    smile_line = _classify_smile_line(points, incisals)

    return {
        "curvature": round(curv, 6),
        "sagitta_px": round(sagitta, 2),
        "arc_shape": arc_shape,
        "smile_line": smile_line,
    }


def _classify_smile_line(
    points: Dict[str, Point], incisals: List[Point]
) -> str:
    """Consonante / reta / reversa comparando incisais com o labio inferior."""
    lower_lip = points.get("lower_lip_midline")
    if lower_lip is None:
        return "nao avaliado (labio inferior nao marcado)"

    # Distancia media (com sinal em y) das incisais ate o labio inferior.
    diffs = [inc[1] - lower_lip[1] for inc in incisals]
    avg = mean(diffs)
    if abs(avg) < 3.0:
        return "reta"
    if avg < 0:
        # incisais acima do labio inferior (curva acompanha) -> consonante
        return "consonante (curva do sorriso favoravel)"
    return "reversa"


def _ordered_incisals(points: Dict[str, Point]) -> List[Point]:
    """Bordas incisais na ordem esquerda->direita da imagem (direita->esquerda paciente)."""
    order = INCISAL_SEQUENCE_RIGHT + INCISAL_SEQUENCE_LEFT
    result = [points[i] for i in order if i in points]
    # ordena por x para garantir sequencia espacial correta
    result.sort(key=lambda p: p[0])
    return result


def analyze_buccal_corridor(points: Dict[str, Point]) -> Optional[dict]:
    """Corredor bucal direito, esquerdo, percentual e simetria.

    Definimos:
        - largura total do sorriso = distancia entre comissuras;
        - limite visivel dos dentes = distais dos caninos (13 e 23);
        - corredor direito = espaco entre comissura direita e distal do 13;
        - corredor esquerdo = espaco entre comissura esquerda e distal do 23.

    O percentual e a fracao do corredor em relacao a largura total do sorriso.
    """
    comm_r = points.get("commissure_right")
    comm_l = points.get("commissure_left")
    if comm_r is None or comm_l is None:
        return None

    total_width = distance(comm_r, comm_l)
    if total_width <= 0:
        return None

    dist_r = points.get("t13_distal") or points.get("t13_incisal")
    dist_l = points.get("t23_distal") or points.get("t23_incisal")
    if dist_r is None or dist_l is None:
        return {
            "total_width_px": round(total_width, 2),
            "note": "Marque as distais dos caninos (13/23) para o corredor bucal.",
        }

    # Usa apenas a componente horizontal (x) para os corredores laterais.
    right_corridor = abs(dist_r[0] - comm_r[0])
    left_corridor = abs(comm_l[0] - dist_l[0])

    right_pct = right_corridor / total_width * 100.0
    left_pct = left_corridor / total_width * 100.0

    # Simetria: 100% quando corredores iguais.
    if max(right_corridor, left_corridor) > 0:
        symmetry = (
            min(right_corridor, left_corridor)
            / max(right_corridor, left_corridor)
            * 100.0
        )
    else:
        symmetry = 100.0

    return {
        "total_width_px": round(total_width, 2),
        "right_corridor_px": round(right_corridor, 2),
        "left_corridor_px": round(left_corridor, 2),
        "right_percent": round(right_pct, 1),
        "left_percent": round(left_pct, 1),
        "symmetry_percent": round(symmetry, 1),
        "classification": _classify_corridor(right_pct + left_pct),
    }


def _classify_corridor(total_pct: float) -> str:
    """Classifica o corredor bucal combinado (direito + esquerdo)."""
    if total_pct < 10.0:
        return "corredor reduzido / ausente"
    if total_pct <= 22.0:
        return "corredor adequado"
    return "corredor amplo"


def analyze_smile_symmetry(points: Dict[str, Point]) -> Optional[dict]:
    """Simetria global do sorriso (direita x esquerda) em relacao a linha media.

    Compara distancias horizontais de estruturas homologas (comissuras,
    caninos, incisivos) ao eixo medio dentario.
    """
    axis = points.get("dental_midline_upper")
    if axis is None:
        return None
    axis_x = axis[0]

    pairs: List[Tuple[str, str]] = [
        ("commissure_right", "commissure_left"),
        ("t13_distal", "t23_distal"),
        ("t13_incisal", "t23_incisal"),
        ("t11_incisal", "t21_incisal"),
    ]

    ratios: List[float] = []
    detail = []
    for right_id, left_id in pairs:
        r = points.get(right_id)
        l = points.get(left_id)
        if r is None or l is None:
            continue
        dr = abs(axis_x - r[0])
        dl = abs(l[0] - axis_x)
        if max(dr, dl) == 0:
            continue
        ratio = min(dr, dl) / max(dr, dl) * 100.0
        ratios.append(ratio)
        detail.append({"pair": f"{right_id}/{left_id}", "symmetry_percent": round(ratio, 1)})

    if not ratios:
        return None

    overall = mean(ratios)
    return {
        "overall_percent": round(overall, 1),
        "classification": "simetrico" if overall >= 90 else "assimetrico",
        "details": detail,
    }
