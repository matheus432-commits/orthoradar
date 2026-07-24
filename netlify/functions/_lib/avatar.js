// AVATAR OdontoFeed — a apresentadora virtual dos vídeos verticais.
//
// Estilo "apresentador virtual" (o formato que domina Shorts/TikTok): um
// personagem 2D da marca com a BOCA SINCRONIZADA à narração. A sincronia é por
// AMPLITUDE da voz (envelope RMS do áudio → visema por frame) — técnica
// determinística, sem IA e sem custo por vídeo.
//
// Pipeline:
//   1. buildAvatarSpritesHtml()  → HTML com os 10 sprites (5 bocas × 2 olhos),
//      renderizado 1× via Playwright (mesmo renderCarousel do carrossel/reel);
//   2. audioEnvelope(mp3, fps)   → RMS por janela de 1/fps s (decodifica com
//      ffmpeg para PCM cru — nada além do ffmpeg que o pipeline já usa);
//   3. visemeTimeline(env, opts) → PURO e testável: envelope → sequência
//      run-length de sprites (ataque rápido/queda lenta, anti-flicker com
//      hold mínimo, piscadas agendadas por PRNG semeado — reproduzível).
//
// O vídeo final é montado em avatar-reel.js (metade de cima = cenas; metade de
// baixo = avatar).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';

// Metade de baixo do vídeo vertical (1080×1920 → 1080×960).
const AVATAR_W = 1080;
const AVATAR_H = 960;

// 5 formas de boca (visemas por intensidade) × 2 estados de olhos.
// Índice do sprite = visema*2 + (piscando ? 1 : 0).
const VISEMES = ['fechada', 'quase', 'media', 'aberta', 'larga'];
const N_SPRITES = VISEMES.length * 2;

// ── O personagem (SVG) ───────────────────────────────────────────────────────
// "Dra. Fê" — apresentadora dentista do OdontoFeed: jaleco ciano, fones de
// podcast dourados, microfone, sorriso. Traço flat/limpo (nada de uncanny
// valley); as cores são as da marca (#37D7E7 ciano, #EABF48 dourado, navy).

const SKIN   = '#C98A63';
const SKIN_D = '#B4744F';   // sombra da pele
const HAIR   = '#2B1B14';
const LIP    = '#8E4A3C';
const MOUTH  = '#5E241C';   // interior da boca
const TEETH  = '#F7F3EC';
const TONGUE = '#C05A50';
const SCRUB  = '#1BA9B8';
const SCRUB_D= '#128291';
const CYAN   = '#37D7E7';
const GOLD   = '#EABF48';
const INKNAVY= '#0A0E1A';

// Boca por visema (desenhada em torno de cx=540, cy=560).
function mouthSvg(visema) {
  switch (visema) {
    case 'fechada': // sorriso fechado suave
      return `<path d="M492 560 Q540 582 588 560" fill="none" stroke="${LIP}" stroke-width="11" stroke-linecap="round"/>`;
    case 'quase':   // entreaberta
      return `<g><ellipse cx="540" cy="570" rx="34" ry="14" fill="${MOUTH}"/>
        <path d="M506 567 Q540 555 574 567" fill="none" stroke="${LIP}" stroke-width="9" stroke-linecap="round"/></g>`;
    case 'media':   // aberta média, dentes de cima
      return `<g><ellipse cx="540" cy="578" rx="42" ry="26" fill="${MOUTH}"/>
        <path d="M502 566 Q540 580 578 566 L578 556 Q540 568 502 556 Z" fill="${TEETH}"/>
        <ellipse cx="540" cy="596" rx="18" ry="8" fill="${TONGUE}"/></g>`;
    case 'aberta':  // bem aberta, dentes + língua
      return `<g><ellipse cx="540" cy="584" rx="46" ry="38" fill="${MOUTH}"/>
        <path d="M498 562 Q540 576 582 562 L582 550 Q540 564 498 550 Z" fill="${TEETH}"/>
        <ellipse cx="540" cy="610" rx="24" ry="12" fill="${TONGUE}"/></g>`;
    case 'larga':   // larga (sorriso falado, "é/a"), dentes visíveis
      return `<g><path d="M478 560 Q540 548 602 560 Q596 604 540 606 Q484 604 478 560 Z" fill="${MOUTH}"/>
        <path d="M484 560 Q540 550 596 560 L594 574 Q540 564 486 574 Z" fill="${TEETH}"/>
        <ellipse cx="540" cy="596" rx="24" ry="9" fill="${TONGUE}"/></g>`;
    default:
      return '';
  }
}

// Olhos abertos ou piscando (cy=470).
function eyesSvg(blink) {
  if (blink) {
    return `<g stroke="${HAIR}" stroke-width="9" stroke-linecap="round" fill="none">
      <path d="M448 472 Q474 484 500 472"/><path d="M580 472 Q606 484 632 472"/></g>`;
  }
  return `<g>
    <ellipse cx="474" cy="470" rx="27" ry="30" fill="#FFFFFF"/>
    <ellipse cx="606" cy="470" rx="27" ry="30" fill="#FFFFFF"/>
    <circle cx="478" cy="474" r="14" fill="${HAIR}"/><circle cx="610" cy="474" r="14" fill="${HAIR}"/>
    <circle cx="483" cy="469" r="4.5" fill="#FFFFFF"/><circle cx="615" cy="469" r="4.5" fill="#FFFFFF"/>
  </g>`;
}

// O personagem completo para um par (visema, blink).
function characterSvg(visema, blink) {
  return `<svg viewBox="0 0 1080 960" xmlns="http://www.w3.org/2000/svg">
    <!-- ondas sonoras decorativas (identidade de áudio) -->
    <g opacity="0.16" fill="${CYAN}">
      <rect x="118" y="470" width="16" height="80"  rx="8"/><rect x="154" y="440" width="16" height="140" rx="8"/>
      <rect x="190" y="490" width="16" height="46"  rx="8"/><rect x="226" y="452" width="16" height="116" rx="8"/>
      <rect x="946" y="470" width="16" height="80"  rx="8"/><rect x="910" y="440" width="16" height="140" rx="8"/>
      <rect x="874" y="490" width="16" height="46"  rx="8"/><rect x="838" y="452" width="16" height="116" rx="8"/>
    </g>

    <!-- ombros / jaleco -->
    <path d="M240 960 C250 812 356 738 540 738 C724 738 830 812 840 960 Z" fill="${SCRUB}"/>
    <path d="M240 960 C250 812 356 738 540 738 L540 960 Z" fill="${SCRUB_D}" opacity="0.35"/>
    <path d="M470 742 L540 828 L610 742 C588 752 492 752 470 742 Z" fill="#EAF2F5"/>
    <!-- crachá dente -->
    <g transform="translate(660,830) scale(0.62)">
      <circle cx="65" cy="59" r="64" fill="#EAF2F5"/>
      <path d="M64 18 C46 18 34 30 34 48 C34 62 38 76 44 94 C47 103 55 103 57 94 L61 72 C62 66 66 66 67 72 L71 94 C73 103 81 103 84 94 C90 76 94 62 94 48 C94 30 82 18 64 18 Z" fill="${CYAN}"/>
      <g fill="none" stroke="${GOLD}" stroke-width="7" stroke-linecap="round"><path d="M83 30 A13 13 0 0 1 96 43"/><path d="M83 17 A26 26 0 0 1 109 43"/></g>
      <circle cx="83" cy="43" r="5.4" fill="${GOLD}"/>
    </g>

    <!-- pescoço -->
    <path d="M492 640 L588 640 L588 760 Q540 786 492 760 Z" fill="${SKIN}"/>
    <path d="M492 640 L588 640 L588 690 Q540 712 492 690 Z" fill="${SKIN_D}" opacity="0.55"/>

    <!-- cabelo atrás -->
    <path d="M356 470 C348 306 432 232 540 232 C648 232 732 306 724 470 C728 560 700 622 664 654 L416 654 C380 622 352 560 356 470 Z" fill="${HAIR}"/>

    <!-- rosto -->
    <path d="M398 462 C398 344 458 286 540 286 C622 286 682 344 682 462 C682 566 622 664 540 664 C458 664 398 566 398 462 Z" fill="${SKIN}"/>
    <!-- orelhas + brincos -->
    <ellipse cx="398" cy="492" rx="24" ry="34" fill="${SKIN}"/><ellipse cx="682" cy="492" rx="24" ry="34" fill="${SKIN}"/>
    <circle cx="398" cy="536" r="9" fill="${GOLD}"/><circle cx="682" cy="536" r="9" fill="${GOLD}"/>

    <!-- franja -->
    <path d="M404 452 C396 330 462 268 540 268 C618 268 684 330 676 452 C676 452 664 380 610 372 C556 364 552 396 540 396 C528 396 524 364 470 372 C416 380 404 452 404 452 Z" fill="${HAIR}"/>
    <!-- coque -->
    <ellipse cx="540" cy="248" rx="86" ry="52" fill="${HAIR}"/>

    <!-- sobrancelhas -->
    <path d="M444 420 Q474 404 506 416" fill="none" stroke="${HAIR}" stroke-width="11" stroke-linecap="round"/>
    <path d="M574 416 Q606 404 636 420" fill="none" stroke="${HAIR}" stroke-width="11" stroke-linecap="round"/>

    ${eyesSvg(blink)}

    <!-- nariz + blush -->
    <path d="M540 496 Q533 514 543 521" fill="none" stroke="${SKIN_D}" stroke-width="8" stroke-linecap="round"/>
    <ellipse cx="452" cy="530" rx="20" ry="12" fill="#E58A70" opacity="0.35"/>
    <ellipse cx="628" cy="530" rx="20" ry="12" fill="#E58A70" opacity="0.35"/>

    ${mouthSvg(visema)}

    <!-- fones de podcast -->
    <path d="M382 430 C374 288 452 214 540 214 C628 214 706 288 698 430" fill="none" stroke="${INKNAVY}" stroke-width="26" stroke-linecap="round"/>
    <rect x="356" y="428" width="52" height="110" rx="24" fill="${INKNAVY}"/>
    <rect x="672" y="428" width="52" height="110" rx="24" fill="${INKNAVY}"/>
    <rect x="366" y="444" width="10" height="78" rx="5" fill="${CYAN}"/>
    <rect x="704" y="444" width="10" height="78" rx="5" fill="${CYAN}"/>

    <!-- microfone (haste do fone) -->
    <path d="M700 540 C740 590 736 636 692 668" fill="none" stroke="${INKNAVY}" stroke-width="14" stroke-linecap="round"/>
    <ellipse cx="678" cy="676" rx="30" ry="22" fill="${INKNAVY}"/>
    <ellipse cx="678" cy="676" rx="18" ry="12" fill="${CYAN}" opacity="0.8"/>
  </svg>`;
}

// HTML com os 10 sprites lado a lado (formato .carousel-track que o
// renderCarousel screenshota um a um).
function buildAvatarSpritesHtml() {
  const frames = [];
  for (let v = 0; v < VISEMES.length; v++) {
    for (const blink of [false, true]) {
      frames.push(`<div class="f">${characterSvg(VISEMES[v], blink)}
        <div class="tag"><span class="a">Odonto</span><span class="b">Feed</span></div>
      </div>`);
    }
  }
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;}
.carousel-track{display:flex;}
.f{width:${AVATAR_W}px;height:${AVATAR_H}px;flex:0 0 ${AVATAR_W}px;position:relative;overflow:hidden;
  background:radial-gradient(130% 90% at 50% 10%,#17233b 0%,#0d1526 60%,#0A0E1A 100%);}
.f svg{position:absolute;inset:0;width:100%;height:100%;}
.tag{position:absolute;left:50%;bottom:26px;transform:translateX(-50%);
  font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:34px;letter-spacing:-1px;color:#EAF2F5;opacity:.85;}
.tag .b{color:#37D7E7;font-weight:700;}
</style></head><body><div class="carousel-track">${frames.join('')}</div></body></html>`;
  return { html, totalFrames: N_SPRITES };
}

// ── Envelope de áudio (RMS por frame) ────────────────────────────────────────
// Decodifica o MP3 para PCM cru (s16le mono 16 kHz) via ffmpeg e calcula o RMS
// de cada janela de 1/fps segundos. Retorna array de números >= 0 (bruto).
function audioEnvelope(audioPath, fps = 12) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const raw = path.join(tmp, 'a.pcm');
  try {
    execFileSync(FFMPEG, ['-y', '-i', audioPath, '-ac', '1', '-ar', '16000',
      '-f', 's16le', '-acodec', 'pcm_s16le', raw], { stdio: 'ignore' });
    const buf = fs.readFileSync(raw);
    const samplesPerFrame = Math.round(16000 / fps);
    const total = Math.floor(buf.length / 2);
    const env = [];
    for (let start = 0; start < total; start += samplesPerFrame) {
      const end = Math.min(total, start + samplesPerFrame);
      let acc = 0;
      for (let i = start; i < end; i++) {
        const s = buf.readInt16LE(i * 2) / 32768;
        acc += s * s;
      }
      env.push(Math.sqrt(acc / Math.max(1, end - start)));
    }
    return env;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ── Timeline de visemas (PURO) ───────────────────────────────────────────────

// Normaliza o envelope pelo percentil 95 (robusto a picos isolados).
function normalizeEnvelope(env) {
  if (!env.length) return [];
  const sorted = [...env].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 1;
  return env.map(v => Math.min(1, p95 > 0 ? v / p95 : 0));
}

// PRNG semeado (mulberry32) — piscadas reproduzíveis entre execuções.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Envelope normalizado → sequência run-length de sprites.
// opts: { fps, seed, minHold (frames mínimos por visema — anti-flicker) }.
// Retorna [{ sprite, frames, secs }] cuja soma de secs = env.length/fps.
function visemeTimeline(envNorm, { fps = 12, seed = 7, minHold = 2 } = {}) {
  const rand = mulberry32(seed);
  const n = envNorm.length;

  // 1. Suavização assimétrica: ataque instantâneo (a boca ABRE junto com a
  //    voz), queda gradual (não fecha num frame só).
  const level = new Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    prev = Math.max(envNorm[i], prev * 0.62);
    level[i] = prev;
  }

  // 2. Nível → visema, com hold mínimo contra tremedeira.
  const vis = new Array(n);
  let cur = 0, held = minHold;
  for (let i = 0; i < n; i++) {
    const v = level[i] < 0.07 ? 0 : level[i] < 0.22 ? 1 : level[i] < 0.45 ? 2 : level[i] < 0.72 ? 3 : 4;
    if (v !== cur && held >= minHold) { cur = v; held = 0; }
    held++;
    vis[i] = cur;
  }

  // 3. Piscadas: a cada 2–4,5 s, durando ~0,13 s.
  const blink = new Array(n).fill(false);
  const blinkLen = Math.max(1, Math.round(0.13 * fps));
  let t = Math.round((1.2 + rand() * 2.2) * fps);
  while (t < n) {
    for (let k = 0; k < blinkLen && t + k < n; k++) blink[t + k] = true;
    t += Math.round((2.0 + rand() * 2.5) * fps);
  }

  // 4. Run-length de sprites.
  const out = [];
  for (let i = 0; i < n; i++) {
    const sprite = vis[i] * 2 + (blink[i] ? 1 : 0);
    if (out.length && out[out.length - 1].sprite === sprite) out[out.length - 1].frames++;
    else out.push({ sprite, frames: 1 });
  }
  for (const seg of out) seg.secs = seg.frames / fps;
  return out;
}

module.exports = {
  AVATAR_W, AVATAR_H, VISEMES, N_SPRITES,
  buildAvatarSpritesHtml, characterSvg,
  audioEnvelope, normalizeEnvelope, visemeTimeline, mulberry32,
};
