// RESUMO COMPLETO CORTADO (12/08 — NiTi salvo terminando em "— molares,"):
// duas facas cortavam meio-frase sem detecção (slice(0,4000) seco e teto de
// 2500 tokens). Contrato: NUNCA persistir/exibir resumo que não termina frase.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { terminaFraseCompleta, apararNaUltimaFrase, ateUltimaFraseCompleta } = require('../claude');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const src = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

describe('detecção de frase completa (mesma definição nas 3 pontas)', () => {
  test('termina frase: pontuação final, com ou sem aspas/parêntese', () => {
    for (const ok of ['Fim do resumo.', 'Valeu a pena!', 'Melhorou?', 'Reticências…', 'Com aspas."', 'Fecha parêntese.)']) {
      assert.ok(terminaFraseCompleta(ok), 'deveria aceitar: ' + ok);
    }
  });
  test('NÃO termina frase: o caso real do incidente e afins', () => {
    for (const ruim of ['em que são utilizados — molares,', 'os grupos NT3 SE e', 'terminou em vírgula,', 'sem pontuação nenhuma']) {
      assert.ok(!terminaFraseCompleta(ruim), 'deveria recusar: ' + ruim);
    }
  });
  test('apara na última frase completa (e devolve vazio sem frase nenhuma)', () => {
    assert.equal(apararNaUltimaFrase('Primeira frase. Segunda incompleta em vírgul'), 'Primeira frase.');
    assert.equal(apararNaUltimaFrase('nada de pontuação'), '');
  });
  test('corte de tamanho recua até o fim de frase (nunca parte palavra)', () => {
    const t = 'A'.repeat(120) + '. ' + 'B'.repeat(120) + '. ' + 'C'.repeat(120);
    const cortado = ateUltimaFraseCompleta(t, 250);
    assert.ok(cortado.endsWith('.'), 'termina em frase completa');
    assert.ok(cortado.length <= 250);
    assert.equal(ateUltimaFraseCompleta('Curto e completo.', 4000), 'Curto e completo.');
  });
});

describe('cadeia do resumo cortado', () => {
  test('geração: detecta truncamento do modelo, tenta de novo e NUNCA publica meio-frase', () => {
    const c = src('netlify/functions/_lib/claude.js');
    assert.ok(c.includes('truncadoPeloModelo'), 'flag de truncamento do modelo');
    assert.ok(c.includes('ateUltimaFraseCompleta(bruto, 4000)'), 'rede de 4000 chars sem partir frase');
    assert.ok(!c.includes(".trim().slice(0, 4000))"), 'slice seco removido');
    assert.match(c, /if \(tentativa === 0\) continue;/, 'primeiro truncamento → retry');
    assert.ok(c.includes('apararNaUltimaFrase(texto)'), 'última tentativa publica aparado, nunca meio-frase');
  });
  test('auditoria: resumo presente porém cortado fica VERMELHO com a cauda no log', () => {
    const a = src('scripts/audit-edicao.js');
    assert.ok(a.includes('terminaFraseCompleta'), 'mesma definição da geração');
    assert.ok(a.includes('RESUMO COMPLETO CORTADO no meio da frase'));
    assert.ok(a.includes('cauda:'), 'cauda do texto no log para diagnóstico imediato');
  });
  test('cura retroativa: dispatch-only, dry-run padrão tolerante, teto de custo por execução', () => {
    const s = src('scripts/regenerar-resumos-cortados.js');
    const wf = src('.github/workflows/regenerar-resumos-cortados.yml');
    assert.match(s, /DRY_RUN = !\/\^\(false\|0\|n\[a\ã\]o\|no\)\$\/i/, 'parser tolerante (lição do run #2 da varredura)');
    assert.ok(s.includes('REGEN_LIMIT'), 'teto de regenerações por execução');
    assert.ok(s.includes('apararNaUltimaFrase(a.resumo_completo)'), 'fallback: apara em vez de deixar meio-frase');
    assert.ok(wf.includes('workflow_dispatch') && !wf.includes('push:'), 'nunca roda em push (custa Sonnet)');
  });
});
