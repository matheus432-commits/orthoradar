// Tests for digest-validator.js
// Run: node --test netlify/functions/_lib/__tests__/digest-validator.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { validateDigest } = require('../digest-validator');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  return {
    email: 'dentista@exemplo.com',
    especialidade: 'Ortodontia',
    especialidades: ['Ortodontia'],
    ...overrides,
  };
}

function makeArticle(overrides = {}) {
  return {
    pmid: '12345678',
    titulo_pt: 'Eficácia dos alinhadores invisíveis no tratamento de má oclusão Classe II',
    resumo_pt: 'Este estudo randomizado avaliou 120 pacientes tratados com alinhadores e brackets convencionais. ' +
               'Os alinhadores demonstraram eficácia equivalente para movimentos de intrusão e torque, ' +
               'com satisfação estética superior (p<0.001). Tempo médio de tratamento: 18 meses.',
    nivel_evidencia: 'RCT',
    journal: 'American Journal of Orthodontics',
    especialidade: 'Ortodontia',
    impacto_pratico: 'Alinhadores são opção viável para má oclusão moderada.',
    ...overrides,
  };
}

function makeArticles(n = 3, overrides = []) {
  return Array.from({ length: n }, (_, i) => makeArticle({
    pmid: String(10000000 + i),
    titulo_pt: `Artigo de teste número ${i + 1} sobre ortodontia clínica`,
    ...overrides[i],
  }));
}

const VALID_HTML = '<html lang="pt-BR"><body><div class="digest">conteúdo track-open track-click unsubscribe odontofeed artigos</div></body></html>';

// ── STRUCTURE tests ───────────────────────────────────────────────────────────

describe('STRUCTURE — article count', () => {
  test('valid digest (3 articles) passes', () => {
    const r = validateDigest({ user: makeUser(), articles: makeArticles(3), html: VALID_HTML });
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  // A edição base é validada com no máximo 3 artigos — os extras Premium são
  // renderizados à parte e NÃO passam por esta validação (daily-digest chama
  // runValidation apenas com os 3 selecionados da edição).
  test('digest with 5 articles fails (base máx 3)', () => {
    const r = validateDigest({ user: makeUser(), articles: makeArticles(5), html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('STRUCTURE')));
  });

  test('too few articles (2) fails', () => {
    const r = validateDigest({ user: makeUser(), articles: makeArticles(2), html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('STRUCTURE')));
  });

  test('zero articles fails', () => {
    const r = validateDigest({ user: makeUser(), articles: [], html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('STRUCTURE')));
  });

  test('null articles fails', () => {
    const r = validateDigest({ user: makeUser(), articles: null, html: VALID_HTML });
    assert.equal(r.valid, false);
  });

  test('too many articles (6) fails', () => {
    const r = validateDigest({ user: makeUser(), articles: makeArticles(6), html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('STRUCTURE') && e.includes('maximum')));
  });
});

describe('STRUCTURE — per article fields', () => {
  test('missing PMID fails', () => {
    const articles = makeArticles(3);
    articles[0].pmid = '';
    delete articles[0].id;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('PMID')));
  });

  test('duplicate PMIDs fail', () => {
    const articles = makeArticles(3);
    articles[1].pmid = articles[0].pmid;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('duplicate PMID')));
  });

  test('missing title fails', () => {
    const articles = makeArticles(3);
    articles[0].titulo_pt = '';
    delete articles[0].titulo;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('missing title')));
  });

  test('missing resumo fails', () => {
    const articles = makeArticles(3);
    articles[0].resumo_pt = '';
    delete articles[0].abstract;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('resumo too short')));
  });

  test('resumo too short fails', () => {
    const articles = makeArticles(3);
    articles[0].resumo_pt = 'Texto curto.';
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('resumo too short')));
  });

  test('generic resumo fails', () => {
    const articles = makeArticles(3);
    // Must be > 50 chars but match the generic pattern
    articles[0].resumo_pt = 'Resumo não disponível para este artigo científico no momento da publicação deste digest.';
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('generic/empty pattern')));
  });

  test('"No abstract available" resumo fails', () => {
    const articles = makeArticles(3);
    articles[0].resumo_pt = 'No abstract available.';
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
  });

  test('missing nivel_evidencia fails', () => {
    const articles = makeArticles(3);
    delete articles[0].nivel_evidencia;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('nivel_evidencia')));
  });

  test('missing journal is a warning (not a blocking error)', () => {
    const articles = makeArticles(3);
    delete articles[0].journal;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some(w => w.includes('journal')));
  });

  test('missing especialidade fails', () => {
    const articles = makeArticles(3);
    delete articles[0].especialidade;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('especialidade')));
  });

  test('missing impacto_pratico is only a warning', () => {
    const articles = makeArticles(3);
    delete articles[0].impacto_pratico;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    // Should still be valid (impacto_pratico is warn-only)
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some(w => w.includes('impacto_pratico')));
  });
});

// ── CONSISTENCY tests ─────────────────────────────────────────────────────────

describe('CONSISTENCY', () => {
  test('all articles wrong specialty fails', () => {
    const articles = makeArticles(3, [{}, {}, {}].map(() => ({ especialidade: 'Implantodontia' })));
    const user = makeUser({ especialidades: ['Ortodontia'] });
    const r = validateDigest({ user, articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('CONSISTENCY') && e.includes('ALL')));
  });

  test('some articles wrong specialty is only a warning', () => {
    const articles = makeArticles(3);
    articles[0].especialidade = 'Implantodontia';
    const user = makeUser({ especialidades: ['Ortodontia'] });
    const r = validateDigest({ user, articles, html: VALID_HTML });
    // Only 1 out of 3 wrong — should warn, not fail
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some(w => w.includes('different specialty')));
  });

  test('multi-specialty user: articles from any of their specialties pass', () => {
    const articles = makeArticles(3, [
      { especialidade: 'Ortodontia' },
      { especialidade: 'Periodontia' },
      { especialidade: 'Ortodontia' },
    ]);
    const user = makeUser({ especialidades: ['Ortodontia', 'Periodontia'] });
    const r = validateDigest({ user, articles, html: VALID_HTML });
    assert.equal(r.valid, true);
    assert.equal(r.errors.filter(e => e.includes('CONSISTENCY')).length, 0);
  });

  test('duplicate titles fails', () => {
    const articles = makeArticles(3);
    articles[1].titulo_pt = articles[0].titulo_pt;
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('duplicate article title')));
  });
});

// ── USER tests ────────────────────────────────────────────────────────────────

describe('USER', () => {
  test('invalid email fails', () => {
    const r = validateDigest({
      user: makeUser({ email: 'nao-e-email' }),
      articles: makeArticles(3),
      html: VALID_HTML,
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('USER')));
  });

  test('missing email fails', () => {
    const r = validateDigest({
      user: makeUser({ email: '' }),
      articles: makeArticles(3),
      html: VALID_HTML,
    });
    assert.equal(r.valid, false);
  });

  test('user with no specialty fails', () => {
    const r = validateDigest({
      user: makeUser({ email: 'ok@ok.com', especialidade: '', especialidades: [] }),
      articles: makeArticles(3),
      html: VALID_HTML,
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('USER') && e.includes('specialty')));
  });
});

// ── RENDER tests ──────────────────────────────────────────────────────────────

describe('RENDER', () => {
  test('missing unsubscribe link fails', () => {
    const html = '<html lang="pt-BR"><body><div>conteudo track-open track-click artigos odontofeed</div></body></html>';
    const r = validateDigest({ user: makeUser(), articles: makeArticles(3), html });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('unsubscribe')));
  });

  test('empty HTML fails', () => {
    const r = validateDigest({ user: makeUser(), articles: makeArticles(3), html: '' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('RENDER')));
  });

  test('missing tracking pixel is only a warning', () => {
    // HTML without any tracking strings — should warn but not block send
    const html = '<html lang="pt-BR"><body><p>digest content</p><a href="/unsubscribe">unsubscribe</a></body></html>';
    const r = validateDigest({ user: makeUser(), articles: makeArticles(3), html });
    assert.equal(r.valid, true,
      `Expected valid=true, got errors: ${r.errors.join('; ')}`);
    assert.ok(
      r.warnings.some(w => w.includes('track')),
      `Expected a tracking warning. Got warnings: ${r.warnings.join('; ')}`
    );
  });

  test('missing html tag fails', () => {
    const html = '<body><div>conteudo track-open track-click unsubscribe artigos odontofeed odontologia</div></body>';
    const r = validateDigest({ user: makeUser(), articles: makeArticles(3), html });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.includes('<html>')));
  });
});

// ── QUALITY tests ─────────────────────────────────────────────────────────────

describe('QUALITY', () => {
  test('no high-evidence study is only a warning', () => {
    const articles = makeArticles(3, [
      { pmid: '30000001', nivel_evidencia: 'Caso Clínico' },
      { pmid: '30000002', nivel_evidencia: 'Caso Clínico' },
      { pmid: '30000003', nivel_evidencia: 'Caso Clínico' },
    ]);
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, true);
    assert.ok(r.warnings.some(w => w.includes('QUALITY')));
  });

  test('digest with at least one RCT has no quality warning', () => {
    const articles = makeArticles(3, [
      { nivel_evidencia: 'Caso Clínico' },
      { nivel_evidencia: 'RCT' },
      { nivel_evidencia: 'Caso Clínico' },
    ]);
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.ok(!r.warnings.some(w => w.includes('QUALITY')));
  });
});

// ── Multiple errors accumulate ────────────────────────────────────────────────

describe('Error accumulation', () => {
  test('multiple independent errors all reported', () => {
    const articles = makeArticles(2); // too few
    articles[0].resumo_pt = 'Curto.';  // also bad resumo
    const r = validateDigest({ user: makeUser(), articles, html: VALID_HTML });
    assert.equal(r.valid, false);
    assert.ok(r.errors.length >= 2, `Expected ≥2 errors, got ${r.errors.length}: ${r.errors.join('; ')}`);
  });

  test('warnings do not block valid digest', () => {
    const articles = makeArticles(3, [
      { pmid: '40000001', nivel_evidencia: 'Caso Clínico' },
      { pmid: '40000002' },
      { pmid: '40000003', impacto_pratico: '' },
    ]);
    // Missing track-open → warning only
    const html = '<html lang="pt-BR"><body><div>conteudo unsubscribe track-click artigos odontofeed</div></body></html>';
    const r = validateDigest({ user: makeUser(), articles, html });
    assert.equal(r.valid, true, `Should be valid but got errors: ${r.errors.join('; ')}`);
    assert.ok(r.warnings.length > 0);
  });
});
