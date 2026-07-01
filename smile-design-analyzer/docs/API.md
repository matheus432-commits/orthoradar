# Referência da API

Base URL padrão: `http://localhost:8000`. Documentação interativa (Swagger) em
`/docs`.

## `GET /health`
Verificação de saúde. → `{ "status": "ok" }`

## `GET /api/landmarks`
Retorna o banco de pontos (`landmarks.json`): categorias, landmarks e dentes.

## `POST /api/analyze`
Executa todos os cálculos.

**Request**
```json
{
  "points": [
    { "id": "glabella", "x": 500, "y": 100 },
    { "id": "subnasale", "x": 500, "y": 300 },
    { "id": "dental_midline_upper", "x": 510, "y": 400 }
  ],
  "known_distance_mm": 10.0
}
```

**Response** — `{ "report": { ... } }` com as seções: `calibration`, `midline`,
`interpupillary`, `occlusal_plane`, `smile_arc`, `buccal_corridor`,
`smile_symmetry`, `gingival_exposure`, `gingival_zeniths`, `tooth_dimensions`,
`golden_proportion`, `central_dominance`, `connectors`, `incisal_progression`,
`facial_proportion`, `lip_symmetry`, `summary`.

## `POST /api/conclusion`
Gera a conclusão clínica a partir de um relatório.

**Request** — `{ "report": { ... } }`
**Response**
```json
{ "text": "Linha média desviada 1.2 mm...", "source": "ai", "warning": null }
```
`source` = `"ai"` (Claude) ou `"rule-based"` (offline).

## `POST /api/image/adjust`
Ajuste de imagem via OpenCV.

**Request**
```json
{ "image": "data:image/png;base64,...", "brightness": 10, "contrast": 1.2, "rotation_deg": 5 }
```
**Response** — `{ "image": "data:image/png;base64,..." }`

## `POST /api/export/png`
Gera a imagem anotada (pontos + linhas). Corpo:
```json
{ "patient": {...}, "report": {...}, "conclusion": "", "points": [...], "image": "data:image/..." }
```
→ `image/png` (download).

## `POST /api/export/pdf`
Gera o laudo completo (imagem anotada + tabelas + conclusão). Mesmo corpo do PNG.
→ `application/pdf` (download).
