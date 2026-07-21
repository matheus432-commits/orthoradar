// Programa "Indique um colega" do OdontoFeed.
//
// Regra (diretriz 21/07/2026): a cada N indicações VÁLIDAS (um colega que se
// cadastra pelo seu link), o indicador ganha 1 mês grátis de Premium. Como
// nesta fase TODO mundo já está em Premium de cortesia, os meses ganhos ficam
// "no banco" (creditados) e são honrados quando o Premium virar pago — nunca
// se perdem.
//
// Cada usuário tem um refCode curto e um link:  odontofeed.com/?ref=CODE
// Ao se cadastrar por esse link, o novo usuário grava referredBy=CODE; o dono
// do código acumula +1 indicação.

// Quantas indicações valem 1 mês grátis. O fundador definiu "2 ou 3"; fixamos
// em 3 (mais conservador para o negócio). Trocar aqui muda todo o programa.
const INDICACOES_POR_MES = 3;

// Alfabeto sem caracteres ambíguos (sem O/0, I/1, L) — o código é lido e
// digitado por humanos ("passa teu código aí").
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 7;

// Gera um refCode aleatório e legível (7 chars). Colisão é desprezível nesta
// escala; quem chama pode reconsultar se quiser garantia extra.
function gerarRefCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) {
    s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return s;
}

// Normaliza um código recebido de URL/entrada do usuário: maiúsculas, só chars
// do alfabeto, no comprimento esperado. Retorna '' se não for um código válido.
function normalizeRefCode(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const up = raw.trim().toUpperCase();
  if (up.length !== CODE_LEN) return '';
  for (const ch of up) if (!ALFABETO.includes(ch)) return '';
  return up;
}

// Progresso do programa a partir do total de indicações válidas.
function calcularBonus(indicacoes) {
  const n = Math.max(0, Number(indicacoes) || 0);
  const mesesGanhos = Math.floor(n / INDICACOES_POR_MES);
  const faltamParaProximo = (INDICACOES_POR_MES - (n % INDICACOES_POR_MES)) % INDICACOES_POR_MES || INDICACOES_POR_MES;
  return {
    indicacoes: n,
    mesesGanhos,
    porMes: INDICACOES_POR_MES,
    // Quantas faltam para ganhar o PRÓXIMO mês (sempre 1..N).
    faltamParaProximo: n === 0 ? INDICACOES_POR_MES : faltamParaProximo,
    // Progresso dentro do ciclo atual (0..N-1) para barra de progresso.
    noCiclo: n % INDICACOES_POR_MES,
  };
}

// Monta o link de indicação a partir do código.
function linkDe(refCode, base = 'https://odontofeed.com') {
  return `${base}/?ref=${refCode}`;
}

module.exports = { INDICACOES_POR_MES, gerarRefCode, normalizeRefCode, calcularBonus, linkDe };
