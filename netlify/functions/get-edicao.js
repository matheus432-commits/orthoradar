// GET /.netlify/functions/get-edicao — dados da edição diária para /edicao.html.
//
// Autenticação (uma das duas):
//   a) MAGIC LINK do e-mail:  ?e=<email>&t=<hmac>   (ver _lib/edicao-token.js)
//   b) SESSÃO do site:        ?email=<email> + Authorization: Bearer <sessionToken>
//
// Resposta: usuário (nome/plano/especialidade), edição do dia da especialidade
// (do cache digests_especialidade — mesmo conteúdo para todos os inscritos) e,
// para plano Pro, a URL do áudio do dia quando disponível.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { verifyEdicaoToken } = require('./_lib/edicao-token');
const { espDigestSlug, specialtySlug } = require('./_lib/slug');
const { resolveArticleUrl } = require('./_lib/email-template');
const { firebaseDownloadUrl } = require('./_lib/storage');
const { isPro } = require('./_lib/plans');
const log = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUserByEmail(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  return docs[0] || null;
}

// Edição de hoje; se ainda não existir (antes do envio ou falha do pipeline),
// cai para a edição mais recente da especialidade.
async function getEdicao(db, especialidade) {
  const today = new Date().toISOString().slice(0, 10);
  const key   = `${espDigestSlug(especialidade)}_${today}`;

  let doc = null;
  try { doc = await db.getDoc('digests_especialidade', key); } catch { /* fallback abaixo */ }
  if (doc?.status === 'ready') return doc;

  try {
    const docs = await db.query('digests_especialidade', {
      where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } },
      limit: 60,
    });
    return docs
      .filter(d => d.status === 'ready')
      .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)[0] || null;
  } catch (err) {
    log.warn('[get-edicao] fallback query falhou', { especialidade, err: err.message });
    return null;
  }
}

async function getPodcastUrl(db, especialidade) {
  try {
    const doc = await db.getDoc('podcasts', specialtySlug(especialidade));
    if (!doc || !doc.objectPath || !doc.downloadToken) return null;
    const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
    const bucket    = process.env.GCS_BUCKET || (projectId + '.appspot.com');
    return {
      url:      firebaseDownloadUrl(bucket, doc.objectPath, doc.downloadToken),
      titulo:   doc.titulo || '',
      geradoEm: doc.geradoEm || '',
    };
  } catch { return null; }
}

function publicArticle(a) {
  return {
    titulo:          a.titulo_pt || a.titulo || '',
    resumo:          a.resumo_pt || '',
    impacto:         a.impacto_pratico || '',
    nivel_evidencia: a.nivel_evidencia || '',
    tempo_leitura:   a.tempo_leitura || 3,
    journal:         a.journal || '',
    year:            a.year || '',
    url:             resolveArticleUrl(a, BASE_URL),
  };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const qs = event.queryStringParameters || {};
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const db = new Firestore(projectId, process.env.FIREBASE_API_KEY);

  try {
    // ── Autenticação ──────────────────────────────────────────────────────────
    let email = null;

    if (qs.e && qs.t) {
      // (a) magic link do e-mail
      if (!verifyEdicaoToken(qs.e, qs.t)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'link_invalido', message: 'Link inválido ou expirado. Use o botão do seu e-mail mais recente.' }) };
      }
      email = qs.e;
    } else if (qs.email) {
      // (b) sessão do site (mesmo esquema do get-podcast)
      const authHeader = event.headers['authorization'] || event.headers['Authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) };
      const u = await getUserByEmail(db, qs.email);
      if (!u || !tokenEqual(u.sessionToken, token)) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida', message: 'Sessão inválida. Faça login novamente.' }) };
      }
      if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada', message: 'Sessão expirada. Faça login novamente.' }) };
      }
      email = qs.email;
    } else {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autenticado' }) };
    }

    // ── Usuário ───────────────────────────────────────────────────────────────
    const user = await getUserByEmail(db, email);
    if (!user || user.ativo === false) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'conta_nao_encontrada' }) };
    }
    const especialidade = Array.isArray(user.especialidade)
      ? (user.especialidade.filter(Boolean)[0] || '')
      : (user.especialidade || '');
    if (!especialidade) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'sem_especialidade' }) };
    }

    // ── Edição + áudio (Pro) ─────────────────────────────────────────────────
    const edicao = await getEdicao(db, especialidade);
    if (!edicao) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'sem_edicao', message: 'A edição de hoje ainda não está disponível. Volte em instantes.' }) };
    }

    const pro = isPro(user);
    const podcast = pro ? await getPodcastUrl(db, especialidade) : null;

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        user: {
          nome:  String(user.nome || '').split(' ')[0] || 'Dentista',
          plano: pro ? 'pro' : 'basico',
          isPro: pro,
          especialidade,
        },
        edicao: {
          date:      edicao.date || '',
          editorial: edicao.editorial || null,
          artigos:   (edicao.artigos || []).map(publicArticle),
          achado:    edicao.achadoSemana ? publicArticle(edicao.achadoSemana) : null,
        },
        podcast, // null para não-Pro ou quando o áudio do dia não existe
      }),
    };
  } catch (err) {
    log.error('[get-edicao] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
