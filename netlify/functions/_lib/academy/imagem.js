// ACADEMY — anonimização POR PADRÃO no upload (spec, Arquitetura).
//
// JPEG carrega metadados nos segmentos APPn (EXIF no APP1: data, GPS do
// celular, modelo do aparelho — tudo risco de identificação) e comentários
// (COM). Este filtro remove APP1..APP15 e COM preservando APP0/JFIF e os
// dados de imagem — determinístico, sem dependências. PNG passa intacto
// (tEXt é raro em exportação clínica; o manifesto avisa para conferir).
// A anonimização VISUAL (tarjar rosto) continua responsabilidade do dentista
// — a interface avisa.

function limparMetadadosJpeg(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) {
    return { buf, tipo: 'nao-jpeg', removidos: 0 };
  }
  const partes = [Buffer.from([0xFF, 0xD8])];
  let i = 2, removidos = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xFF) break; // fora de sincronia: preserva o resto como está
    const marcador = buf[i + 1];
    if (marcador === 0xDA) { partes.push(buf.slice(i)); i = buf.length; break; } // SOS: resto é imagem
    const len = buf.readUInt16BE(i + 2);
    const seg = buf.slice(i, i + 2 + len);
    const ehApp = marcador >= 0xE1 && marcador <= 0xEF; // APP1..APP15 (EXIF/XMP/etc.)
    const ehCom = marcador === 0xFE;
    if (ehApp || ehCom) removidos++;
    else partes.push(seg);
    i += 2 + len;
  }
  if (i < buf.length) partes.push(buf.slice(i));
  return { buf: Buffer.concat(partes), tipo: 'jpeg', removidos };
}

module.exports = { limparMetadadosJpeg };
