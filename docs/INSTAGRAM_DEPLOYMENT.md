# Instagram Automation — Deployment Checklist

## Pre-Deployment Verification

- [x] All code tests pass (11/11 instagram-generator tests)
- [x] Instagram posts function handles missing credentials gracefully
- [x] GitHub Actions workflow configured with proper schedule (08:00 UTC)
- [x] Documentation complete (SETUP.md, EXAMPLES.md, this file)

## Deployment Steps

### 1. Merge to Main Branch

```bash
git checkout main
git pull origin main
git merge claude/session-01b7dxvfq1ezmbapy-oxomb3
git push origin main
```

This will trigger automatic deployment to Netlify.

### 2. Configure Meta Business Account (One-time)

1. Visit [facebook.com/businesses](https://facebook.com/businesses)
2. Create Business Account + connect Instagram profile
3. Note the Business Account ID
4. Go to [developers.facebook.com](https://developers.facebook.com)
5. Create app and add Instagram Graph API product
6. Generate long-lived access token with scopes:
   - `instagram_business_profile`
   - `instagram_content_publish`

See detailed steps in [INSTAGRAM_SETUP.md](./INSTAGRAM_SETUP.md)

### 3. Add GitHub Secrets

In repository → Settings → Secrets and variables → Actions:

| Secret | Value | Example |
|--------|-------|---------|
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Your Meta Business Account ID | `123456789012345` |
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived access token | `EAABsbCS1iHg...` |

⚠️ **Security:** Use long-lived tokens, rotate every 60 days

### 4. Verify Deployment

After merge to main:

1. Go to GitHub → Actions
2. Should see "OdontoFeed Instagram Daily Posts" workflow
3. Workflow enabled and scheduled for 08:00 UTC daily
4. Or manually trigger via "Run workflow" button

### 5. Test First Run

**Option A - Manual Trigger:**
```
GitHub Actions → OdontoFeed Instagram Daily Posts → Run workflow
```

**Option B - Local Test:**
```bash
export FIREBASE_PROJECT_ID=orthoradar
export FIREBASE_API_KEY=$(cat .env | grep FIREBASE_API_KEY | cut -d= -f2)
export INSTAGRAM_BUSINESS_ACCOUNT_ID=$(cat .env | grep INSTAGRAM_... | cut -d= -f2)
export INSTAGRAM_ACCESS_TOKEN=$(cat .env | grep INSTAGRAM_ACCESS...)

node netlify/functions/instagram-posts.js
```

Expected output:
```json
{
  "posted": 1,
  "articles": 5,
  "carousel": "media_id_123456",
  "date": "2026-07-20"
}
```

### 6. Monitor First Week

Track in Instagram Insights:
- Carousel post impressions & engagement
- Audience growth
- Click-through rates to odontofeed.com

## Post-Deployment

### Daily Operations

✅ Posts automatically at 08:00 UTC (05:00 BRT) every morning
✅ Content sourced from daily digest pipeline
✅ Stops gracefully if credentials missing (non-blocking)
✅ Logs available in GitHub Actions

### Weekly Monitoring

- [ ] Check Instagram Insights for engagement metrics
- [ ] Review audience growth rate
- [ ] Monitor click-through traffic to website
- [ ] Check for API errors in GitHub Actions logs

### Monthly Maintenance

- [ ] Refresh access token (if using 60-day limit)
- [ ] Review top-performing posts
- [ ] Consider hashtag strategy adjustments
- [ ] Check competitor hashtag trends

## Rollback Plan

If issues arise:

### Disable Temporarily
```
GitHub Actions → Instagram workflow → ⋯ → Disable workflow
```

### Rollback Code
```bash
git revert a41cee7  # Commit hash of Instagram feature
git push origin main
```

### Delete Workflow File
```bash
git rm .github/workflows/instagram-posts.yml
git commit -m "Disable Instagram automation"
git push origin main
```

## Scaling Considerations

### Current Limitations
- Posts 1 carousel/day (3-5 articles per carousel)
- Uses digest cache (only works after 03:00 UTC ingest completes)
- Text captions only (no generated images yet)

### Scaling Path (Future)

#### Phase 1: Image Generation
- Generate professional slide images with ReportLab
- Include article metadata, emoji highlights
- Test images before posting to prevent failures

#### Phase 2: Multi-Post Strategy
- Post multiple carousels (different specialties)
- Add reels with audio clips from podcast
- Stories for quick engagement

#### Phase 3: Multi-Platform
- LinkedIn (professional B2B audience)
- TikTok (short-form video)
- Twitter/X (news updates)

## Troubleshooting

### "Instagram API error 400"
→ Check token validity and scopes (SETUP.md § Troubleshooting)

### "No articles found for today"
→ Digest pipeline may not have completed. Check daily-pipeline.yml logs.

### "not_configured" (graceful skip)
→ Secrets not set. Add INSTAGRAM_BUSINESS_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN to GitHub.

### Posts not appearing at 08:00 UTC
→ Check GitHub Actions workflow status and logs

See full troubleshooting in [INSTAGRAM_SETUP.md](./INSTAGRAM_SETUP.md#troubleshooting)

## Success Metrics

Track these KPIs to measure Instagram automation success:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Engagement Rate | 1-3% | Instagram Insights → Total Engagement |
| Follower Growth | +10%/month | Instagram → Followers tab |
| CTR to Website | 0.5-1.5% | UTM tracking in analytics |
| Premium Signups from Social | 5%+ | Attribution in analytics |

## Support & Documentation

- **Setup Guide:** [INSTAGRAM_SETUP.md](./INSTAGRAM_SETUP.md)
- **Examples & Architecture:** [INSTAGRAM_EXAMPLES.md](./INSTAGRAM_EXAMPLES.md)
- **Code:** `netlify/functions/instagram-posts.js`, `instagram-generator.js`
- **Tests:** `netlify/functions/_lib/__tests__/instagram-generator.test.js` (11 tests)
- **Schedule:** `.github/workflows/instagram-posts.yml`

## Sign-off

- [x] Feature complete and tested
- [x] Documentation comprehensive
- [x] Error handling graceful (non-blocking)
- [x] GitHub Actions workflow configured
- [x] Ready for production deployment

**Next Step:** Merge to main → Configure Meta credentials → Monitor & optimize
