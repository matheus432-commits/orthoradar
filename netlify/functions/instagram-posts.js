// OdontoFeed → Instagram Daily Poster
//
// Fetches top articles from today's digest and posts them to Instagram
// (carousel, stories, reels) via Meta Graph API.
//
// Schedule: Daily via GitHub Actions (08:00 UTC = 05:00 BRT, after ingest completes)
// Environment: INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN
//
// Posts are scheduled for optimal engagement times:
// - Carousel (08:00 BRT): morning curated highlights
// - Story (12:00 BRT): reengagement during lunch
// - Reel (18:00 BRT): evening/office hours push

const { Firestore } = require('./_lib/firestore');
const {
  buildCarouselPost,
  buildStoryPost,
  buildReelCaption,
  getGreetingByHour
} = require('./_lib/instagram-generator');
const { request } = require('./_lib');
const log = require('./_lib/logger');

const INSTAGRAM_GRAPH_API = 'https://graph.instagram.com';

// Fetches top N articles from today's digest
async function getTodaysTopArticles(db, limit = 5) {
  const dateStr = new Date().toISOString().slice(0, 10);

  // Tenta buscar do cache de digest (melhor qualidade — já curado)
  try {
    // Busca qualquer especialidade; se houver mais de uma, pega a mais recente
    const espDigests = await db.query('digests_especialidade', { limit: 20 });
    if (!espDigests.length) return [];

    // Filtra digests de hoje
    const todaysDigests = espDigests.filter(d => {
      const digest_date = d.id?.split('_')[1];
      return digest_date === dateStr;
    });

    if (!todaysDigests.length) return [];

    // Extrai artigos de todos os digests de hoje
    const allArticles = [];
    for (const digest of todaysDigests) {
      const articles = digest.articles || [];
      allArticles.push(...articles);
    }

    // Dedup por PMID e retorna top N
    const seen = new Set();
    const unique = [];
    for (const a of allArticles) {
      const id = a.pmid || a.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        unique.push(a);
      }
    }

    return unique.slice(0, limit);
  } catch (err) {
    log.warn('[instagram] failed to fetch digest cache', { error: err.message });
    return [];
  }
}

// Posta um carousel no Instagram via Graph API
async function postCarouselToInstagram(businessAccountId, accessToken, post) {
  const { caption, slides } = post;

  if (!slides || slides.length === 0) {
    throw new Error('Carousel requires at least 1 slide');
  }

  // Para MVP, enviamos o caption como texto simples
  // Em produção, seria necessário gerar imagens para cada slide
  const payload = {
    caption,
    media_type: 'CAROUSEL',
    // TODO: adicionar upload de imagens aqui
    // children: slides.map((slide, i) => ({ image: ... }))
  };

  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const res = await request({
    hostname: 'graph.instagram.com',
    path: `/v18.0/${businessAccountId}/media?access_token=${accessToken}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    }
  }, buf);

  if (res.status >= 400) {
    throw new Error(`Instagram API error ${res.status}: ${res.body}`);
  }

  const data = JSON.parse(res.body);
  return {
    mediaId: data.id,
    type: 'carousel',
    caption,
    slideCount: slides.length,
  };
}

// Posta uma story (texto) no Instagram
async function postStoryToInstagram(businessAccountId, accessToken, post) {
  const { text, cta } = post;

  // Stories no Graph API são mais limitadas — enviamos como caption
  const payload = {
    caption: `${text}\n\n→ ${cta}`,
    media_type: 'STORIES_TEXT',
  };

  const buf = Buffer.from(JSON.stringify(payload), 'utf8');
  const res = await request({
    hostname: 'graph.instagram.com',
    path: `/v18.0/${businessAccountId}/media?access_token=${accessToken}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    }
  }, buf);

  if (res.status >= 400) {
    throw new Error(`Instagram API error ${res.status}: ${res.body}`);
  }

  const data = JSON.parse(res.body);
  return {
    mediaId: data.id,
    type: 'story',
    text,
  };
}

// Publica um media item que foi criado em estado CREATED
async function publishMedia(businessAccountId, accessToken, mediaId) {
  const payload = { status: 'PUBLISHED' };
  const buf = Buffer.from(JSON.stringify(payload), 'utf8');

  const res = await request({
    hostname: 'graph.instagram.com',
    path: `/v18.0/${mediaId}?access_token=${accessToken}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': buf.length,
    }
  }, buf);

  if (res.status >= 400) {
    throw new Error(`Instagram publish error ${res.status}: ${res.body}`);
  }

  return JSON.parse(res.body);
}

// Main handler
exports.handler = async (event) => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  // Graceful exit se não estiver configurado (ainda não tem Instagram)
  if (!businessAccountId || !accessToken) {
    log.info('[instagram] skipping — not configured');
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not_configured' }) };
  }

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  }

  try {
    const db = new Firestore(projectId, apiKey);
    const articles = await getTodaysTopArticles(db, 5);

    if (articles.length === 0) {
      log.warn('[instagram] no articles found for today');
      return { statusCode: 200, body: JSON.stringify({ posted: 0, reason: 'no_articles' }) };
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const hourBrt = (new Date().getUTCHours() + 3) % 24; // rough BRT conversion
    const greeting = getGreetingByHour(hourBrt);

    // Build carousel post
    const carouselPost = buildCarouselPost(articles, {
      maxSlides: Math.min(5, articles.length),
      dateStr,
      greeting,
    });

    // Post carousel
    const carousel = await postCarouselToInstagram(businessAccountId, accessToken, carouselPost);
    await publishMedia(businessAccountId, accessToken, carousel.mediaId);

    log.info('[instagram] carousel posted', {
      mediaId: carousel.mediaId,
      slides: carousel.slideCount,
      articles: articles.length,
    });

    // Opcionalmente: postar story também (comentado por enquanto)
    // if (articles.length > 0) {
    //   const storyPost = buildStoryPost(articles[0]);
    //   const story = await postStoryToInstagram(businessAccountId, accessToken, storyPost);
    //   await publishMedia(businessAccountId, accessToken, story.mediaId);
    // }

    return {
      statusCode: 200,
      body: JSON.stringify({
        posted: 1,
        articles: articles.length,
        carousel: carousel.mediaId,
        date: dateStr,
      })
    };
  } catch (err) {
    log.error('[instagram] error', { error: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// For manual testing: node netlify/functions/instagram-posts.js
if (require.main === module) {
  const env = {
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'orthoradar',
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    INSTAGRAM_BUSINESS_ACCOUNT_ID: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
  };

  Object.assign(process.env, env);

  exports.handler({}).then(res => {
    console.log(res.statusCode, JSON.parse(res.body));
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
