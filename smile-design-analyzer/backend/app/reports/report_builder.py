"""
report_builder.py
=================

Transforma o relatorio bruto (dict de ``run_analysis``) em uma estrutura
tabular pronta para renderizacao (PDF, HTML, PNG). Nao gera arquivos — apenas
organiza linhas de tabela e secoes, mantendo a separacao interface/calculo.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

Row = Tuple[str, str]  # (rotulo, valor)


def _fmt(value, unit: str = "") -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "Sim" if value else "Nao"
    if isinstance(value, float):
        value = round(value, 2)
    return f"{value}{(' ' + unit) if unit else ''}"


def build_tables(report: dict) -> List[dict]:
    """Monta as secoes tabulares do relatorio.

    Returns:
        Lista de secoes ``{"title": str, "rows": List[Row]}``.
    """
    sections: List[dict] = []

    md = report.get("midline")
    if md:
        sections.append({
            "title": "Linha media",
            "rows": [
                ("Desvio (mm)", _fmt(md.get("deviation_mm"), "mm")),
                ("Desvio (px)", _fmt(md.get("deviation_px"), "px")),
                ("Lado do desvio", _fmt(md.get("side"))),
                ("Angulo (graus)", _fmt(md.get("angle_deg"), "graus")),
                ("Classificacao", _fmt(md.get("classification"))),
            ],
        })

    ge = report.get("gingival_exposure")
    if ge:
        sections.append({
            "title": "Exposicao gengival",
            "rows": [
                ("Exposicao (mm)", _fmt(ge.get("exposure_mm"), "mm")),
                ("Exposicao (px)", _fmt(ge.get("exposure_px"), "px")),
                ("Classificacao", _fmt(ge.get("classification"))),
            ],
        })

    bc = report.get("buccal_corridor")
    if bc:
        sections.append({
            "title": "Corredor bucal",
            "rows": [
                ("Corredor direito (%)", _fmt(bc.get("right_percent"), "%")),
                ("Corredor esquerdo (%)", _fmt(bc.get("left_percent"), "%")),
                ("Simetria (%)", _fmt(bc.get("symmetry_percent"), "%")),
                ("Classificacao", _fmt(bc.get("classification"))),
            ],
        })

    ip = report.get("interpupillary")
    op = report.get("occlusal_plane")
    plane_rows: List[Row] = []
    if ip:
        plane_rows.append(("Inclinacao interpupilar (graus)", _fmt(ip.get("inclination_deg"), "graus")))
    if op:
        plane_rows.append(("Inclinacao plano incisal (graus)", _fmt(op.get("inclination_deg"), "graus")))
        plane_rows.append(("Paralelismo (graus)", _fmt(op.get("parallelism_deg"), "graus")))
    if plane_rows:
        sections.append({"title": "Planos horizontais", "rows": plane_rows})

    sa = report.get("smile_arc")
    if sa:
        sections.append({
            "title": "Arco / linha do sorriso",
            "rows": [
                ("Forma do arco", _fmt(sa.get("arc_shape"))),
                ("Linha do sorriso", _fmt(sa.get("smile_line"))),
            ],
        })

    ss = report.get("smile_symmetry")
    if ss:
        sections.append({
            "title": "Simetria do sorriso",
            "rows": [
                ("Simetria global (%)", _fmt(ss.get("overall_percent"), "%")),
                ("Classificacao", _fmt(ss.get("classification"))),
            ],
        })

    cd = report.get("central_dominance")
    if cd:
        sections.append({
            "title": "Dominancia do incisivo central",
            "rows": [
                ("Indice de dominancia", _fmt(cd.get("dominance_index"))),
                ("Ideal", _fmt(cd.get("ideal"))),
                ("Interpretacao", _fmt(cd.get("interpretation"))),
            ],
        })

    dims = report.get("tooth_dimensions")
    if dims:
        rows: List[Row] = []
        for tooth in ["13", "12", "11", "21", "22", "23"]:
            d = dims.get(tooth)
            if not d:
                continue
            w = _fmt(d.get("width_mm") or d.get("width_px"),
                     "mm" if d.get("width_mm") else "px")
            h = _fmt(d.get("height_mm") or d.get("height_px"),
                     "mm" if d.get("height_mm") else "px")
            r = _fmt(d.get("width_height_ratio"))
            rows.append((f"Dente {tooth}", f"L: {w} | A: {h} | L/A: {r}"))
        if rows:
            sections.append({"title": "Dimensoes dentarias", "rows": rows})

    fp = report.get("facial_proportion")
    if fp:
        sections.append({
            "title": "Proporcao facial",
            "rows": [
                ("Terco medio (px)", _fmt(fp.get("middle_third_px"), "px")),
                ("Terco inferior (px)", _fmt(fp.get("lower_third_px"), "px")),
                ("Razao inferior/medio", _fmt(fp.get("lower_middle_ratio"))),
                ("Equilibrado", _fmt(fp.get("balanced"))),
            ],
        })

    ls = report.get("lip_symmetry")
    if ls:
        sections.append({
            "title": "Simetria labial",
            "rows": [
                ("Dif. altura comissuras (px)", _fmt(ls.get("commissure_height_diff_px"), "px")),
                ("Classificacao", _fmt(ls.get("classification"))),
            ],
        })

    return sections


def chart_data(report: dict) -> dict:
    """Dados numericos para graficos (barras) do relatorio/front."""
    bc = report.get("buccal_corridor") or {}
    ss = report.get("smile_symmetry") or {}
    gp = report.get("golden_proportion") or {}

    golden_bars = []
    for side in ("direito", "esquerdo"):
        sd = gp.get(side) if isinstance(gp, dict) else None
        if sd and "lateral_central_ratio" in sd:
            golden_bars.append({
                "label": f"Lat/Cen {side}",
                "value": sd["lateral_central_ratio"],
                "ideal": sd.get("lateral_central_ideal"),
            })

    return {
        "buccal_corridor": {
            "right": bc.get("right_percent"),
            "left": bc.get("left_percent"),
            "symmetry": bc.get("symmetry_percent"),
        },
        "smile_symmetry": ss.get("overall_percent"),
        "golden_proportion": golden_bars,
    }
