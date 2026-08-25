// ACADEMY — registro de PAGAMENTO CONFIRMADO (admin-guard; vira webhook do
// gateway quando o Asaas entrar — a lógica de crédito já é idempotente).
//
// POST { tipo:'mensalidade', email, id_transacao, valor? }
//   → credita 1 mensalidade na assinatura (acúmulo da spec, regra 1).
// POST { tipo:'exportacao', projeto_id, id_transacao }
//   → marca a exportação como PAGA e CONSOME o crédito aplicado (regra 3).
//
// Idempotência: id_transacao repetido nunca credita/consome duas vezes.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { carregarPrecos } = require('./_lib/precos');
const C = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!checkAdmin(event)) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'json_invalido' }) }; }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  const idTransacao = String(body.id_transacao || '').trim();
  if (!idTransacao) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id_transacao_obrigatorio' }) };

  try {
    const precos = await carregarPrecos(db);

    // ── Mensalidade → acúmulo de crédito ─────────────────────────────────────
    if (body.tipo === 'mensalidade') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'email_obrigatorio' }) };
      let assinatura = await db.getDoc('academy_assinaturas', email).catch(() => null);
      if (!assinatura) return { statusCode: 404, headers, body: JSON.stringify({ error: 'assinatura_inexistente' }) };

      const r = C.aplicarPagamento(assinatura, {
        valor: body.valor != null ? body.valor : precos.academy_mensal,
        id_transacao: idTransacao,
      });
      if (r.aplicado) await db.setDoc('academy_assinaturas', email, r.assinatura);
      log.info('[academy-pagamentos] mensalidade', { email, idTransacao, aplicado: r.aplicado, motivo: r.motivo || 'ok' });
      return {
        statusCode: r.aplicado ? 200 : 409, headers,
        body: JSON.stringify({ ok: r.aplicado, motivo: r.motivo || 'creditado', credito_acumulado: r.assinatura.credito_acumulado, meses_pagos: r.assinatura.meses_pagos }),
      };
    }

    // ── Exportação → marca paga + consome crédito ────────────────────────────
    if (body.tipo === 'exportacao') {
      const projetoId = String(body.projeto_id || '').trim();
      if (!projetoId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'projeto_id_obrigatorio' }) };
      const exp = await db.getDoc('academy_exportacoes', projetoId).catch(() => null);
      if (!exp) return { statusCode: 404, headers, body: JSON.stringify({ error: 'exportacao_inexistente', message: 'O usuário precisa confirmar a exportação antes (memória de cálculo).' }) };
      if (exp.status === 'paga') {
        return { statusCode: 409, headers, body: JSON.stringify({ ok: false, motivo: 'ja_paga', id_transacao: exp.id_transacao }) };
      }

      const agora = new Date().toISOString();
      await db.setDoc('academy_exportacoes', projetoId, {
        ...exp, status: 'paga', id_transacao: idTransacao, data_exportacao: agora,
      });

      // CONSUMO (regra 3): zera o saldo da assinatura quando havia crédito aplicado.
      if (exp.credito_aplicado > 0 && exp.usuario_email) {
        const assinatura = await db.getDoc('academy_assinaturas', exp.usuario_email).catch(() => null);
        if (assinatura) await db.setDoc('academy_assinaturas', exp.usuario_email, C.consumirCredito(assinatura, agora));
      }
      log.info('[academy-pagamentos] exportacao paga', { projetoId, idTransacao, valor: exp.valor_pago });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, projeto_id: projetoId, valor_pago: exp.valor_pago }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'tipo_invalido' }) };
  } catch (err) {
    log.error('[academy-pagamentos] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
