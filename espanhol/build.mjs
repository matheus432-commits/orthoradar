#!/usr/bin/env node
/* Gera espanhol/index.html (documento completo) e espanhol/artifact.html (fragmento p/ Artifact). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

const lecturas = fs.readdirSync(path.join(raiz, 'src/data/lecturas'))
  .filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(ler('src/data/lecturas/' + f)));

const DB = {
  frequencia: ler('src/data/frequencia.txt'),
  falsos:     ler('src/data/falsos-amigos.txt'),
  tematico:   ler('src/data/tematico.txt'),
  conversa:   JSON.parse(ler('src/data/conversa.json')),
  lecturas,
  build:      new Date().toISOString().slice(0, 10),
};

const corpo = [
  ler('src/app.html'),
  '<script>window.DB=' + JSON.stringify(DB).replace(/<\//g, '<\\/') + ';</script>',
  '<script>\n' + ler('src/core.js') + '\n</script>',
  '<script>\n' + ler('src/views.js') + '\n</script>',
].join('\n');

fs.writeFileSync(path.join(raiz, 'artifact.html'), corpo);
fs.writeFileSync(path.join(raiz, 'index.html'),
  '<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n' + corpo + '\n</html>\n');

const kb = (p) => (fs.statSync(path.join(raiz, p)).size / 1024).toFixed(0) + ' KB';
console.log('index.html    ', kb('index.html'));
console.log('artifact.html ', kb('artifact.html'));
console.log('palavras 1000:', DB.frequencia.trim().split('\n').length);
console.log('falsos amigos:', DB.falsos.trim().split('\n').length);
console.log('temáticas    :', DB.tematico.trim().split('\n').length);
console.log('leituras     :', lecturas.length, '/ frases:', lecturas.reduce((a, l) => a + l.frases.length, 0));
