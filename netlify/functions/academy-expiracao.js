// ACADEMY — JOB DIÁRIO de expiração de crédito (regra 4 da spec 25/08).
//
// Varre as assinaturas CANCELADAS e, passada a carência (carencia_credito_dias
// da config), ZERA o saldo de verdade — reativar depois nunca restaura, porque
// não há o que restaurar. Agendado no netlify.toml (diário, 10h UTC = 7h BRT);
// idempotente e best-effort (uma falha não derruba a varredura).

const { Firestore } = require('./_lib/firestore');
const { carregarPrecos } = require('./_lib/academy/precos');
const { expirarSeVencida } = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const precos = await carregarPrecos(db);
    const docs = await db.query('academy_assinaturas', { limit: 5000 }).catch(() => []);
    let avaliadas = 0, expiradas = 0, falhas = 0, creditoExpirado = 0;
    for (const a of docs) {
      if (a.ativa || !(Number(a.credito_acumulado) > 0)) continue;
      avaliadas++;
      const r = expirarSeVencida(a, precos);
      if (!r.expirou) continue;
      try {
        creditoExpirado += Number(a.credito_acumulado) || 0;
        await db.setDoc('academy_assinaturas', String(a.id), (({ id, ...resto }) => resto)(r.assinatura));
        expiradas++;
      } catch (err) {
        falhas++;
        log.warn('[academy-expiracao] falha ao expirar — tenta amanhã', { err: err.message });
      }
    }
    // Só contadores no log — nunca e-mails de assinantes.
    log.info('[academy-expiracao] varredura diária', { total: docs.length, avaliadas, expiradas, creditoExpirado: creditoExpirado.toFixed(2), falhas });
    return { statusCode: 200, body: JSON.stringify({ avaliadas, expiradas, falhas }) };
  } catch (err) {
    log.error('[academy-expiracao] erro', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
