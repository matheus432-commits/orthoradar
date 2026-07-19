// Utilitários mínimos de MP3 para o podcast.
//
// O áudio do Cloud TTS é MP3 CBR (bitrate constante) — a duração pode ser
// derivada do tamanho: secs = bytes*8 / bitrate. Lemos o primeiro frame
// header válido (Layer III, MPEG1 ou MPEG2/2.5), sem dependências.
// Usos: <itunes:duration> / length do RSS e a PAUSA entre estudos da edição
// completa (frames de silêncio fabricados no MESMO formato do áudio do TTS).

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]; // kbps
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];     // kbps (MPEG2/2.5)
const SAMPLE_RATES   = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// Primeiro frame Layer III válido do buffer → parâmetros do stream.
// Retorna { kbps, sampleRate, versionBits, samplesPerFrame, frameLen, header }.
function mp3FrameInfo(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  const limit = Math.min(buf.length - 4, 64 * 1024); // header fica no começo
  for (let i = 0; i < limit; i++) {
    if (buf[i] !== 0xFF || (buf[i + 1] & 0xE0) !== 0xE0) continue;
    const versionBits = (buf[i + 1] >> 3) & 3; // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const layerBits   = (buf[i + 1] >> 1) & 3; // 1=Layer III
    if (layerBits !== 1 || versionBits === 1) continue;
    const bIdx = (buf[i + 2] >> 4) & 15;
    const sIdx = (buf[i + 2] >> 2) & 3;
    if (bIdx === 0 || bIdx === 15 || sIdx === 3) continue; // free/bad
    const kbps       = (versionBits === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bIdx];
    const sampleRate = SAMPLE_RATES[versionBits]?.[sIdx];
    if (!kbps || !sampleRate) continue;
    const samplesPerFrame = versionBits === 3 ? 1152 : 576;
    const frameLen = Math.floor((samplesPerFrame / 8) * kbps * 1000 / sampleRate); // sem padding
    return { kbps, sampleRate, versionBits, samplesPerFrame, frameLen, header: Buffer.from(buf.subarray(i, i + 4)) };
  }
  return null;
}

// Bitrate (kbps) do primeiro frame Layer III válido; null se não achar.
function mp3BitrateKbps(buf) {
  return mp3FrameInfo(buf)?.kbps ?? null;
}

// Duração em segundos (inteiro) de um MP3 CBR; null quando não dá para saber.
function mp3DurationSecs(buf) {
  const kbps = mp3BitrateKbps(buf);
  if (!kbps || !buf.length) return null;
  return Math.round((buf.length * 8) / (kbps * 1000));
}

// Fabrica ~ms de SILÊNCIO no mesmo formato de refBuf (pausa entre estudos da
// edição completa). Clona o header do stream de referência (mesma versão,
// bitrate e sample rate — decoders não veem mudança de formato) com o corpo
// zerado: side info nula = frame decodificado como silêncio. Ajustes no clone:
// protection bit ligado (sem CRC — corpo zerado não teria CRC válido) e
// padding bit desligado (frameLen fixo). Retorna null se refBuf for ilegível
// (chamador concatena sem pausa — nunca quebra a compilação).
function mp3Silence(refBuf, ms) {
  const info = mp3FrameInfo(refBuf);
  if (!info || !(ms > 0)) return null;
  const header = Buffer.from(info.header);
  header[1] |= 0x01;  // protection bit = 1 (sem CRC)
  header[2] &= ~0x02; // padding bit = 0
  const frame = Buffer.alloc(info.frameLen);
  header.copy(frame, 0);
  const frameMs = (info.samplesPerFrame / info.sampleRate) * 1000;
  const nFrames = Math.max(1, Math.round(ms / frameMs));
  return Buffer.concat(Array(nFrames).fill(frame));
}

module.exports = { mp3DurationSecs, mp3BitrateKbps, mp3FrameInfo, mp3Silence };
