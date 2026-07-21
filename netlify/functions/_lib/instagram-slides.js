// Gera o HTML do carrossel DIÁRIO do Instagram a partir dos artigos do dia.
//
// Mesma identidade da marca dos assets de estreia (navy #0A0E1A, ciano #37D7E7,
// dourado #EABF48, Space Grotesk + DM Sans). Estrutura: capa → 1 slide por
// estudo (alternando claro/escuro) → CTA. Cada slide traz a marca d'água
// odontofeed.com e a barra de progresso.
//
// Este módulo é PURO (só monta a string HTML) — a renderização em JPEG fica em
// instagram-render.js, que depende do navegador. Assim o gerador é testável.

const { escapeHtml } = require('./utils');
const { formatEvidenceLevel } = require('./instagram-generator');
const { corDe, capaFontPx } = require('./especialidade-identidade');

const TOOTH = 'M64 18 C46 18 34 30 34 48 C34 62 38 76 44 94 C47 103 55 103 57 94 L61 72 C62 66 66 66 67 72 L71 94 C73 103 81 103 84 94 C90 76 94 62 94 48 C94 30 82 18 64 18 Z';

function toothSvg(cls, toothColor, waveColor) {
  return `<svg class="${cls}" viewBox="0 0 130 118"><path d="${TOOTH}" fill="${toothColor}"/><g fill="none" stroke="${waveColor}" stroke-width="7" stroke-linecap="round"><path d="M83 30 A13 13 0 0 1 96 43"/><path d="M83 17 A26 26 0 0 1 109 43"/></g><circle cx="83" cy="43" r="5.4" fill="${waveColor}"/></svg>`;
}

function watermark(kind) {
  // kind: 'd' (dark), 'l' (light), 'g' (gradient)
  const tooth = kind === 'g' ? '#04222a' : '#37D7E7';
  const wave  = kind === 'g' ? '#04222a' : '#EABF48';
  return `<div class="wm wm-${kind}">${toothSvg('', tooth, wave)}odontofeed.com</div>`;
}

function progress(idx, total, light) {
  const pct = Math.round(((idx + 1) / total) * 100);
  const track = light ? 'rgba(0,0,0,.08)' : (light === null ? 'rgba(4,34,42,.15)' : 'rgba(255,255,255,.12)');
  const fill  = light ? '#37D7E7' : (light === null ? '#04222a' : '#fff');
  const cnt   = light ? 'rgba(0,0,0,.3)' : (light === null ? 'rgba(4,34,42,.45)' : 'rgba(255,255,255,.4)');
  return `<div class="prog"><div class="track" style="background:${track};"><div class="fill" style="width:${pct}%;background:${fill};"></div></div><span class="cnt" style="color:${cnt};">${idx + 1}/${total}</span></div>`;
}

function arrow(light) {
  const stroke = light ? 'rgba(0,0,0,.25)' : (light === null ? 'rgba(4,34,42,.35)' : 'rgba(255,255,255,.35)');
  return `<div class="arrow"><svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
}

// "2026-07-20" → "20 de julho"
function dateBrLong(dateStr) {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
    'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return '';
  return `${Number(m[3])} de ${meses[Number(m[2]) - 1]}`;
}

function truncate(s, n) {
  s = String(s || '').trim();
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';
}

// Um slide de estudo (alternando claro/escuro). A "tag" (especialidade) recebe
// a cor-assinatura da especialidade do dia — coesão com a capa.
function studySlide(article, idx, total, light, cor) {
  const bg   = light ? 'bg-light' : 'bg-dark';
  const muted = light ? 'muted-l' : 'muted-d';
  const esp = escapeHtml(article.especialidade || article.tema || 'Ciência odontológica');
  const evid = article.nivel_evidencia ? escapeHtml(formatEvidenceLevel(article.nivel_evidencia)) : '';
  const titulo = escapeHtml(truncate(article.titulo_pt || article.titulo || 'Estudo científico', 92));
  const fonte = [article.journal, article.year].filter(Boolean).map(escapeHtml).join(' · ');
  const snippet = escapeHtml(truncate(article.resumo_pt || article.impacto_pratico || '', 165));
  const tagColor = light ? shade(cor, -0.25) : cor; // legível no fundo claro

  return `
    <div class="slide ${bg} pad end" style="padding-bottom:130px;">
      ${watermark(light ? 'l' : 'd')}
      <span class="tag" style="color:${tagColor};">${esp}</span>
      ${evid ? `<span class="evid">${evid}</span>` : ''}
      <h2 class="hd serif">${titulo}</h2>
      ${fonte ? `<div class="fonte ${muted}">${fonte}</div>` : ''}
      ${snippet ? `<p class="body ${muted}">${snippet}</p>` : ''}
      ${progress(idx, total, light)}
      ${arrow(light)}
    </div>`;
}

// Escurece/clareia um hex (t<0 escurece, t>0 clareia) — para versões da cor
// legíveis em fundos claros.
function shade(hex, t) {
  const h = String(hex || '#37D7E7').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c) => Math.max(0, Math.min(255, Math.round(t < 0 ? c * (1 + t) : c + (255 - c) * t)));
  return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Monta o HTML do carrossel da ESPECIALIDADE DO DIA (capa colorida + estudos).
// Retorna { html, totalSlides }.
function buildDailyCarouselHtml(articles, opts = {}) {
  const list = (Array.isArray(articles) ? articles : []).filter(a => a && (a.titulo_pt || a.titulo)).slice(0, 5);
  const dateStr = opts.dateStr || new Date().toISOString().slice(0, 10);
  const especialidade = opts.especialidade || (list[0] && list[0].especialidade) || 'Ciência do dia';
  const cor = opts.cor || corDe(especialidade);
  const dataLonga = dateBrLong(dateStr);
  const total = list.length + 2; // capa + estudos + CTA

  const capa = `
    <div class="slide bg-dark pad capa" style="justify-content:space-between;align-items:center;text-align:center;">
      <div class="ghost" style="color:${cor}14;">${escapeHtml(especialidade.toUpperCase())}</div>
      <div class="topline">${toothSvg('', '#37D7E7', '#EABF48')}<div class="word serif"><span class="a">Odonto</span><span class="b">Feed.</span></div></div>
      <div class="capa-mid">
        <span class="tag gold">Edição de ${escapeHtml(dataLonga)}</span>
        <div class="esp serif" style="color:${cor};font-size:${capaFontPx(especialidade)}px;">${escapeHtml(especialidade)}</div>
        <div class="capa-rule" style="background:${cor};"></div>
        <p class="body muted-d" style="max-width:640px;">${list.length} ${list.length === 1 ? 'estudo selecionado' : 'estudos selecionados'} e resumidos pra sua clínica.</p>
      </div>
      <div class="capa-foot">odontofeed.com · 🎧 com narração</div>
      ${progress(0, total, false)}
    </div>`;

  const estudos = list.map((a, i) => studySlide(a, i + 1, total, i % 2 === 0, cor)).join('');

  const cta = `
    <div class="slide bg-grad pad" style="justify-content:center;">
      ${watermark('g')}
      <div style="text-align:center;width:100%;display:flex;flex-direction:column;align-items:center;gap:16px;">
        ${toothSvg('sym', '#04222a', '#04222a')}
        <h1 class="big serif" style="color:#04222a;">Leia os resumos<br>completos.</h1>
        <p class="body muted-g" style="margin-top:0;">Resumo escrito, áudio e artigo na íntegra —<br><b style="color:#04222a;">grátis, todos os dias.</b></p>
        <div class="cta-btn serif">Seguir @odontofeedbr</div>
        <div class="site" style="color:#04222a;">odontofeed.com</div>
      </div>
      ${progress(total - 1, total, null)}
    </div>`;

  return { html: wrapDocument(capa + estudos + cta), totalSlides: total };
}

// Envelope HTML com o design system (mesma base dos slides de estreia).
function wrapDocument(slidesHtml) {
  return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--cyan:#37D7E7;--cyan-l:#6FE6F1;--cyan-d:#1BA9B8;--gold:#EABF48;--navy:#0A0E1A;--light:#EEF3F6;--border:#DCE5EA;--ink:#0A0E1A;--muted:#5A6B78;}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:#000;font-family:'DM Sans',sans-serif;}
.serif{font-family:'Space Grotesk',sans-serif;}
.carousel-track{display:flex;}
.slide{width:1080px;height:1350px;flex:0 0 1080px;position:relative;overflow:hidden;display:flex;flex-direction:column;}
.bg-dark{background:radial-gradient(120% 90% at 50% 0%,#17233b 0%,#0d1526 55%,#0A0E1A 100%);color:#EAF2F5;}
.bg-light{background:var(--light);color:var(--ink);}
.bg-grad{background:linear-gradient(165deg,var(--cyan-d) 0%,var(--cyan) 55%,var(--cyan-l) 100%);color:#04222a;}
.pad{padding:0 88px;}
.slide.end{justify-content:flex-end;}
.slide.center{justify-content:center;}
.tag{align-self:flex-start;font-size:26px;font-weight:700;letter-spacing:5px;text-transform:uppercase;margin-bottom:26px;}
.tag.gold{color:var(--gold);}.tag.onlight{color:var(--cyan-d);}.tag.ondark{color:var(--cyan-l);}
.evid{align-self:flex-start;font-size:30px;font-weight:700;color:#04222a;background:var(--gold);padding:10px 24px;border-radius:40px;margin-bottom:22px;}
h1.big{font-size:86px;font-weight:700;letter-spacing:-1.5px;line-height:1.08;}
h2.hd{font-size:62px;font-weight:600;letter-spacing:-1px;line-height:1.14;}
.fonte{font-size:30px;font-weight:600;margin-top:20px;opacity:.85;}
p.body{font-size:37px;font-weight:400;line-height:1.5;margin-top:22px;}
.muted-d{color:rgba(234,242,245,.72);}.muted-l{color:var(--muted);}.muted-g{color:rgba(4,34,42,.8);}
.sym{width:190px;height:auto;display:block;filter:drop-shadow(0 12px 34px rgba(0,0,0,.4));}
.word{font-size:78px;letter-spacing:-3px;font-weight:600;line-height:1;}
.word .a{color:#EAF2F5;}.word .b{color:var(--cyan);font-weight:700;}
.cta-btn{display:inline-flex;align-items:center;padding:26px 54px;background:var(--navy);color:#fff;font-weight:700;font-size:37px;border-radius:60px;margin-top:8px;}
.site{font-size:38px;font-weight:700;letter-spacing:.5px;}
.wm{position:absolute;top:56px;left:88px;z-index:8;display:flex;align-items:center;gap:14px;font-size:30px;font-weight:600;}
.wm svg{width:40px;height:40px;}
.wm-d{color:rgba(234,242,245,.6);}.wm-l{color:var(--muted);}.wm-g{color:rgba(4,34,42,.7);}
.prog{position:absolute;bottom:0;left:0;right:0;padding:40px 72px 52px;z-index:10;display:flex;align-items:center;gap:26px;}
.prog .track{flex:1;height:8px;border-radius:5px;overflow:hidden;}
.prog .fill{height:100%;border-radius:5px;}
.prog .cnt{font-size:28px;font-weight:500;}
.arrow{position:absolute;right:0;top:0;bottom:0;width:120px;z-index:9;display:flex;align-items:center;justify-content:center;}
.arrow svg{width:56px;height:56px;}
/* Capa por especialidade */
.slide.capa{padding-top:96px;padding-bottom:130px;}
.slide.capa .ghost{position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-8deg);font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:200px;white-space:nowrap;letter-spacing:-6px;z-index:0;}
.slide.capa .topline{display:flex;align-items:center;gap:16px;z-index:2;}
.slide.capa .topline svg{width:60px;height:60px;}
.slide.capa .word{font-size:52px;}
.capa-mid{z-index:2;display:flex;flex-direction:column;align-items:center;gap:22px;}
.capa-mid .tag{align-self:center;margin-bottom:0;font-size:30px;}
.esp{font-weight:700;letter-spacing:-2px;line-height:.95;}
.capa-rule{width:150px;height:8px;border-radius:5px;}
.capa-foot{font-size:28px;letter-spacing:3px;text-transform:uppercase;color:rgba(234,242,245,.5);z-index:2;}
</style></head><body><div class="carousel-track">${slidesHtml}</div></body></html>`;
}

module.exports = { buildDailyCarouselHtml, dateBrLong, _studySlide: studySlide };
