// Tests do gerador de HTML do carrossel diário do Instagram.
// Run: node --test netlify/functions/_lib/__tests__/instagram-slides.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildDailyCarouselHtml, dateBrLong } = require('../instagram-slides');

const articles = [
  { pmid: '1', especialidade: 'Endodontia', nivel_evidencia: 'Meta-análise', titulo_pt: 'Instrumentação reciprocante vs rotatória', journal: 'J Endod', year: '2026', resumo_pt: 'Menor dor em 24h com reciprocantes.' },
  { pmid: '2', especialidade: 'Implantodontia', nivel_evidencia: 'RCT', titulo_pt: 'Carga imediata em implantes', journal: 'COIR', year: '2026', resumo_pt: 'Sobrevida de 97,5%.' },
  { pmid: '3', especialidade: 'Periodontia', nivel_evidencia: 'Revisão Sistemática', titulo_pt: 'Terapia fotodinâmica adjunta', journal: 'JCP', year: '2026', resumo_pt: 'Ganho modesto de inserção.' },
];

describe('instagram-slides — carrossel diário', () => {
  test('dateBrLong formata data em português', () => {
    assert.equal(dateBrLong('2026-07-20'), '20 de julho');
    assert.equal(dateBrLong('2026-01-05'), '5 de janeiro');
    assert.equal(dateBrLong('lixo'), '');
  });

  test('total de slides = capa + estudos + CTA', () => {
    const { totalSlides } = buildDailyCarouselHtml(articles, { dateStr: '2026-07-20' });
    assert.equal(totalSlides, 5); // 1 capa + 3 estudos + 1 CTA
  });

  test('capa mostra a data, a especialidade em destaque e a contagem de estudos', () => {
    const { html } = buildDailyCarouselHtml(articles, { dateStr: '2026-07-20', especialidade: 'Endodontia' });
    assert.ok(html.includes('20 de julho'));
    assert.ok(html.includes('3 estudos selecionados'));
    // Nome da especialidade grande na capa + cor-assinatura aplicada
    assert.ok(/<div class="esp serif"[^>]*>Endodontia<\/div>/.test(html));
    assert.ok(html.includes('#FFB020')); // âmbar da Endodontia
    assert.ok(html.includes('Edição de'));
  });

  test('cada estudo aparece com título, especialidade e nível de evidência', () => {
    const { html } = buildDailyCarouselHtml(articles, { dateStr: '2026-07-20' });
    assert.ok(html.includes('Instrumentação reciprocante vs rotatória'));
    assert.ok(html.includes('ENDODONTIA') || html.includes('Endodontia'));
    assert.ok(html.includes('Meta-análise'));
    assert.ok(html.includes('Carga imediata em implantes'));
    assert.ok(html.includes('Terapia fotodinâmica adjunta'));
  });

  test('marca d\'água odontofeed.com em todos os slides + CTA com @odontofeedbr', () => {
    const { html, totalSlides } = buildDailyCarouselHtml(articles, { dateStr: '2026-07-20' });
    assert.equal((html.match(/odontofeed\.com/g) || []).length >= totalSlides, true);
    assert.ok(html.includes('@odontofeedbr'));
    assert.ok(html.includes('Leia os resumos'));
  });

  test('limita a 5 estudos (carrossel máximo 7 slides)', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ pmid: String(i), especialidade: 'Ortodontia', titulo_pt: 'Estudo ' + i, journal: 'J', year: '2026', resumo_pt: 'r' }));
    const { totalSlides } = buildDailyCarouselHtml(many, { dateStr: '2026-07-20' });
    assert.equal(totalSlides, 7); // 1 + 5 + 1
  });

  test('escapa HTML no conteúdo dos artigos (sem injeção)', () => {
    const evil = [{ pmid: 'x', especialidade: 'Teste', titulo_pt: '<script>alert(1)</script>', journal: 'J', year: '2026', resumo_pt: 'ok' },
                  { pmid: 'y', especialidade: 'Teste', titulo_pt: 'B', journal: 'J', year: '2026', resumo_pt: 'ok' }];
    const { html } = buildDailyCarouselHtml(evil, { dateStr: '2026-07-20' });
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });
});
