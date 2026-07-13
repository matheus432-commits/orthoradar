// Guardrail de orçamento do Google Cloud TTS (vozes Standard).
//
// REGRAS CLARAS (nunca ultrapassar o plano grátis de 4M caracteres/mês):
//   - FREE_TIER_HARD  = 4.000.000  → limite absoluto do plano grátis. NUNCA cruzar.
//   - MONTHLY_TARGET  = 3.200.000  → teto OPERACIONAL (margem de segurança de 20%).
//                                    Toda decisão usa este teto, não o de 4M, então
//                                    o consumo real nunca chega perto dos 4M.
//   - MAX_CHARS_PER_AUDIO = 8.000  → limite por áudio (~5 min). Bound cada geração.
//   - Cota DIÁRIA = floor(MONTHLY_TARGET / dias_do_mês) → espalha o consumo pelo mês
//                                    e evita queimar a cota nos primeiros dias.
//
// Como é imposto: NENHUMA síntese acontece sem passar por checkBudget() antes e
// recordUsage() depois (ver _lib/tts.js). A contagem de caracteres é a do texto
// enviado à API (o mesmo que o Google cobra), contada de forma conservadora.
//
// Contabilidade: 1 doc por mês em `tts_usage/{YYYY-MM}` = { chars, byDay:{...} }.
// A geração roda SEQUENCIALMENTE (uma especialidade por vez), então o
// read-modify-write abaixo é seguro (sem concorrência sobre o contador).

const FREE_TIER_HARD    = 4_000_000;
const MONTHLY_TARGET     = 3_200_000;
const MAX_CHARS_PER_AUDIO = 8_000;

// Sanidade: o teto operacional precisa ficar abaixo do limite grátis.
if (MONTHLY_TARGET >= FREE_TIER_HARD) throw new Error('[tts-budget] MONTHLY_TARGET deve ser < FREE_TIER_HARD');

function pad2(n) { return String(n).padStart(2, '0'); }
function monthId(d) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`; }
function dayId(d)   { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
function daysInMonth(d) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); }

// Caracteres cobrados = tamanho do texto enviado. Contagem conservadora.
function billableChars(text) { return String(text || '').length; }

async function loadUsage(db, now) {
  const doc = await db.getDoc('tts_usage', monthId(now)).catch(() => null);
  return { chars: doc?.chars || 0, byDay: doc?.byDay || {} };
}

// Decide se `chars` cabe no orçamento. Retorna { ok, reason, ... }.
function checkBudget(usage, chars, now) {
  const dCap = Math.floor(MONTHLY_TARGET / daysInMonth(now));
  const monthUsed = usage.chars || 0;
  const dayUsed   = usage.byDay?.[dayId(now)] || 0;

  if (chars <= 0)                              return { ok: false, reason: 'empty' };
  if (chars > MAX_CHARS_PER_AUDIO)             return { ok: false, reason: 'audio_too_long', chars, cap: MAX_CHARS_PER_AUDIO };
  if (monthUsed + chars > MONTHLY_TARGET)      return { ok: false, reason: 'monthly_cap', monthUsed, target: MONTHLY_TARGET };
  if (dayUsed + chars > dCap)                  return { ok: false, reason: 'daily_cap', dayUsed, dailyCap: dCap };

  return {
    ok: true,
    monthUsed, dayUsed, dailyCap: dCap,
    remainingMonth: MONTHLY_TARGET - monthUsed - chars,
    remainingDay:   dCap - dayUsed - chars,
  };
}

// Incrementa os contadores (mês + dia) após uma síntese bem-sucedida.
async function recordUsage(db, now, chars) {
  const usage = await loadUsage(db, now);
  const day   = dayId(now);
  const byDay = { ...usage.byDay, [day]: (usage.byDay[day] || 0) + chars };
  await db.setDoc('tts_usage', monthId(now), {
    chars: (usage.chars || 0) + chars,
    byDay,
    updatedAt: now.toISOString(),
  });
}

module.exports = {
  FREE_TIER_HARD, MONTHLY_TARGET, MAX_CHARS_PER_AUDIO,
  monthId, dayId, daysInMonth, billableChars,
  loadUsage, checkBudget, recordUsage,
};
