// Tests da diretriz 19/07/2026 do e-mail: NENHUM link de artigo leva ao artigo
// original — tudo aponta para a edição no OdontoFeed (edicaoUrl), rastreado por
// artigo via track-click. O e-mail não entrega áudio: ele acontece no site.
// Run: node --test netlify/functions/_lib/__tests__/email-links.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildDigestEmail } = require('../email-template');

const BASE = 'https://odontofeed.com';
const EDICAO_URL = 'https://odontofeed.com/edicao.html?e=ana%40x.com&t=tok123';

function build(extra = {}) {
  const user = { nome: 'Ana Silva', email: 'ana@x.com', especialidade: 'Prótese' };
  const articles = [
    { pmid: '111', titulo_pt: 'Pino e núcleo: fundição vs 3D', resumo_pt: 'r1', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/111/', nivel_evidencia: 'RCT', journal: 'J Prosthet Dent', year: '2026', tema: 'Pinos' },
    { pmid: '222', titulo_pt: 'Sobredentaduras mandibulares', resumo_pt: 'r2', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/222/', nivel_evidencia: 'Meta-análise', journal: 'JPD', year: '2026', tema: 'Sobredentaduras' },
    { pmid: '333', titulo_pt: 'Zircônia monolítica', resumo_pt: 'r3', doi: '10.1000/zzz', nivel_evidencia: 'Estudo Coorte', journal: 'JPD', year: '2026', tema: 'Cerâmicas' },
  ];
  return buildDigestEmail(user, articles, {
    digestId: 'dig-1', baseUrl: BASE, unsubscribeToken: 'unsub',
    edicaoUrl: EDICAO_URL,
    premiumExtras: [
      { pmid: '444', titulo_pt: 'Extra Premium Um', resumo_completo: 'e1', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/444/', nivel_evidencia: 'RCT', journal: 'JPD' },
      { pmid: '555', titulo_pt: 'Extra Premium Dois', resumo_completo: 'e2', doi: '10.1000/www', nivel_evidencia: 'RCT', journal: 'JPD' },
    ],
    ...extra,
  });
}

// Extrai todos os href="..." do HTML.
function hrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
}

describe('email — links levam ao OdontoFeed (não ao artigo)', () => {
  test('nenhum href aponta para PubMed/DOI (artigo original fora do e-mail)', () => {
    const { html } = build();
    for (const h of hrefs(html)) {
      assert.ok(!/pubmed\.ncbi\.nlm\.nih\.gov/.test(h), 'href para PubMed encontrado: ' + h);
      assert.ok(!/doi\.org/.test(h), 'href para doi.org encontrado: ' + h);
    }
  });

  test('rótulo é "Abrir no OdontoFeed" em todos os cards (3 base + 2 premium); "Abrir artigo" sumiu', () => {
    const { html } = build();
    assert.equal((html.match(/Abrir no OdontoFeed/g) || []).length, 5);
    assert.ok(!html.includes('Abrir artigo'));
  });

  test('links dos cards passam pelo track-click com destino = edicaoUrl (métrica de visita ao site)', () => {
    const { html } = build();
    const expectedT = Buffer.from(EDICAO_URL, 'utf8').toString('base64url');
    const tracked = hrefs(html).filter(h => h.includes('/.netlify/functions/track-click?'));
    // 5 cards × 2 links (título + botão) = 10 links rastreados
    assert.equal(tracked.length, 10, 'tracked=' + tracked.length);
    for (const h of tracked) {
      assert.ok(h.includes('t=' + expectedT), 'destino do track-click não é a edicaoUrl: ' + h);
    }
    // pmid presente por card (métrica de clique POR ARTIGO preservada)
    for (const pmid of ['111', '222', '333', '444', '555']) {
      assert.ok(tracked.some(h => h.includes('p=' + pmid)), 'sem clique rastreado do artigo ' + pmid);
    }
  });

  test('sem edicaoUrl → cai no dashboard do site (nunca no artigo)', () => {
    const { html } = build({ edicaoUrl: '' });
    const expectedT = Buffer.from(BASE + '/dashboard.html', 'utf8').toString('base64url');
    const tracked = hrefs(html).filter(h => h.includes('/.netlify/functions/track-click?'));
    assert.equal(tracked.length, 10);
    for (const h of tracked) assert.ok(h.includes('t=' + expectedT));
  });

  test('e-mail não referencia player/arquivo de áudio (áudio só no site)', () => {
    const { html } = build();
    assert.ok(!/<audio|\.mp3|firebasestorage/i.test(html));
  });

  test('card premium renderiza o resumo ESTRUTURADO com títulos de seção', () => {
    const estruturado = 'Objetivo\nAvaliar a adesão em zircônia.\n\nMateriais e métodos\nEnsaio in vitro com 40 amostras.\n\nResultados\nO primer de MDP aumentou a resistência de união.\n\nRelevância clínica\nJateamento + MDP é o protocolo mais confiável.';
    const { html } = build({ premiumExtras: [{ pmid: '444', titulo_pt: 'Extra', resumo_completo: estruturado, nivel_evidencia: 'RCT', journal: 'JPD' }] });
    for (const secao of ['Objetivo', 'Materiais e métodos', 'Resultados', 'Relevância clínica']) {
      assert.ok(new RegExp('<strong[^>]*>' + secao + '</strong>').test(html), 'seção sem destaque: ' + secao);
    }
    assert.ok(html.includes('O primer de MDP aumentou'), 'corpo do resumo ausente');
  });
});
