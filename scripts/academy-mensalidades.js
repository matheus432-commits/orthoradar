// ACADEMY — JOB MENSAL de acúmulo de crédito (regra 1 da spec 25/08).
//
// Para cada assinatura ATIVA, registra a mensalidade do mês corrente como
// crédito — idempotente por id_transacao determinística (mens-{email}-{AAAA-MM}):
// rodar duas vezes no mês não duplica um centavo.
//
// GATEWAY: enquanto a plataforma não tem gateway de pagamento, este job faz o
// papel do "pagamento confirmado" para assinaturas ativas. Quando o gateway
// existir, o webhook dele chamará o MESMO aplicarPagamento com a id real da
// transação e este job vira só auditoria (a idempotência garante a troca sem
// dupla cobrança de crédito).
//
// DRY_RUN padrão true (parser tolerante). PRIVACIDADE: log de Actions é
// PÚBLICO — este script imprime SÓ contadores, nunca e-mail de assinante.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { carregarPrecos } = require('../netlify/functions/_lib/academy/precos');
const { aplicarPagamento } = require('../netlify/functions/_lib/academy/credito');

const DRY_RUN = !/^(false|0|n[aã]o|no)$/i.test(String(process.env.DRY_RUN ?? 'true').trim());

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

(async () => {
  const db = new Firestore(projectId, apiKey);
  const precos = await carregarPrecos(db);
  const mes = new Date().toISOString().slice(0, 7);
  console.log(`MENSALIDADES ACADEMY — mês ${mes} · DRY_RUN=${DRY_RUN} (input recebido: ${JSON.stringify(process.env.DRY_RUN)}) · valor ${precos.academy_mensal.toFixed(2)}`);

  const docs = await db.query('academy_assinaturas', { limit: 5000 }).catch(() => []);
  let ativas = 0, creditadas = 0, jaCreditadas = 0, falhas = 0;
  for (const a of docs) {
    if (!a.ativa) continue;
    ativas++;
    const email = String(a.id);
    const r = aplicarPagamento(a, precos, { id_transacao: `mens-${email}-${mes}` });
    if (r.duplicado) { jaCreditadas++; continue; }
    if (DRY_RUN) { creditadas++; continue; }
    try {
      await db.setDoc('academy_assinaturas', email, (({ id, ...resto }) => resto)(r.assinatura));
      creditadas++;
    } catch { falhas++; }
  }
  console.log(`assinaturas ativas: ${ativas} · creditadas${DRY_RUN ? ' (simulado)' : ''}: ${creditadas} · já creditadas no mês: ${jaCreditadas} · falhas: ${falhas}`);
  console.log(`crédito novo em circulação${DRY_RUN ? ' (simulado)' : ''}: R$ ${(creditadas * precos.academy_mensal).toFixed(2)}`);
  if (DRY_RUN) console.log('\nDRY-RUN: NADA foi gravado. Rode com DRY_RUN=false para aplicar.');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
