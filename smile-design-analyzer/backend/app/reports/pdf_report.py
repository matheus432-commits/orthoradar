"""
pdf_report.py
=============

Geracao do relatorio em PDF, com layout semelhante a softwares de Smile Design:
cabecalho, dados do paciente, imagem anotada, tabelas de medidas, grafico
simples e conclusao clinica.

Usa ReportLab (puro Python, sem dependencias de sistema).
"""
from __future__ import annotations

import base64
import io
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .report_builder import build_tables

PRIMARY = colors.HexColor("#0F766E")
LIGHT = colors.HexColor("#E6FFFA")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        name="ReportTitle", fontSize=20, textColor=PRIMARY, spaceAfter=6,
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        name="Section", fontSize=12, textColor=PRIMARY, spaceBefore=10,
        spaceAfter=4, fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        name="Body", fontSize=9.5, leading=14, spaceAfter=4,
    ))
    return styles


def _decode_image(data_url: Optional[str]) -> Optional[io.BytesIO]:
    if not data_url:
        return None
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    try:
        return io.BytesIO(base64.b64decode(data_url))
    except Exception:  # noqa: BLE001
        return None


def build_pdf(
    patient: dict,
    report: dict,
    conclusion: str,
    annotated_image_data_url: Optional[str] = None,
) -> bytes:
    """Gera o PDF do laudo e retorna os bytes.

    Args:
        patient: {name, sex, date, notes}.
        report: relatorio de ``run_analysis``.
        conclusion: texto da conclusao clinica (IA ou regras).
        annotated_image_data_url: imagem anotada em data URL (opcional).
    """
    styles = _styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title="Analise Digital do Sorriso",
    )
    story: List = []

    story.append(Paragraph("Analise Digital do Sorriso", styles["ReportTitle"]))
    story.append(Paragraph("Relatorio de Design de Sorriso", styles["Body"]))
    story.append(Spacer(1, 6))

    # Dados do paciente
    pdata = [
        ["Paciente", patient.get("name", "—"), "Sexo", patient.get("sex", "—")],
        ["Data", patient.get("date", "—"), "Calibrado",
         "Sim" if report.get("calibration", {}).get("is_calibrated") else "Nao"],
    ]
    ptable = Table(pdata, colWidths=[25 * mm, 60 * mm, 25 * mm, 55 * mm])
    ptable.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT),
        ("BACKGROUND", (2, 0), (2, -1), LIGHT),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(ptable)
    story.append(Spacer(1, 8))

    # Imagem anotada
    img_stream = _decode_image(annotated_image_data_url)
    if img_stream is not None:
        try:
            img = Image(img_stream)
            max_w = 174 * mm
            ratio = img.imageHeight / float(img.imageWidth)
            img.drawWidth = max_w
            img.drawHeight = max_w * ratio
            if img.drawHeight > 150 * mm:
                img.drawHeight = 150 * mm
                img.drawWidth = 150 * mm / ratio
            story.append(Paragraph("Fotografia com marcacoes", styles["Section"]))
            story.append(img)
            story.append(Spacer(1, 8))
        except Exception:  # noqa: BLE001
            pass

    # Tabelas de medidas
    story.append(Paragraph("Medidas e proporcoes", styles["Section"]))
    for section in build_tables(report):
        story.append(Paragraph(section["title"], styles["Body"]))
        data = [["Parametro", "Valor"]] + [list(r) for r in section["rows"]]
        t = Table(data, colWidths=[95 * mm, 79 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

    # Conclusao
    story.append(Paragraph("Conclusao clinica", styles["Section"]))
    for para in (conclusion or "—").split("\n"):
        if para.strip():
            story.append(Paragraph(para.strip(), styles["Body"]))

    story.append(Spacer(1, 10))
    story.append(Paragraph(
        "Documento gerado automaticamente pelo Smile Design Analyzer. As medidas "
        "dependem da correta marcacao dos pontos e da calibracao.",
        ParagraphStyle(name="Foot", fontSize=7.5, textColor=colors.grey),
    ))

    doc.build(story)
    return buffer.getvalue()
