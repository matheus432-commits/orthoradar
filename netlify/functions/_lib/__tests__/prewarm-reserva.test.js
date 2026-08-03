// Pré-aquecimento da reserva: garante banco profundo de candidatos vivos por
// especialidade ANTES do e-mail, no job de ingestão (fora do orçamento de 180s).
// Aqui testamos a decisão pura de quanto ingerir (a orquestração toca NCBI, que o
// CI local não alcança).

const { test } = require('node:test');
const assert = require('node:assert');
const pw = require('../../prewarm-reserva');

test('banco já no alvo → não ingere nada (idempotente, custo zero)', () => {
  assert.strictEqual(pw.planejarIngestao(25, 25, 18), 0);
  assert.strictEqual(pw.planejarIngestao(40, 25, 18), 0);
});

test('banco fino → ingere o déficit + folga de 4', () => {
  assert.strictEqual(pw.planejarIngestao(20, 25, 18), 9);  // 25-20+4
  assert.strictEqual(pw.planejarIngestao(18, 25, 18), 11); // 25-18+4
});

test('banco vazio → respeita o teto por execução (não estoura tempo/custo)', () => {
  assert.strictEqual(pw.planejarIngestao(0, 25, 18), 18);  // min(18, 29)
  assert.strictEqual(pw.planejarIngestao(2, 25, 18), 18);  // min(18, 27)
});

test('exatamente 1 abaixo do alvo → ingere pouco (5)', () => {
  assert.strictEqual(pw.planejarIngestao(24, 25, 18), 5);  // 25-24+4
});

// ── Cursor da varredura (incidente 03/08: Prótese secou porque toda noite
// recomeçava da página 0 e batia nos mesmos 250 artigos já ingeridos) ─────────
test('cursor avança pelas páginas varridas (a próxima noite continua adiante)', () => {
  assert.strictEqual(pw.proximoCursor(0, 10, 5000, 25), 250);
  assert.strictEqual(pw.proximoCursor(250, 10, 5000, 25), 500);
});

test('cursor volta ao início quando passa do fim do acervo', () => {
  assert.strictEqual(pw.proximoCursor(4900, 10, 5000, 25), 0);
});

test('acervo de tamanho desconhecido (total 0) nunca reseta por engano', () => {
  assert.strictEqual(pw.proximoCursor(100, 4, 0, 25), 200);
});
