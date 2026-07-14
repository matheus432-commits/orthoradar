# Plano de Engajamento — OdontoFeed

Plano de implementação das 5 alavancas de engajamento + fricções.
Estimativas no contexto do stack atual (Netlify Functions + Firestore + PWA).
Ordem recomendada assumindo o norte **"ler o artigo de verdade"** (coerente com a
mudança para 3 artigos/dia). Se o norte for "manter informado", suba a #1.

Legenda de esforço: 🌤️ tarde · 📅 1–2 dias · 📦 sprint

---

## #1 — Streak de leitura ativa + push (PWA)  📦
**Maior retorno pelo esforço. Começar por aqui.**

O que muda: trocar "dias assinando" (passivo) por "dias seguidos lendo" (abriu ≥1
artigo no dia). Mostrar 🔥 e disparar push quando a sequência estiver prestes a quebrar.

- **Modelo (Firestore `user_engagement`)**: adicionar `readStreak`, `lastReadDate`,
  `longestStreak`. Já existe `streak`/`clicksByTheme` — reaproveitar a coleção.
- **Registro de leitura**: em `track-open`/`track-click` e no `toggle-lido`/abertura de
  artigo no dashboard, marcar o dia como "lido" e recalcular o streak (dia seguido = +1;
  gap de 1 dia = zera).
- **UI (dashboard.html)**: trocar o card "Dias assinando" por "🔥 N dias seguidos lendo".
- **Push (PWA)** — a parte grande:
  - Gerar chaves **VAPID**; guardar em env (`VAPID_PUBLIC`/`VAPID_PRIVATE`).
  - Service worker (`sw.js`) com handler `push` + `notificationclick`.
  - Função `save-push-subscription` (guarda a subscription no cadastro) e
    `send-push` (envia via Web Push — implementável em node cru com `crypto`, sem lib).
  - Passo no pipeline diário: para quem está a 1 dia de perder o streak, enviar
    "Você está a 1 dia de perder sua sequência de N dias."
- **Esforço**: streak+UI 🌤️ · infra de push 📦. Entregar em 2 fatias.
- **Dependências**: nenhuma externa (Web Push é grátis).

## #2 — Personalização visível  🌤️
Tornar o aprendizado do algoritmo perceptível.

- Em cada card do digest, uma linha: *"Escolhemos este porque você abriu 3 artigos
  sobre alinhadores esta semana."*
- **Onde**: `email-template.js` já recebe `topThemes`/`clicksByTheme` (via
  `engagement`). O `recommendation-engine` já sabe por que escolheu — basta expor o
  "motivo" por artigo e renderizar a linha.
- Dá ao dentista razão para clicar (validar/corrigir a curadoria) → alimenta o loop.
- **Esforço**: 🌤️–📅. Sem novas coleções.

## #3 — Camada social com prova de pares  📦
Dentista é movido por comparação com pares.

- Sinais: *"4 ortodontistas salvaram este artigo"*, *"Você está entre os 15% mais
  atualizados em Ortodontia este mês"*.
- **Modelo**: agregado por artigo (`artigo_stats`: saves/lidos por especialidade).
  `curtidos`/`lidos` já são rastreados — falta agregar e (para "da sua região") capturar
  **região** no cadastro (campo novo, opcional).
- **Onde**: dashboard (aba Recebidos/Especialidades) e, opcionalmente, no digest.
- **Esforço**: 📦 (agregação + captura de região + UI). Fazer "da sua região" como fase 2.

## #4 — Recompensa por profundidade  📅
Hoje a leitura é rastreada mas não recompensada.

- Selo/badge por especialidade; "certificado de atualização mensal" (dentista adora
  comprovante de educação continuada); desbloqueio de conteúdo.
- **Base já existe**: `user_engagement.newBadgesThisWeek` e a exibição de badges no
  digest. Falta definir as regras (ex.: leu N artigos de alta evidência no mês → badge)
  e o "certificado" (gerar imagem/PDF simples — reaproveitar padrão de template).
- **Gancho estratégico**: se um dia buscar validação de horas de educação continuada,
  vira motor de retenção forte.
- **Esforço**: badges 📅 · certificado mensal 📅.

## #5 — Lacuna de curiosidade no resumo  🌤️
Para os 1–2 artigos que você mais quer que sejam lidos na íntegra.

- Resumo termina com pergunta em aberto em vez de conclusão fechada:
  *"O protocolo funcionou, mas os autores divergem sobre por quê. A discussão traz uma
  hipótese contraintuitiva."*
- Diferenciar visualmente **"leitura rápida"** (resumo completo) de **"vale o
  aprofundamento"** (teaser).
- **Onde**: prompt do `editorial-generator`/enriquecimento gera um campo `teaser` para
  os top artigos; `email-template` renderiza com estilo distinto.
- **Esforço**: 🌤️ (mudança de prompt + 1 estilo). Alto retorno para o norte "ler de verdade".

---

## Fricções menores (fechar antes de escalar)
- **Política de Privacidade / Termos apontam para `#`** (vazio) — público de saúde lida
  com dados sensíveis; criar as páginas de verdade. 🌤️  **Prioridade alta (risco/compliance).**
- **Cadastro pede senha + confirmação no fim do onboarding** — avaliar **magic link** por
  e-mail (o e-mail já precisa ser confirmado). Reduz abandono. 📅
- **CTA "Ver exemplo de digest"** — manter em destaque (já é bom, sem ação).

---

## Sequência recomendada
1. **Fricções de compliance** (Privacidade/Termos) — barato e bloqueante para escalar. 🌤️
2. **#5 lacuna de curiosidade** — barato, alinhado ao norte "ler de verdade". 🌤️
3. **#2 personalização visível** — barato, fecha o loop de curadoria. 🌤️–📅
4. **#1 streak + push** — maior motor de retorno diário; fatiar (streak/UI → push). 📦
5. **#4 recompensa por profundidade** — badges → certificado. 📅
6. **#3 camada social** — maior esforço; fazer por último, "da sua região" em fase 2. 📦

> Regra de ouro: cada alavanca só entra em produção com o guardrail de custo/segurança
> já aplicado ao resto do projeto (validação de sessão, sem placeholder cru, sem gasto
> de API sem gate). Nada sobe ao Netlify sem revisão.
