// ACADEMY — assinatura e crédito de exportação (auth Bearer da plataforma).
//
// GET  ?email=            → estado da assinatura + widget de crédito + simulação
// POST { acao:'assinar' } → cria/reativa a assinatura (crédito só entra por
//                           pagamento CONFIRMADO — ver academy-pagamentos.js)
// POST { acao:'cancelar' }→ desliga; informa o crédito em risco e a carência
//
// Transparência (requisito crítico da diretriz): toda resposta carrega a
// memória de cálculo da exportação COM os valores vigentes de config_precos.

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { carregarPrecos, formatBRL } = require('./_lib/precos');
const C = require('./_lib/academy/credito');
const log = require('./_lib/logger');

const COLECAO = 'academy_assinaturas';

function widget(assinatura, precos) {
  const memoria = C.calcularExportacao({ assinatura, precos });
  return {
    memoria,
    // Texto pronto do widget permanente: o front só exibe.
    texto: `Crédito acumulado: ${formatBRL(memoria.credito_aplicado)}` +
           (memoria.teto_atingido ? ` (teto de ${precos.teto_credito_pct}% atingido)` : '') +
           ` · Sua exportação sairá por ${formatBRL(memoria.valor_final)}`,
    simulacao: [1, 3, 6].map(n => C.simularExportacao(n, precos,
      assinatura ? C.creditoDisponivel(assinatura, precos).credito : 0)),
  };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'academy-assinatura', { max: 30, windowMs: 60000 }); if (_rl) return _rl;

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
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };

    const precos = await carregarPrecos(db);
    let assinatura = await db.getDoc(COLECAO, email).catch(() => null);

    if (event.httpMethod === 'GET') {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          assinante: !!(assinatura && assinatura.ativa),
          assinatura: assinatura ? {
            ativa: assinatura.ativa,
            meses_pagos: assinatura.meses_pagos,
            credito_acumulado: assinatura.credito_acumulado,
            data_cancelamento: assinatura.data_cancelamento,
            data_expiracao_credito: assinatura.data_expiracao_credito,
          } : null,
          precos: {
            academy_mensal: precos.academy_mensal,
            exportacao_valor: precos.exportacao_valor,
            teto_credito_pct: precos.teto_credito_pct,
            carencia_credito_dias: precos.carencia_credito_dias,
          },
          ...widget(assinatura, precos),
        }),
      };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    const acao = String(body.acao || '');

    if (acao === 'assinar') {
      if (assinatura && assinatura.ativa) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'ja_assinante' }) };
      }
      assinatura = assinatura
        ? C.reativarAssinatura(assinatura, precos)  // expirado não volta; carência preserva
        : C.novaAssinatura(email);
      await db.setDoc(COLECAO, email, assinatura);
      log.info('[academy-assinatura] assinatura ativa', { email });
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          // Transparência ao assinar: simulação de 1/3/6 meses SEMPRE presente.
          aviso: `O crédito entra a cada mensalidade paga (${formatBRL(precos.academy_mensal)}/mês) e abate até ${precos.teto_credito_pct}% da exportação.`,
          ...widget(assinatura, precos),
        }),
      };
    }

    if (acao === 'cancelar') {
      if (!assinatura || !assinatura.ativa) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'nao_assinante' }) };
      }
      const emRisco = C.creditoDisponivel(assinatura, precos).credito;
      assinatura = C.cancelarAssinatura(assinatura, precos);
      await db.setDoc(COLECAO, email, assinatura);
      log.info('[academy-assinatura] cancelada', { email, emRisco });
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          ok: true,
          credito_em_risco: emRisco,
          data_expiracao_credito: assinatura.data_expiracao_credito,
          aviso: emRisco > 0
            ? `Você tem ${formatBRL(emRisco)} de crédito. Ele continua válido por ${precos.carencia_credito_dias} dias (até ${assinatura.data_expiracao_credito.slice(0, 10)}); depois disso expira e a reativação não o restaura.`
            : 'Assinatura cancelada.',
        }),
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao_invalida' }) };
  } catch (err) {
    log.error('[academy-assinatura] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
