// REEL COM AVATAR — o formato vertical que mais viraliza: tela 1080×1920
// dividida em 2 metades. EM CIMA, as cenas ilustradas sincronizadas com a
// narração (mesma sincronia do reel atual); EMBAIXO, a apresentadora virtual
// do OdontoFeed falando (lip-sync por amplitude — ver _lib/avatar.js).
//
// Montagem 100% ffmpeg (sem custo por vídeo):
//   topo   = clipes Ken Burns por cena (1080×960) concatenados;
//   base   = sprites do avatar em concat demuxer com duração por visema;
//   final  = vstack(topo, base) + áudio real do episódio.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { escapeHtml } = require('./utils');
const { AVATAR_W, AVATAR_H } = require('./avatar');
const log = require('./logger');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const W = 1080, H = 1920;
const TOP_W = AVATAR_W, TOP_H = H - AVATAR_H; // 1080×960

// ── Metade de cima: cenas compactas (1080×960) ───────────────────────────────
// Visual da marca (mesma linguagem do reel), adaptado à metade: rótulo +
// ilustração + frase. Capa e outro também compactos.
function buildTopHtml({ especialidade, cor, dataLonga, cenas }) {
  const meio = cenas.filter(c => c.tipo === 'cena');
  const accent = cor || '#37D7E7';

  const cover = `<div class="f cover">
    <div class="word"><span class="a">Odonto</span><span class="b">Feed.</span></div>
    <div class="kicker">Edição de ${escapeHtml(dataLonga || 'hoje')}</div>
    <div class="esp" style="color:${accent};">${escapeHtml(especialidade || '')}</div>
    <div class="rule" style="background:${accent};"></div>
  </div>`;

  const sceneDivs = meio.map(c => `<div class="f scene">
    <div class="s-rotulo">${escapeHtml(c.rotulo || '')}</div>
    ${c.imgSrc
    ? `<div class="row"><div class="illo"><img src="${c.imgSrc}" alt=""></div><div class="s-frase">${escapeHtml(c.frase || '')}</div></div>`
    : `<div class="s-frase center">${escapeHtml(c.frase || '')}</div>`}
  </div>`).join('');

  const outro = `<div class="f outro">
    <div class="o-title">Ouça o episódio completo</div>
    <div class="o-btn">Seguir @odontofeedbr</div>
    <div class="o-site">odontofeed.com · Spotify</div>
  </div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;font-family:'DM Sans',sans-serif;}
.carousel-track{display:flex;}
.f{width:${TOP_W}px;height:${TOP_H}px;flex:0 0 ${TOP_W}px;position:relative;overflow:hidden;display:flex;flex-direction:column;
  align-items:center;justify-content:center;text-align:center;gap:22px;padding:70px 70px;color:#EAF2F5;
  background:radial-gradient(120% 90% at 50% 0%,#17233b 0%,#0d1526 60%,#0A0E1A 100%);}
.word,.kicker,.esp,.s-rotulo,.s-frase,.o-title{font-family:'Space Grotesk',sans-serif;}
.word{font-size:52px;letter-spacing:-2px;font-weight:600;}.word .a{color:#EAF2F5;}.word .b{color:#37D7E7;font-weight:700;}
.kicker{font-size:28px;letter-spacing:5px;text-transform:uppercase;color:#EABF48;font-weight:600;}
.esp{font-size:96px;font-weight:700;letter-spacing:-2px;line-height:.95;}
.rule{width:120px;height:7px;border-radius:5px;}
.scene{justify-content:flex-start;padding-top:56px;gap:26px;}
.s-rotulo{font-size:30px;letter-spacing:5px;text-transform:uppercase;color:#EABF48;font-weight:700;}
.row{display:flex;align-items:center;gap:44px;text-align:left;}
.illo{width:420px;height:420px;flex:0 0 420px;display:flex;align-items:center;justify-content:center;}
.illo img{max-width:100%;max-height:100%;border-radius:32px;}
.s-frase{font-size:50px;font-weight:600;letter-spacing:-1px;line-height:1.18;color:#EAF2F5;}
.s-frase.center{text-align:center;max-width:880px;margin:auto 0;font-size:56px;}
.outro{background:linear-gradient(165deg,#1BA9B8 0%,#37D7E7 60%,#6FE6F1 100%);color:#04222a;gap:30px;}
.o-title{font-size:74px;font-weight:700;letter-spacing:-2px;line-height:1.05;color:#04222a;max-width:820px;}
.o-btn{background:#0A0E1A;color:#fff;font-family:'Space Grotesk';font-weight:700;font-size:38px;padding:24px 52px;border-radius:60px;}
.o-site{font-size:30px;font-weight:700;color:#04222a;}
</style></head><body><div class="carousel-track">${cover}${sceneDivs}${outro}</div></body></html>`;

  return { html, totalFrames: meio.length + 2 };
}

// ── Montagem (ffmpeg) ────────────────────────────────────────────────────────
// topFrames: PNG Buffers (1 por segmento) · topDurations: segundos (mesma ordem)
// spriteBuffers: PNG Buffers dos 10 sprites do avatar
// timeline: [{ sprite, secs }] (run-length do lip-sync)
// audioPath: MP3 do episódio. Retorna Buffer do MP4 1080×1920 30fps.
function assembleSplitVideo({ topFrames, topDurations, spriteBuffers, timeline, audioPath }) {
  if (topFrames.length !== topDurations.length) throw new Error('topFrames e topDurations devem ter o mesmo tamanho');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-reel-'));
  try {
    // Metade de cima: clipes Ken Burns por cena → concat.
    const clips = [];
    for (let i = 0; i < topFrames.length; i++) {
      const png = path.join(tmp, `t${i}.png`);
      fs.writeFileSync(png, topFrames[i]);
      const d = Math.max(1, topDurations[i]);
      const out = path.join(tmp, `tc${i}.mp4`);
      const zexpr = i % 2 === 0 ? 'min(zoom+0.0006,1.10)' : 'if(lte(zoom,1.0),1.10,max(1.001,zoom-0.0006))';
      execFileSync(FFMPEG, ['-y', '-loop', '1', '-i', png, '-t', String(d),
        '-vf', `scale=${TOP_W * 1.5}:${TOP_H * 1.5},zoompan=z='${zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(d * 30)}:s=${TOP_W}x${TOP_H}:fps=30,format=yuv420p`,
        '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], { stdio: 'ignore' });
      clips.push(out);
    }
    const topList = path.join(tmp, 'top.txt');
    fs.writeFileSync(topList, clips.map(c => `file '${c}'`).join('\n'));
    const topMp4 = path.join(tmp, 'top.mp4');
    execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', topList,
      '-c', 'copy', topMp4], { stdio: 'ignore' });

    // Metade de baixo: sprites em concat demuxer com a duração de cada visema.
    for (let i = 0; i < spriteBuffers.length; i++) {
      fs.writeFileSync(path.join(tmp, `s${i}.png`), spriteBuffers[i]);
    }
    const lines = [];
    for (const seg of timeline) {
      lines.push(`file 's${seg.sprite}.png'`);
      lines.push(`duration ${seg.secs.toFixed(4)}`);
    }
    // Regra do concat demuxer: o último arquivo se repete sem duration.
    if (timeline.length) lines.push(`file 's${timeline[timeline.length - 1].sprite}.png'`);
    const botList = path.join(tmp, 'bottom.txt');
    fs.writeFileSync(botList, lines.join('\n'));
    const botMp4 = path.join(tmp, 'bottom.mp4');
    execFileSync(FFMPEG, ['-y', '-f', 'concat', '-safe', '0', '-i', botList,
      '-vf', `fps=30,scale=${AVATAR_W}:${AVATAR_H},format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', botMp4], { stdio: 'ignore' });

    // Empilha e casa com o áudio real.
    const total = topDurations.reduce((a, b) => a + b, 0);
    const outMp4 = path.join(tmp, 'avatar-reel.mp4');
    execFileSync(FFMPEG, ['-y', '-i', topMp4, '-i', botMp4, '-i', audioPath,
      '-filter_complex', `[0:v][1:v]vstack=inputs=2,fade=t=out:st=${Math.max(0, total - 0.5)}:d=0.5[v]`,
      '-map', '[v]', '-map', '2:a',
      '-af', 'apad', '-t', String(total),
      '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', outMp4], { stdio: 'ignore' });

    const buf = fs.readFileSync(outMp4);
    log.info('[avatar-reel] vídeo montado', { secs: total, mb: (buf.length / 1e6).toFixed(1) });
    return buf;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { buildTopHtml, assembleSplitVideo, TOP_W, TOP_H, REEL_W: W, REEL_H: H };
