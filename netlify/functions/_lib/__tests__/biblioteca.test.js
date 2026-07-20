// Tests da biblioteca (Salvos): congelamento de resumo/áudio no save e
// backfill de itens antigos no GET.
// Run: node --test netlify/functions/_lib/__tests__/biblioteca.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const fsModule = require('../firestore.js');
const bibPath = require.resolve('../../biblioteca.js');

const USER = { email: 'ana@x.com', sessionToken: 'tok-123', plano: 'premium' };
const ARTIGO = {
  titulo_pt: 'Tracionamento ortodôntico precoce', especialidade: 'Ortodontia',
  nivel_evidencia: 'Estudo Coorte', journal: 'Clin Oral Investig', year: '2026',
  resumo_completo: 'O estudo acompanhou 45 incisivos impactados invertidos...',
  impacto_pratico: 'Tracionar cedo não compromete a raiz.',
  tema: 'Impactados', doi: '10.1/x', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/111/',
};
const EPISODIO = {
  artigoId: '111', slug: 'ortodontia', date: '2026-07-20', n: 1,
  objectPath: 'podcasts/ortodontia/2026-07-20/ep1.mp3', downloadToken: 'tokA', secs: 180,
};

function load(state) {
  state.sets = []; state.updates = [];
  fsModule.Firestore = class {
    async getDoc(coll, id) {
      if (coll === 'artigos' && id === '111') return ARTIGO;
      if (coll === 'podcast_salvos' && id === '111') return state.salvoPermanente || null;
      return null;
    }
    async setDoc(coll, id, val) { state.sets.push({ coll, id, val }); }
    async updateDoc(coll, id, val) { state.updates.push({ coll, id, val }); }
    async deleteDoc() {}
    async query(coll, opts) {
      if (coll === 'cadastros') return [USER];
      if (coll === 'podcast_episodios') return state.temEpisodio ? [EPISODIO] : [];
      if (coll === 'biblioteca_itens') return state.itens || [];
      return [];
    }
  };
  delete require.cache[bibPath];
  return require(bibPath);
}

describe('biblioteca — Salvos com resumo e áudio', () => {
  let state;
  beforeEach(() => { state = { temEpisodio: true }; process.env.FIREBASE_API_KEY = 'x'; });

  test('save congela resumo, metadados e o episódio de áudio do artigo', async () => {
    const bib = load(state);
    const res = await bib.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({
      email: 'ana@x.com', token: 'tok-123', action: 'save', pmid: '111' }) });
    assert.equal(res.statusCode, 200);
    const doc = state.sets.find(s => s.coll === 'biblioteca_itens').val;
    assert.ok(doc.resumo.includes('45 incisivos'));
    assert.equal(doc.impacto, 'Tracionar cedo não compromete a raiz.');
    assert.equal(doc.audioPath, EPISODIO.objectPath);
    assert.equal(doc.audioToken, 'tokA');
    assert.equal(doc.audioSecs, 180);
    assert.equal(doc.year, '2026');
  });

  test('save sem episódio disponível: salva mesmo assim, sem áudio', async () => {
    state.temEpisodio = false;
    const bib = load(state);
    const res = await bib.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({
      email: 'ana@x.com', token: 'tok-123', action: 'save', pmid: '111' }) });
    assert.equal(res.statusCode, 200);
    const doc = state.sets.find(s => s.coll === 'biblioteca_itens').val;
    assert.equal(doc.audioPath, '');
    assert.ok(doc.resumo.length > 0);
  });

  test('GET faz backfill de item antigo (sem resumo/áudio) e devolve audioUrl pronto', async () => {
    state.itens = [{ id: 'h_111', pmid: '111', titulo: 'Antigo', savedAt: '2026-07-20T10:00:00Z' }];
    const bib = load(state);
    const res = await bib.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer tok-123' },
      queryStringParameters: { email: 'ana@x.com' } });
    assert.equal(res.statusCode, 200);
    const { itens } = JSON.parse(res.body);
    assert.ok(itens[0].resumo.includes('45 incisivos'), 'resumo não backfilled');
    assert.ok(itens[0].audioUrl.includes('ep1.mp3'), 'audioUrl ausente');
    assert.ok(itens[0].audioUrl.includes('token=tokA'));
    // e PERSISTIU o backfill
    const up = state.updates.find(u => u.coll === 'biblioteca_itens');
    assert.ok(up && up.val.resumo && up.val.audioPath);
  });

  test('GET prefere o acervo permanente (podcast_salvos) quando existir', async () => {
    state.itens = [{ id: 'h_111', pmid: '111', titulo: 'T', resumo: 'já tem',
      audioPath: EPISODIO.objectPath, audioToken: 'tokA', savedAt: '2026-07-20T10:00:00Z' }];
    state.salvoPermanente = { objectPath: 'podcasts/salvos/111.mp3', downloadToken: 'tokPERM', secs: 180 };
    const bib = load(state);
    const res = await bib.handler({ httpMethod: 'GET', headers: { authorization: 'Bearer tok-123' },
      queryStringParameters: { email: 'ana@x.com' } });
    const { itens } = JSON.parse(res.body);
    assert.ok(itens[0].audioUrl.includes('salvos%2F111.mp3'));
    assert.ok(itens[0].audioUrl.includes('token=tokPERM'));
  });
});
