// ACADEMY — CRUD do projeto acadêmico (sessão do site obrigatória).
//
// GET  ?email&acao=listar                → projetos do dentista (resumo)
// GET  ?email&acao=carregar&id=...      → projeto completo + progresso + histórico
// POST { email, acao:'criar' }
// POST { email, acao:'editar_secao', id, secao, texto }   (edição manual do autor)
// POST { email, acao:'aprovar_secao', id, secao }         (guardrail 7 — só o HUMANO aprova)
// POST { email, acao:'legenda_figura', id, indice, legenda }
// Authorization: Bearer <sessionToken>

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { novoProjeto, progresso, SECOES, podeAvancar } = require('./_lib/academy/estado');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'academy-projeto', { max: 120, windowMs: 60000 }); if (_rl) return _rl;

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

    // Todo acesso a projeto é SEMPRE filtrado pelo dono (usuario_email).
    const carregarMeu = async (id) => {
      const p = await db.getDoc('academy_projetos', String(id || '')).catch(() => null);
      return p && p.usuario_email === email ? p : null;
    };

    if (event.httpMethod === 'GET') {
      const acao = String(qs.acao || 'listar');
      if (acao === 'listar') {
        const docs = await db.query('academy_projetos', {
          where: { fieldFilter: { field: { fieldPath: 'usuario_email' }, op: 'EQUAL', value: { stringValue: email } } },
          limit: 50,
        });
        return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({
          projetos: docs.map(p => ({
            id: p.id, tipo_trabalho: p.tipo_trabalho, etapa_atual: p.etapa_atual,
            titulo: (p.secoes && p.secoes.titulo && p.secoes.titulo.texto) || (p.entrada_livre || '').slice(0, 80) || 'Projeto novo',
            atualizado_em: p.atualizado_em,
          })).sort((a, b) => String(b.atualizado_em).localeCompare(String(a.atualizado_em))),
        }) };
      }
      if (acao === 'carregar') {
        const p = await carregarMeu(qs.id);
        if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
        const msgs = await db.query('academy_mensagens', {
          where: { fieldFilter: { field: { fieldPath: 'projetoId' }, op: 'EQUAL', value: { stringValue: String(p.id) } } },
          limit: 400,
        }).catch(() => []);
        msgs.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
        return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({ projeto: p, progresso: progresso(p), mensagens: msgs.map(m => ({ de: m.de, texto: m.texto, ts: m.ts })) }) };
      }
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao desconhecida' }) };
    }

    // POST
    const acao = String(body.acao || '');
    if (acao === 'criar') {
      const p = novoProjeto(email);
      const id = 'acad-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      await db.setDoc('academy_projetos', id, p);
      return { statusCode: 200, headers, body: JSON.stringify({ id }) };
    }

    const p = await carregarMeu(body.id);
    if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };

    if (acao === 'editar_secao' || acao === 'aprovar_secao') {
      const secao = String(body.secao || '');
      if (!SECOES.includes(secao)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'secao desconhecida' }) };
      const secoes = p.secoes || {};
      const atual = secoes[secao] || { texto: '', aprovada: false };
      if (acao === 'editar_secao') {
        // Edição do AUTOR: substitui o texto e derruba a aprovação anterior.
        secoes[secao] = { ...atual, texto: String(body.texto || '').slice(0, 20000), aprovada: false };
      } else {
        if (!String(atual.texto || '').trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'sem_texto_para_aprovar' }) };
        secoes[secao] = { ...atual, aprovada: true, aprovadaEm: new Date().toISOString() };
      }
      const patch = { secoes, atualizado_em: new Date().toISOString() };
      // Todas as seções aprovadas → o projeto pode ir para a escolha do periódico.
      if (acao === 'aprovar_secao' && p.etapa_atual === 'manuscrito' && !podeAvancar({ ...p, secoes }, 'periodico')) {
        patch.etapa_atual = 'periodico';
      }
      await db.updateDoc('academy_projetos', String(p.id), patch);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, etapa_atual: patch.etapa_atual || p.etapa_atual }) };
    }

    if (acao === 'legenda_figura') {
      const idx = Number(body.indice);
      const imagens = Array.isArray(p.imagens) ? p.imagens : [];
      if (!(idx >= 0 && idx < imagens.length)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'figura inexistente' }) };
      imagens[idx].legenda = String(body.legenda || '').slice(0, 500);
      await db.updateDoc('academy_projetos', String(p.id), { imagens, atualizado_em: new Date().toISOString() });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'acao desconhecida' }) };
  } catch (err) {
    log.error('[academy-projeto] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
