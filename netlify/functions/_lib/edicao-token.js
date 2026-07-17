// Token de acesso à edição diária a partir do e-mail ("login sem fricção").
//
// O link do e-mail carrega ?e=<email>&t=<hmac>, onde t = HMAC-SHA256 do e-mail
// com o UNSUBSCRIBE_SECRET (mesmo padrão dos links de descadastro). O token:
//   - dá acesso SOMENTE à leitura da edição da especialidade do dentista
//     (conteúdo compartilhado) + nome/plano para a saudação e o gate Pro;
//   - não dá acesso ao dashboard, preferências nem a qualquer escrita;
//   - não expira (como o de descadastro) — aceitável para esse escopo de leitura.

const crypto = require('crypto');

function buildEdicaoToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET nao configurado');
  return crypto.createHmac('sha256', secret).update('edicao:' + String(email)).digest('hex');
}

function verifyEdicaoToken(email, token) {
  if (!email || !token) return false;
  let expected;
  try { expected = buildEdicaoToken(email); } catch { return false; }
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildEdicaoUrl(baseUrl, email) {
  return `${baseUrl}/edicao.html?e=${encodeURIComponent(email)}&t=${buildEdicaoToken(email)}`;
}

module.exports = { buildEdicaoToken, verifyEdicaoToken, buildEdicaoUrl };
