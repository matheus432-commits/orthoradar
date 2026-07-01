# Banco de pontos anatômicos

Definido em `backend/app/data/landmarks.json` (e espelhado em
`frontend/public/data/landmarks.json`). Cada ponto possui:

```json
{
  "id": "t11_incisal",
  "number": 15,
  "name": "11 - Borda incisal",
  "description": "Ponto médio da borda incisal do dente 11.",
  "category": "teeth_incisal",
  "color": "#F59E0B",
  "required": true,
  "tooth": "11"
}
```

| Campo | Descrição |
|---|---|
| `id` | Identificador único usado nos cálculos. |
| `number` | Número exibido no marcador. |
| `name` | Nome legível. |
| `description` | Legenda/instrução de marcação. |
| `category` | Grupo (referências faciais, linhas médias, lábios, larguras, incisais, zeniths, calibração). |
| `color` | Cor do marcador. |
| `required` | Se é obrigatório para a análise básica. |
| `tooth` | (Opcional) dente FDI ao qual pertence. |

## Pontos (38)

**Faciais / linhas médias / lábios**: pupila direita (1), pupila esquerda (2),
glabela (3), subnasal (4), menton (5), asa nasal direita (6), asa nasal esquerda
(7), comissura direita (8), comissura esquerda (9), lábio superior (10), lábio
inferior (11), linha média dentária (12).

**Por dente** (13, 12, 11, 21, 22, 23) — cada um com **mesial**, **distal**,
**borda incisal/cúspide** e **zenith gengival** (pontos 13–36).

**Calibração**: ponto A (37) e ponto B (38).

## Dentes considerados

Seis dentes ântero-superiores visíveis no sorriso: caninos (13, 23), laterais
(12, 22) e centrais (11, 21). Os grupos de proporção áurea são `central`,
`lateral` e `canine`.

## Como estender

Para adicionar novos pontos/dentes, basta editar o `landmarks.json` (em ambos os
locais). Os cálculos consomem os pontos por `id`; módulos que dependem de um
ponto ausente simplesmente o ignoram e retornam `null` para aquela métrica.
