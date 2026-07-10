// Guard para endpoints que só devem ser acionados pelo pipeline (GitHub Actions),
// nunca por HTTP público. O CI executa essas funções via `node <arquivo>.js`
// (require.main === module), então NÃO passa pelo handler — este guard só bloqueia
// invocações HTTP diretas, evitando abuso de custo (Claude/Firestore).
//
// Aceita o segredo em header `x-admin-secret` ou query `?secret=`. Se ADMIN_SECRET
// não estiver configurado, bloqueia por padrão (fail-closed).

const crypto = require('crypto');

function checkAdmin(event) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const h = (event && event.headers) || {};
  const q = (event && event.queryStringParameters) || {};
  const provided = h['x-admin-secret'] || h['X-Admin-Secret'] || q.secret || '';
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { checkAdmin };
