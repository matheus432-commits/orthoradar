// REGRA ANTI-REGRESSÃO (incidentes 19/07 Wakai e 24/07 resumos/podcast): o
// texto da resposta da Anthropic NUNCA pode ser lido só de content[0] — o
// modelo pode emitir um bloco de raciocínio ANTES do texto, e content[0].text
// vinha vazio COM A API JÁ COBRADA (resumo "sumia", especialidade sem podcast).

const test = require('node:test');
const assert = require('node:assert');
const { extractAnthropicText } = require('../anthropic-text');

test('texto no primeiro bloco (caso comum)', () => {
  assert.strictEqual(
    extractAnthropicText({ content: [{ type: 'text', text: 'olá mundo' }] }),
    'olá mundo');
});

test('bloco de raciocínio ANTES do texto — pega o texto, não vazio', () => {
  const json = { content: [
    { type: 'thinking', thinking: 'deixa eu pensar...' },
    { type: 'text', text: 'a resposta real' },
  ] };
  assert.strictEqual(extractAnthropicText(json), 'a resposta real');
});

test('múltiplos blocos de texto são concatenados na ordem', () => {
  const json = { content: [
    { type: 'text', text: 'parte 1' },
    { type: 'tool_use', name: 'x' },
    { type: 'text', text: 'parte 2' },
  ] };
  assert.strictEqual(extractAnthropicText(json), 'parte 1\nparte 2');
});

test('sem bloco de texto → string vazia (sinaliza falha ao chamador)', () => {
  assert.strictEqual(extractAnthropicText({ content: [{ type: 'thinking', thinking: 'x' }] }), '');
  assert.strictEqual(extractAnthropicText({ content: [] }), '');
  assert.strictEqual(extractAnthropicText({}), '');
  assert.strictEqual(extractAnthropicText(null), '');
});
