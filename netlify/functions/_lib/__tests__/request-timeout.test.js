// REGRA ANTI-REGRESSÃO (incidente 24/07): o teto de request para a Anthropic
// NUNCA pode voltar aos 15s. A geração de resumo_completo/roteiro com Sonnet
// leva 20-40s+; com 15s praticamente toda chamada dava "Request timeout",
// deixando artigos sem resumo e especialidades sem podcast (os 3 erros que
// "nunca mais devem acontecer"). Firestore/PubMed continuam com o teto curto.

const test = require('node:test');
const assert = require('node:assert');
const { _defaultTimeoutMs } = require('../../_lib');

test('Anthropic ganha teto largo (>= 120s) para geração', () => {
  const t = _defaultTimeoutMs({ hostname: 'api.anthropic.com' });
  assert.ok(t >= 120000, `esperado >= 120000ms para a Anthropic, veio ${t}`);
});

test('Firestore/PubMed mantêm o teto curto (15s)', () => {
  assert.strictEqual(_defaultTimeoutMs({ hostname: 'firestore.googleapis.com' }), 15000);
  assert.strictEqual(_defaultTimeoutMs({ hostname: 'eutils.ncbi.nlm.nih.gov' }), 15000);
});

test('timeoutMs explícito sempre vence o padrão do host', () => {
  assert.strictEqual(_defaultTimeoutMs({ hostname: 'api.anthropic.com', timeoutMs: 30000 }), 30000);
  assert.strictEqual(_defaultTimeoutMs({ hostname: 'firestore.googleapis.com', timeoutMs: 60000 }), 60000);
});
