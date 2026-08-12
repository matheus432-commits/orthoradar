// Painel de PARCERIAS — exclusivo do admin (mesmo segredo do painel).
//
// GET  ?secret=ADMIN_SECRET&action=list
//        → parceiros com produto, cupom, link copiável, ativo e nº de resgates.
// GET  ?secret=...&action=detalhe&id=PARCEIRO_ID
//        → contadores (total/aguardando/ativos/encerrados/convertidos) +
//          tabela de alunos (nome, e-mail, resgate, status, dias restantes).
// GET  ?secret=...&action=csv&id=PARCEIRO_ID  → planilha do parceiro (pt-BR).
// GET  ?secret=...&action=status_cobranca     → { cobranca_ativa, data_inicio_cobranca }.
// POST { secret, action:'criar'|'editar', parceiro:{...} }
// POST { secret, action:'ativar'|'desativar', id }
// POST { secret, action:'ativar_cobranca', confirmar:'ATIVAR COBRANCA' }
//        → liga a cobrança global (IRREVERSÍVEL; dupla confirmação: o admin
//          digita a frase) e recalcula EM LOTE todos os resgates que
//          aguardavam: inicio = MAX(data_resgate, hoje), fim = +90 dias.
//          Idempotente: já ativa → { ja_ativa: true, atualizados: 0 }.
//
// Persistência: Firestore (o "KV" de todo o sistema) — parceiros,
// parcerias_resgates e parcerias_config/global.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const {
  STATUS, STATUS_LABEL,
  normalizarCupom, normalizarSlug, validadePadrao,
  camposAtivacaoLote, diasRestantes, resumoParceiro, relatorioCSV,
} = require('./_lib/parcerias');
const log = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';
const CONFIG_DOC = 'global';
const FRASE_CONFIRMACAO = 'ATIVAR COBRANCA';

const linkDe = (slug) => `${BASE_URL}/parceria/${slug}`;

async function lerConfig(db) {
  const docs = await db.query('parcerias_config', { limit: 5 }).catch(() => []);
  return docs.find(d => d.id === CONFIG_DOC) || { cobranca_ativa: false, data_inicio_cobranca: null };
}

async function resgatesDe(db, parceiroId) {
  return db.query('parcerias_resgates', {
    where: { fieldFilter: { field: { fieldPath: 'parceiro_id' }, op: 'EQUAL', value: { stringValue: String(parceiroId) } } },
    limit: 2000,
  }).catch(() => []);
}

function publicoParceiro(p, nResgates) {
  return {
    id: p.id, nome_parceiro: p.nome_parceiro || '', email: p.email || '',
    instagram: p.instagram || '', nome_produto: p.nome_produto || '',
    especialidade: p.especialidade || '', codigo_cupom: p.codigo_cupom || '',
    slug_link: p.slug_link || '', link: linkDe(p.slug_link || ''),
    validade_cupom: p.validade_cupom || '', limite_resgates: p.limite_resgates ?? null,
    ativo: p.ativo !== false, criado_em: p.criado_em || '',
    resgates: nResgates,
  };
}

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
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    // ── GET ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const qs = event.queryStringParameters || {};
      const action = String(qs.action || 'list');

      if (action === 'status_cobranca') {
        const cfg = await lerConfig(db);
        return { statusCode: 200, headers, body: JSON.stringify({ cobranca_ativa: cfg.cobranca_ativa === true, data_inicio_cobranca: cfg.data_inicio_cobranca || null }) };
      }

      const parceiros = await db.query('parceiros', { limit: 500 }).catch(() => []);

      if (action === 'list') {
        const todos = await db.query('parcerias_resgates', { limit: 5000 }).catch(() => []);
        const porParceiro = new Map();
        for (const r of todos) {
          const k = String(r.parceiro_id || '');
          porParceiro.set(k, (porParceiro.get(k) || 0) + 1);
        }
        const cfg = await lerConfig(db);
        const lista = parceiros
          .map(p => publicoParceiro(p, porParceiro.get(String(p.id)) || 0))
          .sort((a, b) => b.resgates - a.resgates || a.nome_parceiro.localeCompare(b.nome_parceiro, 'pt-BR'));
        return { statusCode: 200, headers, body: JSON.stringify({ parceiros: lista, cobranca_ativa: cfg.cobranca_ativa === true, data_inicio_cobranca: cfg.data_inicio_cobranca || null }) };
      }

      if (action === 'detalhe' || action === 'csv') {
        const p = parceiros.find(x => String(x.id) === String(qs.id || ''));
        if (!p) return { statusCode: 404, headers, body: JSON.stringify({ error: 'parceiro_nao_encontrado' }) };
        const resgates = (await resgatesDe(db, p.id)).sort((a, b) => String(b.data_resgate).localeCompare(String(a.data_resgate)));
        if (action === 'csv') {
          const csv = relatorioCSV(p, resgates, hoje);
          return {
            statusCode: 200,
            headers: {
              ...headers,
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="parceria-${p.slug_link || p.id}.csv"`,
            },
            body: csv,
          };
        }
        return {
          statusCode: 200, headers, body: JSON.stringify({
            parceiro: publicoParceiro(p, resgates.length),
            resumo: resumoParceiro(resgates, hoje),
            alunos: resgates.map(r => ({
              nome: r.usuario_nome || '', email: r.usuario_email || '',
              data_resgate: r.data_resgate || '', status: r.status || '',
              status_label: STATUS_LABEL[r.status] || r.status || '',
              data_inicio_beneficio: r.data_inicio_beneficio || null,
              data_fim_beneficio: r.data_fim_beneficio || null,
              dias_restantes: r.status === STATUS.ATIVO ? diasRestantes(r.data_fim_beneficio, hoje) : null,
            })),
          }),
        };
      }
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'action_invalida' }) };
    }

    // ── POST ─────────────────────────────────────────────────────────────────
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }
    const action = String(body.action || '');

    if (action === 'criar' || action === 'editar') {
      const dados = body.parceiro || {};
      const cupom = normalizarCupom(dados.codigo_cupom);
      const slug = normalizarSlug(dados.slug_link || dados.nome_parceiro);
      if (!String(dados.nome_parceiro || '').trim()) return { statusCode: 400, headers, body: JSON.stringify({ error: 'nome_parceiro obrigatório' }) };
      if (!cupom) return { statusCode: 400, headers, body: JSON.stringify({ error: 'codigo_cupom obrigatório' }) };
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug_link obrigatório' }) };

      // Unicidade de cupom e slug (contra os demais parceiros).
      const existentes = await db.query('parceiros', { limit: 500 }).catch(() => []);
      const conflito = existentes.find(p =>
        String(p.id) !== String(dados.id || '') &&
        (normalizarCupom(p.codigo_cupom) === cupom || normalizarSlug(p.slug_link) === slug));
      if (conflito) return { statusCode: 409, headers, body: JSON.stringify({ error: 'cupom_ou_slug_ja_existe', conflito: conflito.nome_parceiro || conflito.id }) };

      const criadoEm = action === 'criar' ? hoje : undefined;
      const campos = {
        nome_parceiro: String(dados.nome_parceiro || '').trim(),
        email: String(dados.email || '').trim().toLowerCase(),
        instagram: String(dados.instagram || '').trim().replace(/^@/, ''),
        nome_produto: String(dados.nome_produto || '').trim(),
        especialidade: String(dados.especialidade || '').trim(),
        codigo_cupom: cupom,
        slug_link: slug,
        validade_cupom: String(dados.validade_cupom || '').slice(0, 10) || validadePadrao(criadoEm || hoje),
        limite_resgates: dados.limite_resgates === null || dados.limite_resgates === '' || dados.limite_resgates === undefined
          ? null : Math.max(1, parseInt(dados.limite_resgates, 10) || 1),
        ativo: dados.ativo !== false,
      };

      if (action === 'criar') {
        const id = 'par_' + crypto.randomBytes(8).toString('hex');
        await db.setDoc('parceiros', id, { ...campos, criado_em: hoje });
        log.info('[parcerias] parceiro criado', { id, cupom, slug });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, id, link: linkDe(slug) }) };
      }
      const id = String(dados.id || '');
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id obrigatório para editar' }) };
      await db.updateDoc('parceiros', id, campos);
      log.info('[parcerias] parceiro editado', { id, cupom, slug });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id, link: linkDe(slug) }) };
    }

    if (action === 'ativar' || action === 'desativar') {
      const id = String(body.id || '');
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id obrigatório' }) };
      await db.updateDoc('parceiros', id, { ativo: action === 'ativar' });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, id, ativo: action === 'ativar' }) };
    }

    // ── ATIVAÇÃO GLOBAL DA COBRANÇA (irreversível; dupla confirmação) ────────
    if (action === 'ativar_cobranca') {
      if (String(body.confirmar || '') !== FRASE_CONFIRMACAO) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'confirmacao_necessaria', frase: FRASE_CONFIRMACAO }) };
      }
      const cfg = await lerConfig(db);
      if (cfg.cobranca_ativa === true) {
        // Idempotente e IRREVERSÍVEL: nunca reprocessa nem muda a data.
        return { statusCode: 200, headers, body: JSON.stringify({ ja_ativa: true, data_inicio_cobranca: cfg.data_inicio_cobranca, atualizados: 0 }) };
      }
      await db.setDoc('parcerias_config', CONFIG_DOC, { cobranca_ativa: true, data_inicio_cobranca: hoje, ativadaEm: new Date().toISOString() });

      const todos = await db.query('parcerias_resgates', { limit: 5000 }).catch(() => []);
      let atualizados = 0, falhas = 0;
      for (const r of todos) {
        const campos = camposAtivacaoLote(r, hoje); // MAX(data_resgate, hoje)
        if (!campos) continue;
        await db.updateDoc('parcerias_resgates', r.id, campos)
          .then(() => atualizados++)
          .catch(err => { falhas++; log.error('[parcerias] falha no lote', { id: r.id, err: err.message }); });
      }
      log.info('[parcerias] COBRANÇA ATIVADA', { data_inicio_cobranca: hoje, atualizados, falhas });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data_inicio_cobranca: hoje, atualizados, falhas }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action_invalida' }) };
  } catch (err) {
    log.error('[parcerias] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
