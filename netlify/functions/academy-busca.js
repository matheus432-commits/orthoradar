// ACADEMY — busca de literatura (Etapa 5). POST { email, id }.
//
// Executa a busca REAL no PubMed a partir do PICO interno confirmado e grava
// no projeto SÓ referências verificadas (PMID sempre; DOI quando existir) —
// guardrail 1 na prática. Marca com honestidade quando a busca sugere que a
// pergunta já foi respondida (revisão sistemática/meta-análise no resultado).

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { buscarLiteratura } = require('./_lib/academy/referencias');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const _rl = rateLimited(event, 'academy-busca', { max: 10, windowMs: 60000 }); if (_rl) return _rl;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const email = String(body.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };
    const p = await db.getDoc('academy_projetos', String(body.id || '')).catch(() => null);
    if (!p || p.usuario_email !== email) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
    if (!p.pergunta_pesquisa || !p.pergunta_pesquisa.confirmada) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'pergunta_nao_confirmada' }) };
    }

    const { estrategia, referencias, descartadasSemVerificacao } = await buscarLiteratura(p.pergunta_pesquisa.pico, { max: 10 });

    // Honestidade estrutural: revisão sistemática/meta-análise no resultado é
    // sinal forte de pergunta já respondida — fica gravado e o entrevistador
    // é obrigado a comentar (vai no contexto de todo turno).
    const jaRespondida = referencias.some(r => /systematic review|meta-?analys/i.test(r.titulo))
      ? 'A busca trouxe revisão sistemática/meta-análise que pode já responder a pergunta — avaliar com o dentista se o caso agrega algo novo (nicho, técnica, população) ou se vale reposicionar.'
      : null;

    await db.updateDoc('academy_projetos', String(p.id), {
      estrategia_busca: { termos: estrategia, executadaEm: new Date().toISOString() },
      referencias,
      ja_respondida: jaRespondida,
      atualizado_em: new Date().toISOString(),
    });

    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({
      estrategia,
      total: referencias.length,
      referencias,
      descartadasSemVerificacao,
      ja_respondida: jaRespondida,
    }) };
  } catch (err) {
    log.error('[academy-busca] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
