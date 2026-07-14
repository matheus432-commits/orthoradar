// Exclusão de conta e dados pessoais — LGPD art. 18, V e VI.
//
// POST { email, senhaHash } — exige a senha do titular (mesma verificação do
// login) para impedir que terceiros excluam contas alheias.
//
// Escopo da eliminação:
//   - cadastros (documento da conta, incl. nome, e-mail, hash de senha)
//   - user_profiles (perfil comportamental)
//   - user_engagement (streak, badges, cliques por tema)
//   - digests, artigos_enviados, digest_logs, weekly_digest_logs (histórico
//     de envio vinculado ao e-mail)
//   - suppression_list ganha um registro mínimo de opt-out (só o hash do
//     e-mail) para nunca voltarmos a enviar — base legal: obrigação de
//     atender à própria revogação (art. 18, § 6º).
//
// Fica de fora o que a lei manda reter (nada hoje: sem dados fiscais no banco).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { verifyPassword } = require('./_lib/password');
const log = require('./_lib/logger');

const MAX_DOCS_PER_COLLECTION = 400; // teto por execução; reexecutar se sobrar

function emailHash16(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}

async function deleteByEmailField(db, collection, email) {
  let deleted = 0;
  try {
    const docs = await db.query(collection, {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: MAX_DOCS_PER_COLLECTION,
    });
    for (const d of docs) {
      await db.deleteDoc(collection, d.id).catch(e =>
        log.warn('[delete-account] deleteDoc falhou', { collection, id: d.id, err: e.message }));
      deleted++;
    }
  } catch (err) {
    log.warn('[delete-account] varredura falhou', { collection, err: err.message });
  }
  return deleted;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, senhaHash } = body;
  if (!email || !senhaHash) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email e senha obrigatorios' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const db        = new Firestore(projectId, apiKey);

  try {
    // Localiza a conta e verifica a senha (resposta genérica anti-enumeração)
    const users = await db.query('cadastros', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 2,
    });
    const user = users[0];
    const { match } = verifyPassword(senhaHash, user?.senhaHash || 's2$00$00');
    if (!user || !match) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Credenciais inválidas.' }) };
    }

    // Registro mínimo de opt-out (apenas hash — sem dado pessoal legível)
    const ehash = emailHash16(email);
    await db.setDoc('suppression_list', ehash, {
      motivo: 'exclusao_conta',
      em: new Date().toISOString(),
    }).catch(e => log.warn('[delete-account] suppression falhou', { err: e.message }));

    // Elimina documentos diretos (chave conhecida)
    for (const u of users) {
      await db.deleteDoc('cadastros', u.id).catch(e => log.warn('[delete-account] cadastro falhou', { err: e.message }));
    }
    await db.deleteDoc('user_profiles', email).catch(() => {});
    await db.deleteDoc('user_engagement', ehash).catch(() => {});

    // Elimina histórico vinculado ao e-mail
    const counts = {};
    for (const col of ['digests', 'artigos_enviados', 'digest_logs', 'weekly_digest_logs']) {
      counts[col] = await deleteByEmailField(db, col, email);
    }

    log.info('[delete-account] conta excluída', { ehash, counts });
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: 'Conta e dados pessoais excluídos.' }),
    };
  } catch (err) {
    log.error('[delete-account] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno. Tente novamente.' }) };
  }
};
