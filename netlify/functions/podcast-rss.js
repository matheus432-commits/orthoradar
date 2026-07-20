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
// Exclui as "edições completas" (tipo:'completo') — elas são exclusivas do
// feed mestre; o feed por especialidade lista os episódios individuais.
async function historyEpisodes(db, slug) {
  try {
    const docs = await db.query('podcast_episodios', {
      where: { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
      limit: MAX_ITEMS * 2,
    });
    return docs
      .filter(e => e.objectPath && e.downloadToken && e.tipo !== 'completo')
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
  // URL pública canônica do feed mestre: /podcast.xml (rewrite no netlify.toml).
  // Estável para submissão ao Spotify — não amarra ao caminho da function.
  const feedUrl = master
    ? `${BASE_URL}/podcast.xml`
    : `${BASE_URL}/.netlify/functions/podcast-rss?esp=${encodeURIComponent(especialidade)}`;
  const chTitle = master ? 'OdontoFeed — Ciência Odontológica Diária' : `OdontoFeed — ${especialidade}`;
  const chDesc  = master
    ? 'A edição científica do dia em áudio (~8 min): os estudos mais relevantes resumidos em português, direto do PubMed, Europe PMC e OpenAlex. Cada dia, duas especialidades — Segunda: Endodontia e Periodontia · Terça: Bucomaxilofacial e DTM · Quarta: Dentística e Prótese · Quinta: Odontopediatria e Estomatologia · Sexta: Implantodontia e Radiologia · Sábado: Ortodontia. A SUA especialidade todos os dias, com resumos escritos e artigos na íntegra, em odontofeed.com — grátis. Siga também no Instagram: @odontofeedbr.'
    : `Resumos diários de artigos científicos de ${especialidade} em áudio. Ciência odontológica atualizada, em português, todos os dias — selecionada do PubMed, Europe PMC e OpenAlex. Resumos escritos e artigos na íntegra em odontofeed.com · Instagram: @odontofeedbr.`;

  const items = episodes.map(ep => {
    const date     = ep.date || new Date().toISOString().slice(0, 10);
    const espEp    = ep.especialidade || especialidade || '';
    const completo = ep.tipo === 'completo';
    const dateBR   = date.split('-').reverse().join('/'); // "2026-07-20" → "20/07/2026"

    // Edição completa (feed mestre): título com a especialidade + data; a
    // descrição lista os estudos do dia. Episódio individual: título do artigo.
    const base   = completo
      ? `Edição de ${dateBR} — ${(ep.titulos || []).length || 3} estudos do dia`
      : (ep.titulo ? `${ep.titulo}` : `Episódio ${ep.n || 1}`);
    const titulo = master && espEp ? `${espEp} · ${base}` : base;
    const desc   = completo
      ? `A edição completa de ${espEp} de ${dateBR} em um único áudio: ` +
        (ep.titulos || []).map((t, i) => `${i + 1}) ${t}`).join(' ') +
        ` • Resumos escritos e artigos na íntegra em odontofeed.com — grátis.`
      : master
        ? `Resumo em áudio — ${espEp}, edição de ${date}. ${ep.titulo || ''} • Os episódios da sua especialidade saem todo dia em odontofeed.com — grátis.`
        : `Resumo em áudio — ${especialidade}, edição de ${date}. ${ep.titulo || ''}`;

    const guidSuffix = completo ? 'completo' : `ep${ep.n || 1}`;
    return `
    <item>
      <title>${escapeXml(titulo)}</title>
      <description>${escapeXml(desc)}</description>
      <link>${BASE_URL}/</link>
      <guid isPermaLink="false">odontofeed-${escapeXml(ep.slug || specialtySlug(espEp || especialidade))}-${date}-${guidSuffix}</guid>
      <pubDate>${rfc2822(date)}</pubDate>
      <enclosure url="${escapeXml(firebaseDownloadUrl(bucket, ep.objectPath, ep.downloadToken))}" type="audio/mpeg" length="${Number(ep.bytes) || 0}"/>
      <itunes:title>${escapeXml(titulo)}</itunes:title>${Number(ep.secs) > 0 ? `
      <itunes:duration>${Number(ep.secs)}</itunes:duration>` : ''}
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

// Rodízio FIXO por dia da semana — fonte única em _lib/weekly-schedule.js
// (compartilhada com os Reels do Instagram).
const { scheduledForDate } = require('./_lib/weekly-schedule');

// Slugs das especialidades destaque do dia (na ordem do cronograma).
function scheduledSlugsForDate(date) {
  return scheduledForDate(date).map(specialtySlug);
}

// Slug de um episódio, tolerante ao formato: usa o slug gravado; senão deriva do nome.
function episodeSlug(e) {
  return e.slug || specialtySlug(e.especialidade || '');
}

// Feed MESTRE (o único submetido ao Spotify): as especialidades destaque de
// cada dia seguem o cronograma FIXO da semana (WEEKLY_SCHEDULE). O item
// publicado é a EDIÇÃO COMPLETA da especialidade (decisão 19/07: os 3
// episódios do dia compilados num único áudio, ~8 min). Fallback (transição,
// antes de existir o compilado): o episódio 1 da edição.
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
    // Na ordem do cronograma do dia; pula especialidade sem episódio gerado.
    for (const wantSlug of scheduledSlugsForDate(date)) {
      const daEsp = eps.filter(e => episodeSlug(e) === wantSlug);
      const chosen = daEsp.find(e => e.tipo === 'completo') ||
        daEsp.sort((a, b) => (a.n || 0) - (b.n || 0))[0];
      if (chosen) out.push(chosen);
    }
  }
  // Mais recentes primeiro; a ordem do cronograma dentro do dia é preservada
  // (sort estável → não reordena empates de mesma data).
  return out
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, MAX_ITEMS);
}

// Fallback do feed mestre antes do histórico existir: usa os docs do dia em
// `podcasts/{slug}` (mesmo cronograma fixo) — o Spotify não aceita submissão
// de feed sem nenhum episódio.
async function masterFallbackToday(db) {
  let docs = [];
  try { docs = await db.query('podcasts', { limit: 100 }); } catch { return []; }
  const candidatos = docs
    .filter(d => (Array.isArray(d.episodios) && d.episodios.length || d.compilado) && d.date)
    .map(d => d.compilado
      ? { ...d.compilado, tipo: 'completo', date: d.date, especialidade: d.especialidade || d.id, slug: d.id }
      : { ...d.episodios[0], date: d.date, especialidade: d.especialidade || d.id, slug: d.id })
    .filter(e => e.objectPath && e.downloadToken);
  if (!candidatos.length) return [];
  const out = [];
  for (const wantSlug of scheduledSlugsForDate(candidatos[0].date)) {
    const chosen = candidatos.find(e => episodeSlug(e) === wantSlug);
    if (chosen) out.push(chosen);
  }
  return out;
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
