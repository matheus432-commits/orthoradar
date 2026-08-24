// GET /api/admin/diagnostico-pipeline — Fase 1 da spec 2 (24/08).
// SÓ LEITURA: reconciliação temporal, funil por etapa, cruzamento e-mail ×
// biblioteca, cobertura de áudio (com verificação de storage por amostra) e
// execuções. ?format=csv devolve o resumo tabular.
// Numa invocação de function a amostra de HEAD no storage fica em 40 (teto de
// ~26s); o workflow "Diagnostico do Pipeline" verifica TODAS as URLs.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { construirDiagnosticoPipeline, pipelineCSV } = require('./_lib/diagnostico-pipeline');
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
    const d = await construirDiagnosticoPipeline(new Firestore(projectId, apiKey), {
      bucket: process.env.GCS_BUCKET || (projectId + '.appspot.com'),
      max: 40,
    });
    if ((event.queryStringParameters || {}).format === 'csv') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="diagnostico-pipeline.csv"',
          'Cache-Control': 'private, no-store',
        },
        body: pipelineCSV(d),
      };
    }
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify(d) };
  } catch (err) {
    log.error('[diagnostico-pipeline] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
