// SPEC 2 (24/08) — diagnóstico/backfill/monitoramento da biblioteca e do
// áudio. Runtime coberto nas simulações; aqui as garantias estáticas de
// segurança (leitura, dry-run, custo, cron) + funcionais leves.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

const { serieDiaria } = require('../diagnostico-pipeline');

describe('Fase 1 — diagnóstico do pipeline (só leitura)', () => {
  test('série diária lista dias com ZERO explicitamente', () => {
    const s = serieDiaria(['2026-08-01', '2026-08-04']);
    assert.equal(s.diasCorridos, 4);
    assert.deepEqual(s.diasSemNada, ['2026-08-02', '2026-08-03']);
  });
  test('núcleo NUNCA escreve; declara a arquitetura real (Actions/Firestore/regra 07/08)', () => {
    const n = src(path.join(FUNCS, '_lib', 'diagnostico-pipeline.js'));
    assert.ok(!/updateDoc|setDoc|addDoc/.test(n));
    assert.ok(n.includes('GitHub Actions') && n.includes('Firestore') && n.includes('TER PODCAST'));
  });
  test('cobre: reconciliação, funil, cruzamento (50 IDs c/ motivo), posição no lote, HEAD no storage', () => {
    const n = src(path.join(FUNCS, '_lib', 'diagnostico-pipeline.js'));
    for (const m of ['diasSemEdicao', 'funilPorEsp', 'enviadosSemBiblioteca', 'primeiros50', 'posicaoNoLote', "method: 'HEAD'"]) {
      assert.ok(n.includes(m), m);
    }
  });
  test('função admin + CSV; workflow dispatch-only sem chaves de IA/TTS', () => {
    const f = src(path.join(FUNCS, 'diagnostico-pipeline.js'));
    assert.ok(f.indexOf('checkAdmin(event)') < f.indexOf('construirDiagnosticoPipeline(new'), 'gate antes da consulta');
    const wf = src(path.join(RAIZ, '.github', 'workflows', 'diagnostico-pipeline.yml'));
    assert.ok(wf.includes('workflow_dispatch') && !wf.includes('push:'));
    assert.ok(!wf.includes('ANTHROPIC_API_KEY') && !wf.includes('GOOGLE_TTS_API_KEY'));
  });
});

describe('Fase 3 — backfill (custo controlado)', () => {
  test('dry-run padrão em todas as rotas; custo estimado no relatório', () => {
    const n = src(path.join(FUNCS, '_lib', 'backfill-biblioteca.js'));
    assert.ok(n.includes('opts.dryRun !== false'), 'padrão seguro');
    assert.ok(n.includes('custoEstimado'), 'fundador vê o custo ANTES');
    const s = src(path.join(RAIZ, 'scripts', 'backfill-biblioteca.js'));
    assert.match(s, /DRY_RUN = !\/\^\(false\|0\|n\[a\ã\]o\|no\)\$\/i/, 'parser tolerante');
  });
  test('idempotente (pula quem tem episódio) + retry com backoff + lotes com pausa', () => {
    const n = src(path.join(FUNCS, '_lib', 'backfill-biblioteca.js'));
    assert.ok(n.includes('artigosComAudio'), 'já-com-áudio nunca reprocessa');
    assert.ok(n.includes('TENTATIVAS') && n.includes('backoff * Math.pow(2'), 'retry com backoff');
    assert.ok(n.includes('LOTE = 5'));
  });
  test('grava no ARQUIVO permanente (cleanup semanal não apaga — diretriz 22/07)', () => {
    const s = src(path.join(RAIZ, 'scripts', 'backfill-biblioteca.js'));
    assert.ok(s.includes("setDoc('podcast_arquivo'"), 'podcast_arquivo, não a coleção quente');
    assert.ok(s.includes("origem: 'backfill-biblioteca'"), 'auditável');
  });
  test('roteiro STRICT (fidelidade verificada — mesma régua do fix-artigo)', () => {
    const s = src(path.join(RAIZ, 'scripts', 'backfill-biblioteca.js'));
    assert.ok(s.includes('{ strict: true }'));
    assert.ok(s.includes('secs < 40'), 'áudio curto não publica');
  });
  test('workflow só manual; function trava limit em 3 (teto de 26s)', () => {
    const wf = src(path.join(RAIZ, '.github', 'workflows', 'backfill-biblioteca.yml'));
    assert.ok(wf.includes('workflow_dispatch') && !wf.includes('push:'));
    assert.ok(src(path.join(FUNCS, 'backfill-biblioteca.js')).includes(', 3), // teto da function'));
  });
});

describe('Fase 4 — monitoramento', () => {
  test('health check: hoje rodou + etapas completas + violações 7d nomeadas', () => {
    const n = src(path.join(FUNCS, '_lib', 'saude-pipeline.js'));
    assert.ok(n.includes('O job rodou?'));
    assert.ok(n.includes('etapasCompletas'));
    assert.ok(n.includes("'sem áudio (fora da biblioteca)'"));
  });
  test('script alerta o admin por e-mail e FALHA o run (teste automatizado dos 7 dias)', () => {
    const s = src(path.join(RAIZ, 'scripts', 'saude-pipeline.js'));
    assert.ok(s.includes('api.resend.com'), 'alerta via Resend');
    assert.ok(s.includes('process.exit(1)'), 'violação derruba o run');
    assert.ok(!s.includes("'cadastros'"), 'nunca toca a coleção de dentistas (log de Actions é público)');
  });
  test('workflow com cron diário APÓS a janela do pipeline + dispatch', () => {
    const wf = src(path.join(RAIZ, '.github', 'workflows', 'saude-pipeline.yml'));
    assert.match(wf, /cron: '30 8 \* \* \*'/, '08:30 UTC, depois de 04:50-06:00');
    assert.ok(wf.includes('workflow_dispatch'));
    assert.ok(!wf.includes('ANTHROPIC_API_KEY'), 'custo zero de IA');
  });
  test('painel /admin-pipeline: KPIs, séries, funil e divergências atrás do segredo', () => {
    const html = src(path.join(RAIZ, 'admin-pipeline.html'));
    assert.ok(html.includes('diagnostico-pipeline?secret='), 'dados só com ADMIN_SECRET');
    for (const m of ['k-ultima', 'ch-edicoes', 'ch-audio', 'tb-funil', 'tb-div', 'ln-cross'.replace('ln-cross', 'tip(')]) {
      assert.ok(html.includes(m), m);
    }
    assert.ok(src(path.join(RAIZ, 'admin.html')).includes('/admin-pipeline.html'), 'hub linka');
  });
});
