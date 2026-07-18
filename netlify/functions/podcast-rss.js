// GET /.netlify/functions/podcast-rss?esp=Periodontia
//
// Gera feed RSS/Atom para um podcast por especialidade.
// Spotify, Apple Podcasts e outros agregadores sincronizam via este feed.
// Feed inclui últimos 30 episódios com metadados iTunes.

const { Firestore } = require('./_lib/firestore');
const { specialtySlug } = require('./_lib/slug');
const { firebaseDownloadUrl } = require('./_lib/storage');

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatRFC2822(dateStr) {
  // Converte "2026-07-18" para "Fri, 18 Jul 2026 12:00:00 GMT"
  const d = new Date(dateStr + 'T12:00:00Z');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} 12:00:00 GMT`;
}

async function getPodcastDoc(db, slug) {
  try {
    const doc = await db.getDoc('podcasts', slug);
    return doc || null;
  } catch {
    return null;
  }
}

// Últimos 30 dias de podcasts (para preencher histórico)
async function getRecentPodcasts(db, slug) {
  try {
    const docs = await db.query('podcasts', {
      where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: slug } } },
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit: 30
    });
    return docs || [];
  } catch {
    return [];
  }
}

function generateRSSFeed(especialidade, doc, bucket) {
  const slug = specialtySlug(especialidade);
  const baseUrl = 'https://odontofeed.com';
  const podcastUrl = `${baseUrl}/podcast-rss?esp=${encodeURIComponent(especialidade)}`;

  const today = new Date().toISOString().slice(0, 10);
  const geradoEm = doc?.geradoEm || `${today}T12:00:00Z`;

  // Episódios (máximo 30 por RSS — agregadores têm limite)
  const episodios = (Array.isArray(doc?.episodios) ? doc.episodios : [])
    .slice(0, 30)
    .map((ep, idx) => `
    <item>
      <title>${escapeXml(ep.titulo || `Episódio ${ep.n || idx + 1}`)}</title>
      <description>${escapeXml(ep.titulo || `Episódio ${ep.n || idx + 1}`)}</description>
      <link>${baseUrl}/dashboard</link>
      <guid isPermaLink="false">odontofeed-${slug}-${today}-ep${ep.n || idx + 1}</guid>
      <pubDate>${formatRFC2822(today)}</pubDate>
      <enclosure url="${firebaseDownloadUrl(bucket, ep.objectPath, ep.downloadToken)}" type="audio/mpeg" length="0"/>
      <itunes:title>${escapeXml(ep.titulo || `Episódio ${ep.n || idx + 1}`)}</itunes:title>
      <itunes:episode>${ep.n || idx + 1}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:author>OdontoFeed</itunes:author>
      <itunes:duration>900</itunes:duration>
    </item>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>OdontoFeed — ${especialidade}</title>
    <link>${baseUrl}</link>
    <language>pt-br</language>
    <description>Resumos diários de artigos científicos odontológicos em áudio. ${especialidade} — ciência atualizada, todos os dias, em português.</description>
    <copyright>© 2026 OdontoFeed</copyright>
    <lastBuildDate>${formatRFC2822(today)}</lastBuildDate>
    <generator>OdontoFeed RSS Generator</generator>

    <itunes:author>OdontoFeed</itunes:author>
    <itunes:owner>
      <itunes:name>OdontoFeed</itunes:name>
      <itunes:email>contato@odontofeed.com</itunes:email>
    </itunes:owner>
    <itunes:category text="Education">
      <itunes:category text="Medical"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:image href="${baseUrl}/logo-square-3000.jpg"/>

    ${episodios}
  </channel>
</rss>`;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/rss+xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  };

  const esp = event.queryStringParameters?.esp;
  if (!esp) {
    return {
      statusCode: 400,
      headers,
      body: 'especialidade obrigatória (ex: ?esp=Periodontia)'
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');

  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: 'FIREBASE_API_KEY não configurado'
    };
  }

  try {
    const db = new Firestore(projectId, apiKey);
    const slug = specialtySlug(esp);

    const doc = await getPodcastDoc(db, slug);
    if (!doc) {
      return {
        statusCode: 404,
        headers,
        body: `Nenhum podcast encontrado para ${esp}`
      };
    }

    const rss = generateRSSFeed(esp, doc, bucket);
    return {
      statusCode: 200,
      headers,
      body: rss
    };
  } catch (err) {
    console.error('[podcast-rss] erro:', err);
    return {
      statusCode: 500,
      headers,
      body: `Erro interno: ${err.message}`
    };
  }
};
