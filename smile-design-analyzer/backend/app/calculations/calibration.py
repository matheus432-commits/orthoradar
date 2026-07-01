"""
calibration.py
==============

Fator de calibracao: converte distancias em PIXELS para MILIMETROS.

O usuario marca dois pontos (``calibration_a`` e ``calibration_b``) sobre a
fotografia e informa a distancia real correspondente em mm (por exemplo,
"esta distancia equivale a 10 mm"). A partir dessa referencia todas as demais
medidas lineares podem ser convertidas.

    fator (mm/px) = distancia_conhecida_mm / distancia_pixels

Se a calibracao nao estiver disponivel, as funcoes retornam ``None`` para o
valor em mm — a interface e o relatorio devem entao exibir apenas pixels.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .geometry import Point, distance


@dataclass
class Calibration:
    """Guarda o fator de conversao mm/px.

    Attributes:
        mm_per_pixel: quantos milimetros equivalem a 1 pixel. ``None`` se
            a calibracao ainda nao foi definida.
        reference_pixels: distancia em pixels usada na calibracao (auditoria).
        reference_mm: distancia real informada pelo usuario (auditoria).
    """

    mm_per_pixel: Optional[float] = None
    reference_pixels: Optional[float] = None
    reference_mm: Optional[float] = None

    @property
    def is_calibrated(self) -> bool:
        return self.mm_per_pixel is not None and self.mm_per_pixel > 0

    def to_mm(self, pixels: Optional[float]) -> Optional[float]:
        """Converte uma distancia em pixels para milimetros (ou ``None``)."""
        if pixels is None or not self.is_calibrated:
            return None
        return pixels * self.mm_per_pixel  # type: ignore[operator]


def build_calibration(
    point_a: Optional[Point],
    point_b: Optional[Point],
    known_distance_mm: Optional[float],
) -> Calibration:
    """Cria um objeto :class:`Calibration` a partir de dois pontos e um valor mm.

    Args:
        point_a, point_b: pontos da distancia de referencia (pixels).
        known_distance_mm: valor real dessa distancia, em mm.

    Returns:
        Calibration calibrado, ou nao-calibrado se faltar algum dado.
    """
    if point_a is None or point_b is None or not known_distance_mm:
        return Calibration()

    pixels = distance(point_a, point_b)
    if pixels <= 0:
        return Calibration()

    return Calibration(
        mm_per_pixel=known_distance_mm / pixels,
        reference_pixels=pixels,
        reference_mm=known_distance_mm,
    )
