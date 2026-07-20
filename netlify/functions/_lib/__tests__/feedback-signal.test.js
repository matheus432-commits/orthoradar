// Tests do feedback-signal — a garantia central pedida pelo fundador: o voto
// de UM dentista nunca vira lista negra; só padrões consistentes de muitos
// movem o ranking, sempre com efeito limitado (±15%) e nunca exclusão.
// Run: node --test netlify/functions/_lib/__tests__/feedback-signal.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { aggregateStats, feedbackMultiplier, personalTemaAffinity, MULT_MIN, MULT_MAX } = require('../feedback-signal');

const agora = new Date().toISOString();
const doc = (voto, tema, nivel = 'RCT', data = agora) => ({ voto, tema, nivel_evidencia: nivel, data });

describe('feedback-signal', () => {
  test('1 voto negativo isolado move o ranking em <5% (nunca vira lista negra)', () => {
    const stats = aggregateStats([doc('nao_util', 'Qualidade de vida', 'Revisão Narrativa')]);
    const mult = feedbackMultiplier({ tema: 'Qualidade de vida', nivel_evidencia: 'Revisão Narrativa' }, stats);
    assert.ok(mult > 0.95 && mult < 1, 'mult=' + mult);
  });

  test('padrão consistente de MUITOS dentistas atinge o teto de penalidade (0.85) — e nada além', () => {
    const docs = Array.from({ length: 30 }, () => doc('nao_util', 'Qualidade de vida', 'Revisão Narrativa'));
    const stats = aggregateStats(docs);
    const mult = feedbackMultiplier({ tema: 'Qualidade de vida', nivel_evidencia: 'Revisão Narrativa' }, stats);
    assert.equal(mult, MULT_MIN); // 0.85 — penaliza o ranking, NUNCA exclui
    assert.ok(mult > 0, 'exclusão é proibida');
  });

  test('padrão positivo forte atinge o teto de bônus (1.15)', () => {
    const docs = Array.from({ length: 30 }, () => doc('util', 'Ancoragem esquelética', 'Meta-análise'));
    const stats = aggregateStats(docs);
    assert.equal(feedbackMultiplier({ tema: 'Ancoragem esquelética', nivel_evidencia: 'Meta-análise' }, stats), MULT_MAX);
  });

  test('tema mal votado por um grupo NÃO afeta artigo de outro tema', () => {
    const stats = aggregateStats(Array.from({ length: 20 }, () => doc('nao_util', 'Qualidade de vida')));
    assert.equal(feedbackMultiplier({ tema: 'Cimentação adesiva', nivel_evidencia: 'Coorte' }, stats), 1);
  });

  test('votos misturados (comunidade dividida) ficam perto do neutro', () => {
    const docs = [
      ...Array.from({ length: 10 }, () => doc('nao_util', 'Ortopedia funcional')),
      ...Array.from({ length: 9 }, () => doc('util', 'Ortopedia funcional')),
    ];
    const mult = feedbackMultiplier({ tema: 'Ortopedia funcional' }, aggregateStats(docs));
    assert.ok(Math.abs(mult - 1) < 0.03, 'comunidade dividida deve ~anular o sinal; mult=' + mult);
  });

  test('votos fora da janela de 90 dias expiram', () => {
    const velho = new Date(Date.now() - 120 * 86400000).toISOString();
    const stats = aggregateStats(Array.from({ length: 30 }, () => doc('nao_util', 'Qualidade de vida', 'RCT', velho)));
    assert.equal(stats.total, 0);
    assert.equal(feedbackMultiplier({ tema: 'Qualidade de vida' }, stats), 1);
  });

  test('sem stats/sem votos → neutro', () => {
    assert.equal(feedbackMultiplier({ tema: 'X' }, null), 1);
    assert.equal(feedbackMultiplier({ tema: 'X' }, aggregateStats([])), 1);
  });

  test('afinidade pessoal é limitada (±4.5 por tema) e só reordena a curadoria própria', () => {
    const aff = personalTemaAffinity([
      ...Array.from({ length: 10 }, () => doc('nao_util', 'Qualidade de vida')),
      doc('util', 'Cimentação adesiva'),
    ]);
    assert.equal(aff['Qualidade de vida'], -4.5); // teto, mesmo com 10 votos
    assert.equal(aff['Cimentação adesiva'], 1.5);
  });
});
