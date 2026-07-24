// APP: gera o REEL COM AVATAR do dia — vídeo vertical 1080×1920 dividido:
// cenas ilustradas em cima (sincronizadas com a narração) e a apresentadora
// virtual do OdontoFeed falando embaixo (lip-sync por amplitude).
//
// v1 GERA O ARQUIVO e sobe ao Storage (o link sai no log e em avatar_reels/
// {data} no Firestore) — a publicação é manual em Instagram/TikTok/YouTube,
// até validarmos o formato. Não posta nada sozinho.
//
// Custo por execução: 1 chamada de segmentação de cenas (Sonnet, centavos) +
// Imagen APENAS nas cenas sem cache (conceitos repetem muito). ffmpeg e
// Playwright rodam no Actions de graça. Sem TTS novo — usa o áudio já gerado.
//
// Envs: FIREBASE_*, ANTHROPIC_API_KEY, GCP_SERVICE_ACCOUNT_JSON, GCS_BUCKET.
// Opcionais: AVATAR_DATE (YYYY-MM-DD; default hoje), AVATAR_ESP (força a
// especialidade), AVATAR_EP (ep1..ep3; default ep1).
//
// MODO REALISTA (opt-in): AVATAR_MODE=realista + HEYGEN_API_KEY — a metade de
// baixo vira uma pessoa REAL falando (talking head fotorrealista do HeyGen a
// partir do retrato oficial em avatar_config/retrato, ou AVATAR_FOTO_URL).
// CUSTO: HeyGen cobra ~US$1–3/min de vídeo gerado. Guardas: só roda com
// episódio de até AVATAR_MAX_SECS (default 95s — suba conscientemente) e loga
// a estimativa de custo. Se o HeyGen falhar, cai no avatar desenhado (o vídeo
// sai mesmo assim; AVATAR_STRICT=true aborta em vez de degradar).

const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { prioridadesDoDia, corDe } = require('../netlify/functions/_lib/especialidade-identidade');
const { specialtySlug } = require('../netlify/functions/_lib/slug');
const { segmentScript, computeTimings, conceptSlug } = require('../netlify/functions/_lib/reel-scenes');
const { generateIllustration } = require('../netlify/functions/_lib/imagen');
const { renderCarousel } = require('../netlify/functions/_lib/instagram-render');
const { uploadImage, firebaseDownloadUrl } = require('../netlify/functions/_lib/storage');
const { buildAvatarSpritesHtml, audioEnvelope, normalizeEnvelope, visemeTimeline, AVATAR_W, AVATAR_H, N_SPRITES } = require('../netlify/functions/_lib/avatar');
const { buildTopHtml, assembleSplitVideo, TOP_W, TOP_H } = require('../netlify/functions/_lib/avatar-reel');
const { generateTalkingHead, estimateCostUsd } = require('../netlify/functions/_lib/talking-head');
const log = require('../netlify/functions/_lib/logger');

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

function dateBrLong(dateStr) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? `${Number(m[3])} de ${meses[Number(m[2]) - 1]}` : '';
}

// Ilustração da cena com o MESMO cache do reel (reel_cenas por conceito).
async function sceneImage(db, bucket, cena) {
  const slug = conceptSlug(cena.conceito || cena.rotulo || 'cena');
  try {
    const cached = await db.getDoc('reel_cenas', slug);
    if (cached?.objectPath && cached?.downloadToken) {
      return firebaseDownloadUrl(bucket, cached.objectPath, cached.downloadToken);
    }
  } catch { /* sem cache */ }
  const gen = await generateIllustration(cena.visual || cena.conceito || '');
  if (!gen.ok) { log.warn('[avatar-reel] ilustração pulada', { slug, reason: gen.reason }); return null; }
  const objectPath = `reel-cenas/${slug}.png`;
  const up = await uploadImage(objectPath, gen.buffer, gen.mime || 'image/png');
  if (!up.ok) return null;
  await db.setDoc('reel_cenas', slug, {
    conceito: cena.conceito || '', visual: cena.visual || '',
    objectPath, downloadToken: up.downloadToken, criadoEm: new Date().toISOString(),
  }).catch(() => {});
  return up.url;
}

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');
  if (!apiKey) { console.log('FALTA FIREBASE_API_KEY'); process.exit(1); }

  const db = new Firestore(projectId, apiKey);
  const dateStr = process.env.AVATAR_DATE || new Date().toISOString().slice(0, 10);
  const epN = process.env.AVATAR_EP || 'ep1';

  // Episódio do dia (com fallback do ciclo, como o reel do IG).
  const candidatas = process.env.AVATAR_ESP ? [process.env.AVATAR_ESP] : prioridadesDoDia(dateStr);
  let especialidade = null, ep = null;
  for (const cand of candidatas) {
    const doc = await db.getDoc('podcast_episodios', `${specialtySlug(cand)}_${dateStr}_${epN}`).catch(() => null);
    if (doc?.roteiro && doc?.objectPath && doc?.downloadToken && Number(doc.secs) > 0) {
      especialidade = cand; ep = doc; break;
    }
  }
  if (!ep) { console.log('SEM_EPISODIO com roteiro/áudio para', dateStr); process.exit(0); }
  console.log('Episódio:', especialidade, '—', ep.titulo);

  // Cenas + sincronia (mesma engine do reel).
  const segs = await segmentScript(ep.roteiro, { titulo: ep.titulo }, anthropicKey);
  if (!segs) { console.log('SEGMENTACAO_FALHOU'); process.exit(1); }
  const durations = computeTimings(ep.roteiro, segs.map(s => s.inicio), Number(ep.secs));

  const cenas = [];
  for (const s of segs) {
    cenas.push(s.tipo === 'cena' ? { ...s, imgSrc: await sceneImage(db, bucket, s) } : s);
  }

  // Frames da metade de cima.
  const { html: topHtml, totalFrames } = buildTopHtml({
    especialidade, cor: corDe(especialidade), dataLonga: dateBrLong(dateStr), cenas,
  });
  const topFrames = await renderCarousel(topHtml, totalFrames, { width: TOP_W, height: TOP_H, type: 'png' });

  // Áudio real do episódio.
  const audioUrl = firebaseDownloadUrl(bucket, ep.objectPath, ep.downloadToken);
  const audioBuf = await downloadBinary(audioUrl);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-audio-'));
  const tmpAudio = path.join(tmpDir, 'ep.mp3');
  fs.writeFileSync(tmpAudio, audioBuf);

  // ── Metade de baixo: realista (HeyGen) ou desenhada (sprites) ──
  const modo = (process.env.AVATAR_MODE || 'desenho').toLowerCase();
  const strict = process.env.AVATAR_STRICT === 'true';
  let bottomVideoPath = null;

  if (modo === 'realista') {
    const heygenKey = process.env.HEYGEN_API_KEY;
    const maxSecs = Number(process.env.AVATAR_MAX_SECS) || 95;
    try {
      if (!heygenKey) throw new Error('HEYGEN_API_KEY não configurada');
      if (Number(ep.secs) > maxSecs) {
        throw new Error(`episódio de ${ep.secs}s excede o teto de custo AVATAR_MAX_SECS=${maxSecs}s — suba o teto conscientemente para gerar`);
      }
      console.log(`Modo REALISTA: custo estimado ~US$ ${estimateCostUsd(Number(ep.secs))} (${ep.secs}s de vídeo HeyGen)`);

      // Retrato oficial: cache do talking_photo_id > foto do doc > AVATAR_FOTO_URL.
      const cfg = await db.getDoc('avatar_config', 'retrato').catch(() => null);
      let photo = null;
      if (cfg?.talkingPhotoId) photo = { talkingPhotoId: cfg.talkingPhotoId };
      else if (cfg?.fotoPath && cfg?.fotoToken) {
        photo = { buffer: await downloadBinary(firebaseDownloadUrl(bucket, cfg.fotoPath, cfg.fotoToken)), mime: 'image/png' };
      } else if (process.env.AVATAR_FOTO_URL) {
        photo = { buffer: await downloadBinary(process.env.AVATAR_FOTO_URL), mime: 'image/jpeg' };
      } else {
        throw new Error('sem retrato: rode scripts/gerar-avatar-retrato.js e grave avatar_config/retrato (ou defina AVATAR_FOTO_URL)');
      }

      const th = await generateTalkingHead(heygenKey, { photo, audioBuffer: audioBuf, width: AVATAR_W, height: AVATAR_H });
      bottomVideoPath = path.join(tmpDir, 'talking-head.mp4');
      fs.writeFileSync(bottomVideoPath, th.buffer);
      // Cacheia o talking_photo_id — os próximos vídeos pulam o upload da foto.
      if (!cfg?.talkingPhotoId && th.talkingPhotoId) {
        await db.setDoc('avatar_config', 'retrato', { ...(cfg || {}), talkingPhotoId: th.talkingPhotoId, atualizadoEm: new Date().toISOString() }).catch(() => {});
      }
    } catch (e) {
      if (strict) { console.error('REALISTA_FALHOU (strict):', e.message); process.exit(1); }
      log.warn('[avatar-reel] modo realista falhou — degradando para o avatar desenhado', { err: e.message });
      console.log('Modo realista indisponível (' + e.message + ') — usando o avatar desenhado.');
      bottomVideoPath = null;
    }
  }

  // Avatar desenhado (modo padrão ou fallback do realista).
  let spriteBuffers = null, timeline = null;
  if (!bottomVideoPath) {
    const { html: avatarHtml } = buildAvatarSpritesHtml();
    spriteBuffers = await renderCarousel(avatarHtml, N_SPRITES, { width: AVATAR_W, height: AVATAR_H, type: 'png' });
    timeline = visemeTimeline(normalizeEnvelope(audioEnvelope(tmpAudio, 12)), { fps: 12, seed: 7 });
  }

  // Montagem final.
  const video = assembleSplitVideo({ topFrames, topDurations: durations, spriteBuffers, timeline, bottomVideoPath, audioPath: tmpAudio });
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Upload + registro (SEM publicar — v1 é geração de arquivo).
  const videoPath = `instagram/avatar-reels/${dateStr}-${specialtySlug(especialidade)}-${epN}.mp4`;
  const up = await uploadImage(videoPath, video, 'video/mp4');
  if (!up.ok) { console.log('UPLOAD_FALHOU', up.reason); process.exit(1); }

  await db.setDoc('avatar_reels', `${dateStr}_${epN}`, {
    especialidade, artigoId: ep.artigoId || '', titulo: ep.titulo || '',
    objectPath: videoPath, downloadToken: up.downloadToken || '',
    url: up.url, secs: Number(ep.secs), modo: bottomVideoPath ? 'realista' : 'desenho',
    criadoEm: new Date().toISOString(),
  }).catch(e => log.warn('[avatar-reel] falha gravando doc', { err: e.message }));

  console.log('\n=== REEL COM AVATAR PRONTO ===');
  console.log('Especialidade:', especialidade);
  console.log('Duração:', ep.secs, 's  ·  Tamanho:', (video.length / 1e6).toFixed(1), 'MB');
  console.log('URL para baixar/postar:', up.url);
  process.exit(0);
})().catch(e => { console.error('ERRO_FATAL', e.message); process.exit(1); });
