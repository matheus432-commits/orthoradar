// VIGIA DO PIPELINE DIÁRIO — roda no NETLIFY, fora do GitHub (incidente 27-28/08).
//
// O agendador do GitHub Actions degradou: o cron do daily-pipeline atrasou 11
// horas em 27/08 e não disparou em 28/08. Este vigia é a camada DEFINITIVA:
// agendado no Netlify (infra independente), ele confere às 06:30 UTC
// (03:30 BRT) se a edição de hoje existe; se não existir, dispara o
// daily-pipeline via API do GitHub (workflow_dispatch) — exatamente a rodada
// que deveria ter acontecido, nunca uma rodada extra:
//   • edição presente (>= MINIMO digests)  → não faz nada;
//   • já disparou hoje (doc de auditoria)  → não dispara de novo (idempotente);
//   • sem GITHUB_DISPATCH_TOKEN configurado → só loga o alerta.
// O run disparado ainda passa pela guarda de duplicidade do próprio workflow.
//
// Configuração (uma vez, pelo fundador): criar um fine-grained PAT no GitHub
// (repositório orthoradar, permissão "Actions: Read and write", mais nada) e
// salvar como env GITHUB_DISPATCH_TOKEN no Netlify.

const { Firestore } = require('./_lib/firestore');
const { request } = require('./_lib');
const { digestsDeHoje, MINIMO_DIGESTS } = require('../../scripts/edicao-do-dia-existe');
const log = require('./_lib/logger');

const GITHUB_REPO = process.env.GITHUB_REPO || 'matheus432-commits/orthoradar';

// Decisão pura (testada em pipeline-scheduler.test.js).
function decidirWatchdog({ digestsHoje, jaDisparadoHoje, temToken }) {
  if (digestsHoje >= MINIMO_DIGESTS) return { acao: 'nada', motivo: `edição presente (${digestsHoje} digests)` };
  if (jaDisparadoHoje) return { acao: 'nada', motivo: 'já disparado hoje pelo vigia — aguardando o run' };
  if (!temToken) return { acao: 'sem_token', motivo: 'edição AUSENTE e GITHUB_DISPATCH_TOKEN não configurado' };
  return { acao: 'disparar', motivo: `edição ausente (${digestsHoje} digests) — disparando o pipeline` };
}

async function dispararPipeline(token) {
  const body = Buffer.from(JSON.stringify({ ref: 'main' }), 'utf8');
  const res = await request({
    hostname: 'api.github.com',
    path: `/repos/${GITHUB_REPO}/actions/workflows/daily-pipeline.yml/dispatches`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'odontofeed-pipeline-watchdog',
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  }, body);
  return res.status; // 204 = disparado
}

exports.handler = async () => {
  const headers = { 'Content-Type': 'application/json' };
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    const digestsHoje = await digestsDeHoje(db, hoje);
    const marca = await db.getDoc('pipeline_watchdog', hoje).catch(() => null);
    const token = process.env.GITHUB_DISPATCH_TOKEN || '';

    const d = decidirWatchdog({ digestsHoje, jaDisparadoHoje: !!(marca && marca.disparado), temToken: !!token });
    log.info('[watchdog] decisão', { hoje, digestsHoje, acao: d.acao, motivo: d.motivo });

    if (d.acao === 'disparar') {
      const status = await dispararPipeline(token);
      const ok = status === 204;
      // Marca ANTES de qualquer nova execução do vigia — nunca 2 disparos/dia.
      await db.setDoc('pipeline_watchdog', hoje, {
        disparado: ok, http_status: status, digests_no_momento: digestsHoje,
        em: new Date().toISOString(),
      });
      log.info('[watchdog] dispatch', { hoje, status, ok });
      return { statusCode: 200, headers, body: JSON.stringify({ acao: ok ? 'disparado' : 'falha_dispatch', http_status: status }) };
    }

    if (d.acao === 'sem_token') {
      // Sem o PAT o vigia só consegue avisar — deixa o alerta gravado para o
      // painel e nos logs do Netlify.
      await db.setDoc('pipeline_watchdog', hoje, { disparado: false, sem_token: true, digests_no_momento: digestsHoje, em: new Date().toISOString() });
      log.warn('[watchdog] edição ausente e sem GITHUB_DISPATCH_TOKEN — configure o PAT no Netlify para o disparo automático');
    }

    return { statusCode: 200, headers, body: JSON.stringify({ acao: d.acao, motivo: d.motivo, digests_hoje: digestsHoje }) };
  } catch (err) {
    log.error('[watchdog] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};

exports.decidirWatchdog = decidirWatchdog;
