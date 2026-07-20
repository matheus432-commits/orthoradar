// OdontoFeed → Instagram: publica o carrossel DIÁRIO automaticamente.
//
// Fluxo:
//   1. Busca os melhores estudos do dia (cache dos digests por especialidade).
//   2. Monta o HTML do carrossel e renderiza os slides em JPEG (Playwright).
//   3. Sobe as imagens no Firebase Storage (URLs públicas).
//   4. Publica o carrossel via API do Instagram (Instagram Login).
//   5. Grava um marcador de idempotência (nunca posta 2× no mesmo dia).
//
// Roda via GitHub Actions (instagram-posts.yml), 1×/dia após o pipeline.
// Segredos: INSTAGRAM_BUSINESS_ACCOUNT_ID, INSTAGRAM_ACCESS_TOKEN,
// FIREBASE_* e GCP_SERVICE_ACCOUNT_JSON (para o Storage). Sai de forma limpa se
// faltar credencial (não quebra o pipeline).

const { Firestore } = require('./_lib/firestore');
const { buildDailyCarouselHtml } = require('./_lib/instagram-slides');
const { renderCarousel } = require('./_lib/instagram-render');
const { uploadImage } = require('./_lib/storage');
const { publishCarousel, refreshLongLivedToken } = require('./_lib/instagram-api');
const { formatEvidenceLevel } = require('./_lib/instagram-generator');
const { specialtySlug } = require('./_lib/slug');
const log = require('./_lib/logger');

const EVIDENCE_WEIGHT = {
  'Meta-análise': 6, 'Revisão Sistemática': 5, 'RCT': 4, 'Ensaio Clínico': 4,
  'Estudo Coorte': 3, 'Caso-Controle': 2, 'Série de Casos': 1,
};
function evidenceScore(a) { return EVIDENCE_WEIGHT[a?.nivel_evidencia] || 0; }

// Melhores estudos do dia: 1 por especialidade (o melhor de cada digest de
// hoje), sem repetir pmid, priorizando maior nível de evidência. Até 5.
async function getTodaysTopArticles(db, limit = 5) {
  const dateStr = new Date().toISOString().slice(0, 10);
  let docs = [];
  try { docs = await db.query('digests_especialidade', { limit: 40 }); }
  catch (e) { log.warn('[instagram] falha lendo digests', { err: e.message }); return []; }

  const todays = docs.filter(d => (d.date === dateStr) || String(d.id || '').endsWith('_' + dateStr));
  const picks = [];
  const seen = new Set();
  for (const d of todays) {
    const arts = Array.isArray(d.artigos) ? d.artigos : [];
    // melhor artigo da especialidade (maior evidência; senão o primeiro)
    const best = arts.slice().sort((a, b) => evidenceScore(b) - evidenceScore(a))[0];
    if (!best) continue;
    const id = String(best.pmid || best.id || best.titulo_pt || '');
    if (id && seen.has(id)) continue;
    seen.add(id);
    picks.push({ ...best, especialidade: best.especialidade || d.especialidade || '' });
  }
  return picks.sort((a, b) => evidenceScore(b) - evidenceScore(a)).slice(0, limit);
}

// Legenda do post: hashtags por especialidade presente + fixas.
function buildCaption(articles, dateStr) {
  const espSet = [...new Set(articles.map(a => a.especialidade).filter(Boolean))];
  const linhas = articles.map(a => {
    const ev = a.nivel_evidencia ? ` (${formatEvidenceLevel(a.nivel_evidencia)})` : '';
    return `• ${a.especialidade || 'Odontologia'}${ev}`;
  });
  const espTags = espSet.map(e => '#' + specialtySlug(e).replace(/-/g, ''));
  const baseTags = ['#OdontoFeed', '#Odontologia', '#OdontoBaseadaEmEvidência',
    '#AtualizaçãoOdontológica', '#CiênciaOdontológica', '#Dentista', '#PubMed'];
  const tags = [...new Set([...baseTags, ...espTags])].join(' ');

  return `📚 Ciência odontológica do dia\n\n` +
    `Os estudos que selecionamos e resumimos hoje:\n${linhas.join('\n')}\n\n` +
    `📄 Resumo escrito · 🎧 áudio de ~8 min · 📚 artigo na íntegra\n` +
    `Curadoria científica com apoio de IA — transparente.\n\n` +
    `👉 Siga @odontofeedbr e receba todo dia\n🌐 odontofeed.com · 🎙️ Spotify e Apple Podcasts\n\n${tags}`;
}

// Token válido com auto-renovação. O token de longa duração expira em ~60 dias;
// como o job roda diariamente, renovamos quando o guardado passa de 24h e
// gravamos o novo no Firestore (instagram_config/token). Assim o token nunca
// expira sem intervenção — o segredo do GitHub serve só de semente inicial.
async function getValidToken(db, envToken) {
  let stored = null;
  try { stored = await db.getDoc('instagram_config', 'token'); } catch { /* sem doc ainda */ }
  let token = stored?.access_token || envToken;
  const ageMs = stored?.refreshedAt ? (Date.now() - new Date(stored.refreshedAt).getTime()) : Infinity;

  // ig_refresh_token exige token com >24h; renova no máximo 1×/dia.
  if (ageMs > 24 * 3600 * 1000) {
    try {
      const r = await refreshLongLivedToken(token);
      if (r?.access_token) {
        token = r.access_token;
        await db.setDoc('instagram_config', 'token', {
          access_token: token, refreshedAt: new Date().toISOString(),
          expiresIn: r.expires_in || null,
        }).catch(() => {});
        log.info('[instagram] token renovado', { expiresIn: r.expires_in });
      }
    } catch (e) {
      log.warn('[instagram] falha ao renovar token (seguindo com o atual)', { err: e.message });
    }
  }
  return token;
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

    const articles = await getTodaysTopArticles(db, 5);
    if (articles.length < 2) {
      log.warn('[instagram] estudos insuficientes p/ carrossel', { count: articles.length });
      return { statusCode: 200, body: JSON.stringify({ posted: 0, reason: 'not_enough_articles' }) };
    }

    // 1. HTML → slides JPEG
    const { html, totalSlides } = buildDailyCarouselHtml(articles, { dateStr });
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
    const caption = buildCaption(articles, dateStr);
    const { mediaId, slides } = await publishCarousel(igUserId, validToken, urls, caption);

    // 4. Marcador de idempotência
    await db.setDoc('instagram_posts', dateStr, {
      mediaId, slides, articles: articles.length,
      pmids: articles.map(a => String(a.pmid || a.id || '')),
      criadoEm: new Date().toISOString(),
    }).catch(e => log.warn('[instagram] falha gravando marcador', { err: e.message }));

    log.info('[instagram] post do dia publicado', { date: dateStr, mediaId, slides });
    return { statusCode: 200, body: JSON.stringify({ posted: 1, mediaId, slides, date: dateStr }) };
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
