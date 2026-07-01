"""Testes unitarios das primitivas geometricas."""
import math

from app.calculations import geometry as g


def test_distance():
    assert g.distance((0, 0), (3, 4)) == 5.0


def test_midpoint():
    assert g.midpoint((0, 0), (10, 20)) == (5.0, 10.0)


def test_angle_horizontal_line_is_zero():
    assert abs(g.angle_deg_of_line((0, 0), (10, 0))) < 1e-9


def test_acute_angle_to_horizontal():
    # reta a 45 graus (lembrando eixo y invertido)
    assert abs(g.acute_angle_to_horizontal((0, 0), (10, 10)) - 45.0) < 1e-9


def test_point_line_distance():
    # ponto (0,5) a reta x=0 (vertical) -> distancia 0
    assert abs(g.point_line_distance((0, 5), (0, 0), (0, 10))) < 1e-9
    # ponto (3,5) a reta vertical x=0 -> distancia 3
    assert abs(g.point_line_distance((3, 5), (0, 0), (0, 10)) - 3.0) < 1e-9


def test_signed_distance_sign():
    # reta vertical de cima (0,0) para baixo (0,10).
    # ponto a direita (x>0) deve ter sinal positivo.
    d = g.signed_point_line_distance((5, 5), (0, 0), (0, 10))
    assert d > 0


def test_project_point_on_line():
    proj = g.project_point_on_line((5, 5), (0, 0), (10, 0))
    assert abs(proj[0] - 5) < 1e-9 and abs(proj[1]) < 1e-9


def test_curvature_collinear_is_zero():
    assert abs(g.curvature_of_three_points((0, 0), (5, 0), (10, 0))) < 1e-9


def test_angle_between_perpendicular_lines():
    ang = g.angle_between_lines((0, 0), (10, 0), (0, 0), (0, 10))
    assert abs(ang - 90.0) < 1e-9
