"""
schemas.py
==========

Modelos Pydantic (contratos de entrada/saida da API). Mantem a fronteira de
validacao separada das funcoes de calculo puro.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class LandmarkPoint(BaseModel):
    """Ponto marcado pelo usuario, em pixels da imagem original."""

    id: str = Field(..., description="ID do landmark (ex.: 't11_incisal').")
    x: float = Field(..., description="Coordenada X em pixels da imagem original.")
    y: float = Field(..., description="Coordenada Y em pixels da imagem original.")


class Patient(BaseModel):
    """Dados de cadastro do paciente."""

    name: str = ""
    sex: str = ""
    date: str = ""
    notes: str = ""


class AnalyzeRequest(BaseModel):
    """Requisicao de analise."""

    points: List[LandmarkPoint]
    known_distance_mm: Optional[float] = Field(
        default=None,
        description="Distancia real (mm) entre calibration_a e calibration_b.",
    )


class AnalyzeResponse(BaseModel):
    """Resposta de analise: o relatorio completo (estrutura flexivel)."""

    report: Dict[str, Any]


class ConclusionRequest(BaseModel):
    report: Dict[str, Any]


class ConclusionResponse(BaseModel):
    text: str
    source: str
    warning: Optional[str] = None


class ImageAdjustRequest(BaseModel):
    """Ajuste de imagem via OpenCV (opcional)."""

    image: str = Field(..., description="Imagem em data URL base64.")
    brightness: float = 0.0
    contrast: float = 1.0
    rotation_deg: float = 0.0


class ReportExportRequest(BaseModel):
    """Requisicao de exportacao (PDF/PNG)."""

    patient: Patient
    report: Dict[str, Any]
    conclusion: str = ""
    points: List[LandmarkPoint] = []
    image: Optional[str] = Field(
        default=None, description="Imagem original em data URL (para anotacao)."
    )
