# Especificação da apostila — OdontoFeed Campus

Extraída das 5 páginas piloto de Ortodontia (mini-implantes, Herbst, expansão
rápida da maxila, recidiva e contenção, análise de Steiner) e estendida pelo
plano de 04/09 ("o aluno precisa querer continuar"). É a régua de toda página
nova: o validador em `netlify/functions/_lib/campus/pagina.js` recusa o que
foge daqui.

## 1. O que uma página é

Uma página é a menor unidade que o aluno lê de uma vez: um tema clínico
fechado, 12 a 18 minutos de leitura, com autoteste no fim. Cada página aponta
para um id real da árvore de temas (`area/modulo/tema/pagina`, em
`data/ensino-temas.json`) e vive como JSON em `data/campus/paginas/`.

Convenção de arquivo: `<areaId>--<slug-curto>.json` (ex.:
`ortodontia--crescimento-conceitos.json`). O `id` dentro do arquivo é o que
vale; o nome do arquivo só precisa ser único e legível.

## 2. Metadados obrigatórios

| campo | regra |
|---|---|
| `id` | caminho da árvore, minúsculas, `a-z0-9/-` |
| `areaId`, `area`, `modulo`, `tema` | copiados da árvore (busca e prateleira dependem deles) |
| `titulo` | frase completa, específica, sem dois-pontos gratuitos: "Mini-implantes ortodônticos: ancoragem esquelética na prática" |
| `estado` | `rascunho` (nasce assim) → `validada` → `publicada`; só `validada`/`publicada` aparecem ao aluno |
| `versao` | inteiro, começa em 1 |
| `formato` | `2` para toda página nova (com corpo de leitura); as pilotos são formato 1 |
| `autoria` | uma frase honesta: "Rascunho escrito pela plataforma para validação; nada aqui é visível ao aluno antes da assinatura de um ortodontista." |
| `validacao` | `{ validadoPor: null, data: null }` até alguém assinar |
| `referenciasBase` | livros-texto consolidados e artigos clássicos, por extenso, SEM PMID (referência verificável só vem da Biblioteca) |
| `pesquisa.termos` | 2 a 4 termos para o bloco "O que a pesquisa diz hoje" buscar na Biblioteca; nunca artigos fixos |

## 3. Os nove blocos (formato 1, mantidos no formato 2)

Ordem fixa, porque o aluno aprende onde cada coisa fica.

1. **Em um minuto** — 4 a 6 frases que sozinhas resolveriam a prova; `caiNaProva` com 2 a 5 itens; `porQueImporta` em uma frase clínica.
2. **Infográfico** — título e 3 a 8 itens `{rotulo, texto}`; é o resumo em cartões.
3. **Fluxograma de decisão** — "se isso, então aquilo"; um único nó `inicio`, nós `decisao`/`acao`/`fim`, todo nó alcançável, todo `fim` com chegada. A plataforma desenha; a página só descreve nós e arestas.
4. **Passo a passo** — 3 a 8 passos, cada um com `confira` (o que checar antes de seguir). Em tema conceitual, o passo a passo é "como raciocinar/avaliar no paciente", não um procedimento.
5. **Macetes e dicas** — 2 a 5 `{titulo, texto}`; mnemônicos, números para decorar, o jeito de lembrar. Viram flashcards.
6. **Onde todo mundo erra** — 3 a 5 `{erro, porque, certo}`; erros de prova e de clínica. Viram flashcards.
7. **Autoteste** — exatamente 5 questões estilo ENADE/residência: caso clínico curto no enunciado, 4 ou 5 alternativas, uma explicação por alternativa, e a explicação da correta começa com "Correta:".
8. **O que a pesquisa diz hoje** — dinâmico; a página só entrega `pesquisa.termos`.
9. **Quem validou** — nome, especialidade e data, ou o aviso de rascunho.

Números observados nas pilotos: 5 frases, 7 a 8 itens de infográfico, 9 a 10
nós, 7 a 8 passos, 4 a 5 macetes, 5 erros, 5 questões de 4 alternativas,
1.600 a 1.850 palavras. É a densidade de referência do formato 1.

## 4. O corpo de leitura (formato 2)

Entra ANTES dos blocos 2 a 9 e é o que o aluno lê de fato. Campos novos:

### 4.1 `abertura`
`{ situacao, pergunta }`. Situação clínica concreta (2 a 4 linhas) e uma
pergunta que a página responde. Nunca definição de dicionário.

> Ruim: "A ancoragem é definida como…"
> Bom: "Você planejou retrair os anteriores e os molares vieram junto. O que falhou?"

### 4.2 `secoes[]` (3 a 6 seções)
Cada seção: `{ titulo, blocos[], checagem }`.

- `titulo`: subtítulo que funciona como mapa da página ("Por que a maxila cresce para baixo e para a frente").
- `blocos[]`, na ordem de leitura, com `tipo`:
  - `p` — parágrafo de 2 a 4 linhas (`texto`, até 520 caracteres).
  - `lista` — 2 a 7 `itens` curtos; conta como parágrafo na regra de ouro.
  - `visual` — SVG escrito à mão (seção 5 e `docs/SISTEMA-VISUAL.md`).
  - `destaque` — quadro: `estilo` em `erro | dica | prova | mito | frase`, com `titulo` opcional e `texto` (ou `mito` + `verdade` no estilo mito).
  - `imagem` — placeholder de imagem clínica: `{ imagem, mostrar, legenda, destacar }`. Nunca desenhar radiografia, foto clínica, tomografia ou histologia.
  - `pergunta` — pergunta intermediária com `resposta` expansível (além da checagem obrigatória).
- `checagem`: `{ pergunta, resposta }` no fim de TODA seção.

### 4.3 `fechamento`
`{ visual, flashcards[3] }`: um resumo visual da página (formato `mapa` na
maioria) e exatamente três cartões `{ frente, verso }`.

### 4.4 Regra de ouro e densidade mínima (validadas em código)
- Nunca mais de **3 parágrafos seguidos** (`p`/`lista`) sem visual, quadro ou pergunta. Quatro seguidos é erro da página.
- Ao menos **1 visual principal** nas seções; página densa pede 2 a 3; página de abertura de módulo pede um `mapa` do módulo.
- Ao menos **2 quadros de destaque de estilos diferentes**.
- Fechamento com visual e 3 flashcards.
- `[VERIFICAR]` é livre em rascunho e proibido em página validada.

## 5. Visuais

Toda ilustração é SVG inline, criação original, escrita à mão dentro do JSON
da página, no formato:

```json
{ "tipo": "visual", "formato": "fluxograma", "titulo": "…", "descricao": "…",
  "viewBox": "0 0 560 400", "svg": ["<g>", "…", "</g>"], "legenda": "…" }
```

- `formato` em: `fluxograma`, `classificacao`, `linha-do-tempo`, `forcas`, `comparativo`, `processo`, `anatomico`, `grafico`, `mapa`.
- `titulo` e `descricao` viram `<title>` e `<desc>` (leitor de tela). A plataforma põe a tag `<svg>`; a página entrega só o miolo.
- Texto sempre em `<text>`, nunca vetorizado. Cores por `var(--…)` com fallback. Componentes por `<use href="#c-…">` da biblioteca `assets/campus/componentes.svg`.
- Proibido: `<script>`, `<image>`, `<foreignObject>`, link externo, evento.
- Sem dado inventado em gráfico: sem número real, sem gráfico.

## 6. Voz e registro

- Direta, com "você", sem informalidade excessiva e sem tom professoral.
- Frase curta. Uma ideia por parágrafo. Número sempre acompanhado da unidade e do contexto ("30 a 45 graus em relação ao longo eixo").
- Termo da casa: **Distalização**, nunca "Distanciamento". Zero emoji.
- O que é controverso aparece como controvérsia, com as posições; o que não tem certeza vira qualitativo ou `[VERIFICAR]`. Dez marcações honestas valem mais que um erro fluente.
- Nunca reproduzir figura, tabela ou trecho de livro ou artigo. Fato não tem dono; a expressão tem.

## 7. Questões e flashcards

Questão: enunciado com caso (idade, achado, plano), pergunta objetiva, 4 ou 5
alternativas plausíveis (distratores que um aluno médio marcaria), explicação
de CADA alternativa dizendo por que está errada, a da correta começando com
"Correta:". Nenhuma alternativa "todas as anteriores".

Flashcard (`fechamento.flashcards`): frente é uma pergunta ou lacuna; verso é
uma resposta de uma frase. Os macetes, o "cai na prova" e os erros também
viram cartões automaticamente.

## 8. Estados e progresso

Toda página nasce `rascunho` e é invisível ao aluno. `data/campus-progresso.json`
é atualizado a CADA página (script `scripts/campus-progresso.js`): id, título,
arquivo, palavras, visuais por formato, imagens clínicas pendentes, marcações
`[VERIFICAR]` com localização e status. Ao fim de cada módulo, a lista de
imagens clínicas necessárias é consolidada para o titular fornecer imagens
próprias ou licenciadas.

## 9. Checklist antes de marcar a página como concluída

- [ ] `node scripts/campus-indice.js` sem erro (validador passou)
- [ ] abertura com situação e pergunta; nenhuma seção com 4 parágrafos seguidos
- [ ] 1+ visual principal, 2+ quadros de estilos diferentes, fechamento com visual e 3 cartões
- [ ] renderiza em 375 px sem corte e sem rolagem horizontal
- [ ] nenhum número sem fonte ou sem `[VERIFICAR]`; nenhuma referência inventada; nenhum PMID
- [ ] `[VERIFICAR]` contados e listados no progresso
- [ ] commit da página + progresso
