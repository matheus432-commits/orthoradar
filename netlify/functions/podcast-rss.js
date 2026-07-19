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
// E-mail do dono do feed — o Spotify envia o código de verificação para ele.
const OWNER_EMAIL = process.env.PODCAST_OWNER_EMAIL || 'odontofeed@outlook.com';

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

// opts.master = feed único do Spotify: título do canal sem especialidade,
// episódios com a especialidade prefixada no título e descrição que convida
// o ouvinte a ouvir os 3 episódios completos da especialidade dele no site.
function buildFeed(especialidade, episodes, bucket, opts = {}) {
  const master  = !!opts.master;
  const feedUrl = master
    ? `${BASE_URL}/.netlify/functions/podcast-rss`
    : `${BASE_URL}/.netlify/functions/podcast-rss?esp=${encodeURIComponent(especialidade)}`;
  const chTitle = master ? 'OdontoFeed — Ciência Odontológica Diária' : `OdontoFeed — ${especialidade}`;
  const chDesc  = master
    ? 'Todos os dias, o resumo em áudio de um artigo científico odontológico — em português, direto do PubMed, Europe PMC e OpenAlex, com a especialidade em rodízio (Ortodontia, Implantodontia, Periodontia e mais). Este é o episódio destaque do dia: os 3 episódios completos da SUA especialidade saem diariamente em odontofeed.com — crie sua conta gratuita.'
    : `Resumos diários de artigos científicos de ${especialidade} em áudio. Ciência odontológica atualizada, em português, todos os dias — selecionada do PubMed, Europe PMC e OpenAlex.`;

  const items = episodes.map(ep => {
    const date   = ep.date || new Date().toISOString().slice(0, 10);
    const espEp  = ep.especialidade || especialidade || '';
    const base   = ep.titulo ? `${ep.titulo}` : `Episódio ${ep.n || 1}`;
    const titulo = master && espEp ? `${espEp} · ${base}` : base;
    const desc   = master
      ? `Resumo em áudio — ${espEp}, edição de ${date}. ${ep.titulo || ''} • Os 3 episódios completos da sua especialidade estão em odontofeed.com — grátis.`
      : `Resumo em áudio — ${especialidade}, edição de ${date}. ${ep.titulo || ''}`;
    return `
    <item>
      <title>${escapeXml(titulo)}</title>
      <description>${escapeXml(desc)}</description>
      <link>${BASE_URL}/</link>
      <guid isPermaLink="false">odontofeed-${escapeXml(ep.slug || specialtySlug(espEp || especialidade))}-${date}-ep${ep.n || 1}</guid>
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
    <title>${escapeXml(chTitle)}</title>
    <link>${BASE_URL}</link>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>pt-br</language>
    <description>${escapeXml(chDesc)}</description>
    <copyright>© 2026 OdontoFeed</copyright>
    <lastBuildDate>${rfc2822(episodes[0]?.date)}</lastBuildDate>
    <generator>OdontoFeed</generator>
    <itunes:author>OdontoFeed</itunes:author>
    <itunes:owner>
      <itunes:name>OdontoFeed</itunes:name>
      <itunes:email>${escapeXml(OWNER_EMAIL)}</itunes:email>
    </itunes:owner>
    <itunes:category text="Health &amp; Fitness"><itunes:category text="Medicine"/></itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>
    <itunes:image href="${BASE_URL}/logo-square-3000.jpg"/>
    <image>
      <url>${BASE_URL}/logo-square-3000.jpg</url>
      <title>${escapeXml(chTitle)}</title>
      <link>${BASE_URL}</link>
    </image>${items}
  </channel>
</rss>`;
}

// Quantas especialidades diferentes entram no feed mestre por dia. Com 2/dia,
// as 11 especialidades completam o ciclo em ~6 dias.
const MASTER_SPECS_PER_DAY = 2;

// Rodízio determinístico: para um dia e uma lista ordenada de especialidades,
// devolve as N escolhidas do dia (avança N posições por dia → cobre todas).
function pickSpecsOfDay(date, specs, n) {
  if (!specs.length) return [];
  const dayNum = Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000);
  const picks = [];
  for (let i = 0; i < Math.min(n, specs.length); i++) {
    const idx = (((dayNum * n + i) % specs.length) + specs.length) % specs.length;
    if (!picks.includes(specs[idx])) picks.push(specs[idx]);
  }
  return picks;
}

// Feed MESTRE (o único submetido ao Spotify): 2 episódios por dia, com as
// especialidades em RODÍZIO determinístico pela data — a cada dia duas áreas
// diferentes (ciclo completo em ~6 dias), sempre o episódio 1 da edição.
// Os 3 episódios completos de cada especialidade continuam exclusivos do site
// (estratégia: Spotify como isca).
async function masterEpisodes(db) {
  let docs = [];
  try {
    docs = await db.query('podcast_episodios', { limit: 500 });
  } catch { return []; }

  const byDate = new Map();
  for (const e of docs) {
    if (!e.objectPath || !e.downloadToken || !e.date) continue;
    if (!byDate.has(e.date)) byDate.set(e.date, []);
    byDate.get(e.date).push(e);
  }

  const out = [];
  for (const [date, eps] of byDate) {
    const specs = [...new Set(eps.map(e => e.especialidade || e.slug))].filter(Boolean).sort();
    for (const pick of pickSpecsOfDay(date, specs, MASTER_SPECS_PER_DAY)) {
      const chosen = eps
        .filter(e => (e.especialidade || e.slug) === pick)
        .sort((a, b) => (a.n || 0) - (b.n || 0))[0];
      if (chosen) out.push(chosen);
    }
  }
  return out
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(a.especialidade || '').localeCompare(String(b.especialidade || '')))
    .slice(0, MAX_ITEMS);
}

// Fallback do feed mestre antes do histórico existir: usa os docs do dia em
// `podcasts/{slug}` (mesmo rodízio determinístico) — o Spotify não aceita
// submissão de feed sem nenhum episódio.
async function masterFallbackToday(db) {
  let docs = [];
  try { docs = await db.query('podcasts', { limit: 100 }); } catch { return []; }
  const candidatos = docs
    .filter(d => Array.isArray(d.episodios) && d.episodios.length && d.date)
    .map(d => ({ ...d.episodios[0], date: d.date, especialidade: d.especialidade || d.id, slug: d.id }))
    .filter(e => e.objectPath && e.downloadToken);
  if (!candidatos.length) return [];
  const specs = [...new Set(candidatos.map(e => e.especialidade))].sort();
  const picks = pickSpecsOfDay(candidatos[0].date, specs, MASTER_SPECS_PER_DAY);
  return picks
    .map(p => candidatos.find(e => e.especialidade === p))
    .filter(Boolean);
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/rss+xml; charset=UTF-8',
    'Cache-Control': 'public, max-age=1800',
    'Access-Control-Allow-Origin': '*',
  };

  const esp = (event.queryStringParameters?.esp || '').trim();

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const bucket    = process.env.GCS_BUCKET || (projectId + '.appspot.com');
  if (!apiKey) return { statusCode: 500, headers, body: '' };

  try {
    const db = new Firestore(projectId, apiKey);

    // Sem ?esp → feed MESTRE (o que vai ao Spotify): 1 episódio/dia em rodízio.
    if (!esp) {
      let episodes = await masterEpisodes(db);
      if (!episodes.length) episodes = await masterFallbackToday(db);
      return { statusCode: 200, headers, body: buildFeed('', episodes, bucket, { master: true }) };
    }

    const s = specialtySlug(esp);
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
