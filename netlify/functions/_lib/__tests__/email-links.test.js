// Tests da diretriz 20/07/2026 do e-mail: NENHUM link leva ao artigo original
// nem à página avulsa da edição — tudo aponta para a ÁREA DE MEMBRO (dashboard,
// onde a publicidade acontece), com o login pré-preenchido (le) para quem está
// sem sessão. Cliques rastreados por artigo via track-click.
// Run: node --test netlify/functions/_lib/__tests__/email-links.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { buildDigestEmail } = require('../email-template');

const BASE = 'https://odontofeed.com';
const MEMBER_URL = BASE + '/dashboard.html?utm_source=email&utm_medium=digest&le=' + encodeURIComponent('ana@x.com');

function build(extra = {}) {
  const user = { nome: 'Ana Silva', email: 'ana@x.com', especialidade: 'Prótese' };
  const articles = [
    { pmid: '111', titulo_pt: 'Pino e núcleo: fundição vs 3D', resumo_pt: 'r1', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/111/', nivel_evidencia: 'RCT', journal: 'J Prosthet Dent', year: '2026', tema: 'Pinos' },
    { pmid: '222', titulo_pt: 'Sobredentaduras mandibulares', resumo_pt: 'r2', pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/222/', nivel_evidencia: 'Meta-análise', journal: 'JPD', year: '2026', tema: 'Sobredentaduras' },
    { pmid: '333', titulo_pt: 'Zircônia monolítica', resumo_pt: 'r3', doi: '10.1000/zzz', nivel_evidencia: 'Estudo Coorte', journal: 'JPD', year: '2026', tema: 'Cerâmicas' },
  ];
  return buildDigestEmail(user, articles, {
    digestId: 'dig-1', baseUrl: BASE, unsubscribeToken: 'unsub',
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

describe('email — links levam à ÁREA DE MEMBRO (não ao artigo, não à página avulsa)', () => {
  test('nenhum href aponta para PubMed/DOI nem para edicao.html', () => {
    const { html } = build();
    for (const h of hrefs(html)) {
      assert.ok(!/pubmed\.ncbi\.nlm\.nih\.gov/.test(h), 'href para PubMed encontrado: ' + h);
      assert.ok(!/doi\.org/.test(h), 'href para doi.org encontrado: ' + h);
      assert.ok(!/edicao\.html/.test(h), 'href para a página avulsa da edição: ' + h);
    }
  });

  test('rótulo é "Abrir no OdontoFeed" em todos os cards (3 base + 2 premium); "Abrir artigo" sumiu', () => {
    const { html } = build();
    assert.equal((html.match(/Abrir no OdontoFeed/g) || []).length, 5);
    assert.ok(!html.includes('Abrir artigo'));
  });

  test('links dos cards passam pelo track-click com destino = dashboard com login pré-preenchido (le)', () => {
    const { html } = build();
    const expectedT = Buffer.from(MEMBER_URL, 'utf8').toString('base64url');
    const tracked = hrefs(html).filter(h => h.includes('/.netlify/functions/track-click?'));
    // 5 cards × 2 links (título + botão) = 10 links rastreados
    assert.equal(tracked.length, 10, 'tracked=' + tracked.length);
    for (const h of tracked) {
      assert.ok(h.includes('t=' + expectedT), 'destino do track-click não é a área de membro: ' + h);
    }
    // pmid presente por card (métrica de clique POR ARTIGO preservada)
    for (const pmid of ['111', '222', '333', '444', '555']) {
      assert.ok(tracked.some(h => h.includes('p=' + pmid)), 'sem clique rastreado do artigo ' + pmid);
    }
  });

  test('cada card tem a linha de feedback 👍/👎 apontando para feedback-artigo com ehash', () => {
    const { html } = build();
    const fb = hrefs(html).filter(h => h.includes('/.netlify/functions/feedback-artigo?'));
    // 5 cards × 2 votos (Sim/Pouco) = 10 links
    assert.equal(fb.length, 10, 'fb=' + fb.length);
    assert.ok(fb.every(h => /e=[a-f0-9]{16}/.test(h)), 'ehash ausente');
    assert.equal(fb.filter(h => h.includes('v=up')).length, 5);
    assert.equal(fb.filter(h => h.includes('v=down')).length, 5);
    for (const pmid of ['111', '222', '333', '444', '555']) {
      assert.ok(fb.some(h => h.includes('p=' + pmid)), 'sem feedback do artigo ' + pmid);
    }
    assert.ok(html.includes('Este estudo foi relevante'));
  });

  test('CTA principal "Abrir minha área no OdontoFeed" aponta direto para o dashboard', () => {
    const { html } = build();
    assert.ok(html.includes('Abrir minha &aacute;rea no OdontoFeed'));
    const cta = hrefs(html).find(h => h.startsWith(BASE + '/dashboard.html'));
    assert.ok(cta, 'CTA do dashboard ausente');
    assert.ok(cta.includes('le=ana%40x.com'), 'login pré-preenchido ausente no CTA');
  });

  test('e-mail não referencia player/arquivo de áudio (áudio só no site)', () => {
    const { html } = build();
    assert.ok(!/<audio|\.mp3|firebasestorage/i.test(html));
  });

  test('card premium: prosa fluida renderiza limpa; formato legado com títulos ganha destaque (compat)', () => {
    // Formato vigente (v2): prosa fluida — sem <strong> de seção
    const prosa = 'O estudo avaliou a adesão em zircônia com 40 amostras in vitro. O primer de MDP aumentou a resistência de união, e o protocolo com jateamento mostrou-se o mais confiável na prática.';
    const r1 = build({ premiumExtras: [{ pmid: '444', titulo_pt: 'Extra', resumo_completo: prosa, nivel_evidencia: 'RCT', journal: 'JPD' }] });
    assert.ok(r1.html.includes('O primer de MDP aumentou'), 'corpo do resumo ausente');
    assert.ok(!/<strong[^>]*>Objetivo<\/strong>/.test(r1.html), 'prosa não deve ganhar títulos');
    // Compatibilidade: resumo legado com títulos (janela 19/07) ainda renderiza legível
    const comTitulos = 'Objetivo\nAvaliar a adesão em zircônia.\n\nResultados\nO primer de MDP aumentou a resistência de união.\n\nMateriais e métodos\nEnsaio in vitro.\n\nRelevância clínica\nJateamento + MDP.';
    const r2 = build({ premiumExtras: [{ pmid: '444', titulo_pt: 'Extra', resumo_completo: comTitulos, nivel_evidencia: 'RCT', journal: 'JPD' }] });
    assert.ok(/<strong[^>]*>Resultados<\/strong>/.test(r2.html), 'título legado sem destaque');
  });
});
