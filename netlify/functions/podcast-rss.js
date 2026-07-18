// GET /.netlify/functions/podcast-rss?esp=Ortodontia
//
// Feed RSS do podcast por especialidade — consumido pelo Spotify, Apple
// Podcasts e demais agregadores.
//
// Fonte: coleção `podcast_episodios` (histórico datado, retenção de ~14 dias,
// alimentado pelo generate-podcasts). Fallback: doc `podcasts/{slug}` (episódios
// de hoje) para o período de transição antes do histórico existir.
//
// IMPORTANTE: o feed responde SEMPRE um RSS válido (HTTP 200), mesmo sem
// episódios — agregadores validam o XML na submissão e re-verificam o feed
// continuamente; um 404 transitório (ex.: antes da 1ª geração do dia) faria o
// Spotify marcar o feed como quebrado.

const { Firestore } = require('./_lib/firestore');
const { specialtySlug } = require('./_lib/slug');
const { firebaseDownloadUrl } = require('./_lib/storage');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';
const MAX_ITEMS = 50;

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// "2026-07-18" → "Sat, 18 Jul 2026 09:00:00 GMT" (RFC 2822, exigido pelo RSS)
function rfc2822(dateStr) {
  const d = new Date((dateStr || new Date().toISOString().slice(0, 10)) + 'T09:00:00Z');
  if (isNaN(d.getTime())) return rfc2822(new Date().toISOString().slice(0, 10));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2, '0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} 09:00:00 GMT`;
}

// Histórico datado (preferência). Ordena por data desc + nº do episódio.
async function historyEpisodes(db, slug) {
  try {
    const docs = await db.query('podcast_episodios', {
      where: { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
      limit: MAX_ITEMS * 2,
    });
    return docs
      .filter(e => e.objectPath && e.downloadToken)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.n || 0) - (b.n || 0))
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

// Fallback: episódios de hoje no doc `podcasts/{slug}` (formato antigo).
async function todaysEpisodes(db, slug) {
  try {
    const doc = await db.getDoc('podcasts', slug);
    if (!doc) return [];
    const eps = (Array.isArray(doc.episodios) ? doc.episodios : [])
      .filter(e => e.objectPath && e.downloadToken)
      .map(e => ({ ...e, date: doc.date || '', especialidade: doc.especialidade || '' }));
    if (!eps.length && doc.objectPath && doc.downloadToken) {
      eps.push({ n: 1, titulo: doc.titulo || '', objectPath: doc.objectPath,
                 downloadToken: doc.downloadToken, date: doc.date || '' });
    }
    return eps;
  } catch {
    return [];
  }
}

function buildFeed(especialidade, episodes, bucket) {
  const feedUrl = `${BASE_URL}/.netlify/functions/podcast-rss?esp=${encodeURIComponent(especialidade)}`;
  const items = episodes.map(ep => {
    const date = ep.date || new Date().toISOString().slice(0, 10);
    const titulo = ep.titulo ? `${ep.titulo}` : `Episódio ${ep.n || 1}`;
    return `
    <item>
      <title>${escapeXml(titulo)}</title>
      <description>${escapeXml(`Resumo em áudio — ${especialidade}, edição de ${date}. ${ep.titulo || ''}`)}</description>
      <link>${BASE_URL}/dashboard</link>
      <guid isPermaLink="false">odontofeed-${escapeXml(ep.slug || specialtySlug(especialidade))}-${date}-ep${ep.n || 1}</guid>
      <pubDate>${rfc2822(date)}</pubDate>
      <enclosure url="${escapeXml(firebaseDownloadUrl(bucket, ep.objectPath, ep.downloadToken))}" type="audio/mpeg" length="0"/>
      <itunes:title>${escapeXml(titulo)}</itunes:title>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
      <itunes:author>OdontoFeed</itunes:author>
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>OdontoFeed — ${escapeXml(especialidade)}</title>
    <link>${BASE_URL}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>pt-br</language>
    <description>Resumos diários de artigos científicos de ${escapeXml(especialidade)} em áudio. Ciência odontológica atualizada, em português, todos os dias — selecionada do PubMed, Europe PMC e OpenAlex.</description>
    <copyright>© 2026 OdontoFeed</copyright>
    <lastBuildDate>${rfc2822(episodes[0]?.date)}</lastBuildDate>
    <generator>OdontoFeed</generator>
    <itunes:author>OdontoFeed</itunes:author>
    <itunes:owner>
      <itunes:name>OdontoFeed</itunes:name>
      <itunes:email>contato@odontofeed.com</itunes:email>
    </itunes:owner>
    <itunes:category text="Health &amp; Fitness"><itunes:category text="Medicine"/></itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:image href="${BASE_URL}/logo-square-3000.jpg"/>
    <image>
      <url>${BASE_URL}/logo-square-3000.jpg</url>
      <title>OdontoFeed — ${escapeXml(especialidade)}</title>
      <link>${BASE_URL}</link>
    </image>${items}
  </channel>
</rss>`;
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/rss+xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=1800',
    'Access-Control-Allow-Origin': '*',
  };

  const esp = (event.queryStringParameters?.esp || '').trim();
  if (!esp) {
    return { statusCode: 400, headers: { ...headers, 'Content-Type': 'text/plain; charset=UTF-8' },
             body: 'Informe a especialidade: ?esp=Ortodontia' };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const bucket    = process.env.GCS_BUCKET || (projectId + '.appspot.com');
  if (!apiKey) return { statusCode: 500, headers, body: '' };

  try {
    const db   = new Firestore(projectId, apiKey);
    const s    = specialtySlug(esp);

    let episodes = await historyEpisodes(db, s);
    if (!episodes.length) episodes = await todaysEpisodes(db, s);

    // Sem episódios ainda → feed VÁLIDO e vazio (nunca 404: o Spotify
    // re-verifica o feed e o marcaria como quebrado).
    return { statusCode: 200, headers, body: buildFeed(esp, episodes, bucket) };
  } catch (err) {
    console.error('[podcast-rss] erro:', err.message);
    return { statusCode: 500, headers, body: '' };
  }
};
