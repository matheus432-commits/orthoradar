// Cliente do talking head realista (HeyGen) — partes puras.
// Run: node --test netlify/functions/_lib/__tests__/talking-head.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildGeneratePayload, parseVideoStatus, estimateCostUsd } = require('../talking-head');

describe('buildGeneratePayload', () => {
  test('personagem talking_photo + voz de ÁUDIO próprio (nunca TTS do provedor)', () => {
    const p = buildGeneratePayload({ talkingPhotoId: 'tp1', audioAssetId: 'au1', width: 1080, height: 960 });
    assert.equal(p.video_inputs[0].character.type, 'talking_photo');
    assert.equal(p.video_inputs[0].character.talking_photo_id, 'tp1');
    assert.equal(p.video_inputs[0].voice.type, 'audio');
    assert.equal(p.video_inputs[0].voice.audio_asset_id, 'au1');
    assert.deepEqual(p.dimension, { width: 1080, height: 960 });
  });
  test('exige os dois ids', () => {
    assert.throws(() => buildGeneratePayload({ talkingPhotoId: 'tp1' }));
    assert.throws(() => buildGeneratePayload({ audioAssetId: 'au1' }));
  });
});

describe('parseVideoStatus', () => {
  test('completed com video_url → done', () => {
    const st = parseVideoStatus({ data: { status: 'completed', video_url: 'https://x/v.mp4' } });
    assert.equal(st.done, true);
    assert.equal(st.failed, false);
    assert.equal(st.videoUrl, 'https://x/v.mp4');
  });
  test('failed ou campo error → failed com mensagem', () => {
    assert.equal(parseVideoStatus({ data: { status: 'failed' } }).failed, true);
    const st = parseVideoStatus({ data: { status: 'processing', error: { message: 'bad audio' } } });
    assert.equal(st.failed, true);
    assert.match(st.error, /bad audio/);
  });
  test('processing → nem done nem failed (continua o poll)', () => {
    const st = parseVideoStatus({ data: { status: 'processing' } });
    assert.equal(st.done, false);
    assert.equal(st.failed, false);
  });
  test('resposta vazia/malformada não explode', () => {
    assert.equal(parseVideoStatus(null).done, false);
    assert.equal(parseVideoStatus({}).status, 'unknown');
  });
});

describe('estimateCostUsd', () => {
  test('estimativa por minuto (default US$3/min)', () => {
    assert.equal(estimateCostUsd(60, 3), 3);
    assert.equal(estimateCostUsd(90, 3), 4.5);
    assert.equal(estimateCostUsd(150, 2), 5);
    assert.equal(estimateCostUsd(0, 3), 0);
  });
});
