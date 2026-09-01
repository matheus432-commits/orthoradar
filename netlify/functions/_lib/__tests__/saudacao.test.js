// Tests da SAUDAÇÃO que substituiu a Nota Editorial (diretriz do fundador,
// 01/09: "existe uma adoção muito pequena na nota editorial (...) e nos
// consome crédito. vamos eliminar a nota editorial, faça somente uma breve
// saudação para convidar a edição do dia").
//
// O que precisa ficar travado: (a) a saudação é DETERMINÍSTICA — nenhuma
// chamada de IA no caminho do envio; (b) o mesmo dia gera sempre o mesmo
// texto (regeneração/reenvio precisam ser idempotentes); (c) é BREVE, uma
// frase; (d) o pipeline não chama mais o gerador via Claude.
//
// Run: node --test netlify/functions/_lib/__tests__/saudacao.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const src = (f) => fs.readFileSync(path.join(FUNCS, f), 'utf8');
const { saudacaoDoDia, ABERTURAS } = require('../saudacao');

describe('saudação do dia — conteúdo', () => {
  test('convida à edição citando especialidade e quantidade', () => {
    const s = saudacaoDoDia({ especialidade: 'Ortodontia', n: 3, data: '2026-09-01' });
    assert.match(s, /Ortodontia/);
    assert.match(s, /3 estudos selecionados/);
    assert.ok(/leitura|estudos\./i.test(s), 'tem um fecho convidativo');
  });
  test('é BREVE: uma frase curta, sem parágrafos (o oposto da nota editorial)', () => {
    const s = saudacaoDoDia({ especialidade: 'Periodontia', n: 3, data: '2026-09-01' });
    assert.ok(!s.includes('\n'), 'sem quebra de linha');
    assert.ok(s.length < 180, 'até ~180 caracteres, era 4-5 parágrafos: ' + s.length);
    assert.ok(s.split(/\s+/).length < 30, 'menos de 30 palavras');
  });
  test('singular x plural', () => {
    assert.match(saudacaoDoDia({ especialidade: 'DTM', n: 1, data: '2026-09-01' }), /1 estudo selecionado\b/);
    assert.match(saudacaoDoDia({ especialidade: 'DTM', n: 2, data: '2026-09-01' }), /2 estudos selecionados\b/);
  });
  test('nunca sai quebrada em entrada vazia/ausente', () => {
    for (const arg of [undefined, {}, { n: 0 }, { especialidade: '', n: null, data: '' }]) {
      const s = saudacaoDoDia(arg);
      assert.ok(s && typeof s === 'string' && s.length > 10, JSON.stringify(arg));
      assert.ok(!/undefined|NaN|null/.test(s), 'sem lixo no texto: ' + s);
    }
  });
});

describe('saudação do dia — determinismo (custo zero e reenvio idempotente)', () => {
  test('mesma data + mesma edição = texto IDÊNTICO (regerar não muda o e-mail)', () => {
    const a = saudacaoDoDia({ especialidade: 'Ortodontia', n: 3, data: '2026-09-01' });
    const b = saudacaoDoDia({ especialidade: 'Ortodontia', n: 3, data: '2026-09-01' });
    assert.equal(a, b);
  });
  test('datas diferentes variam a abertura (não fica idêntico todo dia)', () => {
    const datas = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
    const textos = new Set(datas.map(d => saudacaoDoDia({ especialidade: 'Ortodontia', n: 3, data: d })));
    assert.ok(textos.size > 1, 'a abertura precisa variar entre dias');
    assert.ok(ABERTURAS.length >= 3, 'variedade suficiente no repertório');
  });
  test('função PURA: sem require de rede/IA no módulo', () => {
    const code = src('_lib/saudacao.js');
    assert.ok(!/require\(/.test(code), 'saudação não depende de nada — nem do logger');
    assert.ok(!/anthropic|api\.anthropic|fetch|request\(/i.test(code), 'nenhuma chamada externa');
  });
});

describe('pipeline — a nota editorial por IA saiu de vez', () => {
  test('daily-digest não chama mais o gerador via Claude', () => {
    const dd = src('daily-digest.js');
    assert.ok(!dd.includes('generateEditorial('), 'sem chamada ao gerador');
    assert.ok(!dd.includes('editorial-generator'), 'sem require do módulo');
    assert.ok(dd.includes('saudacaoDoDia({'), 'usa a saudação determinística');
  });
  test('o módulo gerador foi removido do repositório', () => {
    assert.equal(fs.existsSync(path.join(FUNCS, '_lib', 'editorial-generator.js')), false);
  });
  test('e-mail: bloco sem o rótulo "Nota Editorial" e sem geradora morta', () => {
    const et = src('_lib/email-template.js');
    assert.ok(!/>\s*Nota Editorial\s*</.test(et), 'rótulo removido do cabeçalho da edição');
    assert.ok(!/function generateEditorialIntro/.test(et), 'geradora determinística antiga removida');
    assert.ok(et.includes('saudacaoDoDia('), 'fallback do template monta a mesma frase');
  });
  test('o texto do e-mail continua escapado (a saudação entra em HTML)', () => {
    const et = src('_lib/email-template.js');
    assert.match(et, /esc\(saudacaoDoDia\(/, 'fallback escapado');
  });
});
