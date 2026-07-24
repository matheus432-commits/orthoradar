// Motor de lip-sync do avatar (visemeTimeline) — regras que garantem que a
// boca acompanha a voz e o vídeo nunca sai com tremedeira ou dessincronia.
// Run: node --test netlify/functions/_lib/__tests__/avatar.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEnvelope, visemeTimeline, buildAvatarSpritesHtml,
  VISEMES, N_SPRITES,
} = require('../avatar');

const FPS = 12;
const sum = (tl, f) => tl.reduce((a, s) => a + s[f], 0);

describe('normalizeEnvelope', () => {
  test('escala pelo p95 e limita a 1 (robusto a pico isolado)', () => {
    const env = new Array(99).fill(0.1).concat([10]); // 1 pico absurdo
    const norm = normalizeEnvelope(env);
    assert.ok(Math.max(...norm) <= 1);
    assert.ok(norm[0] > 0.5, 'os valores comuns não podem ser esmagados pelo pico');
  });
  test('vazio → vazio; silêncio → zeros', () => {
    assert.deepEqual(normalizeEnvelope([]), []);
    assert.deepEqual(normalizeEnvelope([0, 0, 0]), [0, 0, 0]);
  });
});

describe('visemeTimeline', () => {
  test('a soma das durações é exatamente a duração do áudio', () => {
    const env = Array.from({ length: 240 }, (_, i) => (i % 7) / 7); // 20s @12fps
    const tl = visemeTimeline(env, { fps: FPS, seed: 7 });
    assert.ok(Math.abs(sum(tl, 'secs') - 240 / FPS) < 1e-6);
    assert.equal(sum(tl, 'frames'), 240);
  });

  test('silêncio → boca fechada; voz alta → boca aberta', () => {
    const silencio = visemeTimeline(new Array(48).fill(0), { fps: FPS, seed: 7 });
    assert.ok(silencio.every(s => Math.floor(s.sprite / 2) === 0), 'silêncio = visema fechado');

    const alto = visemeTimeline(new Array(48).fill(1), { fps: FPS, seed: 7 });
    const abertos = alto.filter(s => Math.floor(s.sprite / 2) >= 3);
    assert.ok(sum(abertos, 'frames') > 40, 'voz no máximo = boca aberta/larga quase o tempo todo');
  });

  test('determinístico com a mesma seed; muda com seed diferente (piscadas)', () => {
    const env = Array.from({ length: 360 }, () => 0.5);
    const a = visemeTimeline(env, { fps: FPS, seed: 7 });
    const b = visemeTimeline(env, { fps: FPS, seed: 7 });
    assert.deepEqual(a, b);
    const c = visemeTimeline(env, { fps: FPS, seed: 99 });
    assert.notDeepEqual(a, c, 'seed diferente agenda piscadas diferentes');
  });

  test('anti-flicker: visema não troca antes do hold mínimo', () => {
    // alternância propositalmente frenética
    const env = Array.from({ length: 120 }, (_, i) => (i % 2 ? 1 : 0));
    const tl = visemeTimeline(env, { fps: FPS, seed: 7, minHold: 3 });
    // reconstrói a série de visemas por frame e mede os trechos contíguos
    const serie = [];
    for (const s of tl) for (let k = 0; k < s.frames; k++) serie.push(Math.floor(s.sprite / 2));
    let runs = [], cur = serie[0], len = 0;
    for (const v of serie) { if (v === cur) len++; else { runs.push(len); cur = v; len = 1; } }
    runs.push(len);
    // os trechos INTERMEDIÁRIOS respeitam o hold (o 1º é o estado inicial e o
    // último é o rabo do áudio — ambos podem ser mais curtos por definição)
    assert.ok(runs.slice(1, -1).every(r => r >= 3), `trechos: ${runs.join(',')}`);
  });

  test('piscadas existem em áudio longo e duram pouco', () => {
    const env = new Array(FPS * 30).fill(0.4); // 30s falando
    const tl = visemeTimeline(env, { fps: FPS, seed: 7 });
    const piscando = tl.filter(s => s.sprite % 2 === 1);
    assert.ok(piscando.length >= 4, 'em 30s deve piscar várias vezes');
    assert.ok(sum(piscando, 'secs') < 3, 'piscadas são breves (não fica de olho fechado)');
  });
});

describe('sprites', () => {
  test('html traz os 10 sprites (5 bocas × 2 olhos) no formato carousel-track', () => {
    const { html, totalFrames } = buildAvatarSpritesHtml();
    assert.equal(totalFrames, N_SPRITES);
    assert.equal(N_SPRITES, VISEMES.length * 2);
    assert.equal((html.match(/class="f"/g) || []).length, N_SPRITES);
    assert.ok(html.includes('carousel-track'));
  });
});
