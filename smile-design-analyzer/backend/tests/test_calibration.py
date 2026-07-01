"""Testes do fator de calibracao px->mm."""
from app.calculations.calibration import build_calibration


def test_calibration_factor():
    cal = build_calibration((400, 400), (500, 400), 10.0)
    assert cal.is_calibrated
    assert abs(cal.mm_per_pixel - 0.1) < 1e-9
    assert abs(cal.to_mm(10) - 1.0) < 1e-9


def test_not_calibrated_without_points():
    cal = build_calibration(None, None, 10.0)
    assert not cal.is_calibrated
    assert cal.to_mm(100) is None


def test_not_calibrated_without_distance():
    cal = build_calibration((0, 0), (100, 0), None)
    assert not cal.is_calibrated
