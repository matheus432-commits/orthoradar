# Instagram Automation — Post Examples & Architecture

## Daily Post Flow

```
03:00 UTC (00:00 BRT)
  ↓
Daily Pipeline (ingest-pubmed, ingest-europepmc, etc)
  ↓
Digest Generation (daily-digest.js)
  ├─ Selects 3-5 top articles per specialty
  ├─ Caches in digests_especialidade/{esp}_{date}
  └─ Enriches with Claude (summaries, evidence level)
  ↓
08:00 UTC (05:00 BRT)
  ↓
Instagram Posts Workflow
  ├─ Fetches today's digest cache
  ├─ Deduplicates by PMID
  ├─ Builds carousel post (3-5 slides)
  ├─ Posts via Meta Graph API
  └─ Publishes to Instagram feed
```

## Example Posts

### Example 1: Morning Carousel Post (08:00 BRT)

**Caption:**
```
📚 Ciência Odontológica

✅ 5 estudos curados em 2026-07-20

💡 Resumos em áudio, artigos na íntegra — grátis em odontofeed.com

🎧 Ouça os episódios completos em Spotify, Apple Podcasts e demais plataformas.

#OdontoFeed #CiênciaOdontológica #Pesquisa #Dentística #PUP
```

**Slide 1/5:**
```
✨ Efetividade de protocolos de clareamento com peróxido de hidrogênio

🏆 Ensaio Clínico
J Esthet Dent • 2026

Tema: Estética
Especialidade: Dentística

"Estudo com 50 pacientes avaliando tempo de tratamento e sensibilidade pós-operatória em diferentes protocolos..."

[1/5]
```

**Slide 2/5:**
```
👑 Prótese sobre implante com carga imediata: análise de 6 meses

👥 Estudo Coorte
Implant Dent • 2026

Tema: Implante
Especialidade: Implantodontia

"Avaliação longitudinal de 40 pacientes com próteses sobre implante osseointegrado imediato, com análise de..."

[2/5]
```

**Slide 3/5:**
```
🪥 Eficácia da raspagem e alisamento radicular associada a laser de baixa potência

📊 Meta-análise
J Periodont Res • 2026

Tema: Perio
Especialidade: Periodontia

"Revisão sistemática de 23 estudos clínicos randomizados, com análise de redução de bolsa periodontal e..."

[3/5]
```

**Slide 4/5:**
```
🔬 Hipoclorito de sódio vs. peróxido de uréia em desinfecção do sistema de canais radiculares

🔍 Revisão Sistemática
J Endod • 2026

Tema: Endodontia
Especialidade: Endodontia

"Comparação de eficácia antimicrobiana de diferentes agentes químicos em desinfecção de canais radiculares..."

[4/5]
```

**Slide 5/5:**
```
📐 Efeito da intensidade de força em movimentos ortodônticos acelerados com microvibrações

⚖️ Caso-Controle
Angle Orthod • 2026

Tema: Ortodontia
Especialidade: Ortodontia

"Estudo avaliando a taxa de movimento dental e perda óssea alveolar em tratamento ortodôntico com..."

[5/5]
```

---

### Example 2: Lunchtime Story Post (12:00 BRT)

**Text:**
```
✨

Efetividade de protocolos de clareamento com peróxido de hidrogênio

🏆 Ensaio Clínico
```

**CTA Button:** "Ver estudo completo"
**Link:** https://odontofeed.com

---

### Example 3: Evening Reel Post (18:00 BRT)

**Caption:**
```
🎧 Ortodontia

✨ Edição compilada de 8m0s

📚 2026-07-20

🎙️ Curadoria científica + narração de IA (100% transparente)

👂 Ouça agora:
• Spotify
• Apple Podcasts
• OdontoFeed.com

#OdontoFeed #Podcast #Ortodontia
```

---

## Architecture Overview

### Data Flow

```
Firebase Firestore
    ↓
    ├─ artigos collection
    │   └─ Daily ingested articles (PubMed, Europe PMC, OpenAlex)
    │
    ├─ digests_especialidade/{esp}_{date}
    │   └─ Cached, curated digest per specialty
    │
    └─ cadastros → preferences → specialties
        └─ User interests determine article selection
```

### Post Generation Pipeline

```javascript
// 1. Fetch today's digest cache
getTodaysTopArticles(db, 5)
  → Queries digests_especialidade for today's date
  → Deduplicates by PMID
  → Returns top 5 articles
  
// 2. Build carousel post structure
buildCarouselPost(articles, opts)
  → Creates caption with greeting + CTA
  → Generates 5 slides (one per article)
  → Each slide includes:
     - Article title (PT/EN)
     - Journal + Year
     - Evidence level emoji (🏆🔬📊🔍⚖️📋)
     - Theme + Specialty
     - Summary snippet
     
// 3. Post to Instagram
postCarouselToInstagram(accountId, token, post)
  → Calls Meta Graph API POST /media
  → Receives media ID
  → Publishes with status=PUBLISHED
```

### Module Responsibilities

| Module | Purpose |
|--------|---------|
| `instagram-generator.js` | Post content generation, formatting, emoji mapping |
| `instagram-posts.js` | Firebase queries, Meta API calls, error handling |
| `instagram-posts.yml` | Scheduling, environment setup, CI/CD integration |
| `instagram-generator.test.js` | 11 unit tests covering all post types |

---

## Content Quality Standards

### Article Selection
✅ Only published articles with status='active'
✅ From today's curated digest (not raw ingest)
✅ Deduped by PMID to prevent repeats
✅ Top N ranked by specialty curator

### Post Quality
✅ Emoji usage appropriate to evidence level & theme
✅ Hashtags include #OdontoFeed + 3 specialty tags
✅ Captions under Instagram limits (2,200 chars)
✅ Portuguese language, professional tone
✅ CTAs link to odontofeed.com + streaming platforms

### Image Considerations (MVP)
**Current:** Text-based captions only
**Future Enhancement:** Could add generated images via:
- Sharp (Node.js image library)
- ReportLab (Python server-side)
- Puppeteer + Chrome (headless rendering)

Each slide would display on 1080x1350 (portrait) or 1080x1080 (square) with:
- Article title (centered, Georgia serif)
- Journal/year badge
- Evidence emoji
- Summary snippet (italicized)
- OdontoFeed branding (footer, gold #C29B6B)

---

## Monitoring & Analytics

### Key Metrics to Track

**Instagram Insights:**
- Impression rate (how many people saw the post)
- Engagement rate (likes, comments, saves)
- Click-through rate (taps to external link)
- Reach (unique viewers per post)
- Follower growth (week-over-week)

**OdontoFeed Conversions:**
- Referrals from Instagram link (utm_source=instagram)
- Article clicks from social traffic
- Sign-up rate from Instagram visitors
- Premium conversions from social audience

### Expected Performance (Industry Benchmarks)

| Metric | Medical/Dental Industry Avg |
|--------|---------------------------|
| Engagement Rate | 1-3% |
| Click-Through Rate | 0.5-1.5% |
| Follower Growth | 5-15% month-over-month |
| Reach per Post | 10-30% of followers |

---

## API Integration Details

### Meta Graph API Endpoint
```
POST /v18.0/{business-account-id}/media
Authorization: Bearer {access-token}
Content-Type: application/json

{
  "caption": "...",
  "media_type": "CAROUSEL",
  "children": [  // For carousel only
    { "image": "https://..." },
    { "image": "https://..." }
  ]
}

Response: { "id": "media_12345" }
```

### Publishing Step
```
POST /v18.0/{media-id}
Authorization: Bearer {access-token}
Content-Type: application/json

{ "status": "PUBLISHED" }

Response: { "success": true }
```

### Error Handling
| Status | Meaning | Action |
|--------|---------|--------|
| 200-299 | Success | Media published, log mediaId |
| 400 | Bad request | Retry with fixed parameters |
| 401 | Unauthorized | Token expired, refresh token |
| 403 | Forbidden | Insufficient scopes, regenerate token |
| 429 | Rate limited | Back off 60+ seconds, retry |
| 500+ | Server error | Log and skip (continue-on-error) |

---

## Next Steps / Future Enhancements

1. **Image Generation**
   - Generate professional slide images with article highlights
   - Use ReportLab or Sharp for server-side rendering
   - Test in CI before posting

2. **Analytics Integration**
   - Track Instagram clicks to OdontoFeed
   - Measure conversion funnel (view → sign-up → premium)
   - Dashboard showing social ROI

3. **Content Diversity**
   - Alternating post types (carousel, reel, story)
   - User-generated content (dentist testimonials)
   - Behind-the-scenes (editorial team, curation process)

4. **A/B Testing**
   - Test different posting times
   - Measure emoji impact on engagement
   - Optimize hashtag strategy

5. **Multi-Platform**
   - Extend to LinkedIn (dental professionals audience)
   - TikTok (shorter video format)
   - Twitter/X (news format)

---

## Code Examples

### Generate and post articles:
```javascript
const articles = await getTodaysTopArticles(db, 5);
const post = buildCarouselPost(articles, {
  dateStr: '2026-07-20',
  greeting: '📚 Ciência Odontológica'
});
const carousel = await postCarouselToInstagram(accountId, token, post);
await publishMedia(accountId, token, carousel.mediaId);
```

### Custom greeting by time:
```javascript
const hourBrt = 8;  // Morning
const greeting = getGreetingByHour(hourBrt); // '☕ Bom dia, dentista'
```

### Format evidence level:
```javascript
formatEvidenceLevel('RCT')  // '🏆 Ensaio Clínico'
formatEvidenceLevel('Meta-análise')  // '📊 Meta-análise'
```
