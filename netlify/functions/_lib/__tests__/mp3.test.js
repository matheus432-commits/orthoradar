// Tests do _lib/mp3.js — duração de MP3 CBR derivada do bitrate do frame header.
// O Cloud TTS gera MP3 32kbps (MPEG-2, 24kHz); a duração alimenta o
// <itunes:duration> do feed do Spotify.
// Run: node --test netlify/functions/_lib/__tests__/mp3.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { mp3DurationSecs, mp3BitrateKbps } = require('../mp3');

// Frame header sintético: [0xFF, b1, b2, 0]. b1 codifica versão/layer; b2 o bitrate.
function fakeMp3({ b1, b2, totalBytes }) {
  const buf = Buffer.alloc(totalBytes);
  buf[0] = 0xFF; buf[1] = b1; buf[2] = b2;
  return buf;
}

describe('mp3', () => {
  test('MPEG-2 Layer III 32kbps (formato do Cloud TTS): 40 kB → 10s', () => {
    // b1=0xF3: MPEG-2 + Layer III; b2=0x40: índice 4 → 32kbps na tabela V2
    const buf = fakeMp3({ b1: 0xF3, b2: 0x40, totalBytes: 40000 });
    assert.equal(mp3BitrateKbps(buf), 32);
    assert.equal(mp3DurationSecs(buf), 10); // 40000*8/32000
  });

  test('MPEG-1 Layer III 128kbps: 160 kB → 10s', () => {
    // b1=0xFB: MPEG-1 + Layer III; b2=0x90: índice 9 → 128kbps na tabela V1
    const buf = fakeMp3({ b1: 0xFB, b2: 0x90, totalBytes: 160000 });
    assert.equal(mp3BitrateKbps(buf), 128);
    assert.equal(mp3DurationSecs(buf), 10);
  });

  test('~8 minutos: edição completa de 3 episódios a 32kbps', () => {
    // 480s × 32.000 bits/s = 15.360.000 bits = 1.920.000 bytes
    const buf = fakeMp3({ b1: 0xF3, b2: 0x40, totalBytes: 1920000 });
    assert.equal(mp3DurationSecs(buf), 480);
  });

  test('concatenação CBR: duração soma (mesmo header no início)', () => {
    const a = fakeMp3({ b1: 0xF3, b2: 0x40, totalBytes: 40000 });
    const b = Buffer.alloc(80000); // continuação sem novo header no offset 0
    assert.equal(mp3DurationSecs(Buffer.concat([a, b])), 30); // 120000 bytes → 30s
  });

  test('buffer sem frame válido → null (nunca chuta duração)', () => {
    assert.equal(mp3DurationSecs(Buffer.alloc(1000)), null);
    assert.equal(mp3DurationSecs(Buffer.from('not an mp3 at all')), null);
    assert.equal(mp3DurationSecs(null), null);
  });
});
