#!/usr/bin/env node
'use strict';
// CAMPUS — gera o índice das apostilas (data/campus/indice.json) a partir das
// páginas em data/campus/paginas/*.json e monta a prévia autocontida
// docs/prototipos/campus-preview.html (campus.html + dados embutidos), para
// abrir no navegador sem servidor. Idempotente.
//
//   node scripts/campus-indice.js

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const { problemasDaPagina, capa } = require('../netlify/functions/_lib/campus/pagina');
const { taxonomia, resumo } = require('../netlify/functions/_lib/ensino/taxonomia');

const dir = path.join(RAIZ, 'data', 'campus', 'paginas');
const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const idsArvore = new Set();
for (const a of taxonomia().areas) for (const m of a.modulos) for (const t of m.temas) for (const p of t.paginas) idsArvore.add(p.id);

const paginas = {};
const capas = [];
for (const f of arquivos) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const problemas = problemasDaPagina(p);
  if (problemas.length) throw new Error(f + ': ' + problemas.join('; '));
  if (!idsArvore.has(p.id)) throw new Error(f + ': id fora da árvore: ' + p.id);
  if (paginas[p.id]) throw new Error(f + ': id repetido');
  paginas[p.id] = p;
  capas.push({ ...capa(p), arquivo: 'paginas/' + f });
}

const indice = {
  geradoEm: new Date().toISOString().slice(0, 10),
  arvore: resumo(),
  apostilas: capas,
};
fs.writeFileSync(path.join(RAIZ, 'data', 'campus', 'indice.json'), JSON.stringify(indice, null, 1) + '\n');

// Prévia: campus.html com os dados embutidos (árvore compacta + índice + páginas).
const html = fs.readFileSync(path.join(RAIZ, 'campus.html'), 'utf8');
const arv = taxonomia().areas.map((a) => ({ id: a.id, nome: a.nome, ciclo: a.ciclo, status: a.statusRotulo, descricao: a.descricao, nota: a.nota || '', modulos: a.modulos.map((m) => ({ nome: m.nome, temas: m.temas.map((t) => ({ nome: t.nome, paginas: t.paginas.map((p) => ({ id: p.id, nome: p.nome })) })) })) }));
const dados = JSON.stringify({ arvore: arv, indice, paginas }).replace(/<\/script/gi, '<\\/script');
const marca = '<script>';
const i = html.indexOf(marca);
if (i < 0) throw new Error('campus.html sem <script>');
const preview = html.slice(0, i) + '<script>window.CAMPUS_DADOS=' + dados + ';</script>\n' + html.slice(i);
fs.mkdirSync(path.join(RAIZ, 'docs', 'prototipos'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'docs', 'prototipos', 'campus-preview.html'), preview);
console.log('índice:', capas.length, 'apostilas; prévia:', (preview.length / 1024).toFixed(0), 'KB');
