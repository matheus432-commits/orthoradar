# Arquitetura

## Visão geral

O sistema segue uma arquitetura limpa com separação estrita entre **interface**
e **cálculo**:

```
┌───────────────────────────┐        HTTP/JSON        ┌──────────────────────────┐
│      Frontend (Next.js)    │  ───────────────────▶   │      Backend (FastAPI)    │
│                            │                         │                          │
│  - Dashboard / Cadastro    │   POST /api/analyze     │  calculations/  (puro)   │
│  - Editor (canvas)         │   POST /api/conclusion  │  services/ (OpenCV, IA)  │
│  - Marcação de pontos      │   POST /api/export/*    │  reports/ (PDF)          │
│  - Exibição de resultados  │  ◀───────────────────   │  data/landmarks.json     │
└───────────────────────────┘        resultados        └──────────────────────────┘
        │                                                        
        │ localStorage (casos)                                   
        ▼                                                        
   Persistência local                                            
```

## Fluxo de dados

1. **Cadastro** — o usuário cria um caso (paciente + foto). O caso é salvo no
   `localStorage` do navegador (sem necessidade de banco de dados).
2. **Marcação** — no editor, cada clique posiciona um ponto. As coordenadas são
   convertidas de tela → **pixels da imagem original** (função `screenToImage`),
   de forma independente de zoom/pan/rotação.
3. **Cálculo** — os pontos são enviados a `POST /api/analyze`. O backend executa
   `run_analysis`, que orquestra todos os módulos de `app/calculations/` e
   devolve um relatório estruturado.
4. **Calibração** — se o usuário informou "A↔B = X mm", o backend calcula o fator
   `mm/px` e converte todas as medidas lineares.
5. **Conclusão** — `POST /api/conclusion` interpreta o relatório via IA (Claude)
   ou por regras determinísticas.
6. **Exportação** — `POST /api/export/pdf` e `/png` renderizam o laudo (imagem
   anotada com OpenCV + tabelas em ReportLab). O JSON é exportado no cliente.

## Por que os cálculos ficam no backend?

- **Testabilidade**: funções puras em Python, cobertas por `pytest`.
- **Reuso**: a mesma lógica serve à API, à exportação e a futuras integrações.
- **Precisão**: fórmulas centralizadas e documentadas, sem duplicação no cliente.

## Sistema de coordenadas

Todas as coordenadas de pontos são armazenadas em **pixels da imagem original**,
com eixo `y` crescendo para baixo (padrão de imagem). O editor aplica uma matriz
de transformação (escala, rotação, translação) apenas para exibição; a marcação
sempre é convertida de volta para o espaço da imagem original. Isso garante que
as medidas independem do zoom/rotação usados na visualização.

## Camadas do backend

| Camada             | Responsabilidade                                       |
|--------------------|--------------------------------------------------------|
| `calculations/`    | Fórmulas matemáticas puras (sem I/O).                  |
| `models/`          | Validação de entrada/saída (Pydantic).                 |
| `services/`        | OpenCV (manipulação de imagem) e IA (conclusão).       |
| `reports/`         | Montagem de tabelas e geração de PDF.                  |
| `main.py`          | Roteamento HTTP (fina, sem lógica de cálculo).         |
