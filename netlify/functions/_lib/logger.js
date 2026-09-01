const crypto = require('crypto');

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? 1;

// ── PRIVACIDADE (31/08) ──────────────────────────────────────────────────────
// O pipeline diário roda no GitHub Actions, onde o LOG É PÚBLICO — qualquer
// pessoa lê. O daily-digest logava `email` do dentista em ~17 pontos (por
// usuário, todo dia), expondo a base de assinantes. Mascarar no LOGGER e não
// em cada chamada é a única forma de garantir: vale para todo call site, hoje
// e no futuro. O apelido é ESTÁVEL por e-mail (hash truncado), então dá para
// seguir o mesmo dentista entre linhas do log sem saber quem é.
const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function apelido(email) {
  const h = crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
  return `usuario#${h.slice(0, 8)}`;
}

// Mascara e-mails em qualquer profundidade (string solta, dentro de frase,
// array ou objeto aninhado) sem alterar o dado do chamador.
function mascarar(v, prof = 0) {
  if (typeof v === 'string') return v.replace(EMAIL_RX, m => apelido(m));
  if (Array.isArray(v)) return prof > 4 ? v : v.map(x => mascarar(x, prof + 1));
  if (v && typeof v === 'object') {
    if (prof > 4) return v;
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = mascarar(val, prof + 1);
    return out;
  }
  return v;
}

function log(level, message, data) {
  if ((LEVELS[level] ?? 1) < MIN_LEVEL) return;
  const entry = { ts: new Date().toISOString(), level, message: mascarar(message) };
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) entry[k] = mascarar(v);
    }
  }
  const output = JSON.stringify(entry);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

module.exports = {
  debug: (msg, data) => log('debug', msg, data),
  info:  (msg, data) => log('info',  msg, data),
  warn:  (msg, data) => log('warn',  msg, data),
  error: (msg, data) => log('error', msg, data),
  apelido, mascarar, // expostos para os testes de privacidade
};
