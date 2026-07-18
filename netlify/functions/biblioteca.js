// Biblioteca Científica Pessoal — exclusiva do plano Premium (Fase B).
//
// GET  ?email=...            + Authorization: Bearer <sessionToken>
//        → { itens: [...], colecoes: [...] }
// POST { email, token, action, pmid, ... }
//        action: 'save'    { pmid }                 salva o artigo na biblioteca
//                'remove'  { pmid }                 remove
//                'nota'    { pmid, nota }           nota privada (até 2000 chars)
//                'colecao' { pmid, colecao }        move para coleção (rótulo livre, até 60 chars)
//
// Gate: servidor verifica sessão E plano Premium (403 premium_required para o
// dashboard mostrar o convite de upgrade). Dados em `biblioteca_itens`, docId
// determinístico emailHash16_pmid (idempotente; sem duplicatas).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { isPremium } = require('./_lib/plans');
const log = require('./_lib/logger');

const MAX_ITENS = 500;

function emailHash16(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}
function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}
function itemId(email, pmid) { return `${emailHash16(email)}_${String(pmid)}`; }

async function getUser(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  return docs[0] || null;
}

// Valida sessão + Premium. Retorna { user } ou { error: <resposta HTTP> }.
async function authorize(db, email, token, headers) {
  if (!email || !token) return { error: { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) } };
  const user = await getUser(db, email);
  if (!user || !tokenEqual(user.sessionToken, token)) {
    return { error: { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida' }) } };
  }
  if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
    return { error: { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada' }) } };
  }
  if (user.ativo === false) return { error: { statusCode: 403, headers, body: JSON.stringify({ error: 'conta_inativa' }) } };
  if (!isPremium(user)) {
    return { error: { statusCode: 403, headers, body: JSON.stringify({
      error: 'premium_required',
      message: 'A Biblioteca Científica Pessoal é exclusiva do plano Premium.',
    }) } };
  }
  return { user };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const db = new Firestore(projectId, process.env.FIREBASE_API_KEY);

  try {
    // ── GET: listar a biblioteca ──────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const authHeader = event.headers['authorization'] || event.headers['Authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const auth = await authorize(db, qs.email, token, headers);
      if (auth.error) return auth.error;

      const itens = await db.query('biblioteca_itens', {
        where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: qs.email } } },
        limit: MAX_ITENS,
      });
      itens.sort((a, b) => (b.savedAt || '') > (a.savedAt || '') ? 1 : -1);
      const colecoes = [...new Set(itens.map(i => i.colecao).filter(Boolean))].sort();
      return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' },
               body: JSON.stringify({ itens, colecoes }) };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    // ── POST: mutações ────────────────────────────────────────────────────────
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }
    const { email, token, action, pmid } = body;
    const auth = await authorize(db, email, token, headers);
    if (auth.error) return auth.error;
    if (!pmid || !action) return { statusCode: 400, headers, body: JSON.stringify({ error: 'action e pmid obrigatorios' }) };

    const id = itemId(email, pmid);

    if (action === 'save') {
      const art = await db.getDoc('artigos', String(pmid)).catch(() => null);
      await db.setDoc('biblioteca_itens', id, {
        email,
        pmid:          String(pmid),
        titulo:        art?.titulo_pt || art?.titulo || String(body.titulo || '').slice(0, 200),
        especialidade: art?.especialidade || '',
        nivel:         art?.nivel_evidencia || '',
        journal:       art?.journal || '',
        temArtigo:     !!art,
        colecao:       '',
        nota:          '',
        savedAt:       new Date().toISOString(),
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, saved: true }) };
    }

    if (action === 'remove') {
      await db.deleteDoc('biblioteca_itens', id).catch(() => {});
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, removed: true }) };
    }

    if (action === 'nota') {
      await db.updateDoc('biblioteca_itens', id, { nota: String(body.nota || '').slice(0, 2000) });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    if (action === 'colecao') {
      await db.updateDoc('biblioteca_itens', id, { colecao: String(body.colecao || '').slice(0, 60) });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action desconhecida' }) };
  } catch (err) {
    log.error('[biblioteca] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
