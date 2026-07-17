// Tests for edicao-token.js — magic link de acesso à edição diária.
// Run: node --test netlify/functions/_lib/__tests__/edicao-token.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('edicao-token', () => {
  let tok;
  beforeEach(() => {
    process.env.UNSUBSCRIBE_SECRET = 'segredo-de-teste';
    delete require.cache[require.resolve('../edicao-token')];
    tok = require('../edicao-token');
  });

  test('token válido verifica', () => {
    const t = tok.buildEdicaoToken('ana@x.com');
    assert.equal(tok.verifyEdicaoToken('ana@x.com', t), true);
  });

  test('token de outro e-mail NÃO verifica', () => {
    const t = tok.buildEdicaoToken('ana@x.com');
    assert.equal(tok.verifyEdicaoToken('beto@x.com', t), false);
  });

  test('token adulterado NÃO verifica', () => {
    const t = tok.buildEdicaoToken('ana@x.com');
    assert.equal(tok.verifyEdicaoToken('ana@x.com', t.slice(0, -1) + (t.endsWith('0') ? '1' : '0')), false);
    assert.equal(tok.verifyEdicaoToken('ana@x.com', ''), false);
    assert.equal(tok.verifyEdicaoToken('', t), false);
  });

  test('token difere do token de descadastro (escopos separados)', () => {
    const crypto = require('crypto');
    const unsub = crypto.createHmac('sha256', 'segredo-de-teste').update('ana@x.com').digest('hex');
    assert.notEqual(tok.buildEdicaoToken('ana@x.com'), unsub);
  });

  test('buildEdicaoUrl monta o link com e-mail escapado', () => {
    const url = tok.buildEdicaoUrl('https://odontofeed.com', 'ana+t@x.com');
    assert.ok(url.startsWith('https://odontofeed.com/edicao.html?e=ana%2Bt%40x.com&t='));
  });

  test('sem UNSUBSCRIBE_SECRET → lança', () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    assert.throws(() => tok.buildEdicaoToken('ana@x.com'), /UNSUBSCRIBE_SECRET/);
    assert.equal(tok.verifyEdicaoToken('ana@x.com', 'abc'), false);
  });
});
