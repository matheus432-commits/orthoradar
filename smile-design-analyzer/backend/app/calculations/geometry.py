"""
geometry.py
===========

Primitivas geometricas usadas por todos os modulos de calculo do Smile Design.

Todas as coordenadas sao pares ``(x, y)`` em pixels da imagem ORIGINAL.
Convencao de eixos (padrao de imagem):

    x cresce para a DIREITA
    y cresce para BAIXO

Isso e importante para a interpretacao de angulos e do sinal do desvio da
linha media. Cada funcao documenta a formula matematica que implementa.

Nenhuma funcao aqui depende da interface (FastAPI/React) — sao funcoes puras,
facilmente testaveis de forma unitaria.
"""
from __future__ import annotations

import math
from typing import Sequence, Tuple

Point = Tuple[float, float]


def distance(a: Point, b: Point) -> float:
    """Distancia euclidiana entre dois pontos.

    Formula:
        d = sqrt((x_b - x_a)^2 + (y_b - y_a)^2)
    """
    return math.hypot(b[0] - a[0], b[1] - a[1])


def midpoint(a: Point, b: Point) -> Point:
    """Ponto medio do segmento a-b.

    Formula:
        m = ((x_a + x_b) / 2, (y_a + y_b) / 2)
    """
    return ((a[0] + b[0]) / 2.0, (a[1] + b[1]) / 2.0)


def vector(a: Point, b: Point) -> Point:
    """Vetor a -> b = (x_b - x_a, y_b - y_a)."""
    return (b[0] - a[0], b[1] - a[1])


def angle_deg_of_line(a: Point, b: Point) -> float:
    """Angulo da reta que passa por a-b em relacao a HORIZONTAL, em graus.

    Como o eixo y da imagem aponta para baixo, invertemos o sinal de dy para
    que angulos positivos representem inclinacao no sentido anti-horario visual
    (convencao matematica classica).

    Formula:
        theta = atan2(-(y_b - y_a), (x_b - x_a))

    Retorna valor em (-180, 180].
    """
    dx = b[0] - a[0]
    dy = -(b[1] - a[1])  # inverte por causa do eixo y invertido da imagem
    return math.degrees(math.atan2(dy, dx))


def acute_angle_to_horizontal(a: Point, b: Point) -> float:
    """Menor angulo (0..90) entre a reta a-b e a horizontal.

    Util para medir "inclinacao" sem se importar com o sentido.
    """
    ang = abs(angle_deg_of_line(a, b))
    if ang > 90.0:
        ang = 180.0 - ang
    return ang


def acute_angle_to_vertical(a: Point, b: Point) -> float:
    """Menor angulo (0..90) entre a reta a-b e a vertical."""
    return 90.0 - acute_angle_to_horizontal(a, b)


def angle_between_lines(a1: Point, a2: Point, b1: Point, b2: Point) -> float:
    """Angulo agudo (0..90) entre a reta a1-a2 e a reta b1-b2.

    Baseado na diferenca dos angulos individuais em relacao a horizontal.
    """
    diff = abs(angle_deg_of_line(a1, a2) - angle_deg_of_line(b1, b2))
    diff = diff % 180.0
    if diff > 90.0:
        diff = 180.0 - diff
    return diff


def signed_point_line_distance(p: Point, a: Point, b: Point) -> float:
    """Distancia COM SINAL do ponto p ate a reta definida por a-b.

    Usa o produto vetorial 2D. O sinal indica de que lado da reta o ponto
    esta. Para uma linha media (a->b de cima para baixo na imagem), um valor
    positivo significa que o ponto esta a DIREITA da imagem (x maior),
    conforme a normalizacao aplicada em ``deviation.py``.

    Formula (distancia ponto-reta):
        area = (x_b - x_a)(y_a - y_p) - (x_a - x_p)(y_b - y_a)
        d    = area / |b - a|
    """
    ax, ay = a
    bx, by = b
    px, py = p
    denom = distance(a, b)
    if denom == 0:
        return distance(p, a)
    cross = (bx - ax) * (ay - py) - (ax - px) * (by - ay)
    return cross / denom


def point_line_distance(p: Point, a: Point, b: Point) -> float:
    """Distancia ABSOLUTA (sempre >= 0) do ponto p ate a reta a-b."""
    return abs(signed_point_line_distance(p, a, b))


def project_point_on_line(p: Point, a: Point, b: Point) -> Point:
    """Projecao ortogonal do ponto p sobre a reta a-b.

    Formula (projecao vetorial):
        t = ((p - a) . (b - a)) / |b - a|^2
        proj = a + t (b - a)
    """
    ax, ay = a
    bx, by = b
    px, py = p
    dx, dy = bx - ax, by - ay
    denom = dx * dx + dy * dy
    if denom == 0:
        return a
    t = ((px - ax) * dx + (py - ay) * dy) / denom
    return (ax + t * dx, ay + t * dy)


def perpendicular_bisector_direction(a: Point, b: Point) -> Point:
    """Vetor unitario perpendicular ao segmento a-b."""
    dx, dy = vector(a, b)
    length = math.hypot(dx, dy)
    if length == 0:
        return (0.0, 0.0)
    # perpendicular = rotacao de 90 graus: (dx, dy) -> (-dy, dx)
    return (-dy / length, dx / length)


def curvature_of_three_points(a: Point, b: Point, c: Point) -> float:
    """Curvatura do arco que passa por 3 pontos (1 / raio do circulo circunscrito).

    Formula:
        curvatura = 4 * Area(triangulo) / (|ab| * |bc| * |ca|)

    Valor 0 => pontos colineares (arco plano). Quanto maior, mais curvo.
    O sinal indica a concavidade (ver ``smile.py``).
    """
    area2 = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])
    d_ab = distance(a, b)
    d_bc = distance(b, c)
    d_ca = distance(c, a)
    denom = d_ab * d_bc * d_ca
    if denom == 0:
        return 0.0
    return (2.0 * area2) / denom  # area2 ja e 2x a area com sinal


def clamp(value: float, low: float, high: float) -> float:
    """Restringe ``value`` ao intervalo [low, high]."""
    return max(low, min(high, value))


def mean(values: Sequence[float]) -> float:
    """Media aritmetica; retorna 0 para sequencia vazia."""
    values = list(values)
    return sum(values) / len(values) if values else 0.0
