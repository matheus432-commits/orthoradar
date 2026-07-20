// Tests do endpoint feedback-artigo — voto de 1 clique do e-mail (GET com
// redirect para a área de membro) e voto autenticado do site (POST).
// Run: node --test netlify/functions/_lib/__tests__/feedback-artigo.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const fsModule = require('../firestore.js');
const fbPath = require.resolve('../../feedback-artigo.js');

const EHASH = crypto.createHash('sha256').update('ana@x.com').digest('hex').slice(0, 16);

function load(state) {
  state.sets = [];
  fsModule.Firestore = class {
    async getDoc(coll, id) {
      if (coll === 'artigos' && id === '111') return { especialidade: 'Ortodontia', tema: 'Qualidade de vida', nivel_evidencia: 'Revisão Narrativa' };
      return null;
    }
    async setDoc(coll, id, val) { state.sets.push({ coll, id, val }); }
    async query(coll) {
      if (coll === 'cadastros') return [{ email: 'ana@x.com', sessionToken: 'tok-123' }];
      return [];
    }
  };
  delete require.cache[fbPath];
  return require(fbPath);
}

describe('feedback-artigo', () => {
  let state;
  beforeEach(() => { state = {}; process.env.FIREBASE_API_KEY = 'x'; });

  test('GET (e-mail, 1 clique): grava o voto com os padrões congelados e redireciona à área de membro', async () => {
    const fb = load(state);
    const res = await fb.handler({ httpMethod: 'GET', queryStringParameters: { p: '111', e: EHASH, v: 'down', d: 'dig-1' } });
    assert.equal(res.statusCode, 302);
    assert.ok(res.headers.Location.includes('/dashboard.html?fb=ok'), res.headers.Location);
    assert.equal(state.sets.length, 1);
    const s = state.sets[0];
    assert.equal(s.coll, 'artigo_feedback');
    assert.equal(s.id, `${EHASH}_111`); // idempotente: 1 doc por dentista+artigo
    assert.equal(s.val.voto, 'nao_util');
    assert.equal(s.val.tema, 'Qualidade de vida');
    assert.equal(s.val.especialidade, 'Ortodontia');
  });

  test('GET com voto inválido: NÃO grava, mas ainda redireciona (clique nunca vira erro)', async () => {
    const fb = load(state);
    const res = await fb.handler({ httpMethod: 'GET', queryStringParameters: { p: '111', e: EHASH, v: 'zzz' } });
    assert.equal(res.statusCode, 302);
    assert.ok(res.headers.Location.includes('fb=err'));
    assert.equal(state.sets.length, 0);
  });

  test('GET com ehash malformado não grava', async () => {
    const fb = load(state);
    await fb.handler({ httpMethod: 'GET', queryStringParameters: { p: '111', e: 'não-é-hash', v: 'up' } });
    assert.equal(state.sets.length, 0);
  });

  test('POST (site): sessão válida grava; revotar sobrescreve o mesmo doc', async () => {
    const fb = load(state);
    const ev = v => ({ httpMethod: 'POST', body: JSON.stringify({ email: 'ana@x.com', token: 'tok-123', pmid: '111', voto: v }) });
    const r1 = await fb.handler(ev('util'));
    assert.equal(r1.statusCode, 200);
    const r2 = await fb.handler(ev('nao_util')); // mudou de ideia
    assert.equal(r2.statusCode, 200);
    assert.equal(state.sets.length, 2);
    assert.equal(state.sets[0].id, state.sets[1].id); // mesmo doc → sobrescreve
    assert.equal(state.sets[1].val.voto, 'nao_util');
  });

  test('POST com token errado → 401 e nada gravado', async () => {
    const fb = load(state);
    const res = await fb.handler({ httpMethod: 'POST', body: JSON.stringify({ email: 'ana@x.com', token: 'tok-errado!', pmid: '111', voto: 'util' }) });
    assert.equal(res.statusCode, 401);
    assert.equal(state.sets.length, 0);
  });
});
