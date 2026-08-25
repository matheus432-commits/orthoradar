// ACADEMY — assinatura e crédito de exportação (sessão do site obrigatória).
//
// GET  ?email                       → status + preços públicos + simulação
//                                     1/3/6 meses + memória de cálculo atual
//                                     (alimenta o widget permanente de crédito)
// POST { email, acao:'assinar' }    → ativa a assinatura e registra a 1ª
//                                     mensalidade (idempotente por mês)
// POST { email, acao:'cancelar', confirmar:true }
//                                   → sem confirmar: devolve o crédito em
//                                     risco + carência (tela de cancelamento);
//                                     confirmado: aplica o cancelamento
// POST { email, acao:'reativar' }   → volta a ativa; crédito ainda em
//                                     carência é mantido (expirado NUNCA volta)
//
// GATEWAY DE PAGAMENTO: ainda não há gateway na plataforma — o registro da
// mensalidade usa id_transacao determinística (mens-{email}-{AAAA-MM}) e o
// aplicarPagamento é idempotente: quando o gateway existir, o webhook chama o
// MESMO caminho com a id real e nada duplica. Nenhum valor hardcoded: tudo
// vem de config/precos.

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { carregarPrecos, fmtBRL } = require('./_lib/academy/precos');
const { calcularExportacao, aplicarPagamento, aplicarCancelamento, creditoDisponivel, simularMeses } = require('./_lib/academy/credito');
const log = require('./_lib/logger');

const mesAtual = () => new Date().toISOString().slice(0, 7);

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'academy-assinatura', { max: 60, windowMs: 60000 }); if (_rl) return _rl;

  const qs = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const email = String(qs.email || body.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };

    const precos = await carregarPrecos(db);
    const assinatura = await db.getDoc('academy_assinaturas', email).catch(() => null);

    if (event.httpMethod === 'GET') {
      const memoria = calcularExportacao(assinatura, precos);
      const disp = creditoDisponivel(assinatura, precos);
      return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({
        assinatura: assinatura ? {
          ativa: !!assinatura.ativa,
          meses_pagos: assinatura.meses_pagos || 0,
          credito_acumulado: assinatura.credito_acumulado || 0,
          situacao_credito: disp.situacao,
          credito_expira_em: disp.expiraEm || null,
        } : null,
        precos: {
          academy_mensal: precos.academy_mensal,
          exportacao_valor: precos.exportacao_valor,
          teto_credito: precos.teto_credito,
          teto_credito_pct: precos.teto_credito_pct,
          minimo_pago_exportacao: precos.minimo_pago_exportacao,
          carencia_credito_dias: precos.carencia_credito_dias,
        },
        memoria,                          // o widget usa: crédito e "sua exportação sairá por"
        simulacao: simularMeses(precos),  // transparência ao assinar: 1/3/6 meses
      }) };
    }

    const acao = String(body.acao || '');

    if (acao === 'assinar') {
      const base = assinatura || { ativa: false, data_inicio: new Date().toISOString(), meses_pagos: 0, credito_acumulado: 0, historico_pagamentos: [] };
      const r = aplicarPagamento(base, precos, { id_transacao: `mens-${email}-${mesAtual()}` });
      const nova = { ...r.assinatura, ativa: true, data_cancelamento: null, data_expiracao_credito: null };
      if (!assinatura) nova.data_inicio = new Date().toISOString();
      await db.setDoc('academy_assinaturas', email, nova);
      return { statusCode: 200, headers, body: JSON.stringify({
        ok: true, ja_pago_este_mes: r.duplicado,
        credito_acumulado: nova.credito_acumulado,
        mensagem: r.duplicado ? 'Sua mensalidade deste mês já estava registrada.' : `Assinatura ativa — ${fmtBRL(precos.academy_mensal)} deste mês já viraram crédito de exportação.`,
      }) };
    }

    if (acao === 'cancelar') {
      if (!assinatura || !assinatura.ativa) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sem_assinatura_ativa' }) };
      const memoria = calcularExportacao(assinatura, precos);
      if (body.confirmar !== true) {
        // TRANSPARÊNCIA (spec): a tela de cancelamento mostra o crédito em
        // risco e a carência ANTES de confirmar.
        return { statusCode: 200, headers, body: JSON.stringify({
          previa: true,
          credito_em_risco: assinatura.credito_acumulado || 0,
          carencia_dias: precos.carencia_credito_dias,
          aviso: `Você tem ${fmtBRL(assinatura.credito_acumulado || 0)} de crédito acumulado. Ao cancelar, ele continua válido por ${precos.carencia_credito_dias} dias — depois disso expira por completo e reativar não o traz de volta. Sua exportação hoje sairia por ${fmtBRL(memoria.valor_pago)}.`,
        }) };
      }
      const cancelada = aplicarCancelamento(assinatura, precos);
      await db.setDoc('academy_assinaturas', email, cancelada);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, credito_valido_ate: cancelada.data_expiracao_credito }) };
    }

    if (acao === 'reativar') {
      if (!assinatura) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sem_assinatura' }) };
      // Crédito expirado já foi zerado pelo job diário — reativar parte do que
      // restou (regra 4: expirado NUNCA volta).
      const r = aplicarPagamento({ ...assinatura, ativa: true, data_cancelamento: null, data_expiracao_credito: null }, precos, { id_transacao: `mens-${email}-${mesAtual()}` });
      await db.setDoc('academy_assinaturas', email, r.assinatura);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, credito_acumulado: r.assinatura.credito_acumulado }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao desconhecida' }) };
  } catch (err) {
    log.error('[academy-assinatura] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
