// CAUSA-RAIZ do "sem áudio no site" (incidentes 04-08/08, achada em 08/08):
// o player do dashboard chamava play() num <audio preload="none"> com
// <source> FILHO — combinação que falha em silêncio no mobile — e o
// .catch(()=>{}) engolia o erro com o botão preso em "Ouvindo…" e 0:00.
// Admin e /biblioteca sempre tocaram porque usam src direto + controle nativo.
// Regressão: nenhum player do site pode voltar a esse padrão.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const src = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

describe('players de áudio à prova de mobile', () => {
  test('NENHUMA página usa <audio> com <source> filho (src sempre direto)', () => {
    for (const f of ['dashboard.html', 'edicao.html', 'biblioteca.html', 'admin.html', 'arquivo.html']) {
      const html = src(f);
      assert.ok(!/<audio[^>]*>\s*<source/i.test(html),
        `${f}: <audio> com <source> filho — play() falha em silêncio no mobile`);
    }
  });

  test('dashboard: load() antes do play() e botão só vira "Ouvindo…" com o play confirmado', () => {
    const d = src('dashboard.html');
    assert.ok(d.includes('if(a.readyState===0) a.load();'), 'preload=none exige load() antes do play()');
    assert.match(d, /a\.play\(\)\.then\(\(\)=>\{ btn\.innerHTML='🎧 Ouvindo…'/, 'estado "Ouvindo…" só após o play resolver');
    assert.ok(!/a\.play\(\)\.catch\(\(\)=>\{\}\)/.test(d), 'erro de play não pode mais ser engolido');
  });

  test('edicao.html: mesmo padrão (load antes, ⏸ só com play confirmado)', () => {
    const e = src('edicao.html');
    assert.ok(e.includes('if (audio.readyState === 0) audio.load();'));
    assert.match(e, /audio\.play\(\)\.then\(/);
  });
});
