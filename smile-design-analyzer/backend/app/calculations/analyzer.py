"""
analyzer.py
===========

Orquestrador central: recebe os pontos marcados e a calibracao, executa todos
os modulos de calculo e monta um relatorio estruturado unico.

Este modulo NAO depende de FastAPI nem de OpenCV — e uma funcao pura que pode
ser testada isoladamente. A camada de API converte a entrada/saida.
"""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from .calibration import build_calibration
from .facial import analyze_facial_proportion, analyze_lip_symmetry
from .geometry import Point
from .gingival import analyze_gingival_exposure, analyze_gingival_zeniths
from .midline import analyze_midline
from .planes import analyze_interpupillary, analyze_occlusal_plane
from .smile import (
    analyze_buccal_corridor,
    analyze_smile_arc,
    analyze_smile_symmetry,
)
from .teeth import (
    analyze_central_dominance,
    analyze_connectors,
    analyze_golden_proportion,
    analyze_incisal_progression,
    analyze_tooth_dimensions,
)


def _to_point_dict(points: List[dict]) -> Dict[str, Point]:
    """Converte lista de pontos [{id, x, y}] em dict id->(x, y)."""
    result: Dict[str, Point] = {}
    for p in points:
        pid = p.get("id")
        x = p.get("x")
        y = p.get("y")
        if pid is not None and x is not None and y is not None:
            result[pid] = (float(x), float(y))
    return result


def run_analysis(
    points: List[dict],
    known_distance_mm: Optional[float] = None,
) -> dict:
    """Executa a analise completa do sorriso.

    Args:
        points: lista de pontos marcados, cada um ``{"id", "x", "y"}`` em pixels
            da imagem original.
        known_distance_mm: valor real (mm) da distancia entre ``calibration_a`` e
            ``calibration_b``. Se ``None`` ou pontos ausentes, medidas ficam em px.

    Returns:
        dict com secoes: calibration, midline, planes, smile, gingival, teeth,
        facial e um bloco ``summary`` com os principais numeros.
    """
    pts = _to_point_dict(points)

    calibration = build_calibration(
        pts.get("calibration_a"),
        pts.get("calibration_b"),
        known_distance_mm,
    )

    dimensions = analyze_tooth_dimensions(pts, calibration)

    report = {
        "calibration": {
            "is_calibrated": calibration.is_calibrated,
            "mm_per_pixel": round(calibration.mm_per_pixel, 5)
            if calibration.mm_per_pixel
            else None,
            "reference_pixels": round(calibration.reference_pixels, 2)
            if calibration.reference_pixels
            else None,
            "reference_mm": calibration.reference_mm,
        },
        "midline": analyze_midline(pts, calibration),
        "interpupillary": analyze_interpupillary(pts),
        "occlusal_plane": analyze_occlusal_plane(pts),
        "smile_arc": analyze_smile_arc(pts),
        "buccal_corridor": analyze_buccal_corridor(pts),
        "smile_symmetry": analyze_smile_symmetry(pts),
        "gingival_exposure": analyze_gingival_exposure(pts, calibration),
        "gingival_zeniths": analyze_gingival_zeniths(pts, calibration),
        "tooth_dimensions": dimensions,
        "golden_proportion": analyze_golden_proportion(dimensions),
        "central_dominance": analyze_central_dominance(dimensions),
        "connectors": analyze_connectors(pts),
        "incisal_progression": analyze_incisal_progression(pts),
        "facial_proportion": analyze_facial_proportion(pts),
        "lip_symmetry": analyze_lip_symmetry(pts),
    }

    report["summary"] = _build_summary(report)
    return report


def _build_summary(report: dict) -> dict:
    """Extrai os numeros-chave para exibicao rapida e para a IA."""
    summary: dict = {}

    md = report.get("midline")
    if md:
        summary["midline_deviation_mm"] = md.get("deviation_mm")
        summary["midline_deviation_px"] = md.get("deviation_px")
        summary["midline_side"] = md.get("side")
        summary["midline_classification"] = md.get("classification")

    ge = report.get("gingival_exposure")
    if ge:
        summary["gingival_exposure_mm"] = ge.get("exposure_mm")
        summary["gingival_classification"] = ge.get("classification")

    bc = report.get("buccal_corridor")
    if bc:
        summary["buccal_corridor_symmetry_percent"] = bc.get("symmetry_percent")
        summary["buccal_corridor_classification"] = bc.get("classification")

    sa = report.get("smile_arc")
    if sa:
        summary["smile_arc_shape"] = sa.get("arc_shape")
        summary["smile_line"] = sa.get("smile_line")

    ss = report.get("smile_symmetry")
    if ss:
        summary["smile_symmetry_percent"] = ss.get("overall_percent")

    ip = report.get("interpupillary")
    if ip:
        summary["interpupillary_inclination_deg"] = ip.get("inclination_deg")

    op = report.get("occlusal_plane")
    if op:
        summary["occlusal_parallelism_deg"] = op.get("parallelism_deg")

    cd = report.get("central_dominance")
    if cd:
        summary["central_dominance_index"] = cd.get("dominance_index")

    ls = report.get("lip_symmetry")
    if ls:
        summary["lip_symmetry"] = ls.get("classification")

    return summary
