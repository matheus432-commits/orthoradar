// ACADEMY — preços PÚBLICOS (sem sessão): a landing precisa mostrar o modelo
// ANTES de qualquer cadastro (transparência é requisito crítico da spec 25/08:
// uso gratuito, exportação paga com o valor visível). Só números da config —
// nenhum dado de usuário; cache curto.

const { Firestore } = require('./_lib/firestore');
const { carregarPrecos } = require('./_lib/academy/precos');
const { simularMeses } = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  try {
    const p = await carregarPrecos(new Firestore(projectId, apiKey));
    return { statusCode: 200, headers, body: JSON.stringify({
      academy_mensal: p.academy_mensal,
      exportacao_valor: p.exportacao_valor,
      teto_credito: p.teto_credito,
      teto_credito_pct: p.teto_credito_pct,
      minimo_pago_exportacao: p.minimo_pago_exportacao,
      carencia_credito_dias: p.carencia_credito_dias,
      simulacao: simularMeses(p),
    }) };
  } catch (err) {
    log.error('[academy-precos] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
