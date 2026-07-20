// OdontoFeed Instagram Post Generator
//
// Gera posts de alta qualidade para Instagram a partir dos artigos diários.
// Cria carrosséis com destaques de estudos, seguindo a curadoria do digest.
//
// Formatos suportados:
// - Carousel (3-5 slides): artigos destacados do dia com imagens
// - Reel caption: snippet + CTA para áudio (podcast compilado)
// - Story (texto): quote rápido de um achado
//
// Estética: marca OdontoFeed (dourado #C29B6B, serif Georgia, professional)

const { escapeHtml } = require('./utils');

// Títulos motivacionais baseados na hora do dia (BRT)
function getGreetingByHour(hourBrt) {
  if (hourBrt < 7) return '🌅 Madrugada de pesquisa';
  if (hourBrt < 9) return '☕ Bom dia, dentista';
  if (hourBrt <= 12) return '📚 Ciência Odontológica';
  if (hourBrt < 14) return '🔬 Conhecimento científico';
  if (hourBrt < 17) return '💡 Descoberta do dia';
  if (hourBrt < 19) return '🌆 Estudos da tarde';
  return '🌙 Leitura noturna';
}

// Formata o nível de evidência de forma visual
function formatEvidenceLevel(nivel) {
  const map = {
    'RCT': '🏆 Ensaio Clínico',
    'Meta-análise': '📊 Meta-análise',
    'Revisão Sistemática': '🔍 Revisão Sistemática',
    'Estudo Coorte': '👥 Estudo Coorte',
    'Estudo Caso-Controle': '⚖️ Caso-Controle',
    'Série de Casos': '📋 Série de Casos',
    'Relato de Caso': '1️⃣ Relato',
    'Revisão Narrativa': '📖 Revisão Narrativa',
  };
  return map[nivel] || nivel;
}

// Trunca texto com elegância, respeitando limites do Instagram
function truncateText(text, maxLength = 130) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '…';
}

// Remove caracteres especiais que causam problemas em captions
function sanitizeCaption(text) {
  return String(text || '')
    .replace(/[<>]/g, '')
    .replace(/&/g, 'e');
}

// Retorna uma cor de destaque baseada no tema/especialidade
function getThemeColor(tema, especialidade) {
  const combined = `${tema || ''} ${especialidade || ''}`.toLowerCase();

  // Mapa de palavras-chave para emoji
  const keywordMap = [
    ['estética', '✨'],
    ['prótese', '👑'],
    ['implant', '🔧'],  // implantodontia, implante
    ['endodontia', '🔬'],
    ['ortodontia', '📐'],
    ['periodont', '🪥'],  // periodontia, perio
    ['pediátrica', '👧'],
    ['cirurgia', '🔪'],
  ];

  // Primeiro match wins
  for (const [keyword, emoji] of keywordMap) {
    if (combined.includes(keyword)) {
      return emoji;
    }
  }
  return '🦷'; // default
}

// ── Gerador de Carousel Posts ──────────────────────────────────────────────────

// Um slide do carousel — um artigo destaques com formatação Instagram
function generateCarouselSlide(article, index, total) {
  const {
    titulo_pt = '',
    titulo = '',
    journal = '',
    year = '',
    nivel_evidencia = '',
    tema = '',
    especialidade = '',
    resumo_pt = '',
    doi = '',
    pmid = ''
  } = article;

  const title = titulo_pt || titulo || 'Estudo científico';
  const emoji = getThemeColor(tema, especialidade);
  const evidence = formatEvidenceLevel(nivel_evidencia);

  // Snippet curto para o caption
  const snippet = sanitizeCaption(truncateText(resumo_pt || titulo, 80));

  // Número do slide (visual)
  const slideNum = `${index + 1}/${total}`;

  return {
    text: `${emoji} ${escapeHtml(title)}\n\n${evidence}\n${journal || 'Artigo científico'} • ${year}\n\nTema: ${tema}\nEspecialidade: ${especialidade}\n\n"${snippet}"\n\n[${slideNum}]`,
    article: {
      pmid,
      doi,
      tema,
      especialidade,
    }
  };
}

// Gera um carousel post com 3-5 artigos
function buildCarouselPost(articles, opts = {}) {
  const { maxSlides = 5, dateStr = '' } = opts;
  const slides = articles
    .slice(0, maxSlides)
    .map((a, i) => generateCarouselSlide(a, i, Math.min(articles.length, maxSlides)));

  // Caption do carousel (introdução + CTA)
  const greeting = opts.greeting || '📚 Ciência atualizada';
  const caption = `${greeting}\n\n✅ ${slides.length} estudos curados em ${dateStr || 'hoje'}\n\n💡 Resumos em áudio, artigos na íntegra — grátis em odontofeed.com\n\n🎧 Ouça os episódios completos em Spotify, Apple Podcasts e demais plataformas.\n\n#OdontoFeed #CiênciaOdontológica #Pesquisa #Dentística #PUP`;

  return {
    type: 'carousel',
    caption,
    slides,
    articleCount: slides.length,
    hashtags: ['OdontoFeed', 'CiênciaOdontológica', 'Pesquisa', 'Dentística', 'PUP'],
  };
}

// ── Story Post (texto simples) ──────────────────────────────────────────────────

// Um story text que destaca um achado rápido
function buildStoryPost(article) {
  const {
    titulo_pt = '',
    tema = '',
    especialidade = '',
    nivel_evidencia = ''
  } = article;

  const emoji = getThemeColor(tema, especialidade);
  const evidence = formatEvidenceLevel(nivel_evidencia);

  return {
    type: 'story',
    text: `${emoji}\n\n${escapeHtml(truncateText(titulo_pt, 70))}\n\n${evidence}`,
    cta: 'Ver estudo completo',
    ctaUrl: 'https://odontofeed.com',
  };
}

// ── Reel Caption (áudio do podcast) ────────────────────────────────────────────

// Caption para um reel mostrando o compilado de áudio do dia
function buildReelCaption(especialidade, compiladoDate, opts = {}) {
  const { reelDurationSecs = 480, audioMb = 1.75 } = opts;
  const minutos = Math.floor(reelDurationSecs / 60);
  const segundos = reelDurationSecs % 60;

  return {
    type: 'reel',
    caption: `🎧 ${especialidade}\n\n✨ Edição compilada de ${minutos}m${segundos}s\n\n📚 ${compiladoDate}\n\n🎙️ Curadoria científica + narração de IA (100% transparente)\n\n👂 Ouça agora:\n• Spotify\n• Apple Podcasts\n• OdontoFeed.com\n\n#OdontoFeed #Podcast #${especialidade.replace(/\\s+/g, '')}`,
    durationSecs: reelDurationSecs,
    fileSizeMb: audioMb,
  };
}

// ── Agregador: múltiplos posts por dia ──────────────────────────────────────────

// Gera o plano de posts para um dia: carousel principal + stories + reel
function generateDailyPostsPlan(articles, opts = {}) {
  const {
    dateStr = new Date().toISOString().slice(0, 10),
    hourBrt = new Date().getHours() - 3, // converte UTC para BRT (aproximado)
    specialties = [],
  } = opts;

  const greeting = getGreetingByHour(hourBrt);
  const postPlan = [];

  // Post 1: Carousel principal (3-5 artigos)
  if (articles.length >= 3) {
    postPlan.push({
      order: 1,
      time: '08:00 BRT', // 05:00 UTC — madrugada, mas agenda para 8h
      post: buildCarouselPost(articles, { greeting, dateStr, maxSlides: 5 }),
    });
  }

  // Post 2: Story rápido (se houver artigo premium)
  if (articles.length > 0) {
    postPlan.push({
      order: 2,
      time: '12:00 BRT', // meio-dia, reforça presença
      post: buildStoryPost(articles[0]),
    });
  }

  // Post 3: Reel do podcast compilado (se houver dados)
  if (specialties.length > 0) {
    const esp = specialties[0];
    postPlan.push({
      order: 3,
      time: '18:00 BRT', // final de tarde, pega dentistas em consultório
      post: buildReelCaption(esp, dateStr, { reelDurationSecs: 480, audioMb: 1.75 }),
    });
  }

  return {
    dateStr,
    totalPosts: postPlan.length,
    posts: postPlan,
  };
}

module.exports = {
  generateCarouselSlide,
  buildCarouselPost,
  buildStoryPost,
  buildReelCaption,
  generateDailyPostsPlan,
  getGreetingByHour,
  formatEvidenceLevel,
  truncateText,
  sanitizeCaption,
  getThemeColor,
};
