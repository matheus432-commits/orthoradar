// Tests da identidade por especialidade e do ciclo diário de publicação.
// Run: node --test netlify/functions/_lib/__tests__/especialidade-identidade.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { CICLO, CORES, corDe, especialidadeDoDia, capaFontPx } = require('../especialidade-identidade');

describe('especialidade-identidade', () => {
  test('as 11 especialidades têm cor única', () => {
    assert.equal(CICLO.length, 11);
    const cores = CICLO.map(corDe);
    assert.equal(new Set(cores).size, 11, 'há cores repetidas');
    for (const e of CICLO) assert.ok(/^#[0-9A-Fa-f]{6}$/.test(CORES[e]), 'cor inválida: ' + e);
  });

  test('corDe usa fallback (ciano da marca) p/ especialidade fora do mapa', () => {
    assert.equal(corDe('Inexistente'), '#37D7E7');
  });

  test('especialidadeDoDia é determinística e gira o ciclo dia a dia', () => {
    // Datas consecutivas → especialidades consecutivas no ciclo, sem repetir em 11 dias.
    const base = '2026-07-20';
    const seq = [];
    for (let i = 0; i < 11; i++) {
      const d = new Date(Date.parse(base + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10);
      seq.push(especialidadeDoDia(d));
    }
    assert.equal(new Set(seq).size, 11, 'não cobriu as 11 em 11 dias');
    // Consecutivas seguem a ordem do CICLO
    const start = CICLO.indexOf(seq[0]);
    for (let i = 0; i < 11; i++) {
      assert.equal(seq[i], CICLO[(start + i) % 11]);
    }
  });

  test('mesma data sempre devolve a mesma especialidade', () => {
    assert.equal(especialidadeDoDia('2026-07-20'), especialidadeDoDia('2026-07-20'));
    // e volta ao mesmo ponto 11 dias depois
    const d0 = '2026-07-20';
    const d11 = new Date(Date.parse(d0 + 'T00:00:00Z') + 11 * 86400000).toISOString().slice(0, 10);
    assert.equal(especialidadeDoDia(d0), especialidadeDoDia(d11));
  });

  test('capaFontPx encolhe conforme o nome cresce', () => {
    assert.ok(capaFontPx('Prótese') > capaFontPx('Bucomaxilofacial'));
    assert.ok(capaFontPx('Bucomaxilofacial') >= capaFontPx('DTM e Dor Orofacial'));
  });
});
