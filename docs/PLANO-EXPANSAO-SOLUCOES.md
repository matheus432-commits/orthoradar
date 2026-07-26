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

| # | Solução | Nome de trabalho | Status | Aproveita o que já existe |
|---|---------|------------------|--------|---------------------------|
| 1 | Resumo semanal de mudanças (CFO, ANVISA, artigos, materiais) | **CFO & ANVISA: o que mudou** (nome DECIDIDO 26/07) | Aprovado p/ construir | `weekly-digest.js`, pipeline de resumo, TTS |
| 2 | Resolver um caso específico (texto + foto/radiografia) | **Resolver um Caso** | Aprovado p/ construir | `clinical-query-engine`, ingestores PubMed/EuropePMC, Wakai |
| 3 | Quanto devo cobrar | Precificador | **ADIADO** (decisão do fundador 26/07) — análise preservada p/ o futuro | — |
| 4 | Qual material entrega melhor custo-benefício | **Comparador de Materiais** | Aprovado p/ construir | acervo `artigos`, ingestores, Wakai, `compare-studies.js` |
| 5 | Guias clínicos visuais por especialidade (área de membro rica) | **Guias OdontoFeed** | Novo (pedido 26/07) — ver seção 5 | pipeline de ilustração (`imagen.js`), identidade por especialidade |
| 6 | Ferramentas de decisão por especialidade (situação → opções + protocolo) | **Ferramentas OdontoFeed** | Novo (pedido 26/07) — ver seções 6 e 7 | conteúdo curado, sem custo de IA por uso |

> **Mapa completo de todas as abas (gerais + por especialidade): seção 7.**

**REGRA DE CRÉDITOS (decisão do fundador, 26/07):** nenhuma ferramenta cria
orçamento novo. **Tudo que usa IA debita do orçamento diário da Wakai**
(`wakai_usage`, o mesmo doc e o mesmo teto). Estourou o orçamento em qualquer
ferramenta → todas respondem com a mesma mensagem:

> *"Muitas requisições hoje 😅 — seu limite de IA renova à meia-noite. Tente
> novamente amanhã."*

O que NÃO debita nada: Normas da Semana (gerado 1x/semana pelo pipeline, não
por usuário), Guias (conteúdo estático) e cache hits do Comparador.

---

## 1) CFO & ANVISA: o que mudou — **nome e comportamento DECIDIDOS (26/07)**

**O que é.** Avaliação **1x por semana** do que mudou na odontologia
brasileira: resoluções e notícias do CFO, RDCs/alertas da ANVISA, artigos e
materiais. Comportamento definido pelo fundador:

- **Houve mudança na semana** → uma **bolinha vermelha** aparece sobre o ícone
  da aba (badge de notificação, estilo app) para o dentista saber que teve
  novidade. Dentro da aba, **cada mudança é explicada em um texto breve** (o
  que mudou, a quem afeta, o que fazer, link para a fonte oficial).
- **Não houve mudança** → sem bolinha; a aba mostra a **página de referência
  permanente**: os termos/normas mais importantes em vigor + links oficiais
  (ex.: resolução de prontuário, prescrição, publicidade CFO, RDCs de
  esterilização/radiologia). Ou seja, a aba nunca fica vazia — vira a
  biblioteca regulatória de bolso do dentista.

**Mecânica do badge:** o job semanal grava `regulatorio/{ano-semana}` com
`temMudanca: true|false` + itens. O dashboard mostra a bolinha se a semana
corrente tem `temMudanca` e o usuário ainda não abriu a aba desde então
(marca `visto` em localStorage/perfil). Some ao abrir.

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
**Debita do orçamento da Wakai** (`wakai_usage` — decisão do fundador: nenhum
orçamento novo). Estourou → mensagem padrão "Muitas requisições hoje 😅 — seu
limite de IA renova à meia-noite. Tente novamente amanhã."

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

## 3) Precificador — "quanto devo cobrar" — **ADIADO**

> **Decisão do fundador (26/07): não será implementado no momento.** A análise
> abaixo fica preservada para quando (e se) o tema voltar.

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
  usados, debita o orçamento da Wakai só de quem gerou (regra: orçamento único).
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

## 5) Guias OdontoFeed — guias clínicos visuais por especialidade

**Origem (pedido do fundador, 26/07).** Referência: anúncio no Instagram de um
guia de análise cefalométrica — cada parâmetro (ex.: FMA) com definição,
diagrama, interpretação de valores aumentados/reduzidos e **orientação do que
fazer**. A área de membro deve ficar rica nesse nível — não "página com abas e
textos mal distribuídos". Exigências: material personalizado, estética MUITO
agradável, fácil entendimento.

**O que é.** Uma biblioteca de guias de referência clínica, um conjunto por
especialidade (as 11 do ciclo editorial), no padrão visual OdontoFeed
(cor da especialidade + ilustrações do pipeline `imagen.js`). Cada guia segue
a mesma anatomia do exemplo da cefalometria:

> parâmetro/situação → definição visual → valores/classificação → o que
> significa quando está alterado → **conduta sugerida** → referências.

**Formato técnico:** páginas HTML interativas dentro do dashboard (navegação
por parâmetro, busca, responsivo, imprimível/exportável em PDF). Conteúdo
estático gerado uma vez e revisado — **zero custo por uso, zero crédito**.
Protótipo de estética: `docs/prototipos/guia-cefalometria-preview.html`.

**Catálogo proposto por especialidade** (v1 = o guia marcado com ★; os demais
entram no ritmo de 1 guia novo/semana, virando inclusive pauta de divulgação):

| Especialidade | Guias propostos |
|---------------|-----------------|
| **Ortodontia** | ★ Análise cefalométrica parâmetro a parâmetro (FMA, SNA, SNB, ANB, IMPA, 1.NA/1.NB, overjet/overbite — interpretação + conduta) · Classificação de Angle visual + plano por classe · Análise de Bolton com calculadora embutida · Cronologia de erupção e janelas de interceptação · Guia de contenção (qual, quando, por quanto tempo) |
| **Implantodontia** | ★ Fluxo de decisão carga imediata × precoce × tardia (com critérios de torque/ISQ) · Classificação de qualidade óssea (Lekholm & Zarb) ilustrada · Checklist de planejamento em tomografia · Diagnóstico e manejo de mucosite × peri-implantite |
| **Periodontia** | ★ Classificação AAP/EFP 2018 interativa (estadiamento + graduação passo a passo) · Guia de sondagem e registro periograma · Recessões (Cairo RT1-3) + indicação de recobrimento · Decisão raspagem × cirurgia |
| **Endodontia** | ★ Diagnóstico pulpar e periapical (testes, interpretação, nomenclatura) · Protocolos de irrigação comparados · Trauma dentário — guia IADT ilustrado por tipo de trauma · Decisão retratamento × cirurgia parendodôntica |
| **Dentística** | ★ Seleção de resina por situação clínica (classe, região, exigência estética) · Protocolos adesivos (condicionamento total × autocondicionante, passo a passo) · Clareamento: concentrações, protocolos e manejo de sensibilidade · Escala de cor na prática |
| **Prótese** | ★ Decisão coroa × onlay × faceta (por destruição remanescente) · Guia de cimentação: qual cimento para qual material · Términos e preparos ilustrados · Zircônia × dissilicato × híbridas: quando cada uma |
| **Bucomaxilofacial** | ★ Terceiros molares: classificações Pell & Gregory/Winter + decisão de extrair × acompanhar · Manejo do paciente anticoagulado/antiagregado · Protocolo MRONJ (prevenção e conduta) · Sinais radiográficos de fratura |
| **Odontopediatria** | ★ Cronologia de erupção interativa (decíduos + permanentes) · Trauma em dentes decíduos (IADT) — o que muda em relação ao permanente · Flúor por idade: doses, vernizes, risco de fluorose · ICDAS visual para decisão restaurar × remineralizar |
| **DTM e Dor Orofacial** | ★ Diagnóstico diferencial da dor orofacial (árvore de decisão) · Exame DC/TMD guiado passo a passo · Placas oclusais: qual tipo para qual quadro |
| **Radiologia** | ★ Lesões radiolúcidas × radiopacas: árvore diagnóstica por localização/relação com o dente · Qual exame pedir (periapical × panorâmica × TCFC) com doses comparadas · Anatomia radiográfica que engana (forames, sobreposições) |
| **Estomatologia** | ★ Atlas de lesões da mucosa por cor (branca/vermelha/pigmentada/ulcerada) com red flags de encaminhamento · Exame sistemático de rastreio de câncer bucal · Biópsia: quando, qual tipo, como encaminhar |

**Produção de cada guia:** conteúdo redigido com Claude a partir de
referências consagradas + artigos do acervo, revisado pelo fundador
(cirurgião-dentista) antes de publicar; ilustrações no estilo travado da marca;
template HTML único → consistência estética e custo marginal baixo. A revisão
profissional é obrigatória: é material de conduta clínica.

**Efeito colateral de marketing:** cada guia novo é um post/anúncio natural
(exatamente como o anúncio que inspirou a ideia) — "guia completo no
OdontoFeed Premium".

---

## 6) Ferramentas de Decisão por especialidade — "seleciono a situação, recebo o protocolo"

**Origem (pedido do fundador, 26/07).** Além dos guias de leitura, abas
**interativas** por especialidade, atacando as dúvidas mais frequentes de cada
uma. O padrão de interação é sempre o mesmo:

> o dentista **seleciona o que quer fazer / a situação do paciente** → a
> ferramenta entrega **as opções disponíveis, com o protocolo de cada uma e
> orientações** (indicação, timing, ativação, acompanhamento, ressalvas).

São **árvores de decisão curadas e estáticas** (conteúdo revisado pelo
fundador): zero custo de IA por uso, zero crédito, resposta instantânea.

### ★ APROVADO P/ IMPLEMENTAR: Aparelhos Ortopédicos (Ortodontia)

O exemplo dado pelo fundador. O ortodontista seleciona o **objetivo
terapêutico** (ex.: avanço mandibular) e recebe os **aparelhos ortopédicos
indicados**, cada um com: indicação precisa, janela ideal de tratamento
(estágio de maturação), protocolo de uso/ativação, duração típica,
orientações ao paciente e contexto da evidência.
Objetivos da v1: avanço mandibular (Classe II) · expansão maxilar ·
protração maxilar (Classe III) · distalização/ancoragem · controle de hábitos
e mordida aberta.
Protótipo de estética/interação: `docs/prototipos/ferramenta-aparelhos-ortopedicos.html`.

### Sugestões de ferramentas por especialidade (dúvidas mais frequentes)

| Especialidade | Ferramenta proposta (situação → opções + protocolo) |
|---------------|------------------------------------------------------|
| **Todas (transversal)** | ★ **APROVADO 26/07** — 💊 **Prescrição Segura**: situação clínica (dor pós-op, abscesso, pericoronarite, profilaxia) + perfil do paciente (alergia à penicilina, gestante, criança/peso, renal) → fármaco, dose, posologia e modelo de receita. É a dúvida nº 1 de qualquer consultório. Inclui 💉 **calculadora de dose máxima de anestésico** (peso + comorbidade → tubetes por sal) |
| **Ortodontia** | ★ Aparelhos Ortopédicos (aprovado) · Timing de interceptação: achado no exame → tratar agora × monitorar |
| **Implantodontia** | Enxertos e biomateriais: defeito ósseo (seio, deiscência, horizontal...) → técnica + biomaterial + tempo de espera · Protocolo de carga: torque/ISQ + situação → imediata × precoce × tardia |
| **Periodontia** | Do periograma ao plano: estágio + grau → sequência de terapia (RAR, antimicrobianos, cirurgia, intervalo de manutenção) |
| **Endodontia** | Medicação intracanal: diagnóstico + nº de sessões → substância, tempo, troca · Anestesia na pulpite irreversível: técnica suplementar quando o bloqueio falha |
| **Dentística** | Protocolo restaurador: cavidade/região/exigência estética → resina + sistema adesivo + passo a passo · Clareamento: vitalidade + urgência + sensibilidade → protocolo e concentração |
| **Prótese** | Assistente de cimentação: material da peça → tratamento de superfície + cimento + passos na ordem · Seleção de material por caso |
| **Bucomaxilofacial** | Terceiros molares: classificação radiográfica → dificuldade, técnica, riscos, o que avisar ao paciente · Paciente anticoagulado/antiagregado: fármaco em uso → conduta pré/pós |
| **Odontopediatria** | Calculadoras pediátricas: peso/idade → anestésico, flúor, antibiótico · Trauma no decíduo: tipo de trauma → conduta (IADT) e o que dizer aos pais |
| **DTM e Dor Orofacial** | Seleção de placa: quadro (bruxismo, travamento, dor muscular) → tipo de placa + protocolo de acompanhamento |
| **Radiologia** | Qual exame pedir: suspeita clínica → exame indicado + justificativa + dose comparada |
| **Estomatologia** | Da lesão à conduta: características da lesão (cor, tempo, superfície) → hipóteses + biópsia sim/não + urgência do encaminhamento |

**Priorização dentro desta frente:** 1º Aparelhos Ortopédicos (aprovado,
protótipo pronto) · 2º Prescrição Segura (aprovada 26/07 — transversal, serve
os 11 públicos de uma vez) · depois 1 ferramenta por especialidade seguindo o
ciclo editorial.

---

## 7) MAPA DE ABAS — visão consolidada

### 7.1 Abas GERAIS (todo dentista vê, independente da especialidade)

| Aba | Status | O que faz | Custo de IA |
|-----|--------|-----------|-------------|
| 📰 **Recebidos** | já existe | Edição do dia (artigos + áudio) | — |
| 📚 **Salvos** | já existe | Biblioteca pessoal (Premium) | — |
| 👥 **Amigos** | já existe | Indicação e colegas da especialidade | — |
| 🤖 **Wakai** | já existe | IA científica pessoal (Premium) | orçamento diário |
| ⚙️ **Preferências** | já existe | Perfil e temas | — |
| ⚖️ **CFO & ANVISA: o que mudou** | NOVA | Avaliação semanal do regulatório; bolinha vermelha quando há mudança + texto breve explicando; sem mudança, mostra normas em vigor + links oficiais | nenhum p/ usuário |
| 💊 **Prescrição Segura** | NOVA ★ aprovada | Situação + perfil do paciente → fármaco, dose, posologia, modelo de receita + calculadora de anestésico | nenhum (conteúdo curado) |
| 🩻 **Resolver um Caso** | NOVA | Descrição + fotos/radiografias → casos clínicos similares na literatura | orçamento Wakai |
| 🧪 **Comparador de Materiais** | NOVA | Material/categoria → ranking com justificativa por evidência (cache: pergunta repetida não gasta crédito) | orçamento Wakai (só no cache miss) |
| 📖 **Guias** | NOVA | Biblioteca de guias visuais — abre nos da especialidade do usuário, com acesso a todas | nenhum |
| 🛠️ **Ferramentas** | NOVA | Hub das ferramentas de decisão — abre nas da especialidade do usuário | nenhum |

> **Como a especialidade entra:** Guias e Ferramentas são abas gerais que
> **filtram pelo perfil do dentista** — o ortodontista abre e vê Ortodontia
> primeiro, com um seletor para navegar nas outras. Isso evita 22 abas no menu
> e mantém a área de membro enxuta.

### 7.2 Conteúdo POR ESPECIALIDADE (dentro de 📖 Guias e 🛠️ Ferramentas)

★ = primeiro a ser produzido em cada especialidade.

| Especialidade | 📖 Guias (leitura visual) | 🛠️ Ferramentas (interativas) |
|---|---|---|
| **Ortodontia** | ★ Análise cefalométrica parâmetro a parâmetro · Classificação de Angle + plano por classe · Análise de Bolton com calculadora · Cronologia de erupção e janelas de interceptação · Guia de contenção | ★ **Aparelhos Ortopédicos** (aprovado, protótipo pronto) · Timing de interceptação: tratar agora × monitorar |
| **Implantodontia** | ★ Carga imediata × precoce × tardia · Qualidade óssea (Lekholm & Zarb) ilustrada · Checklist de planejamento em tomografia · Mucosite × peri-implantite | ★ Enxertos e biomateriais: defeito ósseo → técnica + biomaterial + tempo de espera · Protocolo de carga por torque/ISQ |
| **Periodontia** | ★ Classificação AAP/EFP 2018 interativa · Sondagem e periograma · Recessões (Cairo RT1-3) e recobrimento · Raspagem × cirurgia | ★ Do periograma ao plano: estágio + grau → terapia e intervalo de manutenção |
| **Endodontia** | ★ Diagnóstico pulpar e periapical · Protocolos de irrigação comparados · Trauma dentário (IADT) ilustrado · Retratamento × cirurgia parendodôntica | ★ Medicação intracanal: diagnóstico + sessões → substância e tempo · Anestesia na pulpite irreversível quando o bloqueio falha |
| **Dentística** | ★ Seleção de resina por situação clínica · Protocolos adesivos passo a passo · Clareamento e sensibilidade · Escala de cor na prática | ★ Protocolo restaurador: cavidade/região/estética → resina + adesivo + passos · Clareamento por caso |
| **Prótese** | ★ Coroa × onlay × faceta por remanescente · Qual cimento para qual material · Términos e preparos ilustrados · Zircônia × dissilicato × híbridas | ★ Assistente de cimentação: material da peça → tratamento de superfície + cimento + ordem dos passos |
| **Bucomaxilofacial** | ★ Terceiros molares (Pell & Gregory/Winter) · Paciente anticoagulado/antiagregado · Protocolo MRONJ · Sinais radiográficos de fratura | ★ Terceiros molares: classificação → dificuldade, técnica, riscos, o que avisar · Anticoagulado: fármaco em uso → conduta pré/pós |
| **Odontopediatria** | ★ Cronologia de erupção interativa · Trauma em decíduos (IADT) · Flúor por idade e risco de fluorose · ICDAS visual | ★ Calculadoras pediátricas: peso/idade → anestésico, flúor, antibiótico · Trauma no decíduo → conduta e o que dizer aos pais |
| **DTM e Dor Orofacial** | ★ Diagnóstico diferencial da dor orofacial · Exame DC/TMD guiado · Placas oclusais por quadro | ★ Seleção de placa: quadro → tipo + protocolo de acompanhamento |
| **Radiologia** | ★ Radiolúcidas × radiopacas: árvore diagnóstica · Qual exame pedir (doses comparadas) · Anatomia radiográfica que engana | ★ Qual exame pedir: suspeita clínica → exame + justificativa + dose |
| **Estomatologia** | ★ Atlas de lesões da mucosa por cor com red flags · Rastreio de câncer bucal · Biópsia: quando, qual, como encaminhar | ★ Da lesão à conduta: características → hipóteses + biópsia sim/não + urgência do encaminhamento |

**Totais:** 11 abas gerais (5 existentes + 6 novas) · 41 guias mapeados ·
22 ferramentas mapeadas (2 aprovadas para já: Aparelhos Ortopédicos e
Prescrição Segura).

### 7.3 Ordem de produção sugerida

| Onda | Entregas |
|------|----------|
| **1** | 💊 Prescrição Segura (transversal) + 🛠️ Aparelhos Ortopédicos + 📖 Guia de Cefalometria — as 3 já com protótipo/aprovação |
| **2** | ⚖️ CFO & ANVISA: o que mudou (com o badge) |
| **3** | 🧪 Comparador de Materiais (cache) |
| **4** | 🩻 Resolver um Caso (visão + upload) |
| **Contínuo** | 1 guia ou ferramenta nova por semana, seguindo o ciclo editorial das 11 especialidades — cada entrega vira pauta de divulgação |

---

## Decisões transversais

1. **Créditos: DECIDIDO (26/07)** — orçamento único = o da Wakai, para tudo
   que usa IA. Mensagem única de estouro: *"Muitas requisições hoje 😅 — seu
   limite de IA renova à meia-noite. Tente novamente amanhã."*
2. **Precificador: DECIDIDO (26/07)** — fora do escopo atual.
3. **Nome do guarda-chuva.** Com Guias entrando, o dashboard ganha: aba
   **"Ferramentas"** (Resolver um Caso + Comparador) e aba **"Guias"**
   (biblioteca por especialidade) — ou um hub único. A decidir.
4. **Ordem de implementação sugerida** (valor × risco):
   - Fase 1: **Guia de Cefalometria (Ortodontia)** — é a referência estética
     que define o padrão de TODA a área de membro nova; sem custo de IA por uso
   - Fase 2: **Normas da Semana** (rápido, sem custo por uso)
   - Fase 3: **Comparador de Materiais** (cache + orçamento Wakai)
   - Fase 4: **Resolver um Caso** (visão + upload; maior superfície jurídica)
   - Contínuo: 1 guia novo por semana até cobrir as 11 especialidades
5. **Premium ou gratuito?** Sugestão: Normas da Semana gratuito (isca de
   aquisição, compartilhável); Guias, Comparador e Resolver um Caso exclusivos
   Premium.

## O que este plano ainda NÃO decide (iteraremos aqui)

- Nome final da aba regulatória (recomendação atual: "Normas da Semana").
- Fontes exatas CFO/ANVISA (mapear URLs/APIs reais antes de codar).
- Aprovação da estética do protótipo do guia de cefalometria → vira o template
  de todos os guias.
- Se Normas da Semana ganha versão em áudio já na v1.

---

*Documento de trabalho — branch `claude/session-01b7dxvfq1ezmbapy-oxomb3`.
Produção só com a frase exata: "SUBA O PLANO DE EXPANSÃO".*
