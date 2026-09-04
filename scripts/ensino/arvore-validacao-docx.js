'use strict';
// Uso: node scripts/ensino/arvore-validacao-docx.js [pasta-de-saida]  (requer o pacote npm docx)
// Gera "Árvore de temas do OdontoFeed Campus — para validação" (DOCX + CSV)
// a partir de data/ensino-temas.json. Uso: node gerar-arvore-docx.js
const fs = require('fs');
const path = require('path');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, LevelFormat, PageBreak, BorderStyle, TableOfContents } = docx;

const RAIZ = path.join(__dirname, '..', '..');
const OUT = (process.argv[2] || process.cwd()).replace(/\/?$/, '/');
const doc = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data', 'ensino-temas.json'), 'utf8'));
const r = doc.resumo;

const GOLD = 'B08968', MUTED = '8A8478', INK = '1A1A18', SUTIL = 'F4EEE4', BORDA = 'EDE6D8';
const CICLO = { 'básico': 'Ciclo básico', 'pré-clínico': 'Pré-clínico', 'clínico': 'Clínico', 'pós': 'Especialização' };

const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts.run })], ...opts.par });
const muted = (text, size = 20) => new Paragraph({ children: [new TextRun({ text, color: MUTED, size })], spacing: { after: 80 } });
const cell = (text, w, opts = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: 'auto' } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: !!opts.bold, size: 18, color: opts.color || INK })] })],
});

const children = [];

// ── capa
children.push(new Paragraph({ spacing: { before: 2400, after: 120 }, children: [new TextRun({ text: 'OdontoFeed Campus', color: GOLD, size: 22, bold: true, allCaps: true, characterSpacing: 40 })] }));
children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: 'Árvore de temas para validação' })] }));
children.push(muted(`Versão ${doc.versao} · 1 de setembro de 2026 · ${r.areas} áreas · ${r.modulos} módulos · ${r.temas} temas · ${r.paginas.toLocaleString('pt-BR')} páginas de apostila`, 22));
children.push(new Paragraph({ spacing: { before: 400 }, children: [new TextRun({ text: 'Como validar', bold: true, size: 26 })] }));
for (const t of [
  'Cada área é uma disciplina da graduação ou uma especialidade reconhecida pelo CFO. Dentro dela, um módulo é um bloco de aulas, um tema é uma aula e uma página é um assunto dentro da aula. Cada página vai virar uma apostila ilustrada para o aluno e uma aula pronta com prova para o professor.',
  'O que precisamos de você, na sua especialidade: (1) falta algum tema ou página que se ensina hoje? (2) sobra algo que não se ensina mais ou não pertence a esta área? (3) algum nome está errado, desatualizado ou fora do jargão da sala de aula? (4) a ordem dos módulos faz sentido para dar a disciplina? (5) o nível está certo para graduação, ou é conteúdo só de especialização?',
  'Anote direto neste documento (comentários ou texto ao lado) ou na planilha que acompanha, uma linha por página, marcando na coluna "avaliação": OK, FALTA, SOBRA, RENOMEAR ou MOVER, com o comentário.',
  'Termo padronizado: Distalização (nunca Distanciamento). Nomes em linguagem comum, sigla só depois da palavra por extenso.',
]) children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, size: 21 })] }));

// ── sumário por área
children.push(new Paragraph({ children: [new PageBreak()] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Resumo por área' })] }));
const W = [3600, 1700, 900, 900, 1000, 1260];
const rows = [new TableRow({ tableHeader: true, children: ['Área', 'Ciclo', 'Módulos', 'Temas', 'Páginas', 'CFO'].map((h, i) => cell(h, W[i], { bold: true, shade: SUTIL, color: MUTED, right: i >= 2 && i <= 4 })) })];
for (const a of doc.areas) {
  let t = 0, pg = 0; for (const m of a.modulos) for (const te of m.temas) { t++; pg += te.paginas.length; }
  rows.push(new TableRow({ children: [cell(a.nome, W[0], { bold: true }), cell(CICLO[a.ciclo], W[1]), cell(a.modulos.length, W[2], { right: true }), cell(t, W[3], { right: true }), cell(pg, W[4], { right: true }), cell(a.cfo ? 'especialidade' : 'base', W[5], { color: a.cfo ? GOLD : MUTED })] }));
}
children.push(new Table({ width: { size: W.reduce((s, x) => s + x, 0), type: WidthType.DXA }, columnWidths: W, rows }));

// ── áreas
let nA = 0;
for (const a of doc.areas) {
  nA++;
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${CICLO[a.ciclo]}${a.cfo ? ' · especialidade reconhecida pelo CFO' : ' · disciplina de base'}`, color: GOLD, size: 18, bold: true, allCaps: true, characterSpacing: 30 })] }));
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${nA}. ${a.nome}` })] }));
  children.push(muted(a.descricao, 21));
  let nM = 0;
  for (const m of a.modulos) {
    nM++;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: `${nA}.${nM} ${m.nome}` })] }));
    let nT = 0;
    for (const t of m.temas) {
      nT++;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: `${nA}.${nM}.${nT} ${t.nome}` }), new TextRun({ text: `   ${t.paginas.length} página${t.paginas.length > 1 ? 's' : ''}`, color: MUTED, size: 18, bold: false })] }));
      for (const pg of t.paginas) children.push(new Paragraph({ numbering: { reference: 'pag', level: 0 }, spacing: { after: 20 }, children: [new TextRun({ text: pg.nome, size: 20 })] }));
    }
  }
  children.push(new Paragraph({ spacing: { before: 240, after: 60 }, border: { top: { style: BorderStyle.SINGLE, size: 6, color: BORDA } }, children: [new TextRun({ text: 'Notas do validador', bold: true, size: 20, color: GOLD })] }));
  for (let i = 0; i < 3; i++) children.push(new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: BORDA } }, children: [new TextRun({ text: ' ' })] }));
}

const d = new Document({
  creator: 'OdontoFeed',
  title: 'OdontoFeed Campus — árvore de temas para validação',
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21, color: INK } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: 'Georgia', size: 52, bold: false, color: INK }, paragraph: { spacing: { after: 160 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Georgia', size: 34, bold: false, color: INK }, paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 24, bold: true, color: GOLD }, paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 22, bold: true, color: INK }, paragraph: { spacing: { before: 160, after: 40 }, outlineLevel: 2 } },
    ],
  },
  numbering: { config: [{ reference: 'pag', levels: [{ level: 0, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 560, hanging: 280 } }, run: { color: GOLD } } }] }] },
  sections: [{
    properties: { page: { margin: { top: 1300, bottom: 1200, left: 1400, right: 1300 } } },
    children,
  }],
});

Packer.toBuffer(d).then((buf) => {
  fs.writeFileSync(path.join(OUT, 'campus-arvore-validacao.docx'), buf);
  // CSV: uma linha por página, separador ; e BOM para o Excel em pt-BR
  const linhas = ['ciclo;area;modulo;tema;pagina;id;avaliacao (OK/FALTA/SOBRA/RENOMEAR/MOVER);comentario'];
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
  for (const a of doc.areas) for (const m of a.modulos) for (const t of m.temas) for (const pg of t.paginas) linhas.push([CICLO[a.ciclo], a.nome, m.nome, t.nome, pg.nome, pg.id, '', ''].map(q).join(';'));
  fs.writeFileSync(path.join(OUT, 'campus-arvore-validacao.csv'), '﻿' + linhas.join('\r\n') + '\r\n');
  console.log('docx', buf.length, 'bytes; csv', linhas.length - 1, 'linhas');
});
