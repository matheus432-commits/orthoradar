// Monta o Reel vertical (1080×1920): frames HTML no visual aprovado (protótipo
// 20/07 — capa com especialidade em destaque, cenas híbridas ilustração+frase,
// outro com CTA) e vídeo final via ffmpeg com o ÁUDIO REAL do episódio.
//
// Cada cena permanece na tela pela duração calculada em reel-scenes
// (proporcional ao trecho narrado) — a imagem certa no momento certo do áudio.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { escapeHtml } = require('./utils');
const log = require('./logger');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const W = 1080, H = 1920;

const TOOTH = 'M64 18 C46 18 34 30 34 48 C34 62 38 76 44 94 C47 103 55 103 57 94 L61 72 C62 66 66 66 67 72 L71 94 C73 103 81 103 84 94 C90 76 94 62 94 48 C94 30 82 18 64 18 Z';
function tooth(w, tc, wc) { return `<svg style="width:${w}px" viewBox="0 0 130 118"><path d="${TOOTH}" fill="${tc}"/><g fill="none" stroke="${wc}" stroke-width="7" stroke-linecap="round"><path d="M83 30 A13 13 0 0 1 96 43"/><path d="M83 17 A26 26 0 0 1 109 43"/></g><circle cx="83" cy="43" r="5.4" fill="${wc}"/></svg>`; }

// ── HTML dos frames ──────────────────────────────────────────────────────────

// cenas: [{ tipo:'capa'|'cena'|'outro', rotulo, frase, imgSrc }] — imgSrc é a
// URL pública (ou data URI) da ilustração; capa/outro não usam imagem.
function buildReelHtml({ especialidade, tituloEstudo, dataLonga, cenas }) {
  const meio = cenas.filter(c => c.tipo === 'cena');

  const cover = `<div class="f cover">
    <div class="topline">${tooth(64, '#37D7E7', '#EABF48')}<div class="word"><span class="a">Odonto</span><span class="b">Feed.</span></div></div>
    <div class="cov-mid">
      <div class="kicker">${escapeHtml(especialidade)} · ${escapeHtml(dataLonga || 'Edição de hoje')}</div>
      <div class="title">${escapeHtml(tituloEstudo || '')}</div>
      <div class="rule"></div>
      <div class="meta">🎧 Narrado · acompanhe cada passo</div>
    </div>
    <div class="cov-foot">odontofeed.com</div>
  </div>`;

  const sceneDivs = meio.map((c, i) => `<div class="f scene">
    <div class="wm">${tooth(44, '#37D7E7', '#EABF48')}odontofeed.com</div>
    <div class="s-rotulo">${escapeHtml(c.rotulo || '')}</div>
    <div class="illo">${c.imgSrc ? `<img src="${c.imgSrc}" alt="">` : ''}</div>
    <div class="s-frase">${escapeHtml(c.frase || '')}</div>
    <div class="listening"><span class="bar b1"></span><span class="bar b2"></span><span class="bar b3"></span><span class="bar b4"></span> no áudio agora</div>
    <div class="dots">${meio.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div>
  </div>`).join('');

  const outro = `<div class="f outro">
    ${tooth(140, '#04222a', '#04222a')}
    <div class="o-title">Ouça o episódio<br>completo</div>
    <div class="o-sub">Resumo, áudio e artigo na íntegra — <b>grátis.</b></div>
    <div class="o-btn">Seguir @odontofeedbr</div>
    <div class="o-site">odontofeed.com · Spotify · Apple Podcasts</div>
  </div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;font-family:'DM Sans',sans-serif;}
.carousel-track{display:flex;}
.f{width:${W}px;height:${H}px;flex:0 0 ${W}px;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;text-align:center;padding:120px 90px;color:#EAF2F5;
  background:radial-gradient(120% 70% at 50% 0%,#17233b 0%,#0d1526 55%,#0A0E1A 100%);}
.word,.title,.o-title,.kicker,.s-rotulo,.s-frase{font-family:'Space Grotesk',sans-serif;}
.cover{justify-content:space-between;}
.topline{display:flex;flex-direction:column;align-items:center;gap:20px;}
.word{font-size:64px;letter-spacing:-2px;font-weight:600;}.word .a{color:#EAF2F5;}.word .b{color:#37D7E7;font-weight:700;}
.cov-mid{display:flex;flex-direction:column;align-items:center;gap:24px;}
.kicker{font-size:34px;letter-spacing:5px;text-transform:uppercase;color:#EABF48;font-weight:600;}
.title{font-size:76px;font-weight:700;letter-spacing:-1.5px;line-height:1.1;color:#EAF2F5;max-width:900px;}
.rule{width:140px;height:8px;background:#EABF48;border-radius:5px;}
.meta{font-size:38px;color:rgba(234,242,245,.8);}
.cov-foot{font-size:32px;letter-spacing:4px;text-transform:uppercase;color:rgba(234,242,245,.5);}
.scene{justify-content:space-between;padding-top:150px;}
.wm{position:absolute;top:60px;left:86px;display:flex;align-items:center;gap:14px;font-size:32px;font-weight:600;color:rgba(234,242,245,.6);}
.s-rotulo{font-size:40px;letter-spacing:6px;text-transform:uppercase;color:#EABF48;font-weight:700;margin-top:40px;}
.illo{width:640px;height:640px;display:flex;align-items:center;justify-content:center;}
.illo img{max-width:100%;max-height:100%;border-radius:40px;}
.s-frase{font-size:68px;font-weight:600;letter-spacing:-1px;line-height:1.16;color:#EAF2F5;max-width:880px;}
.listening{display:flex;align-items:center;gap:10px;font-size:32px;color:rgba(234,242,245,.65);}
.bar{display:inline-block;width:9px;border-radius:5px;background:#37D7E7;}
.b1{height:26px;}.b2{height:44px;}.b3{height:18px;}.b4{height:36px;}
.dots{display:flex;gap:16px;}
.dots span{width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.22);}
.dots span.on{background:#EABF48;width:58px;border-radius:12px;}
.outro{justify-content:center;gap:30px;background:linear-gradient(165deg,#1BA9B8 0%,#37D7E7 55%,#6FE6F1 100%);color:#04222a;}
.o-title{font-size:104px;font-weight:700;letter-spacing:-2px;line-height:1.06;color:#04222a;}
.o-sub{font-size:44px;color:rgba(4,34,42,.85);}
.o-btn{background:#0A0E1A;color:#fff;font-family:'Space Grotesk';font-weight:700;font-size:46px;padding:32px 64px;border-radius:70px;}
.o-site{font-size:36px;font-weight:700;color:#04222a;}
</style></head><body><div class="carousel-track">${cover}${sceneDivs}${outro}</div></body></html>`;

  return { html, totalFrames: meio.length + 2 };
}

// ── Montagem do vídeo (ffmpeg) ───────────────────────────────────────────────

// frames: PNG Buffers (1 por segmento, na ordem); durations: segundos por frame
// (mesma ordem — a soma deve ≈ duração do áudio); audioPath: mp3 do episódio.
// Retorna o Buffer do MP4 final (H.264 + AAC, 1080×1920, 30fps).
function assembleVideo(frames, durations, audioPath) {
  if (frames.length !== durations.length) throw new Error('frames e durations devem ter o mesmo tamanho');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  try {
    const clips = [];
    for (let i = 0; i < frames.length; i++) {
      const png = path.join(tmp, `f${i}.png`);
      fs.writeFileSync(png, frames[i]);
      const d = Math.max(1, durations[i]);
      const out = path.join(tmp, `c${i}.mp4`);
      // Ken Burns sutil (zoom in/out alternado) para o frame estático "respirar".
      const zexpr = i % 2 === 0 ? "min(zoom+0.0006,1.10)" : "if(lte(zoom,1.0),1.10,max(1.001,zoom-0.0006))";
      execFileSync(FFMPEG, ['-y', '-loop', '1', '-i', png, '-t', String(d),
        '-vf', `scale=${W * 1.5}:${H * 1.5},zoompan=z='${zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(d * 30)}:s=${W}x${H}:fps=30,format=yuv420p`,
        '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', out],
        { stdio: 'ignore' });
      clips.push(out);
    }

    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, clips.map(c => `file '${c}'`).join('\n'));
    const total = durations.reduce((a, b) => a + b, 0);
    const outMp4 = path.join(tmp, 'reel.mp4');
    // Áudio real do episódio; apad completa com silêncio se o vídeo passar do
    // áudio (ex.: outro além da despedida); corta no fim do vídeo (-shortest
    // não serve aqui — o master é o vídeo, via -t).
    execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', list,
      '-i', audioPath,
      '-vf', `fade=t=in:st=0:d=0.4,fade=t=out:st=${Math.max(0, total - 0.5)}:d=0.5`,
      '-af', 'apad',
      '-t', String(total),
      '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', outMp4], { stdio: 'ignore' });

    const buf = fs.readFileSync(outMp4);
    log.info('[reel] vídeo montado', { secs: total, mb: (buf.length / 1e6).toFixed(1) });
    return buf;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { buildReelHtml, assembleVideo, REEL_W: W, REEL_H: H };
