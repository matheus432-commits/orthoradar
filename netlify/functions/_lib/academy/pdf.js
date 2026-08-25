// ACADEMY — gerador de PDF sem dependências (texto, Helvetica, WinAnsi — a
// codificação cobre o português). Para o manuscrito e documentos do pacote;
// figuras seguem como arquivos próprios nomeados (as legendas vão no texto).

// WinAnsi ≈ latin-1: converte, trocando o que não existir por '?'.
function _winAnsi(s) {
  const out = [];
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0);
    out.push(code <= 0xFF ? code : 0x3F);
  }
  return Buffer.from(out);
}
const _escPdf = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

// Quebra o texto em linhas de até `larguraChars` sem cortar palavra.
function _quebrar(texto, larguraChars) {
  const linhas = [];
  for (const par of String(texto || '').split('\n')) {
    if (!par.trim()) { linhas.push(''); continue; }
    let atual = '';
    for (const palavra of par.split(/\s+/)) {
      if ((atual + ' ' + palavra).trim().length > larguraChars) { linhas.push(atual); atual = palavra; }
      else atual = (atual ? atual + ' ' : '') + palavra;
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

// blocos: mesmos do docx ({tipo, texto}) → Buffer PDF (A4, multi-página).
function criarPdf(blocos, { titulo = 'Documento' } = {}) {
  const LINHAS_POR_PAGINA = 44, LARGURA = 92;
  // Achata blocos em linhas tipadas.
  const linhas = [];
  for (const b of blocos) {
    const grande = b.tipo === 'titulo1', medio = b.tipo === 'titulo2';
    const larg = grande ? 60 : medio ? 74 : LARGURA;
    for (const l of _quebrar(b.texto, larg)) linhas.push({ t: l, negrito: grande || medio || b.tipo === 'negrito', tam: grande ? 16 : medio ? 13 : 11 });
    linhas.push({ t: '', negrito: false, tam: 11 });
  }
  // Paginação.
  const paginas = [];
  for (let i = 0; i < linhas.length; i += LINHAS_POR_PAGINA) paginas.push(linhas.slice(i, i + LINHAS_POR_PAGINA));
  if (!paginas.length) paginas.push([{ t: '', negrito: false, tam: 11 }]);

  // Objetos: 1 catálogo, 2 pages, 3 fonte normal, 4 fonte bold, 5.. páginas+conteúdos.
  const objetos = [];
  const push = (corpo) => { objetos.push(corpo); return objetos.length; }; // ids 1-based

  const catalogoId = push(null); // placeholder
  const pagesId = push(null);
  const fontN = push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const fontB = push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageIds = [];
  for (const pg of paginas) {
    let y = 800;
    const cmds = ['BT'];
    for (const l of pg) {
      y -= l.tam + 6;
      if (l.t) cmds.push(`/${l.negrito ? 'FB' : 'FN'} ${l.tam} Tf 1 0 0 1 56 ${y} Tm (${_escPdf(_winAnsi(l.t).toString('latin1'))}) Tj`);
    }
    cmds.push('ET');
    const stream = Buffer.from(cmds.join('\n'), 'latin1');
    const contId = push(`<< /Length ${stream.length} >>\nstream\n${stream.toString('latin1')}\nendstream`);
    const pageId = push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contId} 0 R /Resources << /Font << /FN ${fontN} 0 R /FB ${fontB} 0 R >> >> >>`);
    pageIds.push(pageId);
  }

  objetos[catalogoId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objetos[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] >>`;

  // Serializa com xref.
  let corpo = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [0];
  for (let i = 0; i < objetos.length; i++) {
    offsets.push(Buffer.byteLength(corpo, 'latin1'));
    corpo += `${i + 1} 0 obj\n${objetos[i]}\nendobj\n`;
  }
  const xrefPos = Buffer.byteLength(corpo, 'latin1');
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objetos.length; i++) corpo += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(corpo, 'latin1');
}

module.exports = { criarPdf };
