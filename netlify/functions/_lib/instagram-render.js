// Renderiza o HTML do carrossel em JPEGs 1080×1350 (formato do Instagram) via
// Chromium/Playwright. Usado só no pipeline (GitHub Actions), onde o navegador
// está instalado — por isso o require do playwright é preguiçoso e tolerante.

const log = require('./logger');

// Resolve o playwright em diferentes ambientes (node_modules local, global do
// runner, ou caminho do browser pré-instalado).
function loadChromium() {
  const candidates = ['playwright', 'playwright-core',
    '/opt/node22/lib/node_modules/playwright'];
  for (const mod of candidates) {
    try { return require(mod).chromium; } catch { /* tenta o próximo */ }
  }
  throw new Error('Playwright não encontrado — instale com "npx playwright install chromium"');
}

const SLIDE_W = 1080;
const SLIDE_H = 1350;

// Renderiza cada slide da faixa (.carousel-track) num JPEG. Retorna Buffer[].
async function renderCarousel(html, totalSlides, opts = {}) {
  const chromium = loadChromium();
  const execPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

  const browser = await chromium.launch({
    executablePath: execPath,
    args: ['--no-sandbox', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE_W, height: SLIDE_H },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(opts.fontWaitMs || 3000); // fontes do Google

    const buffers = [];
    for (let i = 0; i < totalSlides; i++) {
      await page.evaluate((idx) => {
        const track = document.querySelector('.carousel-track');
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + (-idx * 1080) + 'px)';
      }, i);
      await page.waitForTimeout(250);
      const buf = await page.screenshot({
        type: 'jpeg', quality: 92,
        clip: { x: 0, y: 0, width: SLIDE_W, height: SLIDE_H },
      });
      buffers.push(buf);
    }
    log.info('[instagram] slides renderizados', { total: buffers.length });
    return buffers;
  } finally {
    await browser.close();
  }
}

module.exports = { renderCarousel, SLIDE_W, SLIDE_H };
