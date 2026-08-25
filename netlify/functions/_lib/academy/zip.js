// ACADEMY — escritor de ZIP sem dependências (método STORE, suficiente para
// o pacote de entrega e para o contêiner do DOCX). Zero npm: a plataforma
// inteira roda em https/zlib nativos e aqui não é diferente.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// entradas: [{ nome: 'word/document.xml', dados: Buffer|string }]
function criarZip(entradas) {
  const locais = [];
  const centrais = [];
  let offset = 0;
  const agoraDos = 0x2100; // hora DOS fixa (determinístico p/ testes)
  const dataDos = ((2026 - 1980) << 9) | (8 << 5) | 25;

  for (const e of entradas) {
    const nome = Buffer.from(e.nome, 'utf8');
    const dados = Buffer.isBuffer(e.dados) ? e.dados : Buffer.from(String(e.dados), 'utf8');
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // versão
    local.writeUInt16LE(0x0800, 6);    // flag: nomes UTF-8
    local.writeUInt16LE(0, 8);         // método STORE
    local.writeUInt16LE(agoraDos, 10);
    local.writeUInt16LE(dataDos, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nome, dados);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(agoraDos, 12);
    central.writeUInt16LE(dataDos, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(dados.length, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(offset, 42);
    centrais.push(Buffer.concat([central, nome]));

    offset += 30 + nome.length + dados.length;
  }

  const centralBuf = Buffer.concat(centrais);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entradas.length, 8);
  eocd.writeUInt16LE(entradas.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, centralBuf, eocd]);
}

module.exports = { criarZip, crc32 };
