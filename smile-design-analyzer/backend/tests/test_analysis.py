"""
Testes de integracao dos modulos de calculo, usando um conjunto sintetico de
pontos com geometria conhecida.

Sistema de coordenadas do teste (imagem 1000x800, y para baixo):
    - Linha media facial vertical em x=500 (glabela/subnasal/menton).
    - Linha media dentaria em x=510 -> desvio de 10 px para a esquerda do paciente.
    - Calibracao: 100 px = 10 mm -> 0.1 mm/px (10 px = 1 mm).
"""
import pytest

from app.calculations import run_analysis


def base_points():
    return [
        {"id": "pupil_right", "x": 400, "y": 150},
        {"id": "pupil_left", "x": 600, "y": 150},
        {"id": "glabella", "x": 500, "y": 100},
        {"id": "subnasale", "x": 500, "y": 300},
        {"id": "menton", "x": 500, "y": 700},
        {"id": "commissure_right", "x": 380, "y": 420},
        {"id": "commissure_left", "x": 620, "y": 420},
        {"id": "upper_lip_midline", "x": 500, "y": 395},
        {"id": "lower_lip_midline", "x": 500, "y": 470},
        {"id": "dental_midline_upper", "x": 510, "y": 400},
        # centrais
        {"id": "t11_mesial", "x": 505, "y": 400},
        {"id": "t11_distal", "x": 470, "y": 400},
        {"id": "t11_incisal", "x": 487, "y": 440},
        {"id": "t11_zenith", "x": 487, "y": 388},
        {"id": "t21_mesial", "x": 515, "y": 400},
        {"id": "t21_distal", "x": 550, "y": 400},
        {"id": "t21_incisal", "x": 533, "y": 440},
        {"id": "t21_zenith", "x": 533, "y": 388},
        # laterais
        {"id": "t12_mesial", "x": 468, "y": 405},
        {"id": "t12_distal", "x": 447, "y": 405},
        {"id": "t12_incisal", "x": 457, "y": 435},
        {"id": "t12_zenith", "x": 457, "y": 392},
        {"id": "t22_mesial", "x": 552, "y": 405},
        {"id": "t22_distal", "x": 573, "y": 405},
        {"id": "t22_incisal", "x": 563, "y": 435},
        {"id": "t22_zenith", "x": 563, "y": 392},
        # caninos
        {"id": "t13_distal", "x": 430, "y": 415},
        {"id": "t13_incisal", "x": 440, "y": 440},
        {"id": "t23_distal", "x": 570, "y": 415},
        {"id": "t23_incisal", "x": 560, "y": 440},
        # calibracao
        {"id": "calibration_a", "x": 400, "y": 500},
        {"id": "calibration_b", "x": 500, "y": 500},
    ]


@pytest.fixture
def report():
    return run_analysis(base_points(), known_distance_mm=10.0)


def test_calibration_applied(report):
    assert report["calibration"]["is_calibrated"] is True
    assert abs(report["calibration"]["mm_per_pixel"] - 0.1) < 1e-6


def test_midline_deviation(report):
    md = report["midline"]
    assert abs(md["deviation_px"] - 10.0) < 0.5
    assert abs(md["deviation_mm"] - 1.0) < 0.1
    # x maior na imagem => lado esquerdo do paciente
    assert md["side"] == "esquerda"
    assert md["classification"] == "dentro da normalidade"


def test_gingival_exposure_normal(report):
    ge = report["gingival_exposure"]
    # labio (y=395) esta abaixo do zenith (y=388) => sem gengiva exposta
    assert ge["exposure_px"] == 0.0
    assert ge["classification"] == "normal"


def test_gummy_smile_detected():
    pts = base_points()
    # eleva o labio superior acima dos zeniths -> gengiva exposta ~2mm
    for p in pts:
        if p["id"] == "upper_lip_midline":
            p["y"] = 368  # zenith centrais em 388 => 20px = 2mm
    rep = run_analysis(pts, known_distance_mm=10.0)
    ge = rep["gingival_exposure"]
    assert abs(ge["exposure_mm"] - 2.0) < 0.2
    assert ge["classification"] == "moderada"


def test_interpupillary_level(report):
    assert report["interpupillary"]["inclination_deg"] == 0.0


def test_buccal_corridor_symmetry(report):
    bc = report["buccal_corridor"]
    assert bc["symmetry_percent"] > 90
    assert "classification" in bc


def test_tooth_dimensions_present(report):
    dims = report["tooth_dimensions"]
    assert "11" in dims
    assert dims["11"]["width_mm"] is not None
    assert dims["11"]["width_height_ratio"] is not None


def test_golden_proportion(report):
    gp = report["golden_proportion"]
    assert gp is not None
    assert "direito" in gp or "esquerdo" in gp


def test_summary_keys(report):
    s = report["summary"]
    assert "midline_deviation_mm" in s
    assert "gingival_classification" in s


def test_analysis_with_minimal_points():
    # sem pontos suficientes: modulos retornam None sem quebrar
    rep = run_analysis([{"id": "pupil_right", "x": 1, "y": 1}])
    assert rep["midline"] is None
    assert rep["calibration"]["is_calibrated"] is False
