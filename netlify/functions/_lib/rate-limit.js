// Rate limiter em MEMÓRIA (janela deslizante) para os endpoints PÚBLICOS de
// leitura. Auditoria de segurança 03/08: sem limite, um bot poderia martelar e
// pesar no Firestore. De propósito NÃO usa Firestore — o limitador não pode
// custar leituras no banco que ele protege. É por-instância (as functions do
// Netlify reusam instâncias quentes, então um atacante que martela cai na mesma
// instância e é barrado); não pretende ser um WAF distribuído, e sim um teto
// barato contra abuso trivial. Endpoints autenticados/pipeline têm suas próprias
// travas (sessão, ADMIN_SECRET) e não passam por aqui.

const _hits = new Map(); // chave -> array de timestamps (ms) dentro da janela

// Extrai o IP do cliente dos headers do Netlify (ordem de confiança).
function clientIp(event) {
  const h = (event && event.headers) || {};
  return h['x-nf-client-connection-ip'] ||
    (h['x-forwarded-for'] ? String(h['x-forwarded-for']).split(',')[0].trim() : '') ||
    h['client-ip'] || 'desconhecido';
}

// Poda preguiçosa: remove chaves cujas marcas já saíram da janela (evita o Map
// crescer sem limite numa instância de vida longa).
let _ultimaPoda = 0;
function poda(agora, janelaMs) {
  if (agora - _ultimaPoda < 60000) return; // no máx. 1x/min
  _ultimaPoda = agora;
  for (const [k, ts] of _hits) {
    const vivos = ts.filter(t => agora - t < janelaMs);
    if (vivos.length) _hits.set(k, vivos); else _hits.delete(k);
  }
}

// Registra um acesso e diz se está DENTRO do limite.
// max = requisições permitidas por janela; janelaMs = tamanho da janela.
function permitir(chave, max, janelaMs) {
  const agora = Date.now();
  poda(agora, janelaMs);
  const ts = (_hits.get(chave) || []).filter(t => agora - t < janelaMs);
  if (ts.length >= max) {
    const retryMs = janelaMs - (agora - ts[0]);
    return { ok: false, retryAfter: Math.max(1, Math.ceil(retryMs / 1000)) };
  }
  ts.push(agora);
  _hits.set(chave, ts);
  return { ok: true };
}

// Uso no handler:  const rl = rateLimited(event, 'get-stats'); if (rl) return rl;
// Retorna um response 429 pronto quando estoura, ou null quando pode seguir.
function rateLimited(event, nome, { max = 60, windowMs = 60000 } = {}) {
  // Requisições internas do pipeline (node <arquivo>.js) não têm event.headers.
  if (!event || !event.headers) return null;
  const { ok, retryAfter } = permitir(`${nome}:${clientIp(event)}`, max, windowMs);
  if (ok) return null;
  return {
    statusCode: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfter),
      'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: 'rate_limited', message: 'Muitas requisições. Tente novamente em instantes.', retryAfter }),
  };
}

module.exports = { rateLimited, permitir, clientIp, _reset: () => _hits.clear() };
