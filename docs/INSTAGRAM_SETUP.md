# OdontoFeed Instagram Automation Setup Guide

## Overview

OdontoFeed automatically posts high-quality content to Instagram daily at **08:00 UTC (05:00 BRT)**, featuring:

- **Carousel posts** (3-5 article highlights) with professional formatting
- **Story posts** (quick research snippets) for reengagement
- **Reel captions** (podcast compilation announcements) linking to streaming platforms

Posts are generated from daily curated article digests and include:
- Article titles (Portuguese when available)
- Journal, year, evidence level (RCT, meta-analysis, etc)
- Specialty + theme with relevant emoji
- Snippet summary
- CTAs linking to OdontoFeed.com and Spotify

## Prerequisites

1. **Meta/Facebook Business Account** with an Instagram Business profile
2. **App registered** on Meta Developers (facebook.com/developers)
3. **API Access Token** with required scopes

## Step-by-Step Setup

### 1. Create/Connect Instagram Business Account

- Go to [facebook.com/businesses](https://facebook.com/businesses)
- Create a Business Account or use existing one
- Connect an Instagram Business profile (not personal)
- Get the **Business Account ID** and **Instagram Account ID**

### 2. Register App on Meta Developers

- Visit [developers.facebook.com](https://developers.facebook.com)
- Create a new app (type: "Business")
- Add "Instagram Graph API" product to the app
- In app settings, note the **App ID** and **App Secret**

### 3. Generate Access Token

Two options:

#### Option A: Test Token (Development)
- Go to app dashboard → Tools → Graph API Explorer
- Select your Instagram app and account
- Generate a short-lived token
- Use this for testing

#### Option B: Permanent Token (Production)
1. Get a User Access Token:
   - In Graph API Explorer, use `GET /me/accounts?fields=access_token`
   - Get a token with scope: `instagram_business_profile,instagram_content_publish`

2. Exchange for long-lived token:
   ```bash
   curl -i -X GET "https://graph.instagram.com/v18.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app-id}
     &client_secret={app-secret}
     &access_token={short-lived-token}"
   ```

3. Result is a long-lived token (valid ~60 days, auto-refreshes if used regularly)

### 4. Find Business Account ID

```bash
curl -i -X GET "https://graph.instagram.com/v18.0/me?fields=id,name
  &access_token={access-token}"
```

Response will include the ID needed for `INSTAGRAM_BUSINESS_ACCOUNT_ID`.

### 5. Add Secrets to GitHub

In your repository settings (Settings → Secrets and variables → Actions), add:

```
INSTAGRAM_BUSINESS_ACCOUNT_ID = 1234567890123456
INSTAGRAM_ACCESS_TOKEN = EAABsbCS1iHg...{long-token}
```

> **Security:** Use long-lived tokens, rotate every ~60 days, restrict to Instagram Graph API only.

## Testing

### Local Test
```bash
# Set environment variables
export FIREBASE_PROJECT_ID=orthoradar
export FIREBASE_API_KEY=...
export INSTAGRAM_BUSINESS_ACCOUNT_ID=...
export INSTAGRAM_ACCESS_TOKEN=...

# Run the posting function
node netlify/functions/instagram-posts.js
```

Expected output:
```json
{
  "posted": 1,
  "articles": 5,
  "carousel": "media_id_12345",
  "date": "2026-07-20"
}
```

### Manual GitHub Actions Trigger
1. Go to Actions tab in GitHub
2. Select "OdontoFeed Instagram Daily Posts" workflow
3. Click "Run workflow"
4. Check logs for success/errors

## Post Schedule

| Post Type   | Time (BRT) | Purpose                      |
|------------|-----------|------------------------------|
| Carousel   | 08:00     | Morning curated highlights   |
| Story      | 12:00     | Lunch-time reengagement      |
| Reel       | 18:00     | Evening/office hours push    |

> Times are in BRT (UTC-3). Workflow runs daily at 08:00 UTC (05:00 BRT).

## Content Format

### Carousel Caption Example
```
📚 Ciência Odontológica

✅ 5 estudos curados em 2026-07-20

💡 Resumos em áudio, artigos na íntegra — grátis em odontofeed.com

🎧 Ouça os episódios completos em Spotify, Apple Podcasts e demais plataformas.

#OdontoFeed #CiênciaOdontológica #Pesquisa #Dentística #PUP
```

### Article Slide Format
```
✨ Efetividade de protocolos de clareamento

🏆 Ensaio Clínico
J Esthet Dent • 2026

Tema: Estética
Especialidade: Dentística

"Estudo com 50 pacientes avaliando tempo de tratamento..."

[1/5]
```

## Emoji Legend

**Evidence Levels:**
- 🏆 RCT (Randomized Controlled Trial)
- 📊 Meta-análise
- 🔍 Revisão Sistemática
- 👥 Estudo Coorte
- ⚖️ Caso-Controle
- 📋 Série de Casos
- 1️⃣ Relato
- 📖 Revisão Narrativa

**Specialties:**
- ✨ Estética/Dentística
- 👑 Prótese
- 🔧 Implantodontia
- 🔬 Endodontia
- 📐 Ortodontia
- 🪥 Periodontia
- 👧 Odontopediatria
- 🔪 Cirurgia
- 🦷 Other/Default

## Monitoring & Troubleshooting

### Check Logs
- **GitHub Actions:** Repository → Actions → workflow run
- **CloudWatch:** AWS Console → CloudWatch Logs (if deployed to Netlify with CloudWatch logging)

### Common Issues

**Issue:** "Instagram API error 400"
- **Cause:** Invalid access token or missing scopes
- **Fix:** Regenerate token with correct scopes

**Issue:** "No articles found for today"
- **Cause:** Digest pipeline hasn't run yet, or no articles in database
- **Fix:** Run daily-pipeline.yml first, then instagram-posts.yml

**Issue:** "not_configured" (graceful skip)
- **Cause:** `INSTAGRAM_BUSINESS_ACCOUNT_ID` or `INSTAGRAM_ACCESS_TOKEN` missing
- **Fix:** Add secrets to GitHub (see Step 5)

**Issue:** "Graph API error 403"
- **Cause:** Token expired or insufficient permissions
- **Fix:** Refresh token (runs automatically if auto-refresh enabled)

## Advanced Configuration

### Custom Posting Times

Edit `.github/workflows/instagram-posts.yml`:

```yaml
on:
  schedule:
    - cron: '0 8 * * *'  # Change this cron expression
    
    # Examples:
    # - cron: '0 11 * * *'  # 11:00 UTC = 08:00 BRT
    # - cron: '0 14 * * *'  # 14:00 UTC = 11:00 BRT
```

### Custom Post Selection

Edit `instagram-posts.js`:

```javascript
const articles = await getTodaysTopArticles(db, 10);  // Change limit
```

### Disable Instagram Posting

Temporarily disable workflow:
- Go to Actions → Instagram workflow → Three dots → Disable

Or permanently delete `.github/workflows/instagram-posts.yml`

## Best Practices

1. **Monitor engagement:** Check Instagram Insights weekly
2. **Refresh tokens:** Every 60 days (or when auth fails)
3. **Test first:** Use workflow_dispatch to test before regular runs
4. **Fallback content:** Ensure digest pipeline runs before 08:00 UTC
5. **Hashtag tracking:** Use unique hashtags to monitor referral traffic

## API Documentation

- [Meta Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Content Publishing Guide](https://developers.facebook.com/docs/instagram-api/guides/content-publishing)
- [Media Creation Limits](https://developers.facebook.com/docs/instagram-api/reference/ig-user/media)

## Support

If Instagram posting fails:
1. Check GitHub Actions logs
2. Verify token validity: `curl graph.instagram.com/v18.0/me?access_token=...`
3. Test with Graph API Explorer before troubleshooting code
