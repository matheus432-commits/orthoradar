'use strict';
// Uso: node scripts/ensino/arvore-validacao-pdf.js [pasta-de-saida]  (requer playwright-core + Chromium)
// Versão impressa da árvore (HTML → PDF via Chromium), mesma estrutura do DOCX.
const fs = require('fs');
const { chromium } = require('playwright-core');
const doc = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', '..', 'data', 'ensino-temas.json'), 'utf8'));
const OUT = (process.argv[2] || process.cwd()).replace(/\/?$/, '/');
const r = doc.resumo;
const CICLO = { 'básico': 'Ciclo básico', 'pré-clínico': 'Pré-clínico', 'clínico': 'Clínico', 'pós': 'Especialização' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let h = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>OdontoFeed Campus — árvore de temas para validação</title><style>
@page{size:A4;margin:16mm 15mm 18mm 16mm;}
body{font-family:Calibri,'Segoe UI',system-ui,sans-serif;color:#1A1A18;font-size:10.5pt;line-height:1.45;margin:0;}
.eyebrow{font-size:8.5pt;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#B08968;margin:0 0 4px;}
h1.titulo{font-family:Georgia,serif;font-weight:400;font-size:26pt;margin:0 0 6px;}
.muted{color:#8A8478;}
.capa{padding-top:70mm;}
.capa p{max-width:150mm;}
.capa h3{font-size:12pt;margin:18px 0 6px;}
.area{page-break-before:always;}
.area h1{font-family:Georgia,serif;font-weight:400;font-size:18pt;margin:0 0 2px;}
.area .desc{color:#8A8478;margin:0 0 10px;}
h2{font-size:11.5pt;color:#B08968;margin:14px 0 3px;page-break-after:avoid;}
h3{font-size:10.5pt;margin:8px 0 2px;page-break-after:avoid;}
h3 small{font-weight:400;color:#8A8478;font-size:8.5pt;margin-left:6px;}
ul{margin:0 0 0 14px;padding:0;list-style:none;}
li{margin:0 0 1px;padding-left:10px;text-indent:-10px;}
li::before{content:'–  ';color:#B08968;}
.notas{margin-top:14px;border-top:1px solid #EDE6D8;padding-top:4px;color:#B08968;font-weight:700;font-size:9.5pt;page-break-inside:avoid;}
.linha{border-bottom:1px dotted #D8CDB8;height:16px;}
table{border-collapse:collapse;width:100%;font-size:9.5pt;}
th{text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:1px;color:#8A8478;background:#F4EEE4;padding:5px 7px;border-bottom:1px solid #D8CDB8;}
td{padding:4px 7px;border-bottom:1px solid #EDE6D8;}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;}
.cfo{color:#B08968;font-weight:700;}
</style></head><body>
<div class="capa"><p class="eyebrow">OdontoFeed Campus</p><h1 class="titulo">Árvore de temas para validação</h1>
<p class="muted">Versão ${doc.versao} · 1 de setembro de 2026 · ${r.areas} áreas · ${r.modulos} módulos · ${r.temas} temas · ${r.paginas.toLocaleString('pt-BR')} páginas de apostila</p>
<h3>Como validar</h3>
<p>Cada área é uma disciplina da graduação ou uma especialidade reconhecida pelo CFO. Dentro dela, um módulo é um bloco de aulas, um tema é uma aula e uma página é um assunto dentro da aula. Cada página vai virar uma apostila ilustrada para o aluno e uma aula pronta com prova para o professor.</p>
<p>O que precisamos de você, na sua especialidade: (1) falta algum tema ou página que se ensina hoje? (2) sobra algo que não se ensina mais ou não pertence a esta área? (3) algum nome está errado, desatualizado ou fora do jargão da sala de aula? (4) a ordem dos módulos faz sentido para dar a disciplina? (5) o nível está certo para graduação, ou é conteúdo só de especialização?</p>
<p>Anote na versão Word deste documento (comentários ou texto ao lado) ou na planilha que acompanha, uma linha por página, marcando na coluna "avaliação": OK, FALTA, SOBRA, RENOMEAR ou MOVER, com o comentário.</p>
<p>Termo padronizado: Distalização (nunca Distanciamento). Nomes em linguagem comum, sigla só depois da palavra por extenso.</p></div>
<div class="area"><h1>Resumo por área</h1><table><thead><tr><th>Área</th><th>Ciclo</th><th class="n">Módulos</th><th class="n">Temas</th><th class="n">Páginas</th><th>CFO</th></tr></thead><tbody>`;
for (const a of doc.areas) { let t = 0, pg = 0; for (const m of a.modulos) for (const te of m.temas) { t++; pg += te.paginas.length; }
  h += `<tr><td><b>${esc(a.nome)}</b></td><td>${CICLO[a.ciclo]}</td><td class="n">${a.modulos.length}</td><td class="n">${t}</td><td class="n">${pg}</td><td>${a.cfo ? '<span class="cfo">especialidade</span>' : '<span class="muted">base</span>'}</td></tr>`; }
h += '</tbody></table></div>';
let nA = 0;
for (const a of doc.areas) { nA++;
  h += `<div class="area"><p class="eyebrow">${CICLO[a.ciclo]}${a.cfo ? ' · especialidade reconhecida pelo CFO' : ' · disciplina de base'}</p><h1>${nA}. ${esc(a.nome)}</h1><p class="desc">${esc(a.descricao)}</p>`;
  let nM = 0;
  for (const m of a.modulos) { nM++; h += `<h2>${nA}.${nM} ${esc(m.nome)}</h2>`; let nT = 0;
    for (const t of m.temas) { nT++; h += `<h3>${nA}.${nM}.${nT} ${esc(t.nome)}<small>${t.paginas.length} página${t.paginas.length > 1 ? 's' : ''}</small></h3><ul>${t.paginas.map((p) => '<li>' + esc(p.nome) + '</li>').join('')}</ul>`; } }
  h += '<div class="notas">Notas do validador</div><div class="linha"></div><div class="linha"></div><div class="linha"></div></div>';
}
h += '</body></html>';
fs.writeFileSync(OUT + 'campus-arvore-validacao.html', h);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage();
  await p.goto('file://' + OUT + 'campus-arvore-validacao.html');
  await p.pdf({ path: OUT + 'campus-arvore-validacao.pdf', format: 'A4', printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: '<div style="width:100%;font-size:8px;color:#8A8478;text-align:center;font-family:sans-serif;">OdontoFeed Campus · árvore de temas para validação · página <span class="pageNumber"></span> de <span class="totalPages"></span></div>' });
  await b.close();
  console.log('pdf ok');
})();
