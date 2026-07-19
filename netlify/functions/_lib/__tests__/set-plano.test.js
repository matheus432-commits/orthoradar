// Tests do set-plano.js — upgrade em massa da cortesia e, principalmente, o
// DOWNGRADE SELETIVO do fim do período (APENAS_CORTESIA=true): rebaixa só quem
// tem planoOrigem='cortesia'; assinaturas pagas ('assinatura') são protegidas
// do downgrade em massa e só podem ser rebaixadas listadas em EMAILS.
// Run: node --test netlify/functions/_lib/__tests__/set-plano.test.js

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const fsModule = require('../firestore.js');
const guardM   = require('../admin-guard.js');
const setPlanoPath = require.resolve('../../set-plano.js');

const USERS = () => ([
  { id: 'a', email: 'ana@x.com',    ativo: true,  plano: 'gratuito', planoOrigem: 'padrao' },
  { id: 'b', email: 'bia@x.com',    ativo: true,  plano: 'premium',  planoOrigem: 'cortesia' },
  { id: 'c', email: 'caio@x.com',   ativo: true,  plano: 'premium',  planoOrigem: 'assinatura' }, // pagante
  { id: 'd', email: 'duda@x.com',   ativo: false, plano: 'gratuito', planoOrigem: 'padrao' },     // inativa
]);

function load(state) {
  state.updates = [];
  fsModule.Firestore = class {
    async listDocs() { return { docs: state.users, nextPageToken: null }; }
    async updateDoc(coll, id, val) { state.updates.push({ id, val }); }
  };
  guardM.checkAdmin = () => true;
  delete require.cache[setPlanoPath];
  return require(setPlanoPath);
}

describe('set-plano', () => {
  let state;
  beforeEach(() => {
    state = { users: USERS() };
    process.env.FIREBASE_API_KEY = 'x';
    delete process.env.PLANO; delete process.env.EMAILS; delete process.env.APENAS_CORTESIA;
  });
  afterEach(() => { delete process.env.PLANO; delete process.env.EMAILS; delete process.env.APENAS_CORTESIA; });

  test('upgrade em massa: todos os ativos viram premium/cortesia (pula quem já é)', async () => {
    process.env.PLANO = 'premium';
    const sp = load(state);
    const res = JSON.parse((await sp.handler({})).body);
    assert.equal(res.updated, 1); // só a ana (gratuita ativa)
    assert.equal(res.skipped, 2); // bia e caio já premium
    assert.equal(state.updates[0].id, 'a');
    assert.equal(state.updates[0].val.plano, 'premium');
    assert.equal(state.updates[0].val.planoOrigem, 'cortesia');
  });

  test('fim da cortesia (APENAS_CORTESIA): rebaixa SÓ planoOrigem=cortesia', async () => {
    process.env.PLANO = 'gratuito';
    process.env.APENAS_CORTESIA = 'true';
    const sp = load(state);
    const res = JSON.parse((await sp.handler({})).body);
    assert.equal(res.updated, 1, JSON.stringify(res));
    assert.equal(state.updates[0].id, 'b'); // só a bia (cortesia)
    assert.equal(state.updates[0].val.plano, 'gratuito');
    assert.equal(state.updates[0].val.planoOrigem, 'padrao'); // marca de cortesia zerada
    assert.ok(!state.updates.some(u => u.id === 'c'), 'assinatura paga foi rebaixada!');
    assert.ok(!state.updates.some(u => u.id === 'a'), 'gratuita não deveria ser tocada');
  });

  test('GUARDRAIL: downgrade em massa SEM filtro nunca rebaixa assinatura paga', async () => {
    process.env.PLANO = 'gratuito';
    const sp = load(state);
    const res = JSON.parse((await sp.handler({})).body);
    assert.equal(res.protegidos, 1, JSON.stringify(res)); // caio protegido
    assert.ok(!state.updates.some(u => u.id === 'c'), 'assinatura paga foi rebaixada em massa!');
    assert.ok(state.updates.some(u => u.id === 'b'), 'cortesia deveria ser rebaixada');
  });

  test('assinatura paga SÓ é rebaixada quando listada explicitamente em EMAILS', async () => {
    process.env.PLANO = 'gratuito';
    process.env.EMAILS = 'caio@x.com';
    const sp = load(state);
    const res = JSON.parse((await sp.handler({})).body);
    assert.equal(res.updated, 1);
    assert.equal(state.updates[0].id, 'c'); // decisão individual do admin
  });

  test('usuária inativa nunca entra no alvo', async () => {
    process.env.PLANO = 'premium';
    const sp = load(state);
    await sp.handler({});
    assert.ok(!state.updates.some(u => u.id === 'd'));
  });
});
