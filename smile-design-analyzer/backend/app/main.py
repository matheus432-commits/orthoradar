"""
main.py
=======

Aplicacao FastAPI: expoe os endpoints da analise digital do sorriso.

Endpoints:
    GET  /health                 -> status
    GET  /api/landmarks          -> banco de pontos (para o front)
    POST /api/analyze            -> executa todos os calculos
    POST /api/conclusion         -> gera a conclusao clinica (IA/regras)
    POST /api/image/adjust       -> ajustes de imagem via OpenCV
    POST /api/export/pdf         -> gera o relatorio em PDF
    POST /api/export/png         -> gera a imagem anotada em PNG

A logica de calculo vive em ``app.calculations`` (funcoes puras e testaveis).
"""
from __future__ import annotations

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from .calculations import run_analysis
from .config import ALLOWED_ORIGINS, landmark_index, load_landmarks
from .models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    ConclusionRequest,
    ConclusionResponse,
    ImageAdjustRequest,
    ReportExportRequest,
)
from .reports.pdf_report import build_pdf
from .services.ai_conclusion import generate_conclusion
from .services import image_service

app = FastAPI(
    title="Smile Design Analyzer API",
    version="1.0.0",
    description="Analise digital do sorriso a partir de pontos marcados manualmente.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    """Verificacao de saude do servico."""
    return {"status": "ok"}


@app.get("/api/landmarks")
def get_landmarks() -> dict:
    """Retorna o banco de pontos anatomicos."""
    return load_landmarks()


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Executa todos os calculos de medidas e proporcoes."""
    points = [p.model_dump() for p in req.points]
    report = run_analysis(points, req.known_distance_mm)
    return AnalyzeResponse(report=report)


@app.post("/api/conclusion", response_model=ConclusionResponse)
def conclusion(req: ConclusionRequest) -> ConclusionResponse:
    """Gera a conclusao clinica interpretando as medidas calculadas."""
    result = generate_conclusion(req.report)
    return ConclusionResponse(**result)


@app.post("/api/image/adjust")
def adjust_image(req: ImageAdjustRequest) -> dict:
    """Aplica brilho/contraste/rotacao via OpenCV e retorna a imagem processada."""
    img = image_service.decode_data_url(req.image)
    out = image_service.adjust_image(
        img, brightness=req.brightness, contrast=req.contrast,
        rotation_deg=req.rotation_deg,
    )
    return {"image": image_service.encode_png_data_url(out)}


@app.post("/api/export/png")
def export_png(req: ReportExportRequest) -> Response:
    """Gera a imagem anotada (pontos + linhas) em PNG."""
    if not req.image:
        return Response(content=b"", status_code=400)
    img = image_service.decode_data_url(req.image)
    annotated = image_service.render_annotations(
        img, [p.model_dump() for p in req.points], landmark_index()
    )
    return Response(
        content=image_service.encode_png(annotated),
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=smile_annotated.png"},
    )


@app.post("/api/export/pdf")
def export_pdf(req: ReportExportRequest) -> Response:
    """Gera o relatorio completo em PDF (com imagem anotada, tabelas e conclusao)."""
    annotated_data_url = None
    if req.image:
        img = image_service.decode_data_url(req.image)
        annotated = image_service.render_annotations(
            img, [p.model_dump() for p in req.points], landmark_index()
        )
        annotated_data_url = image_service.encode_png_data_url(annotated)

    pdf_bytes = build_pdf(
        patient=req.patient.model_dump(),
        report=req.report,
        conclusion=req.conclusion,
        annotated_image_data_url=annotated_data_url,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=smile_report.pdf"},
    )
