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
    // O único catch silencioso permitido é o da RECARGA automática — o
    // listener de 'error' é quem decide o desfecho dela (Tentar novamente).
    assert.ok(!/display='block';\s*a\.play\(\)\.catch\(\(\)=>\{\}\)/.test(d), 'o toggle principal não engole erro de play');
  });

  test('edicao.html: mesmo padrão (load antes, ⏸ só com play confirmado)', () => {
    const e = src('edicao.html');
    assert.ok(e.includes('if (audio.readyState === 0) audio.load();'));
    assert.match(e, /audio\.play\(\)\.then\(/);
  });

  // ── Incidente 10/08 (Prótese 0:00 recorrente) — camadas definitivas ────────
  test('dashboard: erro de carga → recarga automática 1x; persistindo → "Tentar novamente"', () => {
    const d = src('dashboard.html');
    assert.ok(d.includes("a.addEventListener('error'"), 'listener de erro no player');
    assert.ok(d.includes('a.load(); a.play()'), 'retry recarrega e toca');
    assert.ok(d.includes('Tentar novamente'), 'falha persistente vira ação visível');
    assert.ok(d.includes("a.addEventListener('playing'"), 'rótulo só afirma Ouvindo com áudio rodando');
    // 10/08 à tarde: "ainda não corrigiu" sem nenhum dado do aparelho — a
    // falha persistente agora EXPÕE o MediaError e o link direto do MP3, e o
    // botão "Tentar novamente" recarrega em vez de esconder o player.
    assert.ok(d.includes('function diagAudioDash'), 'diagnóstico visível na falha persistente');
    assert.ok(d.includes('Abrir o áudio direto'), 'link direto do MP3 para isolar player × rede');
    assert.ok(d.includes("a.dataset.retry==='1'"), 'clique em Tentar novamente recarrega no mesmo card');
  });
  test('MP3 sobe CACHEÁVEL (no-store era herança do latest.mp3 e travava mobile)', () => {
    const s = src('netlify/functions/_lib/storage.js');
    assert.match(s, /cacheControl: 'public, max-age=3600',\n\s+metadata: \{ firebaseStorageDownloadTokens/, 'áudio cacheável por 1h');
    assert.ok(s.includes('async function patchCacheControl'), 'cura dos objetos antigos sem rotacionar token');
    // Runs #2-#3 do backfill (10/08): PATCH de metadados exige full_control —
    // com read_write o GCS devolve 403 "Provided scope(s) are not authorized".
    assert.match(s, /patchCacheControl[\s\S]{0,400}devstorage\.full_control/, 'PATCH de metadados pede o escopo full_control');
  });
  test('vigia contínuo: URLs do dia re-verificadas de 2 em 2 horas, vermelho com timestamp', () => {
    const v = src('scripts/vigia-audio.js');
    assert.ok(v.includes('verifyUrl(e.url)'), 'verifica a URL persistida, a mesma do navegador');
    assert.ok(v.includes('process.exit(1)'), 'falha fica vermelha no Actions');
    const wf = src('.github/workflows/vigia-audio.yml');
    assert.match(wf, /cron: '15 7-23\/2 \* \* \*'/, 'agendado a cada 2h');
    assert.ok(!wf.includes('ANTHROPIC_API_KEY') && !wf.includes('GOOGLE_TTS_API_KEY'), 'sem chaves de IA/TTS no vigia — custo zero');
  });
});
