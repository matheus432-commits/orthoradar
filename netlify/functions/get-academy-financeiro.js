// ACADEMY — painel de monetização (exclusivo do admin, spec 25/08).
//
// GET ?secret=ADMIN_SECRET → assinantes ativos, CRÉDITO EM CIRCULAÇÃO
// (passivo — só o saldo ainda VÁLIDO conta), exportações e receita do mês,
// receita por origem (assinatura × exportação) e ticket médio de exportação.
// POST { secret, acao:'salvar_precos', precos:{...} } → edita config/precos
// (campos numéricos conhecidos; o resto é ignorado).

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { carregarPrecos, DEFAULTS } = require('./_lib/academy/precos');
const { creditoDisponivel } = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autorizado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    if (event.httpMethod === 'POST') {
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
      if (String(body.acao) !== 'salvar_precos') return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao desconhecida' }) };
      const atual = await db.getDoc('config', 'precos').catch(() => null) || {};
      const novo = { ...atual };
      for (const k of Object.keys(DEFAULTS)) {
        const v = Number((body.precos || {})[k]);
        if (Number.isFinite(v) && v >= 0) novo[k] = v;
      }
      novo.atualizado_em = new Date().toISOString();
      await db.setDoc('config', 'precos', (({ id, ...resto }) => resto)(novo));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, precos: await carregarPrecos(db) }) };
    }

    const precos = await carregarPrecos(db);
    const mes = new Date().toISOString().slice(0, 7);

    const assinaturas = await db.query('academy_assinaturas', { limit: 5000 }).catch(() => []);
    let ativos = 0, emCarencia = 0, passivoCredito = 0, receitaAssinaturaMes = 0;
    for (const a of assinaturas) {
      const disp = creditoDisponivel(a, precos);
      if (a.ativa) ativos++;
      if (disp.situacao === 'carencia') emCarencia++;
      if (disp.situacao === 'ativo' || disp.situacao === 'carencia') passivoCredito += disp.credito;
      for (const p of (a.historico_pagamentos || [])) {
        if (String(p.data || '').slice(0, 7) === mes) receitaAssinaturaMes += Number(p.valor) || 0;
      }
    }

    const exportacoes = await db.query('academy_exportacoes', { limit: 5000 }).catch(() => []);
    const doMes = exportacoes.filter(e => String(e.data_exportacao || '').slice(0, 7) === mes);
    const receitaExportacaoMes = doMes.reduce((s, e) => s + (Number(e.valor_pago) || 0), 0);
    const creditoConsumidoMes = doMes.reduce((s, e) => s + (Number(e.credito_aplicado) || 0), 0);

    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({
      geradoEm: new Date().toISOString(),
      mes,
      precos,
      assinantes: { ativos, em_carencia: emCarencia, total_registros: assinaturas.length },
      credito_em_circulacao: Math.round(passivoCredito * 100) / 100, // passivo
      exportacoes_mes: {
        quantidade: doMes.length,
        receita: Math.round(receitaExportacaoMes * 100) / 100,
        credito_consumido: Math.round(creditoConsumidoMes * 100) / 100,
        ticket_medio: doMes.length ? Math.round(receitaExportacaoMes / doMes.length * 100) / 100 : 0,
        com_teto_atingido: doMes.filter(e => e.teto_atingido).length,
      },
      receita_por_origem_mes: {
        assinatura: Math.round(receitaAssinaturaMes * 100) / 100,
        exportacao: Math.round(receitaExportacaoMes * 100) / 100,
        total: Math.round((receitaAssinaturaMes + receitaExportacaoMes) * 100) / 100,
      },
      exportacoes_total: exportacoes.length,
    }) };
  } catch (err) {
    log.error('[get-academy-financeiro] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
