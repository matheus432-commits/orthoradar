"""
Testes de integracao da API (FastAPI) usando o TestClient.

Cobrem: landmarks, analyze, conclusion (fallback baseado em regras, sem chave de
API), exportacao PNG e PDF (gera bytes validos). Uma imagem 4x4 minima e usada
como fotografia de teste.
"""
import base64

import numpy as np
import cv2
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _tiny_image_data_url() -> str:
    img = np.full((40, 40, 3), 200, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    return "data:image/png;base64," + base64.b64encode(buf.tobytes()).decode()


POINTS = [
    {"id": "glabella", "x": 20, "y": 5},
    {"id": "subnasale", "x": 20, "y": 15},
    {"id": "dental_midline_upper", "x": 21, "y": 20},
    {"id": "pupil_right", "x": 15, "y": 8},
    {"id": "pupil_left", "x": 25, "y": 8},
    {"id": "upper_lip_midline", "x": 20, "y": 18},
    {"id": "commissure_right", "x": 12, "y": 22},
    {"id": "commissure_left", "x": 28, "y": 22},
    {"id": "t11_incisal", "x": 19, "y": 24},
    {"id": "t11_zenith", "x": 19, "y": 19},
    {"id": "t11_mesial", "x": 20, "y": 20},
    {"id": "t11_distal", "x": 18, "y": 20},
    {"id": "t21_incisal", "x": 21, "y": 24},
    {"id": "t21_zenith", "x": 21, "y": 19},
    {"id": "t21_mesial", "x": 20, "y": 20},
    {"id": "t21_distal", "x": 22, "y": 20},
]


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_landmarks_endpoint():
    data = client.get("/api/landmarks").json()
    assert "landmarks" in data
    assert any(lm["id"] == "t11_incisal" for lm in data["landmarks"])


def test_analyze_endpoint():
    resp = client.post("/api/analyze", json={"points": POINTS, "known_distance_mm": None})
    assert resp.status_code == 200
    report = resp.json()["report"]
    assert report["midline"] is not None
    assert "summary" in report


def test_conclusion_fallback():
    report = client.post(
        "/api/analyze", json={"points": POINTS}
    ).json()["report"]
    resp = client.post("/api/conclusion", json={"report": report})
    assert resp.status_code == 200
    body = resp.json()
    # sem ANTHROPIC_API_KEY nos testes -> baseado em regras
    assert body["source"] == "rule-based"
    assert len(body["text"]) > 10


def test_image_adjust():
    resp = client.post("/api/image/adjust", json={
        "image": _tiny_image_data_url(),
        "brightness": 10, "contrast": 1.2, "rotation_deg": 5,
    })
    assert resp.status_code == 200
    assert resp.json()["image"].startswith("data:image/png;base64,")


def test_export_png():
    resp = client.post("/api/export/png", json={
        "patient": {"name": "Teste"},
        "report": {},
        "points": POINTS,
        "image": _tiny_image_data_url(),
    })
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert len(resp.content) > 0


def test_export_pdf():
    report = client.post("/api/analyze", json={"points": POINTS}).json()["report"]
    resp = client.post("/api/export/pdf", json={
        "patient": {"name": "Teste", "sex": "F", "date": "2026-07-01"},
        "report": report,
        "conclusion": "Conclusao de teste.",
        "points": POINTS,
        "image": _tiny_image_data_url(),
    })
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.content[:4] == b"%PDF"
