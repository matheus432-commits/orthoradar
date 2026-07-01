"""
teeth.py
========

Analise dente a dente e proporcoes entre dentes:

- Largura aparente (mesial<->distal) de cada dente visivel;
- Altura aparente (zenith<->borda incisal) de cada dente;
- Relacao largura/altura (ideal ~0.75-0.85 para incisivos centrais);
- Proporcao aurea / RED (Recurring Esthetic Dental): comparacao das larguras
  aparentes central : lateral : canino (ideal ~ 1 : 0.618 : 0.382);
- Indice de dominancia do incisivo central;
- Conectores dentarios (regra estetica 50-40-30, aproximada);
- Progressao incisal.

Referencias de valores ideais:
    Golden proportion (Levin): cada dente ~62% da largura do dente mesial a ele.
    Relacao largura/altura do central: ~78% (0.78).
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .calibration import Calibration
from .geometry import Point, distance

# Ordem espacial dos dentes (direita do paciente -> esquerda).
TEETH_ORDER = ["13", "12", "11", "21", "22", "23"]

GOLDEN_RATIO = 0.618  # 1/phi
WH_RATIO_IDEAL = 0.78  # relacao largura/altura ideal do incisivo central


def _tooth_points(points: Dict[str, Point], tooth: str) -> dict:
    return {
        "mesial": points.get(f"t{tooth}_mesial"),
        "distal": points.get(f"t{tooth}_distal"),
        "incisal": points.get(f"t{tooth}_incisal"),
        "zenith": points.get(f"t{tooth}_zenith"),
    }


def analyze_tooth_dimensions(
    points: Dict[str, Point], calibration: Calibration
) -> dict:
    """Largura, altura e relacao largura/altura de cada dente visivel."""
    result: Dict[str, dict] = {}
    for tooth in TEETH_ORDER:
        tp = _tooth_points(points, tooth)
        entry: dict = {"tooth": tooth}

        width_px = None
        if tp["mesial"] is not None and tp["distal"] is not None:
            width_px = distance(tp["mesial"], tp["distal"])
        height_px = None
        if tp["incisal"] is not None and tp["zenith"] is not None:
            height_px = distance(tp["incisal"], tp["zenith"])

        entry["width_px"] = round(width_px, 2) if width_px is not None else None
        entry["height_px"] = round(height_px, 2) if height_px is not None else None
        entry["width_mm"] = (
            round(calibration.to_mm(width_px), 2)
            if calibration.to_mm(width_px) is not None
            else None
        )
        entry["height_mm"] = (
            round(calibration.to_mm(height_px), 2)
            if calibration.to_mm(height_px) is not None
            else None
        )

        if width_px and height_px and height_px > 0:
            ratio = width_px / height_px
            entry["width_height_ratio"] = round(ratio, 3)
            entry["ratio_ideal"] = WH_RATIO_IDEAL
            entry["ratio_delta"] = round(ratio - WH_RATIO_IDEAL, 3)
        else:
            entry["width_height_ratio"] = None

        if width_px is not None or height_px is not None:
            result[tooth] = entry

    return result


def analyze_golden_proportion(dimensions: dict) -> Optional[dict]:
    """Compara as larguras aparentes seguindo a proporcao aurea (RED).

    Do ponto de vista frontal, a largura aparente de cada dente deve ser ~61.8%
    da largura do dente imediatamente mesial (mais central).

    Calcula, para cada lado, as razoes:
        lateral / central  (ideal ~0.618)
        canino  / lateral  (ideal ~0.618)
    """
    def width(tooth: str) -> Optional[float]:
        d = dimensions.get(tooth)
        return d["width_px"] if d and d.get("width_px") else None

    sides = {
        "direito": {"central": "11", "lateral": "12", "canino": "13"},
        "esquerdo": {"central": "21", "lateral": "22", "canino": "23"},
    }

    output = {}
    any_data = False
    for side, teeth in sides.items():
        c = width(teeth["central"])
        la = width(teeth["lateral"])
        ca = width(teeth["canino"])
        side_res = {}
        if c and la:
            side_res["lateral_central_ratio"] = round(la / c, 3)
            side_res["lateral_central_ideal"] = GOLDEN_RATIO
            any_data = True
        if la and ca:
            side_res["canine_lateral_ratio"] = round(ca / la, 3)
            side_res["canine_lateral_ideal"] = GOLDEN_RATIO
            any_data = True
        if side_res:
            output[side] = side_res

    if not any_data:
        return None

    output["reference"] = {
        "description": "Cada dente ~61.8% da largura do dente mesial (proporcao aurea).",
        "golden_ratio": GOLDEN_RATIO,
    }
    return output


def analyze_central_dominance(dimensions: dict) -> Optional[dict]:
    """Indice de dominancia do incisivo central.

    Os incisivos centrais devem dominar o sorriso. O indice e a razao entre a
    largura media dos centrais e a largura media dos laterais (ideal ~1.6, ou
    seja, o inverso da proporcao aurea).
    """
    def width(tooth: str) -> Optional[float]:
        d = dimensions.get(tooth)
        return d["width_px"] if d and d.get("width_px") else None

    centrals = [w for w in (width("11"), width("21")) if w]
    laterals = [w for w in (width("12"), width("22")) if w]
    if not centrals or not laterals:
        return None

    avg_c = sum(centrals) / len(centrals)
    avg_l = sum(laterals) / len(laterals)
    index = avg_c / avg_l if avg_l else None
    if index is None:
        return None

    return {
        "dominance_index": round(index, 3),
        "ideal": round(1.0 / GOLDEN_RATIO, 3),  # ~1.618
        "interpretation": "boa dominancia dos centrais"
        if index >= 1.4
        else "dominancia reduzida dos centrais",
    }


def analyze_connectors(points: Dict[str, Point]) -> Optional[dict]:
    """Conectores dentarios — regra estetica 50-40-30 (aproximada).

    O conector e a area de contato entre dentes adjacentes. A regra estetica diz
    que o conector central-central ocupa ~50% da altura do central, o
    central-lateral ~40% e o lateral-canino ~30%.

    Como cada interproximal possui apenas um ponto de contato marcado, estimamos
    o comprimento do conector pela posicao vertical do ponto de contato em
    relacao a borda incisal do central: quanto mais gengival o contato, maior o
    conector. O valor e reportado como percentual da altura do central 11.
    """
    central_incisal = points.get("t11_incisal")
    central_zenith = points.get("t11_zenith")
    if central_incisal is None or central_zenith is None:
        return None
    central_height = abs(central_zenith[1] - central_incisal[1])
    if central_height <= 0:
        return None

    def connector_pct(contact_id: str) -> Optional[float]:
        c = points.get(contact_id)
        if c is None:
            return None
        # distancia vertical do contato ate a borda incisal / altura do central
        return round(abs(c[1] - central_incisal[1]) / central_height * 100.0, 1)

    return {
        "central_central_percent": connector_pct("dental_midline_upper"),
        "central_lateral_percent": connector_pct("t11_mesial"),
        "lateral_canine_percent": connector_pct("t12_mesial"),
        "reference": {"ideal": "50-40-30 (%) da altura do central"},
    }


def analyze_incisal_progression(points: Dict[str, Point]) -> Optional[dict]:
    """Progressao incisal: variacao vertical das bordas incisais.

    Do central ao canino, as bordas incisais tipicamente progridem: laterais
    ligeiramente mais curtos (mais altos/gengival) e caninos ao nivel dos
    centrais. Mede as diferencas verticais (px) em relacao ao central 11.
    """
    ref = points.get("t11_incisal")
    if ref is None:
        return None
    seq = ["t11_incisal", "t12_incisal", "t13_incisal",
           "t21_incisal", "t22_incisal", "t23_incisal"]
    progression = {}
    for pid in seq:
        p = points.get(pid)
        if p is not None:
            # y maior = mais para baixo (mais longo). diff relativo ao central.
            progression[pid] = round(p[1] - ref[1], 2)
    if len(progression) < 2:
        return None
    return {
        "relative_incisal_y_px": progression,
        "note": "Valores positivos = borda mais baixa que o central 11.",
    }
