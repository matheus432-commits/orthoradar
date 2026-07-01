# Fórmulas matemáticas

Todas as fórmulas estão implementadas em `backend/app/calculations/` e cobertas
por testes unitários. Coordenadas em pixels da imagem original (eixo `y` para
baixo).

## Primitivas geométricas (`geometry.py`)

| Medida | Fórmula |
|---|---|
| Distância euclidiana | `d = √((xb−xa)² + (yb−ya)²)` |
| Ponto médio | `m = ((xa+xb)/2, (ya+yb)/2)` |
| Ângulo da reta (horizontal) | `θ = atan2(−(yb−ya), (xb−xa))` (y invertido) |
| Distância ponto→reta (com sinal) | `d = [(xb−xa)(ya−yp) − (xa−xp)(yb−ya)] / |b−a|` |
| Projeção sobre reta | `t = ((p−a)·(b−a))/|b−a|²; proj = a + t(b−a)` |
| Curvatura (3 pontos) | `κ = 4·Área / (|ab|·|bc|·|ca|)` |
| Ângulo entre retas | `|θ₁ − θ₂|`, normalizado a [0, 90] |

## Calibração (`calibration.py`)

```
fator (mm/px) = distância_conhecida_mm / distância_A↔B_pixels
medida_mm     = medida_px × fator
```

## Linha média (`midline.py`)

- Linha média facial = reta **glabela → subnasal**.
- Desvio = distância (com sinal) do ponto **linha média dentária** até essa reta.
- Sinal → lado (direita/esquerda do paciente).
- Ângulo (canting) = ângulo entre a reta facial e o eixo dentário (centrais).
- Classificação por faixas: ≤1 mm normal; ≤2 leve; ≤4 moderado; >4 acentuado.

## Planos horizontais (`planes.py`)

- Inclinação interpupilar = menor ângulo entre a reta pupila↔pupila e a horizontal.
- Plano incisal = reta entre cúspides dos caninos (ou bordas dos centrais).
- Paralelismo = ângulo entre o plano incisal e a linha interpupilar (ideal ≤2°).

## Exposição gengival (`gingival.py`)

```
exposição_px = max(0, y_zenith − y_labio_superior)
```
Classificação (mm): ≤1 normal; ≤3 moderada; >3 excessiva.

Zeniths: alturas relativas ao zenith mais apical; simetria = diferença entre
pares homólogos (13/23, 12/22, 11/21).

## Corredor bucal (`smile.py`)

```
largura_total     = distância(comissura_dir, comissura_esq)
corredor_dir      = |x(distal 13) − x(comissura_dir)|
corredor_esq      = |x(comissura_esq) − x(distal 23)|
percentual_lado   = corredor_lado / largura_total × 100
simetria (%)      = min(dir, esq) / max(dir, esq) × 100
```

## Arco / linha do sorriso (`smile.py`)

- Curvatura das bordas incisais (κ dos 3 pontos extremos).
- **Sagitta** = `y(centro) − média(y dos cantos)`:
  - `|sagitta| < 2` → plano; `>0` → convexo; `<0` → côncavo (reverso).
- Linha do sorriso = comparação das incisais com o lábio inferior
  (consonante / reta / reversa).

## Dimensões dentárias (`teeth.py`)

```
largura  = distância(mesial, distal)
altura   = distância(incisal, zenith)
razão L/A = largura / altura        (ideal do central ≈ 0.78)
```

## Proporção áurea (RED) e dominância (`teeth.py`)

- Do frontal, cada dente ≈ **61,8%** da largura do dente mesial:
  `lateral/central ≈ 0.618`, `canino/lateral ≈ 0.618`.
- Índice de dominância do central = `largura_média_centrais / largura_média_laterais`
  (ideal ≈ `1/0.618 ≈ 1.618`).

## Conectores (`teeth.py`)

Regra estética **50-40-30**: percentual do conector em relação à altura do
central. Estimado pela posição vertical do ponto de contato:
```
conector_% = |y_contato − y_incisal_central| / altura_central × 100
```

## Simetria do sorriso (`smile.py`)

Média das razões `min/max` das distâncias horizontais de estruturas homólogas
(comissuras, caninos, laterais, centrais) ao eixo médio dentário.

## Proporção facial e simetria labial (`facial.py`)

- Proporção facial = razão terço inferior (subnasal→menton) / terço médio
  (glabela→subnasal); ideal ≈ 1.0.
- Simetria labial = diferença vertical entre as comissuras.
