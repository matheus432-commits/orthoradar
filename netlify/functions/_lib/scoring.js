// Article scoring and classification helpers.
// All functions are deterministic — no external I/O.

// Journal tier table (impact factor proxy, kept lightweight)
const JOURNAL_TIERS = {
  // Tier 1 — flagship, high IF
  'Journal of Dental Research': 20,
  'Journal of Clinical Periodontology': 18,
  'Journal of Periodontology': 15,
  'Clinical Oral Implants Research': 15,
  'Dental Materials': 14,
  'Journal of Endodontics': 14,
  'Journal of Orthodontics': 12,
  'American Journal of Orthodontics and Dentofacial Orthopedics': 12,
  'Oral Oncology': 12,
  'Oral Diseases': 10,
  'Journal of Oral and Maxillofacial Surgery': 10,
  'International Journal of Oral and Maxillofacial Implants': 10,
  'Journal of Prosthetic Dentistry': 10,
  'Journal of Oral Rehabilitation': 8,
  'Journal of Oral Pathology & Medicine': 8,
  'Community Dentistry and Oral Epidemiology': 8,
  'European Journal of Oral Sciences': 7,
  'Caries Research': 7,
  'Oral Surgery, Oral Medicine, Oral Pathology and Oral Radiology': 7,
  // Tier 2
  'International Journal of Periodontics & Restorative Dentistry': 5,
  'Quintessence International': 5,
  'Journal of Esthetic and Restorative Dentistry': 5,
};

// Evidence level patterns — ordered by strength (check higher first)
const EVIDENCE_PATTERNS = [
  { level: 'Meta-análise',        patterns: [/\bmeta.?analysis\b/i, /\bmeta.?análise\b/i] },
  { level: 'Revisão Sistemática', patterns: [/\bsystematic review\b/i, /\brevisão sistemática\b/i] },
  { level: 'RCT',                 patterns: [/\brandomized controlled trial\b/i, /\bRCT\b/, /\bensaio clínico randomizado\b/i, /\bdouble.?blind\b/i] },
  { level: 'Estudo Coorte',       patterns: [/\bcohort study\b/i, /\bprospective study\b/i, /\bretrospective study\b/i, /\bcase.?control\b/i] },
  { level: 'Caso Clínico',        patterns: [/\bcase report\b/i, /\bcase series\b/i, /\brelato de caso\b/i] },
  { level: 'In Vitro',            patterns: [/\bin vitro\b/i, /\blaboratory study\b/i] },
  { level: 'Estudo Animal',       patterns: [/\banimal study\b/i, /\bin vivo\b.*animal/i, /\brat\b.*model/i, /\bmouse\b.*model/i] },
  { level: 'Revisão Narrativa',   patterns: [/\breview\b/i, /\bnarrative\b/i, /\bscoping review\b/i] },
];

// Specialty keyword map
const SPECIALTY_KEYWORDS = {
  'Ortodontia':      ['orthodonti', 'malocclusion', 'aligner', 'bracket', 'cephalometric', 'molar rotation'],
  'Implantodontia':  ['implant', 'osseointegration', 'peri-implant', 'sinus lift', 'bone graft'],
  'Periodontia':     ['periodon', 'gingivitis', 'gingival', 'alveolar bone', 'scaling root planing', 'furcation'],
  'Endodontia':      ['endodon', 'root canal', 'pulp', 'apical', 'retreatment', 'irrigation'],
  'Dentística':      ['composite', 'resin', 'bonding', 'caries', 'restoration', 'bleaching', 'whitening', 'amalgam', 'direct restoration', 'glass ionomer', 'adhesive'],
  'Prótese':         ['prosthodon', 'prosthes', 'denture', 'crown', 'fixed partial', 'removable partial', 'complete denture', 'zirconia', 'ceramic', 'pontic', 'dental bridge', 'overdenture'],
  'Cirurgia':        ['surgery', 'surgical', 'extraction', 'orthognathic', 'osteotomy', 'flap'],
  'Odontopediatria': ['pediatric dent', 'children', 'deciduous', 'primary teeth', 'child oral', 'primary molar', 'primary dentition', 'pulpotomy', 'stainless steel crown', 'space maintainer'],
  'Saúde Pública':   ['epidemiology', 'prevalence', 'public health', 'socioeconomic', 'community dent'],
  'Radiologia':      ['radiograph', 'CBCT', 'cone beam', 'imaging', 'radiolog', 'tomograph'],
  'Estomatologia':   ['oral mucosa', 'stomatolog', 'leukoplakia', 'oral cancer', 'aphthous'],
};

// ── Overrides determinísticos de especialidade ───────────────────────────────
// Rede de segurança FINAL, aplicada depois de qualquer classificação (keyword ou
// IA). Regras cirúrgicas para erros que NÃO podem acontecer:
//   1. Artigo sobre dentição decídua / paciente pediátrico → Odontopediatria,
//      não importa o procedimento (coroa, restauração, pulpotomia…).
//   2. Restauração DIRETA (resina/amálgama/ionômero — ex.: substituir amálgama)
//      rotulada como Prótese → Dentística.
const PEDIATRIC_RX = /\b(deciduous|primary (?:tooth|teeth|molar|molars|incisor|incisors|canine|canines|dentition)|paediatric dentistry|pediatric dentistry|preschool child|stainless.?steel crown|pulpotom|space maintainer|dec[ií]duo)/i;
const DIRECT_RESTORATION_RX = /\b(amalgam|direct (?:resin |composite )?restoration|direct composite|resin.?based composite restoration|glass.?ionomer|composite restoration)\b/i;

/**
 * Retorna a especialidade CORRIGIDA quando uma regra determinística se aplica,
 * ou null quando o rótulo proposto pode ficar como está.
 */
function especialidadeOverride(title, abstract, label) {
  const text = `${title || ''} ${abstract || ''}`;
  if (PEDIATRIC_RX.test(text) && label !== 'Odontopediatria') return 'Odontopediatria';
  if (label === 'Prótese' && DIRECT_RESTORATION_RX.test(text) && !/\b(denture|prosthes|fixed partial|overdenture|pontic)\b/i.test(text)) return 'Dentística';
  return null;
}

/**
 * Detects evidence level from article text (title + abstract).
 * Returns the strongest level found, or 'Revisão Narrativa' as default.
 */
function detectEvidenceLevel(title, abstract) {
  const text = `${title || ''} ${abstract || ''}`;
  for (const { level, patterns } of EVIDENCE_PATTERNS) {
    if (patterns.some(p => p.test(text))) return level;
  }
  return 'Revisão Narrativa';
}

/**
 * Classifies the primary dental specialty from title + abstract.
 * Returns the specialty name or null.
 */
function classifySpecialty(title, abstract) {
  const text = (`${title || ''} ${abstract || ''}`).toLowerCase();

  // Precedência absoluta: população decídua/pediátrica define a especialidade
  // antes de qualquer contagem — "zirconia crown in primary molars" é
  // Odontopediatria, nunca Prótese.
  if (PEDIATRIC_RX.test(text)) return 'Odontopediatria';

  let best = null, bestScore = 0;
  for (const [specialty, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = specialty; }
  }
  return especialidadeOverride(title, abstract, best) || best;
}

/**
 * Computes a relevance score 0–100 for an article.
 * Higher = more likely to be sent to users.
 */
function scoreRelevance(article) {
  let score = 0;

  // Open access: users can read the full paper
  if (article.isOpenAccess) score += 25;

  // Evidence level
  const evidenceScore = {
    'Meta-análise':        25,
    'Revisão Sistemática': 22,
    'RCT':                 20,
    'Estudo Coorte':       12,
    'Revisão Narrativa':   8,
    'Caso Clínico':        5,
    'In Vitro':            4,
    'Estudo Animal':       3,
  };
  score += evidenceScore[article.nivel_evidencia] || 5;

  // Recency
  if (article.data) {
    const ageMs = Date.now() - new Date(article.data).getTime();
    const ageDays = ageMs / (24 * 3600 * 1000);
    if (ageDays < 30)  score += 20;
    else if (ageDays < 90)  score += 12;
    else if (ageDays < 180) score += 6;
    else if (ageDays < 365) score += 3;
  }

  // Journal tier
  const journalScore = JOURNAL_TIERS[article.journal] || 0;
  score += Math.min(journalScore, 20); // cap at 20

  // AI quality (if enriched)
  if (typeof article.qualidadeIA === 'number') {
    score += Math.round(article.qualidadeIA * 10);
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Estimates AI quality score 0.0–1.0 based on richness of enriched fields.
 */
function estimateQualityScore(enriched) {
  if (!enriched) return 0;
  let score = 0;
  if (enriched.titulo_pt     && enriched.titulo_pt.length     > 20) score += 0.2;
  if (enriched.resumo_pt     && enriched.resumo_pt.length     > 100) score += 0.3;
  if (enriched.impacto_pratico && enriched.impacto_pratico.length > 20) score += 0.2;
  if (Array.isArray(enriched.achados_principais) && enriched.achados_principais.length >= 2) score += 0.15;
  if (enriched.nivel_evidencia) score += 0.1;
  if (enriched.limitacoes    && enriched.limitacoes.length    > 10) score += 0.05;
  return Math.min(1.0, score);
}

module.exports = { detectEvidenceLevel, classifySpecialty, especialidadeOverride, scoreRelevance, estimateQualityScore };
