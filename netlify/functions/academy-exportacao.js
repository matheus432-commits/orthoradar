// ACADEMY — fluxo de EXPORTAÇÃO paga (auth Bearer da plataforma).
//
// GET  ?email&id           → memória de cálculo da tela de confirmação
//                            (valor cheio, crédito, teto, valor final) + status
// POST { acao:'confirmar' }→ registra a exportação com os valores TRAVADOS
//                            (status 'aguardando_pagamento'; o crédito só é
//                            consumido quando o pagamento confirma — ver
//                            academy-pagamentos.js). Reconfirmar recalcula
//                            enquanto não estiver paga.
//
// O paywall fica na EXPORTAÇÃO, nunca antes: todo o fluxo de construção do
// trabalho é livre (regra 5 — a assinatura nunca é obrigatória).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { carregarPrecos, formatBRL } = require('./_lib/precos');
const C = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'academy-exportacao', { max: 20, windowMs: 60000 }); if (_rl) return _rl;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  let body = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'json_invalido' }) }; }
  }
  const qs = event.queryStringParameters || {};
  const email = String(body.email || qs.email || '').trim().toLowerCase();
  const projetoId = String(body.id || qs.id || '').trim();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };

    const projeto = await db.getDoc('academy_projetos', projetoId).catch(() => null);
    if (!projeto || projeto.usuario_email !== email) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
    }

    const precos = await carregarPrecos(db);
    const assinatura = await db.getDoc('academy_assinaturas', email).catch(() => null);
    const existente = await db.getDoc('academy_exportacoes', projetoId).catch(() => null);
    const memoria = C.calcularExportacao({ assinatura, precos });

    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          status: existente ? existente.status : 'nao_confirmada',
          // Já paga: a memória exibida é a TRAVADA no pagamento, não a recalculada.
          memoria: existente && existente.status === 'paga'
            ? { valor_cheio: existente.valor_cheio, credito_aplicado: existente.credito_aplicado, teto_atingido: existente.teto_atingido, valor_final: existente.valor_pago }
            : memoria,
          resumo: existente && existente.status === 'paga'
            ? `Exportação paga (${formatBRL(existente.valor_pago)}). Baixe o pacote quando quiser.`
            : `Valor da exportação: ${formatBRL(memoria.valor_cheio)} · crédito aplicado: ${formatBRL(memoria.credito_aplicado)}` +
              (memoria.teto_atingido ? ` (teto de ${precos.teto_credito_pct}%)` : '') +
              ` · você paga ${formatBRL(memoria.valor_final)}.`,
        }),
      };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    if (String(body.acao || '') !== 'confirmar') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao_invalida' }) };
    }
    if (existente && existente.status === 'paga') {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'ja_paga' }) };
    }
    // O pacote precisa estar fechado (mesma regra do download) antes de cobrar.
    if (!projeto.periodico_alvo) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'pacote_indisponivel', message: 'Escolha o periódico antes de exportar — é ele que define formato e exigências.' }) };
    }

    const doc = {
      usuario_id:       email,       // nome da spec
      usuario_email:    email,
      projeto_id:       projetoId,
      valor_cheio:      memoria.valor_cheio,
      credito_aplicado: memoria.credito_aplicado,
      teto_atingido:    memoria.teto_atingido,
      valor_pago:       memoria.valor_final,
      status:           'aguardando_pagamento',
      id_transacao:     null,
      data_confirmacao: new Date().toISOString(),
      data_exportacao:  null,
      referencia_pagamento: 'exp_' + crypto.randomUUID().slice(0, 8),
    };
    await db.setDoc('academy_exportacoes', projetoId, doc);
    log.info('[academy-exportacao] confirmada', { projetoId, email, valor: doc.valor_pago });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true, status: doc.status, memoria,
        referencia_pagamento: doc.referencia_pagamento,
        mensagem: `Exportação confirmada por ${formatBRL(doc.valor_pago)}. Assim que o pagamento for confirmado, o download do pacote é liberado` +
                  (doc.credito_aplicado > 0 ? ` e o crédito de ${formatBRL(doc.credito_aplicado)} é consumido (o saldo volta a zero).` : '.'),
      }),
    };
  } catch (err) {
    log.error('[academy-exportacao] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
