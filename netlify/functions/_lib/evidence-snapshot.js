// Evidence snapshot — extracts a structured clinical PICO-like summary from enriched articles.
// Works entirely from existing Firestore fields; requires no additional AI calls.
// Returns an ultra-scannable clinical card for use in < 30 seconds of reading.

const EVIDENCE_FORCE = {
  'Meta-análise':        { level: 'Máxima',       strength: 5, tag: 'A' },
  'Revisão Sistemática': { level: 'Muito Alta',    strength: 4, tag: 'A' },
  'RCT':                 { level: 'Alta',          strength: 3, tag: 'B' },
  'Estudo Coorte':       { level: 'Moderada',      strength: 2, tag: 'C' },
  'Revisão Narrativa':   { level: 'Baixa–Moderada', strength: 1, tag: 'D' },
  'Caso Clínico':        { level: 'Baixa',         strength: 1, tag: 'D' },
  'In Vitro':            { level: 'Pré-clínica',   strength: 0, tag: 'E' },
  'Estudo Animal':       { level: 'Pré-clínica',   strength: 0, tag: 'E' },
};

// Patterns for population/follow-up extraction from Portuguese/English text
const POP_PATTERNS   = [/(\d+)\s*pacientes?/i, /n\s*=\s*(\d+)/i, /(\d+)\s*participantes?/i, /(\d+)\s*adultos?/i, /(\d+)\s*(dentes?|implantes?|casos?)/i];
const FUPUP_PATTERNS = [/(\d+)\s*m[eê]ses?/i, /(\d+)\s*anos?/i, /acompanhamento\s+de\s+([\w\s]+)/i, /follow.up.*?(\d+)/i];

function extractFirstMatch(text, patterns) {
  if (!text) return null;
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

function extractComparison(titulo) {
  if (!titulo) return null;
  const t = titulo.toLowerCase();
  if (t.includes(' vs ') || t.includes(' versus ') || t.includes(' compared ') || t.includes(' comparado ')) {
    const parts = titulo.split(/\bvs\.?\b|\bversus\b|\bcompar[ae][d]?\b/i);
    if (parts.length >= 2) return parts.slice(1).join(' vs ').trim().slice(0, 120);
  }
  return null;
}

function whenToApplyFromEvidence(nivel, impacto) {
  if (!nivel) return null;
  if (nivel === 'Meta-análise' || nivel === 'Revisão Sistemática') {
    return 'Baseado em síntese de múltiplos estudos — aplicável quando contexto clínico é análogo ao descrito.';
  }
  if (nivel === 'RCT') {
    return 'Em casos comparáveis à população do ensaio; verificar critérios de inclusão do estudo.';
  }
  if (nivel === 'Estudo Coorte') {
    return 'Considerar como dado observacional — requer confirmação experimental antes de generalização.';
  }
  if (nivel === 'In Vitro' || nivel === 'Estudo Animal') {
    return 'Apenas como referência exploratória — evidência pré-clínica, sem tradução direta para a prática.';
  }
  return 'Considerar junto a outros estudos e à experiência clínica individual.';
}

function whenNotToExtrapolate(nivel, limitacoes) {
  const base = limitacoes && limitacoes.length > 10 ? limitacoes : null;
  if (nivel === 'Caso Clínico') return base || 'Relato de caso individual — não extrapolar para populações.';
  if (nivel === 'In Vitro' || nivel === 'Estudo Animal') return base || 'Condições laboratoriais/animais diferem do contexto clínico humano.';
  if (nivel === 'RCT') return base || 'Verificar tamanho amostral e tempo de seguimento antes de aplicar.';
  return base || 'Considerar as limitações metodológicas e o contexto clínico individual.';
}

/**
 * Builds a clinical snapshot object from an enriched article.
 * All fields are best-effort — may be null if data is insufficient.
 *
 * @param {Object} article — Firestore article document
 * @returns {Object}       — structured clinical snapshot
 */
function buildSnapshot(article) {
  const combinedText = [article.titulo_pt, article.titulo, article.resumo_pt, article.resumo].filter(Boolean).join(' ');

  const populacao   = extractFirstMatch(combinedText, POP_PATTERNS);
  const followUp    = extractFirstMatch(combinedText, FUPUP_PATTERNS);
  const comparacao  = extractComparison(article.titulo_pt || article.titulo || '');

  const achados = Array.isArray(article.achados_principais)
    ? article.achados_principais.filter(Boolean).slice(0, 3)
    : [];

  const ev     = EVIDENCE_FORCE[article.nivel_evidencia] || { level: 'Não classificado', strength: 0, tag: '?' };
  const titulo = article.titulo_pt || article.titulo || '';

  return {
    pmid:            article.pmid || article.id || '',
    titulo,
    tipoEstudo:      article.nivel_evidencia || '—',
    forcaEvidencia:  ev.level,
    forcaTag:        ev.tag,
    forcaStrength:   ev.strength,
    populacao:       populacao   || 'Não especificado no resumo',
    followUp:        followUp    || null,
    intervencao:     article.tema || article.especialidade || '—',
    comparacao:      comparacao  || null,
    desfechoPrincipal: article.impacto_pratico || (achados[0] || null),
    achados,
    takeawayClinico: article.impacto_pratico || '',
    quandoAplicar:   whenToApplyFromEvidence(article.nivel_evidencia, article.impacto_pratico),
    quandoNaoExtrapolar: whenNotToExtrapolate(article.nivel_evidencia, article.limitacoes),
    limitacoes:      article.limitacoes || null,
    journal:         article.journal || '',
    data:            article.data || '',
    pubmedUrl:       article.pubmedUrl || '',
    isOpenAccess:    article.isOpenAccess || false,
    tempoLeitura:    article.tempo_leitura || 3,
    disclaimer:      'Este conteúdo é destinado à atualização científica e não substitui avaliação clínica individualizada.',
  };
}

module.exports = { buildSnapshot, EVIDENCE_FORCE };
