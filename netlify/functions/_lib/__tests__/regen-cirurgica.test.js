// Regeneração cirúrgica: REGEN_ESPECIALIDADES fura o cache do digest E a
// idempotência de envio SÓ para as especialidades listadas; as demais ficam
// intactas (não reconstroem, não recebem e-mail duplicado).

const { test } = require('node:test');
const assert = require('node:assert');

function comEnv(valor, fn) {
  const antes = process.env.REGEN_ESPECIALIDADES;
  process.env.REGEN_ESPECIALIDADES = valor;
  delete require.cache[require.resolve('../../daily-digest.js')];
  const mod = require('../../daily-digest.js');
  try { fn(mod); } finally {
    if (antes === undefined) delete process.env.REGEN_ESPECIALIDADES;
    else process.env.REGEN_ESPECIALIDADES = antes;
    delete require.cache[require.resolve('../../daily-digest.js')];
  }
}

test('sem REGEN_ESPECIALIDADES, nenhuma especialidade é regerada', () => {
  comEnv('', (m) => {
    assert.strictEqual(m.deveRegerar('Ortodontia'), false);
    assert.strictEqual(m.deveRegerar('Prótese'), false);
  });
});

test('só as especialidades listadas são regeradas (acentos e caixa toleram)', () => {
  comEnv('Ortodontia, Prótese', (m) => {
    assert.strictEqual(m.deveRegerar('Ortodontia'), true);
    assert.strictEqual(m.deveRegerar('ortodontia'), true);
    assert.strictEqual(m.deveRegerar('Prótese'), true);
    assert.strictEqual(m.deveRegerar('protese'), true);
    assert.strictEqual(m.deveRegerar('Endodontia'), false);
    assert.strictEqual(m.deveRegerar('Periodontia'), false);
  });
});

test('uma só especialidade', () => {
  comEnv('Ortodontia', (m) => {
    assert.strictEqual(m.deveRegerar('Ortodontia'), true);
    assert.strictEqual(m.deveRegerar('Prótese'), false);
  });
});
