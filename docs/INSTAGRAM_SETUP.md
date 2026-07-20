# OdontoFeed — Automação do Instagram

Publica **um carrossel diário** no Instagram **@odontofeedbr** com os melhores
estudos científicos do dia, na identidade da marca. Totalmente automático.

## Como funciona

```
03:00 UTC  Pipeline diário (ingestão + digest por especialidade)
              └─ grava os estudos curados em digests_especialidade/{esp}_{data}
11:00 UTC  Workflow instagram-posts.yml
              1. Lê os melhores estudos do dia (1 por especialidade, top evidência)
              2. Monta o carrossel (capa + estudos + CTA) e renderiza em JPEG (Chromium)
              3. Sobe as imagens no Firebase Storage (URLs públicas)
              4. Publica o carrossel via API do Instagram (Instagram Login)
              5. Grava marcador de idempotência (nunca posta 2× no mesmo dia)
```

### Arquivos

| Arquivo | Papel |
|---|---|
| `netlify/functions/instagram-posts.js` | Orquestra tudo (fetch → render → upload → publish) |
| `netlify/functions/_lib/instagram-slides.js` | Monta o HTML do carrossel a partir dos artigos |
| `netlify/functions/_lib/instagram-render.js` | Renderiza os slides em JPEG 1080×1350 (Playwright) |
| `netlify/functions/_lib/instagram-api.js` | Cliente da API do Instagram (container → carrossel → publish) |
| `netlify/functions/_lib/storage.js` → `uploadImage` | Sobe a imagem no Firebase e devolve URL pública |
| `.github/workflows/instagram-posts.yml` | Agenda diária (11:00 UTC) + disparo manual |

## Credenciais (GitHub Secrets)

A automação usa a **Instagram API with Instagram Login**. Os segredos abaixo
já foram configurados em `Settings → Secrets and variables → Actions`:

| Secret | Valor | Observação |
|---|---|---|
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | `17841446551607375` | ID da conta business @odontofeedbr |
| `INSTAGRAM_ACCESS_TOKEN` | *(token longo)* | Semente inicial; renova sozinho (ver abaixo) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` | — | Já existentes no projeto |
| `GCP_SERVICE_ACCOUNT_JSON`, `GCS_BUCKET` | — | Já existentes (usados pelo Storage/podcast) |

### Auto-renovação do token
O token de longa duração vale ~60 dias. Como o job roda **todo dia**, ele se
**renova sozinho**: a cada execução (se o token guardado tiver >24h) chama
`ig_refresh_token`, estende por mais 60 dias e grava o novo em
`instagram_config/token` no Firestore. O secret do GitHub é só a semente
inicial — depois o Firestore assume. Enquanto o job rodar ao menos uma vez a
cada ~59 dias, o token nunca expira.

> Se algum dia o token expirar (job parado por semanas), gere um novo no painel
> de desenvolvedores (developers.facebook.com → app OdontoFeed Publisher →
> Instagram → Gerar token) e atualize o secret `INSTAGRAM_ACCESS_TOKEN`.

## Testar agora (disparo manual)

1. GitHub → aba **Actions** → **OdontoFeed Instagram Daily Posts**
2. **Run workflow** → Run
3. Acompanhe o log. Sucesso esperado:
   ```
   200 {"posted":1,"mediaId":"...","slides":6,"date":"2026-07-20"}
   ```
4. Confira o post no perfil @odontofeedbr.

> Se aparecer `{"posted":0,"reason":"not_enough_articles"}`, é porque o digest
> do dia ainda não rodou — rode o pipeline diário antes (ou espere o horário).

## Requisitos de imagem (atendidos)
O Instagram exige JPEG, largura 320–1440px e proporção entre 4:5 e 1.91:1. Os
slides são **1080×1350 (4:5)** — dentro do limite. Todas as imagens do carrossel
têm a mesma proporção (obrigatório).

## Formato do carrossel
- **Slide 1 — capa:** "Ciência do dia" + data + nº de estudos + logo
- **Slides 2–6 — estudos:** especialidade + selo de evidência (🏆 RCT, 📊 Meta-análise…) + título + fonte + resumo curto (alternando fundo claro/escuro)
- **Último — CTA:** "Leia os resumos completos" + Seguir @odontofeedbr + odontofeed.com

Marca d'água `odontofeed.com` no topo de todos os slides.

## Idempotência e robustez
- **1 post por dia:** marcador em `instagram_posts/{data}`; reexecutar não duplica.
- **Não quebra o pipeline:** `continue-on-error: true` no workflow e saída limpa se faltar credencial.
- **Processamento assíncrono:** aguarda cada container ficar `FINISHED` antes de publicar (a Meta baixa a imagem primeiro).

## Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `not_configured` | Secrets ausentes | Confira `INSTAGRAM_*` no GitHub |
| `not_enough_articles` | Digest do dia não rodou | Rode o pipeline diário antes |
| `Instagram API: ...` | Token expirado / permissão | Gere novo token e atualize o secret |
| Container não fica pronto | URL da imagem inacessível | Verifique o Storage/bucket público |

## Manutenção futura (opcional)
- Adicionar **stories** e **reels** (o áudio do podcast) — a base já existe.
- Login do Facebook (além do Instagram) para **insights/alcance**.
- Variar o formato (ex.: "mito x verdade", "número que importa").
