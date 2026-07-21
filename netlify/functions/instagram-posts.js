// OdontoFeed → Instagram: publica o carrossel DIÁRIO da ESPECIALIDADE DO DIA.
//
// Ciclo (decisão 21/07): 1 especialidade por dia, girando as 11 em ordem fixa
// (especialidade-identidade). Cada dia sai o carrossel da especialidade da vez,
// com a CAPA na cor-assinatura dela — o dentista reconhece a sua no feed.
//
// Fluxo:
//   1. Especialidade do dia → estudos dela no cache (digests_especialidade).
//   2. Monta o carrossel (capa colorida + estudos) e renderiza em JPEG.
//   3. Sobe as imagens no Storage (URLs públicas).
//   4. Publica o carrossel via API do Instagram (Instagram Login).
//   5. Marcador de idempotência (nunca posta 2× no mesmo dia).

const { Firestore } = require('./_lib/firestore');
const { buildDailyCarouselHtml } = require('./_lib/instagram-slides');
const { renderCarousel } = require('./_lib/instagram-render');
const { uploadImage } = require('./_lib/storage');
const { publishCarousel, getValidToken } = require('./_lib/instagram-api');
const { formatEvidenceLevel } = require('./_lib/instagram-generator');
const { especialidadeDoDia, corDe } = require('./_lib/especialidade-identidade');
const { specialtySlug, espDigestSlug } = require('./_lib/slug');
const log = require('./_lib/logger');

const EVIDENCE_WEIGHT = {
  'Meta-análise': 6, 'Revisão Sistemática': 5, 'RCT': 4, 'Ensaio Clínico': 4,
  'Estudo Coorte': 3, 'Caso-Controle': 2, 'Série de Casos': 1,
};
function evidenceScore(a) { return EVIDENCE_WEIGHT[a?.nivel_evidencia] || 0; }

// Estudos da especialidade do dia: lê o digest dela (digests_especialidade),
// ordena por nível de evidência e devolve até `limit`.
async function getEspecialidadeArticles(db, especialidade, dateStr, limit = 5) {
  const key = `${espDigestSlug(especialidade)}_${dateStr}`;
  const doc = await db.getDoc('digests_especialidade', key).catch(() => null);
  const arts = (doc && Array.isArray(doc.artigos)) ? doc.artigos : [];
  return arts
    .map(a => ({ ...a, especialidade: a.especialidade || especialidade }))
    .sort((a, b) => evidenceScore(b) - evidenceScore(a))
    .slice(0, limit);
}

// Legenda do post da especialidade do dia.
function buildCaption(especialidade, articles) {
  const linhas = articles.map(a => {
    const ev = a.nivel_evidencia ? ` — ${formatEvidenceLevel(a.nivel_evidencia)}` : '';
    const t = (a.titulo_pt || a.titulo || '').slice(0, 90);
    return `• ${t}${ev}`;
  });
  const espTag = '#' + specialtySlug(especialidade).replace(/-/g, '');
  const tags = ['#OdontoFeed', '#Odontologia', '#OdontoBaseadaEmEvidência',
    '#AtualizaçãoOdontológica', '#CiênciaOdontológica', '#Dentista', '#PubMed', espTag]
    .filter((v, i, a) => a.indexOf(v) === i).join(' ');

  return `📚 ${especialidade} — a ciência do dia\n\n` +
    `Os estudos que selecionamos e resumimos hoje:\n${linhas.join('\n')}\n\n` +
    `📄 Resumo escrito · 🎧 áudio de ~8 min · 📚 artigo na íntegra\n` +
    `Curadoria científica com apoio de IA — transparente.\n\n` +
    `👉 Siga @odontofeedbr e receba todo dia\n🌐 odontofeed.com · 🎙️ Spotify e Apple Podcasts\n\n${tags}`;
}

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!igUserId || !token) {
    log.info('[instagram] pulando — credenciais ausentes');
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not_configured' }) };
  }
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };

  const dateStr = new Date().toISOString().slice(0, 10);
  const db = new Firestore(projectId, apiKey);

  try {
    // Idempotência: não posta 2× no mesmo dia.
    const already = await db.getDoc('instagram_posts', dateStr).catch(() => null);
    if (already && already.mediaId) {
      log.info('[instagram] já postado hoje', { date: dateStr, mediaId: already.mediaId });
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'already_posted', mediaId: already.mediaId }) };
    }

    // Especialidade do dia (ciclo fixo das 11).
    const especialidade = especialidadeDoDia(dateStr);
    const articles = await getEspecialidadeArticles(db, especialidade, dateStr, 5);
    if (articles.length < 2) {
      log.warn('[instagram] estudos insuficientes p/ carrossel', { especialidade, count: articles.length });
      return { statusCode: 200, body: JSON.stringify({ posted: 0, reason: 'not_enough_articles', especialidade }) };
    }

    // 1. HTML → slides JPEG (capa na cor-assinatura da especialidade)
    const { html, totalSlides } = buildDailyCarouselHtml(articles, { dateStr, especialidade, cor: corDe(especialidade) });
    const buffers = await renderCarousel(html, totalSlides);

    // 2. Upload das imagens (URLs públicas)
    const urls = [];
    for (let i = 0; i < buffers.length; i++) {
      const path = `instagram/${dateStr}/slide-${i + 1}.jpg`;
      const up = await uploadImage(path, buffers[i], 'image/jpeg');
      if (!up.ok) throw new Error('Upload de imagem falhou: ' + (up.reason || 'desconhecido'));
      urls.push(up.url);
    }

    // 3. Publicar carrossel (token com auto-renovação)
    const validToken = await getValidToken(db, token);
    const caption = buildCaption(especialidade, articles);
    const { mediaId, slides } = await publishCarousel(igUserId, validToken, urls, caption);

    // 4. Marcador de idempotência
    await db.setDoc('instagram_posts', dateStr, {
      mediaId, slides, especialidade, articles: articles.length,
      pmids: articles.map(a => String(a.pmid || a.id || '')),
      criadoEm: new Date().toISOString(),
    }).catch(e => log.warn('[instagram] falha gravando marcador', { err: e.message }));

    log.info('[instagram] post do dia publicado', { date: dateStr, especialidade, mediaId, slides });
    return { statusCode: 200, body: JSON.stringify({ posted: 1, mediaId, slides, especialidade, date: dateStr }) };
  } catch (err) {
    log.error('[instagram] erro', { error: err.message, detail: err.detail });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Execução direta: node netlify/functions/instagram-posts.js
if (require.main === module) {
  exports.handler().then(res => {
    console.log(res.statusCode, res.body);
    process.exit(res.statusCode >= 400 ? 1 : 0);
  }).catch(err => { console.error(err); process.exit(1); });
}
