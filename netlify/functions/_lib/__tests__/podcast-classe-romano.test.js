// Pedido do fundador (28/07): no ÁUDIO, "Classe III" deve ser falado "Classe 3"
// (o TTS lê "III" como "i-i-i"). Conversão de romano→arábico só nos contextos
// classe/divisão, aplicada em TODO roteiro via capScript. O card escrito
// permanece com "Classe III".

const { test } = require('node:test');
const assert = require('node:assert');
const { numeraisDeClasseParaFala, capScript } = require('../podcast-script.js');

test('converte Classe I/II/III/IV/V para arábico', () => {
  assert.strictEqual(numeraisDeClasseParaFala('má-oclusão de Classe I'), 'má-oclusão de Classe 1');
  assert.strictEqual(numeraisDeClasseParaFala('Classe II divisão 1'), 'Classe 2 divisão 1');
  assert.strictEqual(numeraisDeClasseParaFala('Classe III esquelética'), 'Classe 3 esquelética');
  assert.strictEqual(numeraisDeClasseParaFala('cavidade Classe IV'), 'cavidade Classe 4');
  assert.strictEqual(numeraisDeClasseParaFala('Classe V cervical'), 'Classe 5 cervical');
});

test('preserva a capitalização e o plural de "classe"', () => {
  assert.strictEqual(numeraisDeClasseParaFala('as classes II e III'), 'as classes 2 e 3');
  assert.strictEqual(numeraisDeClasseParaFala('CLASSE III'), 'CLASSE 3');
});

test('converte também "divisão" com romano', () => {
  assert.strictEqual(numeraisDeClasseParaFala('divisão II do incisivo'), 'divisão 2 do incisivo');
});

test('NÃO toca em romanos fora do contexto de classe', () => {
  assert.strictEqual(numeraisDeClasseParaFala('osso tipo III de Lekholm'), 'osso tipo III de Lekholm');
  assert.strictEqual(numeraisDeClasseParaFala('colágeno tipo I'), 'colágeno tipo I');
  assert.strictEqual(numeraisDeClasseParaFala('estágio III da periodontite'), 'estágio III da periodontite');
});

test('NÃO confunde palavra iniciada por I após "Classe"', () => {
  assert.strictEqual(numeraisDeClasseParaFala('Classe Inicial'), 'Classe Inicial');
  assert.strictEqual(numeraisDeClasseParaFala('classe interativa'), 'classe interativa');
});

test('capScript aplica a conversão no roteiro final', () => {
  const r = capScript('Hoje falamos de má-oclusão de Classe III em adolescentes.');
  assert.ok(r.includes('Classe 3'));
  assert.ok(!/Classe III/.test(r));
});
