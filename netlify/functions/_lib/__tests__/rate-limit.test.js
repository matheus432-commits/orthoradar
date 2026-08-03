// Rate limiter em memória (auditoria de segurança 03/08).
const { test } = require('node:test');
const assert = require('node:assert');
const rl = require('../rate-limit');

const evt = (ip) => ({ headers: { 'x-nf-client-connection-ip': ip } });

test('permite até o máximo e barra o excedente (429 com Retry-After)', () => {
  rl._reset();
  for (let i = 0; i < 5; i++) assert.strictEqual(rl.rateLimited(evt('1.1.1.1'), 'ep', { max: 5, windowMs: 60000 }), null);
  const barrado = rl.rateLimited(evt('1.1.1.1'), 'ep', { max: 5, windowMs: 60000 });
  assert.ok(barrado && barrado.statusCode === 429, 'a 6ª deve ser barrada');
  assert.ok(Number(barrado.headers['Retry-After']) >= 1);
});

test('isola por IP — um atacante não afeta outro usuário', () => {
  rl._reset();
  for (let i = 0; i < 5; i++) rl.rateLimited(evt('9.9.9.9'), 'ep', { max: 5, windowMs: 60000 });
  assert.strictEqual(rl.rateLimited(evt('8.8.8.8'), 'ep', { max: 5, windowMs: 60000 }), null,
    'outro IP tem sua própria cota');
});

test('isola por endpoint — cota de um endpoint não gasta a do outro', () => {
  rl._reset();
  for (let i = 0; i < 5; i++) rl.rateLimited(evt('2.2.2.2'), 'epA', { max: 5, windowMs: 60000 });
  assert.strictEqual(rl.rateLimited(evt('2.2.2.2'), 'epB', { max: 5, windowMs: 60000 }), null);
});

test('chamada interna do pipeline (sem headers) nunca é limitada', () => {
  rl._reset();
  for (let i = 0; i < 100; i++) assert.strictEqual(rl.rateLimited({}, 'ep', { max: 5, windowMs: 60000 }), null);
});

test('janela desliza — libera após a janela expirar', () => {
  rl._reset();
  const agora = Date.now();
  // Simula 5 hits antigos manualmente pela API pura.
  for (let i = 0; i < 5; i++) rl.permitir('k', 5, 10); // janela de 10ms
  const barrado = rl.permitir('k', 5, 10);
  assert.strictEqual(barrado.ok, false);
  // Após a janela (10ms) a cota volta.
  const fim = Date.now() + 15; while (Date.now() < fim) { /* espera curta */ }
  assert.strictEqual(rl.permitir('k', 5, 10).ok, true);
});
