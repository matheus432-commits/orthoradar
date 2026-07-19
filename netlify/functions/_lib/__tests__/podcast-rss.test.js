// Tests do feed mestre do Spotify (podcast-rss) — rodízio FIXO por dia da
// semana (decisão 19/07/2026): Seg Endo+Perio · Ter Buco+DTM · Qua Dent+Prót ·
// Qui Odonto+Estoma · Sex Implanto+Radio · Sáb só Ortodontia · Dom nada.
// Run: node --test netlify/functions/_lib/__tests__/podcast-rss.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const fsModule = require('../firestore.js');
const { specialtySlug } = require('../slug.js');
const rssPath = require.resolve('../../podcast-rss.js');

// Datas com dia da semana conhecido (UTC): 20/07/2026=Seg … 26/07/2026=Dom.
const SEG = '2026-07-20', TER = '2026-07-21', QUA = '2026-07-22',
      QUI = '2026-07-23', SEX = '2026-07-24', SAB = '2026-07-25', DOM = '2026-07-26';

const CANON = ['Ortodontia', 'Implantodontia', 'Periodontia', 'Dentística',
  'Bucomaxilofacial', 'Prótese', 'Endodontia', 'Odontopediatria',
  'DTM e Dor Orofacial', 'Radiologia', 'Estomatologia'];

function ep(esp, date, n = 1) {
  return {
    slug: specialtySlug(esp), especialidade: esp, date, n,
    titulo: `${esp} artigo`, objectPath: `podcasts/${specialtySlug(esp)}/${date}/ep${n}.mp3`, downloadToken: 'tok',
  };
}
// Todas as 11 especialidades geradas numa data.
function allSpecs(date) { return CANON.map(e => ep(e, date)); }

function loadRss(episodios) {
  fsModule.Firestore = class {
    async query(coll, opts) {
      if (coll !== 'podcast_episodios') return [];
      const f = opts?.where?.fieldFilter;
      if (f && f.field?.fieldPath === 'slug') return episodios.filter(e => e.slug === f.value?.stringValue);
      return episodios;
    }
    async getDoc() { return null; }
  };
  delete require.cache[rssPath];
  return require(rssPath);
}

async function masterFeed(episodios) {
  const rss = loadRss(episodios);
  const res = await rss.handler({ queryStringParameters: {} });
  return res.body;
}
// Especialidades destaque, na ordem, a partir dos títulos dos <item> ("Esp · ...").
function destaques(xml) {
  return [...xml.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>/g)]
    .map(m => m[1].split(' · ')[0]);
}

describe('podcast-rss — feed mestre (rodízio fixo semanal)', () => {
  beforeEach(() => { process.env.FIREBASE_API_KEY = 'x'; process.env.SITE_URL = 'https://odontofeed.com'; });

  test('segunda → Endodontia + Periodontia (nessa ordem)', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(SEG))), ['Endodontia', 'Periodontia']);
  });
  test('terça → Bucomaxilofacial + DTM e Dor Orofacial', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(TER))), ['Bucomaxilofacial', 'DTM e Dor Orofacial']);
  });
  test('quarta → Dentística + Prótese', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(QUA))), ['Dentística', 'Prótese']);
  });
  test('quinta → Odontopediatria + Estomatologia', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(QUI))), ['Odontopediatria', 'Estomatologia']);
  });
  test('sexta → Implantodontia + Radiologia', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(SEX))), ['Implantodontia', 'Radiologia']);
  });
  test('sábado → só Ortodontia (11 é ímpar)', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(SAB))), ['Ortodontia']);
  });
  test('domingo → nenhum destaque novo (feed válido e sem itens da data)', async () => {
    const xml = await masterFeed(allSpecs(DOM));
    assert.equal(destaques(xml).length, 0);
    assert.ok(xml.includes('<rss') && xml.includes('OdontoFeed — Ciência Odontológica Diária'));
  });

  test('a semana inteira cobre exatamente as 11 especialidades, sem repetir', async () => {
    const eps = [SEG, TER, QUA, QUI, SEX, SAB].flatMap(allSpecs);
    const set = new Set(destaques(await masterFeed(eps)));
    assert.equal(set.size, 11);
    for (const e of CANON) assert.ok(set.has(e), 'faltou ' + e);
  });

  test('ordena por data (mais recente primeiro), mantendo a ordem do dia', async () => {
    const eps = [...allSpecs(SEG), ...allSpecs(TER)];
    // Ter (mais recente) antes de Seg; dentro de cada dia, ordem do cronograma.
    assert.deepEqual(destaques(await masterFeed(eps)),
      ['Bucomaxilofacial', 'DTM e Dor Orofacial', 'Endodontia', 'Periodontia']);
  });

  test('especialidade do dia sem episódio gerado é pulada (não quebra o feed)', async () => {
    // Segunda com só Periodontia gerada (Endodontia faltando)
    assert.deepEqual(destaques(await masterFeed([ep('Periodontia', SEG)])), ['Periodontia']);
  });

  test('feed por especialidade (?esp=) continua funcionando', async () => {
    const rss = loadRss(allSpecs(SEG));
    const res = await rss.handler({ queryStringParameters: { esp: 'Ortodontia' } });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes('OdontoFeed — Ortodontia'));
    assert.equal((res.body.match(/<item>/g) || []).length, 1);
  });

  // ── Edição completa (~8 min, 3 episódios compilados) no feed mestre ────────
  function completo(esp, date) {
    return {
      slug: specialtySlug(esp), especialidade: esp, date, tipo: 'completo', n: 0,
      titulo: 'Edição completa — 3 estudos',
      titulos: ['Estudo A', 'Estudo B', 'Estudo C'],
      objectPath: `podcasts/${specialtySlug(esp)}/${date}/edicao-completa.mp3`,
      downloadToken: 'tokC', bytes: 1920000, secs: 480,
    };
  }

  test('feed mestre prefere a EDIÇÃO COMPLETA ao episódio 1', async () => {
    const eps = [ep('Endodontia', SEG, 1), ep('Endodontia', SEG, 2), completo('Endodontia', SEG)];
    const xml = await masterFeed(eps);
    assert.equal((xml.match(/<item>/g) || []).length, 1);
    assert.ok(xml.includes('edicao-completa.mp3'), 'não publicou o áudio compilado');
    assert.ok(xml.includes('Endodontia · Edição de 20/07/2026 — 3 estudos do dia'), 'título da edição completa errado');
    assert.ok(xml.includes('1) Estudo A 2) Estudo B 3) Estudo C'), 'descrição não lista os estudos');
  });

  test('edição completa publica duração (~8 min) e tamanho reais', async () => {
    const xml = await masterFeed([completo('Endodontia', SEG)]);
    assert.ok(xml.includes('<itunes:duration>480</itunes:duration>'), 'sem duração');
    assert.ok(xml.includes('length="1920000"'), 'sem tamanho do arquivo');
    assert.ok(xml.includes('-completo</guid>'), 'guid da edição completa');
  });

  test('sem compilado (transição) → cai no episódio 1, sem quebrar', async () => {
    const xml = await masterFeed([ep('Endodontia', SEG, 1), ep('Endodontia', SEG, 2)]);
    assert.equal((xml.match(/<item>/g) || []).length, 1);
    assert.ok(xml.includes('ep1.mp3'));
    assert.ok(!xml.includes('<itunes:duration>')); // episódio antigo sem secs não inventa duração
  });

  test('feed por especialidade NÃO lista a edição completa (só episódios individuais)', async () => {
    const rss = loadRss([ep('Endodontia', SEG, 1), ep('Endodontia', SEG, 2), completo('Endodontia', SEG)]);
    const res = await rss.handler({ queryStringParameters: { esp: 'Endodontia' } });
    assert.equal((res.body.match(/<item>/g) || []).length, 2);
    assert.ok(!res.body.includes('edicao-completa.mp3'));
  });

  test('episódio individual com bytes/secs publica duração e tamanho', async () => {
    const e = { ...ep('Ortodontia', SAB, 1), bytes: 720000, secs: 180 };
    const xml = await masterFeed([e]);
    assert.ok(xml.includes('<itunes:duration>180</itunes:duration>'));
    assert.ok(xml.includes('length="720000"'));
  });
});
