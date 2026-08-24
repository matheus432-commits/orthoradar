// POST /api/admin/migrar-temas — Fase 3 da spec de temas (24/08).
//
// Body JSON: { dry_run?: true, modo?: 'mapear'|'completo', limit?: 30,
//              especialidade?: 'Ortodontia' }
//
// ATENÇÃO: uma invocação de Netlify Function tem ~26s — aqui o limit padrão é
// pequeno (30) e a rota serve para lotes pontuais; a migração COMPLETA roda
// pelo workflow "Migrar Temas" (GitHub Actions, sem teto curto). A função é
// idempotente (versao_taxonomia): chamadas repetidas continuam de onde parou.
// DRY-RUN por padrão — só grava com dry_run explicitamente false.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { migrarAcervo } = require('./_lib/migracao-temas');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autorizado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const modo = body.modo === 'completo' ? 'completo' : 'mapear';

  // IA (modo completo) via Haiku — modelo mais barato; etapa medida em custos.
  let classificarIA;
  if (modo === 'completo') {
    const { callClaude } = require('./_lib/claude');
    const { DEFAULT_MODEL } = require('./_lib/ai-config');
    classificarIA = async (prompt) => (await callClaude(prompt, 0, process.env.TEMAS_MODEL || DEFAULT_MODEL, 200, 'temas')).text;
  }

  try {
    const relatorio = await migrarAcervo(new Firestore(projectId, apiKey), {
      dryRun: body.dry_run !== false,
      modo,
      limit: Number(body.limit) > 0 ? Math.min(Number(body.limit), 200) : 30,
      especialidade: body.especialidade || undefined,
      classificarIA,
      pausaMs: 0, // dentro do teto da função não há por que pausar
    });
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify(relatorio) };
  } catch (err) {
    log.error('[migrar-temas] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
