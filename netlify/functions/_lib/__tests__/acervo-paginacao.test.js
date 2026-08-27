// Tests do INCIDENTE 27/08 — a biblioteca ENCOLHEU (684 → 660 artigos; Orto
// 66 → 57) porque query() com limit fixo de 5.000 trunca por __name__ e a
// coleção artigos cresceu além disso: artigos novos (pmid alto) caíam fora do
// corte e a reserva diária de pmids antigos empurrava mais para fora por dia.
//
// Cobertura: (a) queryAll pagina por cursor até esgotar a coleção, sem teto
// silencioso; (b) os caminhos de leitura do acervo (biblioteca, arquivo e os
// dois diagnósticos) usam queryAll — um limit fixo de 5.000 reintroduzido em
// qualquer um deles derruba estes testes.
//
// Run: node --test netlify/functions/_lib/__tests__/acervo-paginacao.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { Firestore } = require('../firestore.js');
const FUNCS = path.join(__dirname, '..', '..');
const src = (f) => fs.readFileSync(path.join(FUNCS, f), 'utf8');

// Firestore fake: N docs em ordem de __name__, servidos em páginas de `limit`
// a partir do cursor startAt (referenceValue) — o contrato real do runQuery.
function fakeFirestore(total, { registrar } = {}) {
  const db = new Firestore('proj-teste', 'chave');
  const nomes = [];
  for (let i = 0; i < total; i++) nomes.push(String(10000000 + i)); // "pmids" ordenados
  db._send = async (p, method, body) => {
    const q = body.structuredQuery;
    if (registrar) registrar(q);
    let inicio = 0;
    if (q.startAt) {
      const ultimo = q.startAt.values[0].referenceValue.split('/').pop();
      inicio = nomes.indexOf(ultimo) + 1;
      assert.ok(inicio > 0, 'cursor aponta para doc conhecido');
      assert.equal(q.startAt.before, false, 'cursor é exclusivo (before:false)');
    }
    const fatia = nomes.slice(inicio, inicio + (q.limit || nomes.length));
    return {
      status: 200,
      body: JSON.stringify(fatia.map(n => ({ document: {
        name: `projects/proj-teste/databases/(default)/documents/artigos/${n}`,
        fields: { pmid: { stringValue: n } },
      } }))),
    };
  };
  return db;
}

describe('queryAll — paginação sem teto silencioso', () => {
  test('coleção MAIOR que o antigo teto vem inteira (7.234 docs, lotes de 1.000)', async () => {
    let chamadas = 0;
    const db = fakeFirestore(7234, { registrar: () => chamadas++ });
    const docs = await db.queryAll('artigos');
    assert.equal(docs.length, 7234, 'nenhum doc descartado');
    assert.equal(chamadas, 8, '7 páginas cheias + 1 parcial');
    // Ordem e integridade: primeiro e último docs presentes uma única vez.
    assert.equal(docs[0].pmid, '10000000');
    assert.equal(docs[docs.length - 1].pmid, '10007233');
    assert.equal(new Set(docs.map(d => d.id)).size, 7234, 'sem duplicatas de cursor');
  });

  test('coleção pequena: uma chamada só, resultado idêntico ao query()', async () => {
    let chamadas = 0;
    const db = fakeFirestore(42, { registrar: () => chamadas++ });
    const docs = await db.queryAll('artigos');
    assert.equal(docs.length, 42);
    assert.equal(chamadas, 1);
  });

  test('página EXATAMENTE cheia não perde o resto (1.000 + 1)', async () => {
    const db = fakeFirestore(1001);
    const docs = await db.queryAll('artigos');
    assert.equal(docs.length, 1001, 'o doc 1.001 não pode sumir');
  });

  test('where e select são repassados a TODAS as páginas; orderBy é __name__', async () => {
    const consultas = [];
    const db = fakeFirestore(2500, { registrar: (q) => consultas.push(q) });
    const where = { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: 'x@y.com' } } };
    const select = { fields: [{ fieldPath: 'pmid' }] };
    await db.queryAll('digest_metrics', { where, select });
    assert.equal(consultas.length, 3);
    for (const q of consultas) {
      assert.deepEqual(q.where, where, 'filtro presente em toda página');
      assert.deepEqual(q.select, select, 'select presente em toda página');
      assert.equal(q.orderBy[0].field.fieldPath, '__name__', 'cursor exige ordem por nome');
    }
  });

  test('freio max interrompe sem loop infinito (nunca em uso normal)', async () => {
    const db = fakeFirestore(5000);
    const docs = await db.queryAll('artigos', { batch: 1000, max: 2000 });
    assert.equal(docs.length, 2000);
  });

  test('erro do Firestore vira exceção clara, não resultado parcial silencioso', async () => {
    const db = fakeFirestore(10);
    db._send = async () => ({ status: 500, body: 'boom' });
    await assert.rejects(() => db.queryAll('artigos'), /queryAll 500/);
  });
});

describe('caminhos de leitura do acervo usam queryAll (guarda de regressão)', () => {
  // O incidente só existiu porque um limit "grande o bastante" parou de ser.
  // Estes arquivos derivam catálogo/diagnóstico da coleção INTEIRA — qualquer
  // volta do limit fixo é regressão.
  const arquivos = ['acervo.js', 'get-arquivo.js', '_lib/diagnostico-pipeline.js', '_lib/diagnostico-temas.js'];
  for (const f of arquivos) {
    test(f + ': sem limit fixo de 5.000; catálogo via queryAll', () => {
      const code = src(f);
      assert.ok(!code.includes('limit: 5000'), f + ' não pode voltar ao teto fixo');
      assert.ok(code.includes('queryAll('), f + ' usa a leitura paginada');
    });
  }
  test("acervo.js: as três fontes do catálogo (artigos + episódios + salvos) paginadas", () => {
    const code = src('acervo.js');
    assert.ok(/queryAll\('artigos'/.test(code));
    assert.ok(/queryAll\(coll/.test(code), 'podcast_arquivo + podcast_episodios');
    assert.ok(/queryAll\('podcast_salvos'/.test(code));
  });
});
