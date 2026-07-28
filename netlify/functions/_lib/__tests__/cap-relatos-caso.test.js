// REGRA (fundador 28/07): no máximo 1 relato de caso por edição. Relato continua
// permitido, mas limitado a 1; as vagas liberadas são preenchidas por estudos
// NÃO-relato da reserva. (Incidente 28/07: Ortodontia saiu com 3 relatos.)

const { test } = require('node:test');
const assert = require('node:assert');
const { limitarRelatosDeCaso, MAX_RELATOS_POR_EDICAO } = require('../../daily-digest.js');

const relato = (id) => ({ pmid: id, titulo_pt: `Reabilitação — relato de caso ${id}` });
const estudo = (id) => ({ pmid: id, titulo_pt: `Ensaio clínico randomizado ${id}` });

test('a regra é 1 relato por edição', () => {
  assert.strictEqual(MAX_RELATOS_POR_EDICAO, 1);
});

test('3 relatos selecionados → mantém 1 e repõe 2 com estudos da reserva', () => {
  const selecionados = [relato('a'), relato('b'), relato('c')];
  const candidatos = [...selecionados, estudo('d'), estudo('e'), estudo('f')];
  const r = limitarRelatosDeCaso(selecionados, candidatos, 3);
  assert.strictEqual(r.removidos, 2);
  assert.strictEqual(r.selecionados.filter(a => /relato de caso/i.test(a.titulo_pt)).length, 1);
  assert.strictEqual(r.selecionados.length, 3);
});

test('1 relato + 2 estudos → nada muda', () => {
  const selecionados = [relato('a'), estudo('b'), estudo('c')];
  const r = limitarRelatosDeCaso(selecionados, selecionados, 3);
  assert.strictEqual(r.removidos, 0);
  assert.strictEqual(r.selecionados.length, 3);
});

test('a reposição nunca usa outro relato (só não-relato)', () => {
  const selecionados = [relato('a'), relato('b'), relato('c')];
  // reserva só tem MAIS relatos + 1 estudo → só o estudo pode repor
  const candidatos = [...selecionados, relato('x'), relato('y'), estudo('z')];
  const r = limitarRelatosDeCaso(selecionados, candidatos, 3);
  const relatosFinais = r.selecionados.filter(a => /relato de caso/i.test(a.titulo_pt)).length;
  assert.strictEqual(relatosFinais, 1);
  assert.ok(r.selecionados.some(a => a.pmid === 'z'), 'deve ter reposto com o estudo z');
  assert.ok(!r.selecionados.some(a => a.pmid === 'x' || a.pmid === 'y'), 'não repõe com relato');
});

test('sem reserva de não-relato, fica só com 1 (não força relato extra)', () => {
  const selecionados = [relato('a'), relato('b')];
  const r = limitarRelatosDeCaso(selecionados, selecionados, 3);
  assert.strictEqual(r.selecionados.length, 1);
  assert.strictEqual(r.removidos, 1);
});
