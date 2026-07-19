// Tests do wakai.js — bug real 19/07: toda pergunta devolvia "A Wakai teve um
// problema" porque a chamada ao Claude usava o timeout padrão de 15s do
// _lib.request (Sonnet leva 15-25s para 1200 tokens). Garante:
//   1. timeout de 20s + SEM retry na chamada ao Claude (orçamento Netlify ~26s)
//   2. happy path devolve resposta + fontes + contagem de tokens
//   3. timeout → mensagem específica (não o erro genérico)
//   4. ANTHROPIC_API_KEY ausente → erro de configuração identificável
// Run: node --test netlify/functions/_lib/__tests__/wakai.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const lib      = require('../../_lib.js');
const fsModule = require('../firestore.js');
const wakaiPath = require.resolve('../../wakai.js');

const USER = { email: 'ana@x.com', sessionToken: 'tok-123', plano: 'premium', especialidade: 'Prótese', ativo: true };
const ARTIGOS = [
  { pmid: '111', titulo_pt: 'Cimentação de pino de fibra de vidro', resumo_pt: 'Estudo sobre cimentação adesiva de pino de fibra.', nivel_evidencia: 'RCT', journal: 'JPD', year: '2026', especialidade: 'Prótese', status: 'active' },
];

// Resposta canônica do Claude: bloco de raciocínio ANTES do texto — o texto
// real NÃO está em content[0] (bug real 19/07: chat mostrava só as fontes).
function claudeOk() {
  return {
    status: 200,
    body: JSON.stringify({
      content: [
        { type: 'thinking', thinking: 'raciocínio interno do modelo' },
        { type: 'text', text: 'Resposta clínica fundamentada [1].' },
      ],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    }),
  };
}

// Instala stubs e carrega o handler fresco. anthropicImpl decide o que a
// chamada à api.anthropic.com faz; Firestore devolve dados canônicos.
function loadWakai(anthropicImpl, state) {
  state.calls = [];
  lib.request = async function (options, body, _attempt = 0, maxRetries = 2) {
    if (options.hostname === 'api.anthropic.com') {
      state.calls.push({ options, body: String(body), maxRetries });
      return anthropicImpl(options, body);
    }
    throw new Error('unexpected host ' + options.hostname); // Firestore é stubado na classe
  };
  fsModule.Firestore = class {
    async query(coll) {
      if (coll === 'cadastros') return [USER];
      if (coll === 'artigos') return ARTIGOS;
      if (coll === 'biblioteca_itens') return [];
      return [];
    }
    async getDoc() { return null; }              // wakai_usage: nada gasto hoje
    async setDoc(coll, id, val) { (state.writes ||= []).push({ coll, id, val }); }
  };
  delete require.cache[wakaiPath];
  return require(wakaiPath);
}

function event(body) {
  return { httpMethod: 'POST', headers: {}, body: JSON.stringify(body) };
}
const PERGUNTA = { email: 'ana@x.com', token: 'tok-123', modo: 'conversa', pergunta: 'como cimentar pino de fibra de vidro?' };

describe('wakai', () => {
  let state;
  beforeEach(() => {
    state = {};
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    process.env.FIREBASE_API_KEY = 'fb-test';
  });

  test('happy path: 200 com resposta, fontes e uso registrado (texto FORA de content[0])', async () => {
    const wakai = loadWakai(claudeOk, state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(res.statusCode, 200, res.body);
    const data = JSON.parse(res.body);
    assert.equal(data.resposta, 'Resposta clínica fundamentada [1].');
    assert.ok(Array.isArray(data.fontes) && data.fontes.length >= 1, 'fontes vazias');
    assert.equal(data.limite - data.restantes, 150); // 100 in + 50 out registrados
    assert.ok(state.writes.some(w => w.coll === 'wakai_usage' && w.val.tokens === 150));
  });

  test('múltiplos blocos de texto são concatenados', async () => {
    const wakai = loadWakai(() => ({ status: 200, body: JSON.stringify({
      content: [{ type: 'text', text: 'Parte 1.' }, { type: 'thinking', thinking: 'x' }, { type: 'text', text: 'Parte 2.' }],
      usage: { input_tokens: 10, output_tokens: 10 },
    }) }), state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(JSON.parse(res.body).resposta, 'Parte 1.\nParte 2.');
  });

  test('resposta SEM bloco de texto → erro "resposta_vazia" (nunca 200 com resposta vazia)', async () => {
    const wakai = loadWakai(() => ({ status: 200, body: JSON.stringify({
      content: [{ type: 'thinking', thinking: 'só raciocínio, texto nenhum' }],
      stop_reason: 'max_tokens',
      usage: { input_tokens: 100, output_tokens: 900 },
    }) }), state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(res.statusCode, 500);
    const data = JSON.parse(res.body);
    assert.equal(data.error, 'resposta_vazia');
    assert.match(data.message, /Pergunte de novo/);
  });

  test('chamada ao Claude usa timeout de 20s e NÃO faz retry (orçamento Netlify)', async () => {
    const wakai = loadWakai(claudeOk, state);
    await wakai.handler(event(PERGUNTA));
    assert.equal(state.calls.length, 1);
    assert.equal(state.calls[0].options.timeoutMs, 20000);
    assert.equal(state.calls[0].maxRetries, 0, 'retry duplicaria cobrança e estouraria os 26s');
    const payload = JSON.parse(state.calls[0].body);
    assert.equal(payload.max_tokens, 1000); // cabe no orçamento de tempo
  });

  test('timeout na geração → mensagem específica (erro "timeout"), não a genérica', async () => {
    const wakai = loadWakai(() => { throw new Error('Request timeout: api.anthropic.com/v1/messages'); }, state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(res.statusCode, 500);
    const data = JSON.parse(res.body);
    assert.equal(data.error, 'timeout');
    assert.match(data.message, /demorou/);
  });

  test('ANTHROPIC_API_KEY ausente → erro "config" identificável no cliente', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const wakai = loadWakai(claudeOk, state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.parse(res.body).error, 'config');
    assert.equal(state.calls.length, 0);
  });

  test('erro da API do Claude (não-200) → 500 genérico, sem quebrar', async () => {
    const wakai = loadWakai(() => ({ status: 429, body: '{"error":"overloaded"}' }), state);
    const res = await wakai.handler(event(PERGUNTA));
    assert.equal(res.statusCode, 500);
    assert.equal(JSON.parse(res.body).error, 'erro_interno');
  });

  test('token de sessão errado → 401', async () => {
    const wakai = loadWakai(claudeOk, state);
    const res = await wakai.handler(event({ ...PERGUNTA, token: 'tok-errado!!' }));
    assert.equal(res.statusCode, 401);
    assert.equal(state.calls.length, 0);
  });
});
