// GET /api/admin/diagnostico-temas — Fase 1 da spec de temas (24/08).
// SÓ LEITURA: relatório completo sem alterar nenhum dado.
// ?format=csv devolve a distribuição bruta em CSV (Excel BR).
// Exclusivo do admin (mesmo segredo dos demais painéis).

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { construirDiagnostico, distribuicaoCSV } = require('./_lib/diagnostico-temas');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autorizado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };

  try {
    const diagnostico = await construirDiagnostico(new Firestore(projectId, apiKey));
    if ((event.queryStringParameters || {}).format === 'csv') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="diagnostico-temas.csv"',
          'Cache-Control': 'private, no-store',
        },
        body: distribuicaoCSV(diagnostico),
      };
    }
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify(diagnostico) };
  } catch (err) {
    log.error('[diagnostico-temas] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
