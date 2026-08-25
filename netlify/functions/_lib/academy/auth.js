// ACADEMY — autenticação COMPARTILHADA com o OdontoFeed (mesma sessão do
// dashboard/biblioteca: of_email + of_token; comparação em tempo constante).
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function sessaoValida(db, email, token) {
  if (!email || !token) return { ok: false, status: 401, erro: 'nao_autenticado' };
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  const user = docs[0] || null;
  if (!user || !tokenEqual(user.sessionToken, token)) return { ok: false, status: 401, erro: 'sessao_invalida' };
  if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) return { ok: false, status: 401, erro: 'sessao_expirada' };
  if (user.ativo === false) return { ok: false, status: 403, erro: 'conta_inativa' };
  return { ok: true, user };
}

module.exports = { sessaoValida, tokenEqual };
