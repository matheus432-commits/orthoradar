// Define o plano de assinatura de usuários — uso administrativo.
//
// Execução normal: GitHub Actions (workflow set-plano.yml, disparo manual) via
// `node netlify/functions/set-plano.js`. Como HTTP, exige o ADMIN_SECRET.
//
// Env:
//   PLANO            — 'premium' (default) ou 'gratuito'
//   EMAILS           — lista separada por vírgula; vazio = TODOS os ativos
//   APENAS_CORTESIA  — 'true' restringe aos usuários planoOrigem='cortesia'
//                      (downgrade seletivo no fim do período de cortesia)
//
// planoOrigem: 'cortesia' quando o Premium é dado de graça; 'padrao' após um
// downgrade; 'assinatura' será gravado pela cobrança quando existir. GUARDRAIL:
// no downgrade em massa (EMAILS vazio), usuários 'assinatura' NUNCA são
// rebaixados — só individualmente, listados explicitamente em EMAILS.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { normalizePlan } = require('./_lib/plans');
const log = require('./_lib/logger');

async function allUsers(db) {
  let users = [], pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users = users.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[set-plano] FIREBASE_API_KEY ausente'); return { error: 'no_firebase_key' }; }

  const plano  = normalizePlan(process.env.PLANO || 'premium');
  const emails = String(process.env.EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const apenasCortesia = String(process.env.APENAS_CORTESIA || '').toLowerCase() === 'true';

  const db = new Firestore(projectId, apiKey);
  const users = await allUsers(db);

  const alvo = users.filter(u => {
    if (u.ativo === false) return false;
    if (emails.length) return emails.includes(String(u.email || '').toLowerCase());
    if (apenasCortesia && u.planoOrigem !== 'cortesia') return false;
    return true;
  });

  log.info('[set-plano] iniciando', {
    plano, alvo: alvo.length, filtroEmails: emails.length || 'todos ativos', apenasCortesia,
  });

  let updated = 0, skipped = 0, protegidos = 0, failed = 0;
  for (const u of alvo) {
    if (normalizePlan(u.plano) === plano) {
      log.info('[set-plano] já está no plano — pulando', { email: u.email });
      skipped++;
      continue;
    }
    // GUARDRAIL: downgrade em massa nunca rebaixa assinatura PAGA — só quando o
    // e-mail é listado explicitamente (decisão individual do administrador).
    if (plano === 'gratuito' && !emails.length && u.planoOrigem === 'assinatura') {
      log.info('[set-plano] assinatura paga PROTEGIDA do downgrade em massa', { email: u.email });
      protegidos++;
      continue;
    }
    try {
      await db.updateDoc('cadastros', u.id, {
        plano,
        // premium administrativo = cortesia; downgrade zera a marca p/ 'padrao'
        planoOrigem:       plano === 'premium' ? 'cortesia' : 'padrao',
        planoAtualizadoEm: new Date().toISOString(),
      });
      updated++;
      log.info('[set-plano] atualizado', { email: u.email, de: normalizePlan(u.plano), para: plano });
    } catch (err) {
      failed++;
      log.error('[set-plano] falha ao atualizar', { email: u.email, err: err.message });
    }
  }

  const result = { plano, total: alvo.length, updated, skipped, protegidos, failed };
  log.info('[set-plano] concluído', result);
  return result;
}

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try { return { statusCode: 200, body: JSON.stringify(await main()) }; }
  catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};

if (require.main === module) {
  main().then(r => { console.log('Done:', JSON.stringify(r)); process.exit(r.error || r.failed ? 1 : 0); })
        .catch(e => { console.error(e.message); process.exit(1); });
}
