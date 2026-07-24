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

// ── Estudo não concluído (protocolo / em andamento) ──────────────────────────
// Regra editorial: o OdontoFeed só publica estudos COM resultados. Protocolos,
// registros de ensaio e trabalhos "em andamento" ainda não têm achados — narrá-
// los como estudo distorce a ciência (incidente do laceback). Detector de alta
// PRECISÃO: marcadores inequívocos no TÍTULO (sinal forte) + no início do
// abstract. Não usa o periódico sozinho (revistas como "Trials"/"BMJ Open"
// publicam protocolos E estudos concluídos).
const PROTOCOL_TITLE_RX = new RegExp([
  'study protocol', 'trial protocol', 'protocol for (?:a|an|the)\\b',
  '\\b(?:a|an) (?:study|trial) protocol', 'rationale and design',
  'design of (?:a|an|the)\\b.*\\b(?:trial|study|cohort)', 'protocol of (?:a|an|the)\\b',
  'protocol paper', 'registered report',
  // Protocolos de REVISÃO/META-ANÁLISE (incidente 23/07: meta-análise "que ainda
  // vai avaliar" — BMJ Open): "…: a systematic review protocol", "meta-analysis
  // protocol", "protocol for a systematic review/meta-analysis".
  '(?:systematic|scoping|narrative|umbrella) review protocol',
  'meta-?analysis protocol',
  'protocol (?:of|for) (?:a |an |the )?(?:systematic review|meta-?analysis|scoping review)',
  // Português
  'protocolo de (?:estudo|ensaio|pesquisa|revis[ãa]o)', 'protocolo do estudo',
].join('|'), 'i');

// Sinais de "ainda sem resultados" nas primeiras frases do abstract.
const ONGOING_ABSTRACT_RX = new RegExp([
  'this (?:study )?protocol', 'we will (?:recruit|enrol|enroll|randomi|assess|conduct|compare|investigate)',
  'will be (?:recruited|enrolled|randomi|conducted|assessed|performed|analy)',
  'is designed to (?:evaluate|assess|compare|investigate)',
  'trial registration', 'has been registered', 'prospectively registered',
  'the aim of this protocol', 'no results are (?:yet )?available',
  // Protocolo de REVISÃO SISTEMÁTICA/META-ANÁLISE (ainda sem síntese de dados):
  'we will (?:search|include|synthesi|screen|extract|appraise)',
  'will be (?:searched|screened|included|synthesi|extracted|appraised)',
  '(?:databases|the literature) will be searched', 'prospero',
  'this (?:systematic |scoping )?review (?:protocol )?(?:will|aims to|is registered)',
  // Português
  'ser[aã]o (?:recrutados|randomizados|avaliados|incluídos|pesquisados|buscados|selecionados)',
  'este protocolo', 'protocolo (?:tem por|visa)', 'registro do ensaio',
  'esta revis[ãa]o (?:sistem[áa]tica )?(?:ir[áa]|visa|pretende|foi registrada)',
].join('|'), 'i');

/**
 * true quando o artigo é um estudo NÃO concluído (protocolo/em andamento).
 * `title` pesa mais; o abstract só reforça quando o marcador aparece cedo (o
 * início costuma declarar o desenho — evita falso-positivo por um "will" solto
 * lá no fim de um estudo já concluído).
 */
function isUnfinishedStudy(title, abstract, journal) {
  const t = String(title || '');
  if (PROTOCOL_TITLE_RX.test(t)) return true;
  const head = String(abstract || '').slice(0, 400);
  if (PROTOCOL_TITLE_RX.test(head)) return true;
  if (ONGOING_ABSTRACT_RX.test(head)) return true;
  // Periódico dedicado a protocolos — sinal forte por si só.
  if (/\bresearch protocols\b/i.test(String(journal || ''))) return true;
  return false;
}

// O título traduzido (titulo_pt) ficou EM INGLÊS? (incidente 24/07: card com
// "Orthodontics and temporomandibular disorders: a comprehensive review"). O
// gate de enriquecimento só media COMPRIMENTO — um titulo_pt não-traduzido
// passava. Sinais: (1) idêntico ao título original; (2) sem acento português E
// com ≥2 palavras funcionais claramente inglesas.
const PALAVRAS_INGLES_RX = /\b(the|of|and|with|for|among|versus|assessment|comprehensive|review|study|studies|treatment|patients|using|based|outcomes?|management|between|randomized|randomised|trial|systematic|evaluation|analysis|effect|effects|impact|role)\b/gi;
function tituloEmIngles(tituloPt, tituloOriginal) {
  const pt = String(tituloPt || '').trim();
  if (!pt) return false; // vazio é tratado pelo gate de comprimento
  const orig = String(tituloOriginal || '').trim();
  // 1) Não traduzido: igual ao original.
  if (orig && pt.toLowerCase() === orig.toLowerCase()) return true;
  // 2) Sem acento pt-BR E com ≥2 marcadores ingleses fortes.
  const temAcento = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(pt);
  if (temAcento) return false;
  const nIngles = (pt.match(PALAVRAS_INGLES_RX) || []).length;
  return nIngles >= 2;
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

module.exports = { detectEvidenceLevel, classifySpecialty, especialidadeOverride, isUnfinishedStudy, tituloEmIngles, scoreRelevance, estimateQualityScore };
