// Tests do feed mestre do Spotify (podcast-rss) — CICLO DIÁRIO das 11
// especialidades (decisão 21/07/2026, mesma fonte do carrossel/reel:
// especialidade-identidade). 1 edição por dia = a especialidade do dia; se ela
// não tiver episódio gerado (área sem usuários ativos), cai na primeira do
// ciclo que tiver — o feed nunca fica sem o item do dia.
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

describe('podcast-rss — feed mestre (ciclo diário das 11)', () => {
  beforeEach(() => { process.env.FIREBASE_API_KEY = 'x'; process.env.SITE_URL = 'https://odontofeed.com'; });

  // Ciclo (época 2026-01-01): 20/07→Periodontia · 21/07→Endodontia ·
  // 22/07→Dentística · 23/07→Prótese · 24/07→Bucomaxilofacial ·
  // 25/07→Odontopediatria · 26/07→DTM e Dor Orofacial.
  // Decisão 21/07: 2 especialidades/dia — a do dia + a próxima do ciclo.
  test('cada dia publica a especialidade do dia + a próxima do ciclo (2 itens/dia)', async () => {
    assert.deepEqual(destaques(await masterFeed(allSpecs(SEG))), ['Periodontia', 'Endodontia']);
    assert.deepEqual(destaques(await masterFeed(allSpecs(TER))), ['Endodontia', 'Dentística']);
    assert.deepEqual(destaques(await masterFeed(allSpecs(QUA))), ['Dentística', 'Prótese']);
    assert.deepEqual(destaques(await masterFeed(allSpecs(DOM))), ['DTM e Dor Orofacial', 'Radiologia']);
  });

  test('feed mestre anuncia a URL canônica /podcast.xml (atom:self) — estável p/ Spotify', async () => {
    const xml = await masterFeed(allSpecs(SEG));
    assert.ok(xml.includes('<atom:link href="https://odontofeed.com/podcast.xml" rel="self"'), 'atom:self não é /podcast.xml');
    assert.ok(!/<atom:link href="[^"]*\/\.netlify\/functions\/podcast-rss" rel="self"/.test(xml), 'ainda expõe o caminho da function no self');
  });

  test('domingo também publica (o ciclo diário não pula dia)', async () => {
    const xml = await masterFeed(allSpecs(DOM));
    assert.equal(destaques(xml).length, 2);
    assert.ok(xml.includes('OdontoFeed — Ciência Odontológica Diária'));
  });

  test('uma semana de episódios → 2 itens por dia, seguindo o ciclo', async () => {
    const dias = [SEG, TER, QUA, QUI, SEX, SAB, DOM];
    const xml = await masterFeed(dias.flatMap(allSpecs));
    assert.deepEqual(destaques(xml), [
      'DTM e Dor Orofacial', 'Radiologia',       // Dom
      'Odontopediatria', 'DTM e Dor Orofacial',  // Sáb
      'Bucomaxilofacial', 'Odontopediatria',     // Sex
      'Prótese', 'Bucomaxilofacial',             // Qui
      'Dentística', 'Prótese',                   // Qua
      'Endodontia', 'Dentística',                // Ter
      'Periodontia', 'Endodontia',               // Seg
    ]);
  });

  test('ordena por data (mais recente primeiro)', async () => {
    const eps = [...allSpecs(SEG), ...allSpecs(TER)];
    assert.deepEqual(destaques(await masterFeed(eps)),
      ['Endodontia', 'Dentística', 'Periodontia', 'Endodontia']);
  });

  test('BUG 21/07: especialidade do dia sem episódio → as próximas do ciclo GERADAS', async () => {
    // 21/07 (dia de Endodontia) mas só Ortodontia e Prótese geradas: na ordem
    // do ciclo rotacionado a partir de Endodontia, Prótese vem antes de
    // Ortodontia — publica as duas, nunca fica sem itens.
    assert.deepEqual(destaques(await masterFeed([ep('Prótese', TER), ep('Ortodontia', TER)])), ['Prótese', 'Ortodontia']);
    // Só 1 especialidade gerada → 1 item (o mínimo possível).
    assert.deepEqual(destaques(await masterFeed([ep('Periodontia', TER)])), ['Periodontia']);
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

  test('sem NENHUM compilado (transição) → cai no episódio 1, sem quebrar', async () => {
    const xml = await masterFeed([ep('Endodontia', SEG, 1), ep('Endodontia', SEG, 2)]);
    assert.equal((xml.match(/<item>/g) || []).length, 1);
    assert.ok(xml.includes('ep1.mp3'));
    assert.ok(!xml.includes('<itunes:duration>')); // episódio antigo sem secs não inventa duração
  });

  test('havendo compiladas, NÃO mistura avulsos de dias sem compilado', async () => {
    // TER (21/07) tem as compiladas de Endodontia e Prótese; um dia legado
    // (19/07) só tem avulso. O feed publica SÓ as 2 compiladas — o dia sem
    // compilada fica de fora (o avulso não aparece).
    const eps = [completo('Endodontia', TER), completo('Prótese', TER), ep('Endodontia', '2026-07-19', 1)];
    const xml = await masterFeed(eps);
    assert.equal((xml.match(/<item>/g) || []).length, 2);
    assert.equal((xml.match(/edicao-completa\.mp3/g) || []).length, 2);
    assert.ok(!xml.includes('2026-07-19'), 'dia sem compilada não deveria aparecer');
    assert.deepEqual(destaques(xml), ['Endodontia', 'Prótese']);
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
