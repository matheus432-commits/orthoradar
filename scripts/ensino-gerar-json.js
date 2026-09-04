#!/usr/bin/env node
'use strict';
// Gera data/ensino-temas.json a partir da fonte em _lib/ensino (para o site,
// o artefato e qualquer consumidor sem Node). Idempotente: mesma entrada,
// mesmo arquivo.
//
//   node scripts/ensino-gerar-json.js

const fs = require('fs');
const path = require('path');
const { taxonomia, resumo } = require('../netlify/functions/_lib/ensino/taxonomia');

const destino = path.join(__dirname, '..', 'data', 'ensino-temas.json');
const t = taxonomia();
const doc = {
  versao: t.versao,
  geradoPor: 'scripts/ensino-gerar-json.js (fonte: netlify/functions/_lib/ensino/temas-*.js)',
  notas: [
    'Taxonomia de ensino para aluno (apostilas/guias) e professor (aulas/provas).',
    'Base: DCN Odontologia (Res. CNE/CES 3/2021), portarias do ENADE, ementas públicas de faculdades e conteúdos programáticos de editais.',
    'Termo canônico: Distalização (nunca Distanciamento). Zero emojis.',
  ],
  resumo: resumo(),
  areas: t.areas,
};
fs.writeFileSync(destino, JSON.stringify(doc, null, 1) + '\n');
console.log('gravado', path.relative(process.cwd(), destino), JSON.stringify(doc.resumo));
