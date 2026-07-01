# Backend — Smile Design Analyzer (FastAPI)

Todos os cálculos matemáticos, a conclusão por IA e a exportação (PDF/PNG) vivem
aqui. OpenCV é usado **apenas** para manipulação de imagem.

## Rodar

```bash
pip install -r requirements.txt
cp .env.example .env         # opcional: ANTHROPIC_API_KEY para a IA
uvicorn app.main:app --reload --port 8000
```

Swagger: http://localhost:8000/docs

## Testes

```bash
pytest        # geometria, calibração, análise e API
```

## Estrutura

- `app/calculations/` — funções puras e documentadas (o coração do sistema).
- `app/services/` — `image_service` (OpenCV) e `ai_conclusion` (Claude/regras).
- `app/reports/` — montagem de tabelas e geração de PDF (ReportLab).
- `app/models/` — schemas Pydantic.
- `app/data/landmarks.json` — banco de pontos.

Veja `../docs/FORMULAS.md` para todas as fórmulas.
