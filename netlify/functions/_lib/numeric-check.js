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

// NÚMEROS POR EXTENSO (incidente 04/08 — os 3 resumos da Prótese reprovados em
// série): o abstract dizia "three techniques" e o resumo escrevia "3 técnicas";
// como o extrator só pega ALGARISMOS, "three" nunca virava "3" na origem e o
// validador reprovava um número perfeitamente fiel. Agora os números escritos
// por extenso (EN e PT) da ORIGEM entram no conjunto como dígitos. Só a origem
// ganha essa expansão — o resumo continua validado dígito a dígito.
const EXTENSO = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, ambos: 2, ambas: 2, tres: 3, 'três': 3,
  quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
  doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
  dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40,
  cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, mil: 1000,
  one: 1, two: 2, both: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};
function writtenNumbers(text) {
  const out = new Set();
  const s = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const m of s.match(/[a-z]+/g) || []) {
    const chave = m.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (chave in EXTENSO) out.add(String(EXTENSO[chave]));
  }
  return out;
}

// true se todos os números do resumo existem na origem.
// Retorna { ok, offending: [...] }.
function numbersConsistent(sourceText, summaryText) {
  const source  = extractNumbers(sourceText);
  for (const n of writtenNumbers(sourceText)) source.add(n); // "three" → "3"
  const summary = extractNumbers(summaryText);
  const offending = [];
  for (const n of summary) {
    if (!source.has(n)) offending.push(n);
  }
  return { ok: offending.length === 0, offending };
}

module.exports = { extractNumbers, writtenNumbers, numbersConsistent };
