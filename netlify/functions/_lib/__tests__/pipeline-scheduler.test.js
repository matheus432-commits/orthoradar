// Tests da DEFESA CONTRA O AGENDADOR DO GITHUB (incidente 27-28/08): o cron
// único de 03:00 UTC atrasou 11h num dia e não disparou no outro — dois dias
// sem edição na hora. A defesa tem 3 camadas, e cada uma tem contrato aqui:
//   1. DOIS crons em minutos fora de pico no daily-pipeline.yml;
//   2. Guarda de duplicidade: só a primeira execução do dia trabalha
//      (disparo manual do fundador roda SEMPRE);
//   3. Vigia no Netlify (infra independente): dispara o pipeline se a edição
//      não existir até 06:30 UTC — no máximo 1 disparo/dia.
//
// Run: node --test netlify/functions/_lib/__tests__/pipeline-scheduler.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const src = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');

const { decidir, MINIMO_DIGESTS } = require('../../../../scripts/edicao-do-dia-existe');
const { decidirWatchdog } = require('../../pipeline-watchdog');

describe('guarda de duplicidade — decisão pura', () => {
  test('disparo manual roda SEMPRE, mesmo com a edição pronta (clique do fundador é soberano)', () => {
    assert.equal(decidir({ eventName: 'workflow_dispatch', digestsHoje: 11 }).rodar, true);
    assert.equal(decidir({ eventName: 'workflow_dispatch', digestsHoje: 0 }).rodar, true);
  });
  test('schedule com edição pronta → NÃO roda (segundo cron do dia vira no-op)', () => {
    const d = decidir({ eventName: 'schedule', digestsHoje: 11 });
    assert.equal(d.rodar, false);
    assert.match(d.motivo, /já existe/);
  });
  test('schedule sem edição → roda; edição PARCIAL (< mínimo) → roda para completar', () => {
    assert.equal(decidir({ eventName: 'schedule', digestsHoje: 0 }).rodar, true);
    assert.equal(decidir({ eventName: 'schedule', digestsHoje: MINIMO_DIGESTS - 1 }).rodar, true);
    assert.equal(decidir({ eventName: 'schedule', digestsHoje: MINIMO_DIGESTS }).rodar, false);
  });
  test('FAIL-OPEN: consulta ao Firestore falhou → roda (nunca um dia sem edição pela própria proteção)', () => {
    const d = decidir({ eventName: 'schedule', digestsHoje: 0, erroConsulta: 'timeout' });
    assert.equal(d.rodar, true);
    assert.match(d.motivo, /fail-open/);
  });
});

describe('vigia (Netlify) — decisão pura', () => {
  test('edição presente → nada a fazer', () => {
    assert.equal(decidirWatchdog({ digestsHoje: 10, jaDisparadoHoje: false, temToken: true }).acao, 'nada');
  });
  test('edição ausente + token → dispara', () => {
    assert.equal(decidirWatchdog({ digestsHoje: 0, jaDisparadoHoje: false, temToken: true }).acao, 'disparar');
  });
  test('IDEMPOTENTE: já disparou hoje → nunca um segundo disparo no mesmo dia', () => {
    assert.equal(decidirWatchdog({ digestsHoje: 0, jaDisparadoHoje: true, temToken: true }).acao, 'nada');
  });
  test('sem GITHUB_DISPATCH_TOKEN → só alerta, nunca tenta chamar a API', () => {
    assert.equal(decidirWatchdog({ digestsHoje: 0, jaDisparadoHoje: false, temToken: false }).acao, 'sem_token');
  });
});

describe('fiação — workflow, netlify.toml e função (guardas de regressão)', () => {
  const wf = src('.github', 'workflows', 'daily-pipeline.yml');

  test('DOIS crons, ambos em minuto fora de pico (:00 é o horário mais descartado)', () => {
    const crons = [...wf.matchAll(/cron: '([^']+)'/g)].map(m => m[1]);
    assert.equal(crons.length, 2, 'redundância de horários');
    for (const c of crons) {
      const minuto = Number(c.split(' ')[0]);
      assert.ok(minuto !== 0, `cron "${c}" não pode voltar ao minuto 0`);
      assert.match(c, /^\d+ \d ?\d? \* \* \*$/, 'diário');
    }
  });
  test('job guard existe, roda o script certo e exporta a decisão', () => {
    assert.ok(wf.includes('guard:'), 'job guard');
    assert.ok(wf.includes('scripts/edicao-do-dia-existe.js'));
    assert.ok(wf.includes('rodar: ${{ steps.decidir.outputs.rodar }}'));
  });
  test('TODOS os jobs de trabalho respeitam a guarda (ingest, email, podcasts, audit)', () => {
    const ocorrencias = (wf.match(/needs\.guard\.outputs\.rodar == 'true'/g) || []).length;
    assert.equal(ocorrencias, 4, 'os 4 jobs condicionados à guarda');
    assert.ok(wf.includes('needs: [guard, ingest]'), 'email declara guard em needs (senão o output some)');
    assert.ok(wf.includes('needs: [guard, email]'), 'podcasts idem');
    assert.ok(wf.includes('needs: [guard, email, podcasts]'), 'audit idem');
  });
  test('vigia agendado no netlify.toml DEPOIS das janelas de cron do GitHub', () => {
    const toml = src('netlify.toml');
    assert.match(toml, /\[functions\."pipeline-watchdog"\]\s*\n\s*schedule = "30 6 \* \* \*"/);
  });
  test('vigia: dispatch no workflow certo, com ref main e marca de auditoria', () => {
    const w = src('netlify', 'functions', 'pipeline-watchdog.js');
    assert.ok(w.includes('daily-pipeline.yml/dispatches'));
    assert.ok(w.includes("ref: 'main'"));
    assert.ok(w.includes("setDoc('pipeline_watchdog'"), 'registro do disparo (idempotência entre execuções)');
    assert.ok(!/log\.(info|warn|error)\([^)]*email/i.test(w), 'log sem PII');
  });
  test('o guarda usa a MESMA data (UTC) e a MESMA coleção que o daily-digest grava', () => {
    const g = src('scripts', 'edicao-do-dia-existe.js');
    assert.ok(g.includes("toISOString().slice(0, 10)"));
    assert.ok(g.includes("query('digests_especialidade'"));
    assert.ok(g.includes('GITHUB_OUTPUT'));
  });
});
