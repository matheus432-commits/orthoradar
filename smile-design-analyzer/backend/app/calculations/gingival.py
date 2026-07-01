"""
gingival.py
===========

Analise gengival:

- Exposicao gengival ("gummy smile"): distancia vertical entre a borda inferior
  do labio superior e o zenith gengival dos incisivos centrais. Classificada em
  normal, moderada ou excessiva.
- Zeniths gengivais: alturas e simetria dos pontos zenith dos dentes visiveis.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from .calibration import Calibration
from .geometry import Point, mean

# Limiares clinicos (mm) para exposicao gengival abaixo do labio.
GUMMY_NORMAL_MM = 1.0     # ate ~1 mm de gengiva e considerado normal/estetico
GUMMY_MODERATE_MM = 3.0   # 1-3 mm moderada; acima disso excessiva

ZENITH_IDS = [
    "t13_zenith", "t12_zenith", "t11_zenith",
    "t21_zenith", "t22_zenith", "t23_zenith",
]


def analyze_gingival_exposure(
    points: Dict[str, Point], calibration: Calibration
) -> Optional[dict]:
    """Exposicao gengival abaixo do labio superior.

    Considera positivo quando o zenith gengival esta ABAIXO da borda do labio
    superior (gengiva exposta). Usa a media dos zeniths dos centrais.
    """
    upper_lip = points.get("upper_lip_midline")
    if upper_lip is None:
        return None

    zeniths = [points.get("t11_zenith"), points.get("t21_zenith")]
    zeniths = [z for z in zeniths if z is not None]
    if not zeniths:
        return None

    # Em coordenadas de imagem, y maior = mais para baixo.
    # gengiva exposta => zenith acima (y menor) que o labio? Nao:
    # o labio superior cobre a gengiva; se o labio esta ACIMA (y menor) do
    # zenith, ha gengiva exposta entre eles. Exposicao = zenith_y - lip_y? Nao.
    # A borda do labio marca ate onde o labio desce. Gengiva aparece quando o
    # labio para ANTES (mais alto) do zenith. Exposicao vertical =
    # (zenith_y - upper_lip_y) quando negativa significa labio abaixo do zenith
    # (nenhuma gengiva). Usamos: gengiva exposta = upper_lip_y acima do zenith.
    avg_zenith_y = mean([z[1] for z in zeniths])
    exposure_px = upper_lip[1] - avg_zenith_y
    # exposure_px > 0 => labio esta abaixo do zenith (cobre alem) => sem gengiva
    # exposure_px < 0 => labio acima do zenith => gengiva exposta.
    gingival_show_px = max(0.0, -exposure_px)

    gingival_mm = calibration.to_mm(gingival_show_px)
    classification = _classify_gummy(gingival_mm)

    return {
        "exposure_px": round(gingival_show_px, 2),
        "exposure_mm": round(gingival_mm, 2) if gingival_mm is not None else None,
        "classification": classification,
    }


def _classify_gummy(exposure_mm: Optional[float]) -> str:
    if exposure_mm is None:
        return "nao calibrado"
    if exposure_mm <= GUMMY_NORMAL_MM:
        return "normal"
    if exposure_mm <= GUMMY_MODERATE_MM:
        return "moderada"
    return "excessiva"


def analyze_gingival_zeniths(
    points: Dict[str, Point], calibration: Calibration
) -> Optional[dict]:
    """Alturas relativas dos zeniths e simetria entre lados homologos.

    Referencia vertical: o zenith mais apical (mais alto) recebe altura 0; os
    demais recebem a distancia (para baixo) em relacao a ele.
    """
    present = {zid: points[zid] for zid in ZENITH_IDS if zid in points}
    if len(present) < 2:
        return None

    top_y = min(p[1] for p in present.values())  # zenith mais apical
    heights = {}
    for zid, p in present.items():
        px = p[1] - top_y
        heights[zid] = {
            "height_px": round(px, 2),
            "height_mm": round(calibration.to_mm(px), 2)
            if calibration.to_mm(px) is not None
            else None,
        }

    # Simetria entre pares homologos: |altura_dir - altura_esq|.
    pairs = [("t13_zenith", "t23_zenith"),
             ("t12_zenith", "t22_zenith"),
             ("t11_zenith", "t21_zenith")]
    symmetry = []
    for r, l in pairs:
        if r in heights and l in heights:
            diff_px = abs(heights[r]["height_px"] - heights[l]["height_px"])
            symmetry.append({
                "pair": f"{r}/{l}",
                "diff_px": round(diff_px, 2),
                "diff_mm": round(calibration.to_mm(diff_px), 2)
                if calibration.to_mm(diff_px) is not None
                else None,
            })

    return {
        "heights": heights,
        "symmetry": symmetry,
    }
