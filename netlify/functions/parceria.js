// RESGATE PÚBLICO de parceria — /parceria/{slug} (página parceria.html).
//
// GET  ?slug=nayara-idz
//        → dados PÚBLICOS da parceria (nome do parceiro, produto) + validade.
//          Nunca expõe e-mail/limites/contagens do parceiro.
// POST { action:'resgatar', slug, email }  (Authorization: Bearer <sessionToken>)
//        → aplica o resgate ao usuário LOGADO. A página cuida do fluxo:
//          conta nova → register (validação completa, e-mail de boas-vindas,
//          termos LGPD) → login → resgatar; conta existente → login → resgatar.
//          Reuso de 100% da autenticação existente — nada de cadastro paralelo.
//
// Regras: cupom ativo/dentro da validade/dentro do limite; UM resgate por
// aluno por parceria (idempotente — repetir devolve o resgate existente);
// SEM cartão de crédito em lugar nenhum; benefício de 90 dias só começa a
// contar no início da cobrança (MAX(data_resgate, data_inicio_cobranca)) —
// e o texto da página diz isso com todas as letras.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const {
  STATUS, MOTIVO_MSG, validarResgate, camposNovoResgate, normalizarSlug,
} = require('./_lib/parcerias');
const log = require('./_lib/logger');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUser(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  return docs[0] || null;
}

async function parceiroPorSlug(db, slug) {
  const docs = await db.query('parceiros', { limit: 500 }).catch(() => []);
  return docs.find(p => normalizarSlug(p.slug_link) === slug) || null;
}

async function resgatesDoParceiro(db, parceiroId) {
  return db.query('parcerias_resgates', {
    where: { fieldFilter: { field: { fieldPath: 'parceiro_id' }, op: 'EQUAL', value: { stringValue: String(parceiroId) } } },
    limit: 2000,
  }).catch(() => []);
}

async function lerConfig(db) {
  const docs = await db.query('parcerias_config', { limit: 5 }).catch(() => []);
  return docs.find(d => d.id === 'global') || { cobranca_ativa: false, data_inicio_cobranca: null };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'parceria', { max: 30, windowMs: 60000 }); if (_rl) return _rl;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    // ── GET: dados públicos da landing ──────────────────────────────────────
    if (event.httpMethod === 'GET') {
      const slug = normalizarSlug((event.queryStringParameters || {}).slug);
      if (!slug) return { statusCode: 400, headers, body: JSON.stringify({ error: 'slug obrigatório' }) };
      const p = await parceiroPorSlug(db, slug);
      const resgates = p ? await resgatesDoParceiro(db, p.id) : [];
      const val = validarResgate(p, resgates.length, hoje);
      if (!val.ok) {
        return { statusCode: 200, headers, body: JSON.stringify({ valido: false, motivo: val.motivo, mensagem: MOTIVO_MSG[val.motivo] }) };
      }
      // Só o que a landing precisa exibir — nada sensível do parceiro.
      return {
        statusCode: 200, headers, body: JSON.stringify({
          valido: true,
          nome_parceiro: p.nome_parceiro || '',
          nome_produto: p.nome_produto || '',
          especialidade: p.especialidade || '',
        }),
      };
    }

    // ── POST: resgatar (usuário autenticado) ────────────────────────────────
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }
    if (String(body.action || '') !== 'resgatar') return { statusCode: 400, headers, body: JSON.stringify({ error: 'action_invalida' }) };

    const email = String(body.email || '').trim().toLowerCase();
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) };

    const user = await getUser(db, email);
    if (!user || !tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada' }) };
    }

    const slug = normalizarSlug(body.slug);
    const p = await parceiroPorSlug(db, slug);
    const resgates = p ? await resgatesDoParceiro(db, p.id) : [];

    // Idempotência: um resgate por aluno por parceria — repetir NÃO conta de
    // novo no limite nem duplica o benefício.
    const jaResgatou = resgates.find(r => String(r.usuario_email || '').toLowerCase() === email);
    if (jaResgatou) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, ja_resgatado: true, status: jaResgatou.status }) };
    }

    const val = validarResgate(p, resgates.length, hoje);
    if (!val.ok) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: val.motivo, mensagem: MOTIVO_MSG[val.motivo] }) };
    }

    const cfg = await lerConfig(db);
    const campos = camposNovoResgate({
      parceiroId: p.id, cupom: p.codigo_cupom, email, nome: user.nome || body.nome || '',
      cobrancaAtiva: cfg.cobranca_ativa === true, dataInicioCobranca: cfg.data_inicio_cobranca, hoje,
    });
    const resgateId = 'res_' + crypto.randomBytes(8).toString('hex');
    await db.setDoc('parcerias_resgates', resgateId, { ...campos, criado_em: new Date().toISOString() });

    // Marca a ORIGEM no cadastro: garante Premium (cortesia) e protege o
    // downgrade seletivo — a expiração só rebaixa quem veio de parceria e
    // nunca quem tiver assinatura paga registrada.
    await db.updateDoc('cadastros', user.id, {
      plano: 'premium',
      premiumOrigem: user.dataAtivacaoPremium || user.planoPremium ? (user.premiumOrigem || 'pago') : 'parceria',
      parceriaSlug: slug,
      parceriaCupom: campos.cupom_id,
      parceriaResgateEm: hoje,
    }).catch(err => log.warn('[parceria] cadastro não atualizado', { email, err: err.message }));

    log.info('[parceria] resgate concluído', { slug, email, status: campos.status });
    return {
      statusCode: 200, headers, body: JSON.stringify({
        success: true,
        status: campos.status,
        beneficio_ja_contando: campos.status === STATUS.ATIVO,
        data_fim_beneficio: campos.data_fim_beneficio,
      }),
    };
  } catch (err) {
    log.error('[parceria] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
