// GUARDA DE DUPLICIDADE do pipeline diário (incidente 27-28/08).
//
// O agendador do GitHub degradou: o cron único de 03:00 UTC atrasou 11 horas
// em 27/08 e simplesmente não disparou em 28/08 — dois dias seguidos sem
// edição na hora certa. A defesa é ter VÁRIOS horários de disparo + este
// guarda: ele olha no Firestore se a edição de HOJE já existe e decide se o
// run continua. Assim os horários extras custam ~10s de VM quando o dia já
// está feito — nunca uma segunda rodada de IA/e-mail.
//
// Decisão (pura, testada em pipeline-scheduler.test.js):
//   • workflow_dispatch  → RODA SEMPRE (clique do fundador é soberano —
//     force_send/regen/dry_run continuam funcionando como antes);
//   • schedule + edição de hoje já com >= MINIMO digests → NÃO roda;
//   • schedule + edição ausente/parcial → roda (o pipeline é idempotente:
//     completa o que falta, fadiga impede e-mail duplicado — comprovado no
//     re-run de 27/08: envio 29,5min → 9min, podcasts 22min → 2min);
//   • erro ao consultar o Firestore → RODA (fail-open: melhor uma rodada
//     idempotente a mais do que um dia sem edição).
//
// Saída: escreve `rodar=true|false` em $GITHUB_OUTPUT (e loga o motivo).

const MINIMO_DIGESTS = 8; // ~11 especialidades/dia; >= 8 = edição feita

// Decisão pura — recebe os fatos, devolve { rodar, motivo }.
function decidir({ eventName, digestsHoje, erroConsulta }) {
  if (eventName !== 'schedule') {
    return { rodar: true, motivo: `evento ${eventName || '(vazio)'} — disparo manual roda sempre` };
  }
  if (erroConsulta) {
    return { rodar: true, motivo: `consulta ao Firestore falhou (${erroConsulta}) — fail-open` };
  }
  if (digestsHoje >= MINIMO_DIGESTS) {
    return { rodar: false, motivo: `edição de hoje já existe (${digestsHoje} digests >= ${MINIMO_DIGESTS}) — nada a fazer` };
  }
  return { rodar: true, motivo: `edição de hoje ausente/parcial (${digestsHoje} digests < ${MINIMO_DIGESTS})` };
}

// Conta os digests de hoje (data UTC — a mesma que o daily-digest grava).
async function digestsDeHoje(db, hoje) {
  const docs = await db.query('digests_especialidade', {
    where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: hoje } } },
    select: { fields: [{ fieldPath: 'date' }] },
    limit: 100,
  });
  return docs.length;
}

async function main() {
  const { Firestore } = require('../netlify/functions/_lib/firestore');
  const fs = require('fs');
  const hoje = new Date().toISOString().slice(0, 10);
  const eventName = process.env.GITHUB_EVENT_NAME || '';

  let digestsHoje = 0, erroConsulta = null;
  if (eventName === 'schedule') {
    try {
      const db = new Firestore(process.env.FIREBASE_PROJECT_ID || 'orthoradar', process.env.FIREBASE_API_KEY);
      digestsHoje = await digestsDeHoje(db, hoje);
    } catch (e) { erroConsulta = e.message; }
  }

  const d = decidir({ eventName, digestsHoje, erroConsulta });
  console.log(`GUARDA ${hoje} · evento=${eventName} · ${d.motivo} → rodar=${d.rodar}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `rodar=${d.rodar}\n`);
}

if (require.main === module) {
  main().catch(e => {
    // Até o guarda quebrando, o pipeline RODA (fail-open) — nunca um dia sem
    // edição por culpa da própria proteção.
    console.error('GUARDA falhou:', e.message, '— seguindo com rodar=true');
    if (process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, 'rodar=true\n');
  });
}

module.exports = { decidir, digestsDeHoje, MINIMO_DIGESTS };
