// Validador numérico determinístico — anti-alucinação de números em resumos.
//
// Regra: todo número citado no resumo gerado DEVE existir no material de origem
// (abstract + metadados). Pega o clássico "estudo com 10 pacientes" virando "9"
// — nenhum modelo de IA garante 100% de fidelidade numérica; este validador sim.
//
// Conservador por desenho: números ausentes na ORIGEM (a IA inventou ou derivou)
// reprovam; números da origem ausentes no resumo são permitidos (resumir é omitir).

// Extrai números "clinicamente relevantes" de um texto pt/en: inteiros, decimais
// (vírgula ou ponto) e percentuais. Normaliza vírgula decimal para ponto.
function extractNumbers(text) {
  const s = String(text || '');
  const out = new Set();
  const re = /\d+(?:[.,]\d+)?/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const raw = m[0];
    out.add(raw.replace(',', '.'));
    // "1.234" pode ser milhar (en) — aceita também a forma sem separador
    if (/^\d{1,3}\.\d{3}$/.test(raw)) out.add(raw.replace('.', ''));
    if (/^\d{1,3},\d{3}$/.test(raw)) out.add(raw.replace(',', ''));
  }
  return out;
}

// true se todos os números do resumo existem na origem.
// Retorna { ok, offending: [...] }.
function numbersConsistent(sourceText, summaryText) {
  const source  = extractNumbers(sourceText);
  const summary = extractNumbers(summaryText);
  const offending = [];
  for (const n of summary) {
    if (!source.has(n)) offending.push(n);
  }
  return { ok: offending.length === 0, offending };
}

module.exports = { extractNumbers, numbersConsistent };
