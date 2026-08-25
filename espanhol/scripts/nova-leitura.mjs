#!/usr/bin/env node
/*
 * Adiciona um texto de leitura ao acervo e reconstrói o app.
 *
 *   node espanhol/scripts/nova-leitura.mjs caminho/para/texto.json
 *
 * O JSON deve ter:
 *   { titulo, tema: odonto|negocios|viajes|rutina, nivel: A2|B1|B2,
 *     resumen, fuente, url,
 *     frases:   [{es, pt}, ...]   (8 a 12 frases)
 *     glosario: [{es, pt}, ...]   (4 a 8 termos)
 *     preguntas:[ "...", ... ]    (3 perguntas para responder em voz alta) }
 * O campo "id" é atribuído automaticamente.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(raiz, 'src/data/lecturas');

const entrada = process.argv[2];
if (!entrada) { console.error('uso: nova-leitura.mjs <arquivo.json>'); process.exit(1); }

const t = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const erros = [];
for (const c of ['titulo', 'tema', 'nivel', 'resumen', 'frases'])
  if (!t[c]) erros.push('campo obrigatório ausente: ' + c);
if (!['odonto', 'negocios', 'viajes', 'rutina'].includes(t.tema))
  erros.push('tema inválido: ' + t.tema);
if (!['A2', 'B1', 'B2'].includes(t.nivel)) erros.push('nível inválido: ' + t.nivel);
if (!Array.isArray(t.frases) || t.frases.length < 6)
  erros.push('são necessárias ao menos 6 frases');
(t.frases || []).forEach((f, i) => {
  if (!f?.es || !f?.pt) erros.push(`frase ${i + 1} precisa de "es" e "pt"`);
});
if (erros.length) { console.error('Inválido:\n- ' + erros.join('\n- ')); process.exit(1); }

const existentes = fs.readdirSync(dir).filter(f => /^L\d+\.json$/.test(f));
const proximo = existentes.reduce((m, f) => Math.max(m, +f.slice(1, 4)), 0) + 1;
t.id = 'L' + String(proximo).padStart(3, '0');
t.glosario ||= [];
t.preguntas ||= [];
t.agregado = new Date().toISOString().slice(0, 10);

const destino = path.join(dir, t.id + '.json');
fs.writeFileSync(destino, JSON.stringify(t, null, 1) + '\n');
console.log('gravado:', path.relative(process.cwd(), destino), '·', t.frases.length, 'frases');

execFileSync('node', [path.join(raiz, 'build.mjs')], { stdio: 'inherit' });
