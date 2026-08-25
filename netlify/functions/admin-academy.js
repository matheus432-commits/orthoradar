// ADMIN — monetização do Academy (admin-guard, mesmo padrão do afiliados).
//
// GET  ?secret=&action=metricas → assinantes ativos, crédito em circulação
//        (passivo), exportações do mês, receita por origem (assinatura vs.
//        exportação), ticket médio de exportação, preços vigentes.
// POST ?secret=  { acao:'precos', ...campos } → edita config_precos (doc
//        Firestore `config/precos`) sem deploy. Só chaves conhecidas entram.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { carregarPrecos, mesclar, DEFAULTS } = require('./_lib/precos');
const C = require('./_lib/academy/credito');
const log = require('./_lib/logger');

async function listarTudo(db, colecao) {
  let docs = [], pageToken = null;
  do {
    const page = await db.listDocs(colecao, { pageSize: 300, pageToken });
    docs = docs.concat(page.docs);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return docs;
}

async function metricas(db) {
  const precos = await carregarPrecos(db);
  const [assinaturas, exportacoes] = await Promise.all([
    listarTudo(db, 'academy_assinaturas').catch(() => []),
    listarTudo(db, 'academy_exportacoes').catch(() => []),
  ]);

  const hoje = new Date();
  const mes = hoje.toISOString().slice(0, 7); // YYYY-MM

  const ativos = assinaturas.filter(a => a.ativa);
  // PASSIVO: crédito ainda utilizável (ativos + cancelados dentro da carência).
  const passivo = assinaturas.reduce((s, a) => s + C.creditoDisponivel(a, precos, hoje).credito, 0);

  const pagas = exportacoes.filter(e => e.status === 'paga');
  const pagasMes = pagas.filter(e => String(e.data_exportacao || '').slice(0, 7) === mes);
  const receitaExportacao = pagas.reduce((s, e) => s + (Number(e.valor_pago) || 0), 0);
  const receitaExportacaoMes = pagasMes.reduce((s, e) => s + (Number(e.valor_pago) || 0), 0);

  // Receita de assinatura = soma do histórico de pagamentos confirmados.
  let receitaAssinatura = 0, receitaAssinaturaMes = 0;
  for (const a of assinaturas) {
    for (const p of (a.historico_pagamentos || [])) {
      const v = Number(p.valor) || 0;
      receitaAssinatura += v;
      if (String(p.data || '').slice(0, 7) === mes) receitaAssinaturaMes += v;
    }
  }

  const round2 = v => Math.round(v * 100) / 100;
  return {
    mes,
    precos,
    assinantes: {
      ativos: ativos.length,
      cancelados_em_carencia: assinaturas.filter(a => !a.ativa && C.creditoDisponivel(a, precos, hoje).motivo === 'carencia').length,
      total: assinaturas.length,
    },
    credito_em_circulacao: round2(passivo), // passivo a abater em exportações futuras
    exportacoes: {
      pagas_no_mes: pagasMes.length,
      pagas_total: pagas.length,
      aguardando_pagamento: exportacoes.filter(e => e.status === 'aguardando_pagamento').length,
      ticket_medio: pagas.length ? round2(receitaExportacao / pagas.length) : 0,
      ticket_medio_mes: pagasMes.length ? round2(receitaExportacaoMes / pagasMes.length) : 0,
    },
    receita: {
      assinatura_mes: round2(receitaAssinaturaMes),
      exportacao_mes: round2(receitaExportacaoMes),
      assinatura_total: round2(receitaAssinatura),
      exportacao_total: round2(receitaExportacao),
    },
  };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  if (!checkAdmin(event)) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    if (event.httpMethod === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify(await metricas(db)) };
    }

    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'json_invalido' }) }; }
      if (String(body.acao || '') !== 'precos') return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao_invalida' }) };

      const atual = await carregarPrecos(db);
      const novos = mesclar({ ...atual, ...body }); // só chaves de DEFAULTS, números válidos
      await db.setDoc('config', 'precos', { ...novos, atualizadoEm: new Date().toISOString() });
      log.info('[admin-academy] config_precos atualizado', novos);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, precos: novos, defaults: DEFAULTS }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  } catch (err) {
    log.error('[admin-academy] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
