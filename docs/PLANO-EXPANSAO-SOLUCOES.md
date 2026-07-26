# Plano de Expansão de Soluções — OdontoFeed

> **REGRA DE DEPLOY (absoluta):** nada deste plano sobe para produção até o fundador
> dizer a frase exata **"SUBA O PLANO DE EXPANSÃO"**. Todo o trabalho fica nesta
> branch (`claude/session-01b7dxvfq1ezmbapy-oxomb3`) e neste documento até lá.
>
> Status: **EM CONSTRUÇÃO** — documento vivo, iteramos aqui até ficar perfeito.

---

## Visão geral

Hoje o OdontoFeed entrega curadoria diária (e-mail, site, Spotify, Instagram) e a
Wakai (IA Premium com orçamento diário de tokens). A expansão adiciona **4
ferramentas de trabalho** — o dentista deixa de só *receber* ciência e passa a
*usar* ciência no dia a dia do consultório:

| # | Solução | Nome de trabalho | Complexidade | Aproveita o que já existe |
|---|---------|------------------|--------------|---------------------------|
| 1 | Resumo semanal de mudanças (CFO, ANVISA, artigos, materiais) | **Radar da Semana** | Média | `weekly-digest.js`, pipeline de resumo, TTS |
| 2 | Resolver um caso específico (texto + foto/radiografia) | **Resolver um Caso** | Média-alta | `clinical-query-engine`, ingestores PubMed/EuropePMC, Wakai |
| 3 | Quanto devo cobrar | **Precificador** | Alta (viabilidade limitada — ver análise) | pouco; ferramenta nova |
| 4 | Qual material entrega melhor custo-benefício | **Comparador de Materiais** | Média | acervo `artigos`, ingestores, Wakai, `compare-studies.js` |

Todas entram como abas/cartões dentro do dashboard (área logada), seguindo o
padrão visual existente (`tab-btn` / `tab-content`). Gate Premium + orçamento de
uso reaproveitam o mecanismo da Wakai (`wakai_usage`: orçamento diário de tokens
por usuário, contado após a resposta).

---

## 1) Radar da Semana — "o que mudou em 5 minutos"

**O que é.** Toda semana, um resumo único e escaneável do que mudou na
odontologia brasileira: resoluções e notícias do CFO, RDCs/alertas da ANVISA,
os artigos mais relevantes da semana no acervo, e novidades de materiais.
Formato pensado para 5 minutos de leitura (ou áudio de ~5 min no padrão do
podcast).

**Nome.** "O que mudou esta semana" é descritivo mas comprido para uma aba.
Candidatos (decidir com o fundador):
- **Radar da Semana** ← recomendado (curto, casa com a linguagem do produto)
- Semana em 5 minutos
- Resumo da Semana

**Fontes por bloco:**

| Bloco | Fonte | Como coletar |
|-------|-------|--------------|
| CFO (resoluções, decisões) | cfo.org.br → notícias + atos normativos | Fetch semanal da página de notícias/normas; extrair título+link+data; Claude filtra o que é relevante para clínico |
| ANVISA (RDCs, alertas de produtos, recalls) | Diário Oficial (API do in.gov.br) + página de alertas da ANVISA | Busca semanal por termos odontológicos ("odontológico", "resina", "implante dentário"...) nas publicações da ANVISA |
| Artigos da semana | **Já existe** — coleção `artigos` (últimos 7 dias) | Query no Firestore; Claude escolhe os 3-5 de maior impacto clínico |
| Materiais | Artigos da semana com tema "material" + alertas ANVISA de produtos | Derivado dos dois blocos acima (sem fonte nova no início) |

**Arquitetura:**
- Novo job semanal `radar-semanal.js` (mesmo padrão do `weekly-digest.js`,
  disparado pelo workflow no domingo à noite) → coleta as fontes → 1 chamada
  Sonnet gera o resumo estruturado em blocos → grava em `radar_semanal/{ano-semana}`.
- Nova aba **📡 Radar** no dashboard lendo o doc da semana (+ arquivo das
  semanas anteriores). Custo por semana: ~1 chamada Sonnet + fetches (centavos).
- Opcional fase 2: versão em áudio (reaproveita o TTS do podcast) e bloco no
  e-mail de segunda-feira.

**Riscos e mitigação:**
- *Scraping de site governamental quebra.* → Blocos independentes: se o CFO
  falhar numa semana, o Radar sai sem o bloco CFO (nunca trava a edição inteira),
  e loga para correção. Seletores/URLs em env vars para ajustar sem deploy.
- *Semana sem novidade regulatória.* → O bloco diz "sem mudanças relevantes
  esta semana" — isso também é informação útil (o dentista fica tranquilo).

**Veredito de viabilidade: ALTA.** É a feature mais barata e a de entrega mais
rápida; 80% da infraestrutura já existe.

---

## 2) Resolver um Caso — busca de casos clínicos similares

**O que é.** O dentista descreve o caso (texto livre) e/ou envia fotos —
radiografias, fotos clínicas, documentação. A IA busca **SOMENTE CASOS
CLÍNICOS** (case reports / séries de casos) similares na literatura: primeiro
no acervo próprio, depois busca ativa no PubMed/EuropePMC. Devolve os casos
mais parecidos com o desfecho e a conduta descritos em cada um.

**Regra dura do produto:** a busca retorna exclusivamente publicações do tipo
caso clínico — no PubMed, filtro `Case Reports[Publication Type]`; no
EuropePMC, `PUB_TYPE:"case-reports"`. Nada de revisões ou ensaios aqui: o
dentista quer ver "alguém já enfrentou ISTO", não estatística agregada.

**Fluxo:**
1. Aba **🩻 Resolver um Caso** no dashboard: campo de texto grande + upload de
   até 3 imagens (JPEG/PNG, limite ~5 MB cada).
   - Texto de apoio no campo, exatamente no espírito pedido:
     *"Quanto mais informações sobre o caso (idade, histórico, sintomas,
     achados radiográficos, o que já foi tentado), mais específica será a
     busca por casos similares na literatura."*
   - Abaixo do upload: *"As imagens são usadas apenas para extrair
     características do caso e refinar a busca — não são armazenadas após a
     consulta."* (decisão de privacidade: **não persistir** imagens de
     pacientes; processa e descarta).
2. Backend `resolver-caso.js` (gate Premium + orçamento de tokens, padrão Wakai):
   - **Passo A — extração:** Claude (com visão, se houver imagem) transforma o
     caso num perfil estruturado: achados, dentes envolvidos, hipóteses de
     termos MeSH, especialidade. *A IA descreve achados de imagem ("lesão
     radiolúcida periapical em 46"), nunca emite diagnóstico.*
   - **Passo B — busca:** query no acervo `artigos` (tipo caso clínico) via
     `clinical-query-engine` + busca ao vivo PubMed/EuropePMC com o filtro de
     tipo de publicação e os termos do Passo A.
   - **Passo C — síntese:** Claude ranqueia os 3-6 casos mais similares e
     resume cada um em pt-BR: paciente, quadro, conduta, desfecho, o que
     aproxima do caso do usuário.
3. Rodapé fixo da resposta: *"Material de apoio à decisão baseado em relatos
   publicados — a conduta é sempre do cirurgião-dentista responsável pelo
   caso."* (proteção jurídica; alinhar com docs/PENDENCIAS-JURIDICAS.md).

**Custo por consulta:** 1 chamada com visão (Sonnet) + 1 síntese ≈ R$ 0,10-0,30.
Controlado pelo orçamento diário de tokens por usuário (mesma mecânica Wakai,
coleção própria `caso_usage` ou orçamento unificado — decidir no item
"Créditos" abaixo).

**Riscos e mitigação:**
- *Imagem de paciente = dado sensível (LGPD).* → Não armazenar; processar em
  memória e descartar; avisar o dentista que não deve incluir rosto/nome do
  paciente. Registrar essa decisão nas PENDÊNCIAS JURÍDICAS.
- *Caso raro sem literatura.* → Resposta honesta: "não encontramos casos
  publicados suficientemente similares" + sugerir ampliar a descrição. Nunca
  forçar similaridade.

**Veredito de viabilidade: ALTA** (a parte de visão já é padrão do Claude; a
busca filtrada por tipo de publicação é trivial nos ingestores existentes).

---

## 3) Precificador — "quanto devo cobrar"

**Análise de viabilidade (honesta).** É a mais difícil das quatro, por dois
motivos que não são técnicos:

1. **Não existe base pública confiável de preços praticados por região.**
   Qualquer número "médio da sua cidade" que a IA desse seria inventado — e
   errar preço mina a confiança no produto inteiro.
2. **Risco regulatório real:** o CADE já condenou tabelas de preços sugeridas
   por entidades de classe como conduta anticoncorrencial. Um produto que diz
   "o preço da restauração em Fortaleza é X" flerta com tabelamento.

**Caminho viável: virar uma CALCULADORA DE PRECIFICAÇÃO, não um oráculo de
preço.** Em vez de "o preço da sua região é X", a ferramenta calcula **o preço
mínimo sustentável e uma faixa recomendada PARA O CONSULTÓRIO DAQUELE
dentista** — que é o que ele de fato precisa e ninguém oferece bem:

- **Entradas** (formulário guiado, como o fundador propôs):
  - Região/cidade (ajusta custo de vida e referência de mercado qualitativa)
  - Público-alvo (popular / intermediário / premium)
  - Custo de materiais do procedimento (com sugestões de valores típicos)
  - Custos fixos mensais do consultório (aluguel, equipe, equipamento) e horas
    clínicas/mês → **custo da hora clínica** (o número que a maioria não sabe)
  - Tempo de cadeira do procedimento
- **Saída:** custo real do procedimento + faixa de preço sugerida por
  posicionamento (markup típico do público-alvo), com a memória de cálculo
  aberta ("seu custo/hora é R$ 180; este procedimento consome 1,5h + R$ 90 de
  material → abaixo de R$ 360 você paga para trabalhar").
- A matemática é determinística (sem IA, sem crédito, custo zero por uso). A
  IA entra só para explicar o resultado e responder "e se" (opcional, Premium).

**Fase 2 (o diferencial de longo prazo):** dados anônimos e agregados dos
próprios usuários — "dentistas do seu perfil na sua região que usam o
OdontoFeed relatam faixa de R$ X–Y". Isso é lícito (dado estatístico agregado,
opt-in) e vira um ativo que nenhum concorrente tem. Só faz sentido com base de
usuários maior; fica planejado, não construído.

**Veredito: VIÁVEL COM REENQUADRAMENTO.** Como calculadora de custo/hora +
faixa por posicionamento: constrói-se bem e é honesta. Como "preço da região":
não recomendo — sem dado real, seria chute com aparência de autoridade.

---

## 4) Comparador de Materiais — melhor custo-benefício com evidência

**O que é.** O dentista digita uma categoria ou produto ("resina composta para
posterior", "cimento resinoso X") e a IA busca estudos acadêmicos no acervo +
PubMed/EuropePMC, elencando os materiais com melhor desempenho e justificando
**com base nos artigos**, nunca em opinião.

**Como apresentar as ressalvas SEM dizer "os estudos podem conter viés".**
A regra editorial aqui: toda ressalva vem *ancorada na evidência concreta*,
como contexto que qualifica o resultado — nunca como disclaimer genérico.
Exemplos do tom certo:

- ✅ "A resina A liderou em resistência ao desgaste nos 4 ensaios encontrados;
  3 deles acompanharam os pacientes por até 2 anos, então o desempenho acima
  de 5 anos ainda não foi medido."
- ✅ "Os dois materiais empataram em ensaios clínicos; a vantagem da B aparece
  apenas em testes de laboratório, que nem sempre se repetem na boca."
- ✅ "A maior parte da evidência sobre o produto C vem de estudos conduzidos
  com amostras pequenas (< 30 pacientes) — o resultado é promissor, mas ainda
  inicial."
- ❌ "Os estudos podem conter viés." / "Consulte o texto completo." (proibidos
  — mesma regra editorial do digest.)

Isso é implementável por prompt: o Claude recebe os abstracts e a instrução de
qualificar cada conclusão citando o tipo, o tamanho e o horizonte dos estudos
que a sustentam.

**CACHE COMPARTILHADO — perguntas iguais não consomem crédito (requisito do
fundador).** A resposta para "melhor resina composta para posterior" é
praticamente a mesma para qualquer dentista, então:

- Normalização da pergunta: minúsculas, sem acentos, sem stopwords, termos
  ordenados → `sha256` → doc em `material_cache/{hash}`.
- **Cache hit:** devolve a resposta pronta, **não chama o Claude e não debita
  o orçamento de ninguém** (marca `cacheHit: true`, conta acesso p/ analytics).
- **Cache miss:** roda a busca + síntese, grava no cache com a lista de PMIDs
  usados, debita o orçamento só de quem gerou.
- **Validade:** 90 dias (evidência de materiais muda devagar) — ou invalidação
  antecipada se o pipeline diário ingerir artigo novo altamente relevante para
  um cache existente (fase 2; começar só com TTL).
- Efeito colateral desejado: as 30-50 perguntas mais comuns viram um acervo
  curado quase estático → custo marginal da feature tende a zero com escala.

**Arquitetura:** `comparar-materiais.js` (gate Premium + orçamento padrão
Wakai) → normaliza → cache → (miss) busca acervo + PubMed com filtros de tipo
de estudo (clinical trial, RCT, revisão sistemática) → síntese Sonnet no
formato: ranking, justificativa ancorada por material, contexto da evidência,
fontes. Aba **🧪 Materiais** no dashboard.

**Veredito de viabilidade: ALTA.**

---

## Decisões transversais (a fechar com o fundador)

1. **Nome do guarda-chuva.** As 4 ferramentas podem virar abas soltas ou um
   grupo "🛠️ Ferramentas" / "Consultório". Com o dashboard já tendo 5 abas,
   recomendo um hub: aba única **"Ferramentas"** com 4 cartões dentro.
2. **Créditos unificados ou por ferramenta?** Recomendo **um orçamento diário
   único Premium** cobrindo Wakai + Resolver um Caso + Comparador (o Radar é
   sem custo por uso; o Precificador é determinístico). Mais simples de
   comunicar: "seu uso diário de IA".
3. **Ordem de implementação sugerida** (menor risco → maior):
   - Fase 1: **Radar da Semana** (rápido, alto valor percebido, sem custo por uso)
   - Fase 2: **Comparador de Materiais** (cache torna barato; motor de busca reaproveitado)
   - Fase 3: **Resolver um Caso** (adiciona visão + upload; mais superfície jurídica)
   - Fase 4: **Precificador** (calculadora; sem IA na v1)
4. **Premium ou gratuito?** Sugestão: Radar gratuito (isca de retenção/aquisição,
   inclusive compartilhável); as outras 3 exclusivas Premium.

## O que este plano ainda NÃO decide (iteraremos aqui)

- Nome final de cada aba e do hub.
- Fontes exatas CFO/ANVISA (vou mapear URLs/APIs reais antes de codar).
- Valores default da calculadora de precificação (custos típicos de materiais).
- Se o Radar ganha versão em áudio já na v1.

---

*Documento de trabalho — branch `claude/session-01b7dxvfq1ezmbapy-oxomb3`.
Produção só com a frase exata: "SUBA O PLANO DE EXPANSÃO".*
