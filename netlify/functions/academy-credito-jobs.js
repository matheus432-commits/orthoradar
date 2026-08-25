// ACADEMY — jobs de manutenção do crédito (GitHub Actions, passo diário).
//
//   1. EXPIRAÇÃO (diário)  — zera o saldo de assinaturas canceladas há mais
//      de carencia_credito_dias (regra 4 da spec).
//   2. RECONCILIAÇÃO       — recomputa meses_pagos/credito_acumulado a partir
//      do histórico de pagamentos pós-último-consumo; o acúmulo oficial
//      acontece a cada pagamento confirmado (academy-pagamentos.js) e este
//      job garante que o espelho nunca deriva.
//
// Run: node netlify/functions/academy-credito-jobs.js

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { carregarPrecos } = require('./_lib/precos');
const C = require('./_lib/academy/credito');
const log = require('./_lib/logger');

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[academy-jobs] FIREBASE_API_KEY not set'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);
  const precos = await carregarPrecos(db);
  const hoje = new Date().toISOString();

  let docs = [];
  let pageToken = null;
  do {
    const page = await db.listDocs('academy_assinaturas', { pageSize: 300, pageToken });
    docs = docs.concat(page.docs);
    pageToken = page.nextPageToken;
  } while (pageToken);

  let expirados = 0, reconciliados = 0;
  for (const a of docs) {
    let doc = a;
    let mudou = false;

    const exp = C.expirarSeVencido(doc, precos, hoje);
    if (exp.expirou) { doc = exp.assinatura; mudou = true; expirados++; log.info('[academy-jobs] crédito expirado', { email: doc.usuario_email }); }

    const rec = C.reconciliar(doc, hoje);
    if (rec.corrigiu) { doc = rec.assinatura; mudou = true; reconciliados++; log.warn('[academy-jobs] espelho reconciliado', { email: doc.usuario_email }); }

    if (mudou) {
      await db.setDoc('academy_assinaturas', a.id || doc.usuario_email, doc)
        .catch(e => log.error('[academy-jobs] save falhou', { email: doc.usuario_email, err: e.message }));
    }
  }

  const resumo = { assinaturas: docs.length, expirados, reconciliados };
  log.info('[academy-jobs] concluído', resumo);
  return resumo;
}

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try { return { statusCode: 200, body: JSON.stringify(await main()) }; }
  catch (err) {
    log.error('[academy-jobs] erro', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
