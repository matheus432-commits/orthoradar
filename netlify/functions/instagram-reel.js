// OdontoFeed → Instagram: REEL diário com áudio do podcast + cenas ilustradas
// sincronizadas ("a imagem certa no momento certo da narração").
//
// Fluxo:
//   1. Especialidade do dia (rodízio fixo semanal — mesma do feed Spotify).
//   2. Episódio 1 de hoje (podcast_episodios): áudio + ROTEIRO narrado + secs.
//   3. Claude divide o roteiro em cenas (capa/cenas/outro) com conceito visual.
//   4. Ilustração de cada cena: cache por conceito (reel_cenas) → senão Imagen.
//   5. Frames HTML (visual aprovado 20/07) → PNGs → ffmpeg com o áudio real;
//      cada cena dura o tempo do trecho narrado (proporcional ao texto).
//   6. Sobe o MP4 no Storage e publica como REEL via API do Instagram.
//   7. Marcador de idempotência (instagram_reels/{data}) — nunca posta 2×.
//
// Roda via GitHub Actions (instagram-reel.yml). Sai limpo se faltar credencial,
// roteiro (transição: episódios antigos não têm) ou episódio do dia (domingo).

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Firestore } = require('./_lib/firestore');
const { prioridadesDoDia, corDe } = require('./_lib/especialidade-identidade');
const { specialtySlug } = require('./_lib/slug');
const { segmentScript, computeTimings, conceptSlug } = require('./_lib/reel-scenes');
const { generateIllustration } = require('./_lib/imagen');
const { buildReelHtml, assembleVideo, REEL_W, REEL_H } = require('./_lib/reel-builder');
const { renderCarousel } = require('./_lib/instagram-render');
const { uploadImage, firebaseDownloadUrl } = require('./_lib/storage');
const { publishReel, getValidToken, resolveIgUserId } = require('./_lib/instagram-api');
const log = require('./_lib/logger');

// Download binário (o helper request do projeto acumula string — corromperia mp3).
function downloadBinary(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('download ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// "2026-07-20" → "20 de julho"
function dateBrLong(dateStr) {
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho',
    'agosto','setembro','outubro','novembro','dezembro'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? `${Number(m[3])} de ${meses[Number(m[2]) - 1]}` : '';
}

// Ilustração da cena: cache por conceito → senão gera no Imagen e cacheia.
async function sceneImage(db, bucket, cena) {
  const slug = conceptSlug(cena.conceito || cena.rotulo || 'cena');
  try {
    const cached = await db.getDoc('reel_cenas', slug);
    if (cached?.objectPath && cached?.downloadToken) {
      return firebaseDownloadUrl(bucket, cached.objectPath, cached.downloadToken);
    }
  } catch { /* sem cache */ }

  const gen = await generateIllustration(cena.visual || cena.conceito || '');
  if (!gen.ok) { log.warn('[reel] ilustração pulada', { slug, reason: gen.reason }); return null; }

  const objectPath = `reel-cenas/${slug}.png`;
  const up = await uploadImage(objectPath, gen.buffer, gen.mime || 'image/png');
  if (!up.ok) return null;
  await db.setDoc('reel_cenas', slug, {
    conceito: cena.conceito || '', visual: cena.visual || '',
    objectPath, downloadToken: up.downloadToken, criadoEm: new Date().toISOString(),
  }).catch(() => {});
  return up.url;
}

function buildCaption(especialidade, tituloEstudo) {
  const espTag = '#' + specialtySlug(especialidade).replace(/-/g, '');
  return `🎧 ${especialidade} — a ciência do dia, narrada\n\n${tituloEstudo}\n\n` +
    `Acompanhe cada passo do estudo com o áudio. Resumo escrito e artigo na íntegra — grátis.\n\n` +
    `👉 Siga @odontofeedbr\n🌐 odontofeed.com · Spotify · Apple Podcasts\n\n` +
    `#OdontoFeed #Odontologia #CiênciaOdontológica #OdontoBaseadaEmEvidência ${espTag}`;
}

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');

  if (!igUserId || !envToken) {
    log.info('[reel] pulando — credenciais do Instagram ausentes');
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not_configured' }) };
  }
  if (!apiKey || !anthropicKey) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'missing_keys' }) };
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const db = new Firestore(projectId, apiKey);

  try {
    // Idempotência diária (FORCE_REPOST=true ignora, para reprocessar/testar).
    const force = process.env.FORCE_REPOST === 'true' || process.env.FORCE_REPOST === '1';
    const already = await db.getDoc('instagram_reels', dateStr).catch(() => null);
    if (already?.mediaId && !force) {
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'already_posted', mediaId: already.mediaId }) };
    }
    if (already?.mediaId && force) log.info('[reel] FORCE_REPOST — republicando apesar do marcador', { dateStr });

    // Especialidade do dia com FALLBACK (incidente 22/07, mesma regra do
    // carrossel): dia de área sem episódio → a próxima do ciclo com áudio.
    let especialidade = null, ep = null;
    for (const cand of prioridadesDoDia(dateStr)) {
      const doc = await db.getDoc('podcast_episodios', `${specialtySlug(cand)}_${dateStr}_ep1`).catch(() => null);
      if (doc?.roteiro && doc?.objectPath && doc?.downloadToken && Number(doc.secs) > 0) {
        especialidade = cand; ep = doc; break;
      }
    }
    if (!ep) {
      log.info('[reel] nenhuma especialidade com episódio narrado hoje', { dateStr });
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'no_episode_with_script' }) };
    }

    // Cenas + sincronia.
    const segs = await segmentScript(ep.roteiro, { titulo: ep.titulo }, anthropicKey);
    if (!segs) return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'segmentation_failed' }) };
    const durations = computeTimings(ep.roteiro, segs.map(s => s.inicio), Number(ep.secs));

    // Ilustrações (com cache) — só para as cenas do meio.
    const cenas = [];
    for (const s of segs) {
      if (s.tipo === 'cena') {
        const imgSrc = await sceneImage(db, bucket, s);
        cenas.push({ ...s, imgSrc });
      } else {
        cenas.push(s);
      }
    }

    // Frames → PNGs → vídeo com o áudio real (capa na cor da especialidade).
    const { html, totalFrames } = buildReelHtml({
      especialidade, cor: corDe(especialidade), tituloEstudo: ep.titulo,
      dataLonga: dateBrLong(dateStr), cenas,
    });
    const frames = await renderCarousel(html, totalFrames, { width: REEL_W, height: REEL_H, type: 'png' });

    const audioUrl = firebaseDownloadUrl(bucket, ep.objectPath, ep.downloadToken);
    const audioBuf = await downloadBinary(audioUrl);
    const tmpAudio = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reel-audio-')), 'ep.mp3');
    fs.writeFileSync(tmpAudio, audioBuf);

    // Duração por frame: capa+cenas+outro seguem os segmentos narrados (a soma
    // é a duração do áudio). Frames e durations têm o mesmo comprimento por
    // construção (1 segmento = 1 frame).
    const video = assembleVideo(frames, durations, tmpAudio);
    fs.rmSync(path.dirname(tmpAudio), { recursive: true, force: true });

    // Upload + publicação.
    const videoPath = `instagram/reels/${dateStr}-${specialtySlug(especialidade)}.mp4`;
    const upVideo = await uploadImage(videoPath, video, 'video/mp4');
    if (!upVideo.ok) throw new Error('Upload do vídeo falhou: ' + upVideo.reason);

    const token = await getValidToken(db, envToken);
    const igId = await resolveIgUserId(token, igUserId);
    const caption = buildCaption(especialidade, ep.titulo);
    const { mediaId } = await publishReel(igId, token, upVideo.url, caption);

    await db.setDoc('instagram_reels', dateStr, {
      mediaId, especialidade, artigoId: ep.artigoId || '',
      cenas: cenas.filter(c => c.tipo === 'cena').length,
      secs: Number(ep.secs), criadoEm: new Date().toISOString(),
    }).catch(e => log.warn('[reel] falha gravando marcador', { err: e.message }));

    log.info('[reel] publicado', { dateStr, especialidade, mediaId });
    return { statusCode: 200, body: JSON.stringify({ posted: 1, mediaId, especialidade, date: dateStr }) };
  } catch (err) {
    log.error('[reel] erro', { error: err.message, detail: err.detail });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Execução direta: node netlify/functions/instagram-reel.js
if (require.main === module) {
  exports.handler().then(res => {
    console.log(res.statusCode, res.body);
    process.exit(res.statusCode >= 400 ? 1 : 0);
  }).catch(err => { console.error(err); process.exit(1); });
}
