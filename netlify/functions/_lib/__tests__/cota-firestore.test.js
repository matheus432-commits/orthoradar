// Incidente 04/09 — "Quota exceeded / RESOURCE_EXHAUSTED" derrubou o site
// inteiro: login, painel e Biblioteca ao mesmo tempo, porque a cota é do
// PROJETO Firestore, não de cada função.
//
// Causa: /biblioteca e /arquivo montavam o catálogo do zero a cada abertura —
// varredura completa da coleção `artigos` (mais de 5.000 documentos) somada aos
// três acervos de áudio. Poucas visitas consomem a cota diária inteira.
//
// O que fica travado aqui:
//   1. o catálogo é construído UMA vez por janela e reaproveitado;
//   2. requisições simultâneas não disparam varreduras iguais em paralelo;
//   3. cota estourada aparece como QUEDA (503), nunca como acervo vazio;
//   4. se a reconstrução falhar e houver catálogo velho, ele serve — acervo
//      desatualizado é melhor que acervo sumido.
//
// Run: node --test netlify/functions/_lib/__tests__/cota-firestore.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { memo, esquecer, tamanho } = require('../cache-memoria');

const FUNCS = path.join(__dirname, '..', '..');

describe('cache do catálogo: a varredura não se repete a cada clique', () => {
  beforeEach(() => esquecer());

  test('constrói uma vez e reaproveita dentro da janela', async () => {
    let construcoes = 0;
    const build = async () => { construcoes++; return { artigos: construcoes }; };
    const a = await memo('cat', build);
    const b = await memo('cat', build);
    const c = await memo('cat', build);
    assert.equal(construcoes, 1, 'três visitas, uma varredura');
    assert.deepEqual(a, b); assert.deepEqual(b, c);
  });

  test('reconstrói depois que o TTL vence', async () => {
    let construcoes = 0;
    let relogio = 1_000_000;
    const agora = () => relogio;
    const build = async () => { construcoes++; return construcoes; };
    assert.equal(await memo('cat', build, { ttl: 1000, agora }), 1);
    relogio += 500;
    assert.equal(await memo('cat', build, { ttl: 1000, agora }), 1, 'ainda fresco');
    relogio += 600;
    assert.equal(await memo('cat', build, { ttl: 1000, agora }), 2, 'venceu, reconstrói');
    assert.equal(construcoes, 2);
  });

  test('abas abertas ao mesmo tempo compartilham UMA construção', async () => {
    let construcoes = 0;
    let liberar;
    const espera = new Promise((r) => { liberar = r; });
    const build = async () => { construcoes++; await espera; return 'catálogo'; };
    const juntos = Promise.all([memo('cat', build), memo('cat', build), memo('cat', build)]);
    liberar();
    const r = await juntos;
    assert.equal(construcoes, 1, 'sem varredura duplicada em paralelo');
    assert.deepEqual(r, ['catálogo', 'catálogo', 'catálogo']);
  });

  test('falha na reconstrução devolve o catálogo velho em vez de vazio', async () => {
    let relogio = 1_000_000;
    const agora = () => relogio;
    await memo('cat', async () => ['artigo antigo'], { ttl: 10, agora });
    relogio += 100;
    const r = await memo('cat', async () => { throw new Error('Firestore queryAll 429'); }, { ttl: 10, agora });
    assert.deepEqual(r, ['artigo antigo'], 'biblioteca desatualizada, nunca vazia');
  });

  test('sem nada guardado, a falha sobe para quem chamou decidir', async () => {
    await assert.rejects(memo('cat', async () => { throw new Error('Firestore queryAll 429'); }), /429/);
    assert.equal(tamanho(), 0, 'erro não vira cache');
  });
});

describe('acervo e arquivo: cota esgotada não vira acervo vazio', () => {
  const acervo = fs.readFileSync(path.join(FUNCS, 'acervo.js'), 'utf8');
  const arquivo = fs.readFileSync(path.join(FUNCS, 'get-arquivo.js'), 'utf8');

  test('as duas páginas passaram a montar o catálogo pelo cache', () => {
    assert.ok(acervo.includes("memo('acervo:catalogo'"), 'biblioteca');
    assert.ok(arquivo.includes("memo('arquivo:catalogo'"), 'arquivo');
  });

  test('a varredura pesada ficou DENTRO do cache, não por requisição', () => {
    const dentro = acervo.slice(acervo.indexOf("memo('acervo:catalogo'"), acervo.indexOf('const lidos = await pmidsLidos'));
    assert.ok(dentro.includes("db.queryAll('artigos'"), 'a coleção artigos só é varrida ao (re)construir');
    assert.ok(dentro.includes('mapaDeAudios('), 'os acervos de áudio também');
  });

  test('o "já lido" continua por pessoa, fora do cache compartilhado', () => {
    assert.ok(/const lidos = await pmidsLidos\(db, email\)/.test(acervo));
    const dentro = acervo.slice(acervo.indexOf("memo('acervo:catalogo'"), acervo.indexOf('const lidos = await pmidsLidos'));
    assert.ok(!dentro.includes('pmidsLidos'), 'o que é de cada um nunca entra no cache de todos');
    assert.ok(acervo.includes('lido: lidos.has(a.pmid)'));
  });

  test('429 do Firestore vira 503 explicando a cota, e não lista vazia', () => {
    assert.ok(acervo.includes('RESOURCE_EXHAUSTED') && acervo.includes('Quota exceeded'), 'reconhece a resposta do Firestore');
    assert.ok(acervo.includes("error: 'cota_esgotada'") && acervo.includes('statusCode: 503'));
    assert.ok(!/queryAll\('artigos'[\s\S]{0,400}?\.catch\(\(\) => \[\]\)/.test(acervo), 'a varredura de artigos não engole mais o 429 devolvendo []');
  });

  test('semCota reconhece as formas em que o erro chega', () => {
    const semCota = (err) => /\b429\b|RESOURCE_EXHAUSTED|Quota exceeded/i.test(String((err && err.message) || err));
    for (const m of ['Firestore queryAll 429: {...}', 'Firestore listDocs 429', '{"status":"RESOURCE_EXHAUSTED"}', 'Quota exceeded.']) {
      assert.ok(semCota(new Error(m)), m);
    }
    assert.ok(!semCota(new Error('Firestore queryAll 500: erro interno')), '500 não é cota');
    assert.ok(!semCota(new Error('sem rede')));
  });
});
