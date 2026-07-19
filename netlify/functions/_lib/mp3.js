// Utilitários mínimos de MP3 para o podcast.
//
// O áudio do Cloud TTS é MP3 CBR (bitrate constante) — a duração pode ser
// derivada do tamanho: secs = bytes*8 / bitrate. Lemos o bitrate do primeiro
// frame header válido (Layer III, MPEG1 ou MPEG2/2.5), sem dependências.
// Usada para publicar <itunes:duration> e o length real do enclosure no RSS.

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]; // kbps
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];     // kbps (MPEG2/2.5)

// Bitrate (kbps) do primeiro frame Layer III válido; null se não achar.
function mp3BitrateKbps(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  const limit = Math.min(buf.length - 4, 64 * 1024); // header fica no começo
  for (let i = 0; i < limit; i++) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) continue;
    const versionBits = (buf[i + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits   = (buf[i + 1] >> 1) & 3; // 1=Layer III
    if (layerBits !== 1 || versionBits === 1) continue;
    const idx = (buf[i + 2] >> 4) & 15;
    if (idx === 0 || idx === 15) continue; // free/bad
    const kbps = (versionBits === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[idx];
    if (kbps) return kbps;
  }
  return null;
}

// Duração em segundos (inteiro) de um MP3 CBR; null quando não dá para saber.
function mp3DurationSecs(buf) {
  const kbps = mp3BitrateKbps(buf);
  if (!kbps || !buf.length) return null;
  return Math.round((buf.length * 8) / (kbps * 1000));
}

module.exports = { mp3DurationSecs, mp3BitrateKbps };
