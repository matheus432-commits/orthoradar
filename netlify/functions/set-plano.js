// Define o plano de assinatura de usuários — uso administrativo.
//
// Execução normal: GitHub Actions (workflow set-plano.yml, disparo manual) via
// `node netlify/functions/set-plano.js`. Como HTTP, exige o ADMIN_SECRET.
//
// Env:
//   PLANO   — 'premium' (default) ou 'gratuito'
//   EMAILS  — lista separada por vírgula; vazio = TODOS os usuários ativos
//
// Registra planoOrigem='cortesia' e planoAtualizadoEm — quando a cobrança for
// implementada, esses campos distinguem cortesias de assinaturas pagas.

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

  const db = new Firestore(projectId, apiKey);
  const users = await allUsers(db);

  const alvo = users.filter(u => {
    if (u.ativo === false) return false;
    if (emails.length) return emails.includes(String(u.email || '').toLowerCase());
    return true;
  });

  log.info('[set-plano] iniciando', { plano, alvo: alvo.length, filtroEmails: emails.length || 'todos ativos' });

  let updated = 0, skipped = 0, failed = 0;
  for (const u of alvo) {
    if (normalizePlan(u.plano) === plano) {
      log.info('[set-plano] já está no plano — pulando', { email: u.email });
      skipped++;
      continue;
    }
    try {
      await db.updateDoc('cadastros', u.id, {
        plano,
        planoOrigem:       'cortesia',
        planoAtualizadoEm: new Date().toISOString(),
      });
      updated++;
      log.info('[set-plano] atualizado', { email: u.email, de: normalizePlan(u.plano), para: plano });
    } catch (err) {
      failed++;
      log.error('[set-plano] falha ao atualizar', { email: u.email, err: err.message });
    }
  }

  const result = { plano, total: alvo.length, updated, skipped, failed };
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
