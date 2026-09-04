# Sistema visual das apostilas — OdontoFeed Campus

Biblioteca: `assets/campus/componentes.svg` (símbolos `<symbol id="c-…">`,
injetada uma vez pela plataforma). Toda ilustração das 3.387 páginas usa estes
tokens e componentes. Consistência é o que faz o material parecer editorial.

## 1. Paleta (herdada do Campus)

| token | valor | uso |
|---|---|---|
| `--ink` | `#23211C` | traço e texto principal, nó de início |
| `--muted` | `#8A8478` | texto secundário, setas, eixos |
| `--gold` | `#B08968` | acento, destaque, decisão, "o que importa" |
| `--green` | `#3E7C4F` | certo, fim, favorável, cartilagem |
| `--blue` | `#4A6B8A` | estrutura, osso, referência, neutro |
| `--red` | `#B4533B` | erro, risco, sutura, força que atrapalha |
| `--gold-soft` `--green-soft` `--blue-soft` `--red-soft` | `#F4EEE4` `#E8F2EA` `#E9EEF3` `#F6E7E2` | preenchimentos |
| `--border` | `#EDE6D8` | contorno leve, hachura |
| fundo | `#fff` | caixas; o SVG não pinta o próprio fundo |

Regra: no SVG, cor sempre `var(--token, #fallback)`. Nunca hex solto. Nunca
mais de 3 cores de acento no mesmo visual.

## 2. Tipografia dentro do SVG

- `font-family` herdada do documento (Segoe UI/system-ui); títulos internos podem usar `Georgia, serif`.
- Tamanhos em um viewBox de 560 de largura: título 18, rótulo 15, nota 13. Mínimo absoluto 12.
- Peso: rótulo de decisão e de cabeçalho em `font-weight="700"`; o resto em 400.
- `text-anchor="middle"` em caixas; `start` em listas e eixos. Linhas de texto separadas por 16 a 18 unidades.
- Texto sempre em `<text>`; nunca converter em caminho.

## 3. Traço, raio e espaçamento

| elemento | valor |
|---|---|
| contorno de caixa | 1.5 |
| ênfase (vetor, seta principal) | 2.5 |
| guia, eixo, linha do tempo | 1 a 1.5 |
| raio de caixa | 10 |
| raio de pílula (decisão, rótulo) | 999 (metade da altura) |
| espaço entre caixas | 24 (vertical) / 20 (horizontal) |
| margem interna do viewBox | 16 |
| setas | `marker-end="url(#c-seta)"` (variantes `-ink`, `-gold`, `-red`, `-green`, `-blue`) |

## 4. Grid, proporções e celular

- **Retrato 560 × N** é o padrão: fluxograma, linha do tempo vertical, processo, classificação, anatomia. Em 375 px de tela o texto de 15 vira ~10 px: ainda legível.
- **Paisagem 720 × N** só quando o conteúdo é horizontal (forças, comparativo de 3 colunas, gráfico). Aí o rótulo mínimo sobe para 16.
- Largura útil = viewBox − 2 × 16. Colunas: 2 colunas de 256 (560) ou 3 de 224 (720).
- Sempre `viewBox="0 0 L A"` e `width="100%"` (a plataforma põe). Nunca altura fixa.
- Teste obrigatório em 375 px antes de concluir a página: nada cortado, nenhuma rolagem horizontal da página.
- Formatos largos (`grafico`, `comparativo`, `forcas`) ganham, abaixo de 600 px, largura mínima de 480 e rolam DENTRO da própria figura: melhor um deslize lateral no gráfico do que letra de 7 px. Os formatos retrato continuam ocupando 100% da largura.

## 5. Componentes da biblioteca

| id | uso | tamanho nativo |
|---|---|---|
| `c-caixa`, `-ink`, `-gold`, `-green`, `-blue`, `-red` | nó de ação, cartão, célula | 200×60 (escalar por width/height no `<use>`) |
| `c-decisao` | nó de decisão (pílula dourada) | 200×60 |
| `c-pilula` | rótulo "sim"/"não"/etapa | 60×22 |
| `c-num`, `c-num-ink` | círculo numerado de passo (número em `<text>` por cima) | 28×28 |
| `c-marco`, `-cheio`, `-green`, `-blue` | marco de linha do tempo | 20×20 |
| `c-certo`, `c-errado`, `c-atencao` | ícones de comparativo e mito x verdade | 24×24 |
| `c-vetor`, `-red`, `-green`, `-blue` | vetor de força (girar com `transform="rotate(a cx cy)"`) | 100×20 |
| `c-momento`, `c-momento-anti` | momento de rotação | 60×60 |
| `c-dente`, `c-dente-alveolo`, `c-molar` | dente esquemático (camadas nomeadas por `<text>`) | 60×140, 120×150, 80×130 |
| `c-cranio`, `c-mandibula`, `c-arco` | crânio/face, mandíbula, arco em U | 200×220, 200×120, 160×160 |
| `c-osso`, `c-cartilagem`, `c-sutura` | tecidos (hachura, pontilhado, serrilha) | 100×60, 100×60, 100×12 |
| `c-vertebra`, `-concava`, `-retangular` | estágios cervicais | 60×50 |
| `c-mao` | mão esquemática (idade óssea) | 80×110 |
| `c-eixo`, `c-barra`, `-blue`, `-green` | gráficos | 300×20, 40×100 |
| `c-no-central`, `c-no` | mapa da página/módulo | 160×60, 160×44 |

Uso: `<use href='#c-caixa' x='40' y='60' width='200' height='60'/>` e o texto
por cima: `<text x='140' y='95' text-anchor='middle' font-size='15'>…</text>`.
Dentro do JSON, atributos com aspas simples.

## 6. Receitas por tipo de visual

1. **Fluxograma de decisão** (`fluxograma`) — retrato; `c-caixa-ink` no início, `c-decisao` nas perguntas, `c-caixa` nas ações, `c-caixa-green` nos fins; setas `c-seta`, rótulos `c-pilula` com "sim"/"não". Máximo 9 nós; acima disso, dividir em dois visuais.
2. **Diagrama de classificação** (`classificacao`) — árvore de cima para baixo ou colunas; categoria em `c-caixa-gold`, subtipos em `c-caixa`. Nome da classificação e autor no título.
3. **Linha do tempo** (`linha-do-tempo`) — vertical (retrato): linha à esquerda em `--muted`, marcos `c-marco`, rótulo de idade/fase em 700 e descrição em 13. Horizontal só para até 5 marcos.
4. **Forças e mecânica** (`forcas`) — paisagem; dente `c-dente-alveolo` no centro, vetores `c-vetor*` com rótulo de intensidade/direção, momento `c-momento`. Centro de resistência marcado com ponto `--gold` e legenda "CR".
5. **Tabela comparativa visual** (`comparativo`) — 2 ou 3 colunas com cabeçalho em `c-caixa-blue`/`-gold`/`-green`, linhas com `c-certo`/`c-errado`/`c-atencao` quando o critério é binário. Nunca é tabela de texto: cada célula tem no máximo 6 palavras.
6. **Infográfico de processo** (`processo`) — passos numerados `c-num` em coluna (retrato) ou em linha (até 4); cada passo com um pictograma simples da biblioteca e uma frase.
7. **Esquema anatômico** (`anatomico`) — geométrico, nunca realista; componentes `c-dente*`, `c-cranio`, `c-mandibula`, `c-osso`, `c-sutura`; setas de crescimento `c-vetor`. Rótulos com linha-guia de 1 px.
8. **Gráfico de dados** (`grafico`) — barras `c-barra*` e eixo `c-eixo`; só com números reais citados na `legenda` com a fonte. Sem fonte, sem gráfico.
9. **Mapa** (`mapa`) — resumo visual de fechamento: `c-no-central` com o tema e 4 a 8 `c-no` satélites, ligados por linhas `--border`. Também é o "mapa do módulo" da página de abertura.

## 7. Quadros de destaque (HTML, não SVG)

| estilo | rótulo | cor | quando |
|---|---|---|---|
| `erro` | Erro comum | `--red-soft` / `--red` | o que a maioria erra e por quê |
| `dica` | Dica clínica | `--green-soft` / `--green` | o que só se aprende na cadeira |
| `prova` | Cai na prova | `--gold-soft` / `--gold` | o ponto que bancas cobram |
| `mito` | Mito x verdade | `--blue-soft` / `--blue` | desfaz crença difundida (campos `mito` e `verdade`) |
| `frase` | Em uma frase | `--ink` com texto claro | resumo da seção |

Usar com frequência; dois estilos diferentes por página é o mínimo.

## 8. Imagem clínica (placeholder)

Radiografia, foto clínica, tomografia e histologia não são desenhadas.
Bloco `imagem` com: `imagem` (tipo), `mostrar` (o que a imagem precisa
conter), `legenda` (sugerida), `destacar` (elementos a marcar). Na prévia o
placeholder aparece completo; na plataforma, só a nota "imagem em preparação"
até o titular fornecer a imagem própria ou licenciada.

## 9. Acessibilidade e segurança

- `<title>` e `<desc>` em todo visual (a plataforma gera a partir de `titulo` e `descricao`); `role="img"` e `aria-labelledby`.
- Contraste: texto `--ink` sobre `-soft`; texto branco só sobre `--ink`, `--gold`, `--green`, `--blue`, `--red` cheios.
- Nada de `<script>`, `<image>`, `<foreignObject>`, `href` externo ou evento. O validador recusa.
- `prefers-reduced-motion`: nenhum visual anima.

## 10. O que não fazer

- Dente ou face "realista" em SVG. Um dente esquemático com camadas nomeadas funciona; um dente fotorrealista não.
- Copiar esquema, figura ou tabela de livro ou artigo, mesmo redesenhado por cima. Todo visual é criação original a partir do texto validado.
- Gráfico com números inventados "para preencher".
- Texto como caminho vetorizado; cor hexadecimal solta; emoji; "Distanciamento".

## 11. Biblioteca de diagramas: avaliação

A plataforma já desenha o bloco "Fluxograma de decisão" em SVG com layout
automático (`campus.html`), sem dependência externa, e as demais páginas do
site também não carregam biblioteca de diagramas. Adotar Mermaid ou similar
traria fonte e estilo próprios, mais um download por página e pior
controle de quebra de texto em 375 px, em troca de escrever menos markup. Como
o ganho de tempo é pequeno e o custo em consistência visual é alto, a decisão
é **SVG inline escrito à mão com os componentes daqui**; o fluxograma
automático continua reservado ao bloco 3.
