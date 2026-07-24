// Tests das travas de qualidade do roteiro do podcast (parte pura, sem rede).
// Run: node --test netlify/functions/_lib/__tests__/podcast-script.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { generateScript, hasNarratableMaterial, buildMaterial, capScript } = require('../podcast-script');

describe('capScript — áudio nunca corta no meio de uma frase', () => {
  test('roteiro truncado (sem pontuação final) é fechado na última frase completa', () => {
    const truncado = 'Primeira frase completa. Segunda frase também completa. E aqui o roteiro foi cortado no meio de uma ideia sem';
    const out = capScript(truncado);
    assert.ok(/[.!?…]$/.test(out), `deveria terminar em pontuação; veio: "${out.slice(-40)}"`);
    assert.equal(out, 'Primeira frase completa. Segunda frase também completa.');
  });
  test('roteiro já completo é preservado (inclui a despedida)', () => {
    const ok = 'Olá! Hoje falamos sobre X. Os resultados mostraram Y. É isso por hoje. Até o próximo episódio.';
    assert.equal(capScript(ok), ok);
  });
  test('termina em pontuação seguida de aspas/fecho é aceito', () => {
    const s = 'O autor conclui que "a técnica é superior."';
    assert.equal(capScript(s), s);
  });
});

const enriquecido = {
  pmid: '1', titulo_pt: 'Alinhadores versus aparelho fixo em extrações',
  resumo_pt: 'O estudo comparou a largura do arco após extração de pré-molares em pacientes tratados com alinhadores e com aparelho fixo. '
    + 'Os pacientes com aparelho fixo mantiveram maior largura intermolar, enquanto os alinhadores mostraram maior constrição do arco no acompanhamento.',
  achados_principais: ['Aparelho fixo manteve maior largura intermolar', 'Alinhadores apresentaram maior constrição'],
  abstract: 'Fixed appliances maintained greater intermolar width than aligners.',
};

const cru = { pmid: '2', titulo: 'Arch width changes following first premolar extractions' }; // sem enriquecimento

describe('podcast-script — travas de qualidade', () => {
  test('hasNarratableMaterial: artigo enriquecido passa; artigo cru não', () => {
    assert.equal(hasNarratableMaterial(enriquecido), true);
    assert.equal(hasNarratableMaterial(cru), false);
    // Título traduzido é obrigatório (card em inglês = não enriquecido).
    assert.equal(hasNarratableMaterial({ ...enriquecido, titulo_pt: '' }), false);
    // Resumo curto sem achados não sustenta um episódio.
    assert.equal(hasNarratableMaterial({ titulo_pt: 'Título ok aqui', resumo_pt: 'curto', achados_principais: [] }), false);
    // Sem resumo mas com 2+ achados concretos ainda dá episódio (fallback).
    assert.equal(hasNarratableMaterial({ titulo_pt: 'Título ok aqui', achados_principais: ['a foi melhor', 'b foi pior'] }), true);
  });

  test('generateScript: artigo SEM material → null (episódio deve ser pulado)', async () => {
    assert.equal(await generateScript(cru, 'Ortodontia', null), null);
    assert.equal(await generateScript(cru, 'Ortodontia', 'chave-qualquer'), null); // guard vem antes de qualquer rede
  });

  test('generateScript sem chave: artigo enriquecido → fallback narrando o resumo', async () => {
    const s = await generateScript(enriquecido, 'Ortodontia', null);
    assert.ok(s && s.length > 100);
    assert.ok(s.includes('maior largura intermolar')); // conteúdo real, não casca vazia
  });

  test('buildMaterial expõe o abstract (fonte da DIREÇÃO do veredito)', () => {
    const m = buildMaterial(enriquecido);
    assert.ok(m.abstract.includes('greater intermolar width'));
  });
});
