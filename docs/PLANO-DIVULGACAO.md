# OdontoFeed — Plano de Divulgação

_Documento vivo. Última atualização: 21/07/2026._

O objetivo desta fase é simples: **colocar o OdontoFeed na mão de dentistas de
verdade**, começando pela rede de contatos do fundador no WhatsApp e crescendo
por indicação (cada dentista traz o próximo). Enquanto a forma de pagamento não
está no ar, **o Premium está 100% grátis** — esse é o maior argumento de
conversão que temos agora. Use-o em tudo.

---

## 1. As 3 mensagens de WhatsApp

Três versões para três situações. **Todas** carregam o aviso de que o Premium
está grátis hoje e o convite para indicar colegas. Substitua `SEULINK` pelo seu
link de indicação (veja a seção 2).

> Dica: mande a **mensagem 1** para contatos individuais próximos, a
> **mensagem 2** em grupos de dentistas / colegas de turma, e a **mensagem 3**
> como status ou recado curto para quem tem pouca intimidade.

### Mensagem 1 — para amigos próximos (individual)

> Oi! 🦷 Tô com um projeto que acho que vai te ajudar todo dia: o **OdontoFeed**.
>
> Todo dia de manhã ele te manda um resumo da ciência mais recente da **sua
> especialidade** — direto do PubMed, resumido pra leitura rápida. Tem e-mail,
> site com os resumos completos, e até **podcast diário no Spotify** pra ouvir
> indo pro consultório.
>
> ⭐ **É importante:** hoje o **plano Premium está de graça** pra que todo mundo
> conheça 100% do OdontoFeed. Então aproveita pra se cadastrar e conhecer o app
> inteiro, sem pagar nada.
>
> Entra pelo meu link 👉 SEULINK
>
> (Se curtir, me fala o que achou — tô ouvindo todo mundo pra deixar redondo.)

### Mensagem 2 — para grupos de dentistas / colegas (broadcast)

> Pessoal, deixando uma recomendação que vale pra todo mundo aqui do grupo 🦷📚
>
> **OdontoFeed** — atualização científica odontológica **todo dia**, na sua
> especialidade. Você acorda com um resumo dos estudos mais recentes (PubMed),
> lê em 2 minutos ou ouve o **podcast no Spotify**. Curadoria de verdade, com
> transparência sobre o uso de IA.
>
> ⭐ **Importante:** neste momento o **plano Premium está 100% grátis** pra todos
> conhecerem o app completo — biblioteca pessoal, comparação de estudos e a
> assistente de IA. Aproveitem pra se cadastrar e testar tudo enquanto está
> liberado.
>
> Cadastro pelo meu link 👉 SEULINK

### Mensagem 3 — recado curto / status

> 🦷 Ciência odontológica da **sua especialidade**, todo dia, no e-mail e no
> Spotify: **OdontoFeed**.
>
> ⭐ O **Premium está grátis** agora pra conhecer o app 100%. Aproveita e se
> cadastra 👉 SEULINK

---

## 2. Como funciona a indicação (Indique um colega, ganhe Premium)

Cada dentista cadastrado tem um **link de indicação próprio** dentro da conta
(aba **Amigos** no dashboard → "Indique um colega, ganhe Premium"). Regra:

> **A cada 3 colegas que se cadastrarem pelo seu link, você ganha 1 mês grátis
> de Premium.** Sem limite — indique quantos quiser.

- O link tem o formato `odontofeed.com/?ref=SEUCODIGO`.
- Quando alguém se cadastra por ele, a indicação é **contada automaticamente** e
  aparece na barra de progresso do dashboard.
- Como nesta fase **todos já estão no Premium de cortesia**, os meses ganhos
  ficam **creditados na conta** e valem quando o Premium virar pago. **Nada se
  perde.**
- O botão **"Copiar"** e o botão **"WhatsApp"** já deixam a mensagem pronta para
  encaminhar (com o aviso do Premium grátis embutido).

**Por que isso cresce sozinho:** cada pessoa que entra tem o próprio link e o
mesmo incentivo — encaminhar para os colegas dela. É o mesmo movimento que você
faz agora, repetido por cada novo dentista.

---

## 3. Roteiro de execução (para o fundador)

1. **Pegue seu link** no dashboard (aba Amigos). Ele é o `?ref=` que identifica
   todas as suas indicações.
2. **Semana 1 — contatos individuais.** Mande a Mensagem 1 para os dentistas que
   você tem no WhatsApp, um a um (chega mais que broadcast). Meta: 30–50 envios.
3. **Semana 1–2 — grupos.** Poste a Mensagem 2 nos grupos de dentistas, colegas
   de turma, especialização, congressos.
4. **Sempre ligado — status.** Deixe a Mensagem 3 no status do WhatsApp e nas
   bios (Instagram: `odontofeed.com`).
5. **Peça a indicação de volta.** Ao responder quem entrou, lembre: "pega teu
   link ali na aba Amigos e manda pros teus colegas — a cada 3 você ganha um mês
   de Premium".
6. **Acompanhe.** O progresso das indicações aparece no dashboard. O painel de
   cadastros mostra o crescimento diário.

---

## 4. Canais de apoio (já no ar)

- **Site:** odontofeed.com — cadastro + resumos completos + dashboard.
- **Instagram:** @odontofeedbr (`odontofeed.com/instagram`) — carrossel diário
  por especialidade + Reels com o áudio do podcast.
- **Spotify:** `odontofeed.com/spotify` — edição diária em áudio (~8 min).
- **E-mail:** o digest diário leva de volta ao dashboard (onde tudo acontece).

Todos os canais apontam para o cadastro, e o cadastro entra em Premium de
cortesia — o funil está fechado e coerente.

---

## 5. O que medir

| Indicador | Onde ver | Meta desta fase |
|---|---|---|
| Novos cadastros/dia | Painel de cadastros (Firestore) | Crescimento constante |
| Indicações por usuário | Dashboard → Amigos | ≥ 1 indicação por usuário ativo |
| Taxa de cadastro via `?ref=` | `referredBy` preenchido nos cadastros | Parcela crescente do total |
| Retenção | Aberturas de e-mail / uso do dashboard | Manter engajamento diário |

O sinal de que o loop pegou é simples: **a fatia de novos cadastros que vêm com
`referredBy` preenchido subindo semana a semana.** Quando isso acontece, o
crescimento deixa de depender só dos seus envios.
