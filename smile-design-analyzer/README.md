# 🦷 Smile Design Analyzer

Aplicativo web profissional para **análise digital do sorriso** (Digital Smile
Design). O usuário marca **manualmente** todos os pontos anatômicos sobre uma
fotografia e o sistema calcula **automaticamente** todas as medidas, proporções
e gera um **relatório completo** com conclusão clínica.

> O objetivo **não** é detectar pontos automaticamente — a marcação é manual e
> precisa. Toda a inteligência do sistema está nos **cálculos** e na
> **interpretação** das medidas.

---

## ✨ Funcionalidades

- **Dashboard** com lista de pacientes e histórico de casos.
- **Cadastro** do paciente (nome, sexo, data, observações) + upload da foto.
- **Editor de fotografia** com zoom, pan, rotação, brilho, contraste e reset.
- **Marcação manual** de 38 pontos anatômicos (banco de pontos em JSON), com
  nome, cor, número, categoria, legenda e obrigatoriedade.
- **Cálculo automático** de dezenas de medidas e proporções:
  - Linha média (desvio em mm/px, lado, ângulo, classificação);
  - Exposição gengival (mm + classificação normal/moderada/excessiva);
  - Corredor bucal (direito, esquerdo, %, simetria);
  - Largura, altura e relação largura/altura de cada dente;
  - Proporção áurea (RED) e índice de dominância do incisivo central;
  - Linha/arco do sorriso (côncavo/convexo/plano, consonante/reto/reverso);
  - Linha interpupilar, plano oclusal e paralelismo;
  - Simetria do sorriso, zeniths gengivais, conectores, progressão incisal;
  - Proporção facial, simetria labial.
- **Fator de calibração**: "esta distância equivale a X mm" → todas as medidas
  são convertidas de pixels para milímetros.
- **Conclusão clínica por IA** (Claude), usando **exclusivamente** os valores
  calculados — nunca inventa medidas. Fallback determinístico offline.
- **Exportação** em **PDF**, **PNG** (imagem anotada) e **JSON**.

---

## 🏗️ Arquitetura

Monorepo com dois serviços independentes e responsabilidades bem separadas:

```
smile-design-analyzer/
├── backend/                 # FastAPI (Python) — TODOS os cálculos
│   └── app/
│       ├── calculations/    # Cálculo puro e testável (fórmulas documentadas)
│       ├── models/          # Schemas Pydantic (contratos da API)
│       ├── services/        # OpenCV (imagem) + IA (conclusão)
│       ├── reports/         # Geração de PDF e montagem de tabelas
│       └── data/            # landmarks.json (banco de pontos)
│   └── tests/               # Testes unitários e de integração (pytest)
├── frontend/                # Next.js + React + TypeScript + Tailwind
│   └── src/
│       ├── app/             # Telas (dashboard, cadastro, editor)
│       ├── components/      # Editor de foto, painéis, gráficos
│       ├── hooks/           # Estado reativo (landmarks, casos)
│       ├── services/        # Cliente HTTP + persistência local
│       ├── lib/ utils/      # Utilidades (transformações, formatação)
│       └── types/           # Tipos compartilhados
└── docs/                    # Documentação (arquitetura, fórmulas, API)
```

**Princípio central:** os cálculos vivem **100% no backend**, em funções puras
(`app/calculations/`), sem dependência de interface. Isso os torna testáveis e
reutilizáveis. O front apenas coleta pontos e exibe resultados.

---

## 🚀 Como rodar

### Pré-requisitos
- Python 3.10+
- Node.js 20+

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # opcional
pip install -r requirements.txt
cp .env.example .env        # (opcional) defina ANTHROPIC_API_KEY para a IA
uvicorn app.main:app --reload --port 8000
```

API em `http://localhost:8000` — docs interativas em `http://localhost:8000/docs`.

### 2. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Aplicação em `http://localhost:3000`.

### Docker (opcional)

```bash
docker compose up --build
```

---

## 🧠 Inteligência Artificial

A IA é usada **apenas** para redigir a **conclusão clínica**, interpretando as
medidas já calculadas. Regras:

1. Usa **exclusivamente** os valores do relatório (nunca inventa números).
2. Se `ANTHROPIC_API_KEY` estiver definida → modelo **`claude-opus-4-8`**.
3. Sem chave → gerador **determinístico** baseado em regras (offline, sem custo).

---

## 🧪 Testes

```bash
cd backend
pytest            # 29 testes: geometria, calibração, análise e API
```

Os testes cobrem as fórmulas geométricas, o fator de calibração, cada módulo de
análise (com geometria conhecida) e os endpoints da API (análise, conclusão,
exportação PDF/PNG).

---

## 📚 Documentação

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — visão geral e fluxo de dados.
- [`docs/FORMULAS.md`](docs/FORMULAS.md) — todas as fórmulas matemáticas.
- [`docs/API.md`](docs/API.md) — referência dos endpoints.
- [`docs/LANDMARKS.md`](docs/LANDMARKS.md) — banco de pontos anatômicos.

---

## ⚖️ Aviso

Ferramenta de apoio à análise estética. As medidas dependem da correta marcação
dos pontos e da calibração. Não substitui a avaliação clínica profissional.
