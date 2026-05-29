// PubMed REST helpers — shared by daily-digest.js (fallback) and ingest-pubmed.js.
// Provides: TEMA_MAP, ESPECIALIDADE_FALLBACK, throttled search, evidence detection.

const { request } = require('../_lib');
const log         = require('./logger');

const NCBI_API_PARAM = process.env.NCBI_API_KEY ? '&api_key=' + process.env.NCBI_API_KEY : '';

// ── Theme → PubMed search terms ───────────────────────────────────────────────
// Each key is a Portuguese theme name; value is an array of English terms tried
// in order until one returns results.

const TEMA_MAP = {
  // ===== ORTODONTIA =====
  'Alinhadores invisíveis':          ['clear aligners orthodontics', 'invisible aligners treatment'],
  'Biomecânica ortodôntica':         ['orthodontic biomechanics', 'orthodontic force tooth movement'],
  'Cefalometria':                    ['cephalometric analysis orthodontics', 'cephalometry craniofacial'],
  'Mini-implantes / TADs':           ['temporary anchorage devices orthodontics', 'mini-implant orthodontic anchorage'],
  'Mini-implantes/TADs':             ['temporary anchorage devices orthodontics', 'mini-implant orthodontic anchorage'],
  'Expansão maxilar':                ['rapid maxillary expansion', 'maxillary expansion orthodontics'],
  'Expansão de maxila':              ['rapid maxillary expansion', 'palatal expansion appliance'],
  'Cirurgia ortognática':            ['orthognathic surgery', 'jaw surgery malocclusion'],
  'Ortodontia e ATM':                ['temporomandibular disorder orthodontics', 'orthodontic treatment TMJ'],
  'Ancoragem esquelética':           ['skeletal anchorage orthodontics', 'temporary anchorage devices'],
  'Contenção e recidiva':            ['orthodontic retention relapse', 'retainer post-treatment'],
  'Ortodontia interceptiva':         ['interceptive orthodontics', 'early orthodontic treatment children'],
  'Tratamento de Classe II':         ['Class II malocclusion treatment', 'Angle Class II orthodontics'],
  'Tratamento de Classe III':        ['Class III malocclusion treatment', 'skeletal Class III orthopedics'],
  'Mordida aberta':                  ['anterior open bite treatment', 'open bite orthodontics'],
  'Mordida cruzada posterior':       ['posterior crossbite correction', 'transverse maxillary deficiency'],
  'Sobremordida profunda':           ['deep overbite correction orthodontics', 'deep bite treatment'],
  'Ortodontia em adultos':           ['adult orthodontics treatment', 'malocclusion treatment adult patients'],
  'Respiração oral e má-oclusão':    ['mouth breathing malocclusion', 'oral breathing dentofacial effects'],
  'Ortodontia e sono/apneia':        ['obstructive sleep apnea orthodontics', 'sleep disordered breathing orthodontics'],
  'Inteligência artificial em ortodontia': ['artificial intelligence orthodontics', 'machine learning cephalometric analysis'],

  // ===== IMPLANTODONTIA =====
  'Osseointegração':                 ['osseointegration dental implant', 'implant bone integration'],
  'Carga imediata':                  ['immediate loading dental implants', 'immediate implant provisionalization'],
  'Enxertos ósseos autógenos':       ['autogenous bone graft implant', 'autologous bone graft dental'],
  'Enxertos com biomateriais':       ['bone substitute implant', 'xenograft dental augmentation'],
  'Peri-implantite':                 ['peri-implantitis treatment', 'peri-implant disease management'],
  'Planejamento digital 3D':         ['digital implant planning 3D CBCT', 'computer-guided implant surgery'],
  'All-on-4 e All-on-X':            ['All-on-4 dental implant technique', 'full arch implant rehabilitation'],
  'Elevação de seio maxilar':        ['sinus floor elevation implant', 'maxillary sinus lift augmentation'],
  'Implantes curtos':                ['short dental implants', 'short implants posterior region'],
  'Implantes zigomáticos':           ['zygomatic implants atrophic maxilla', 'zygoma implants rehabilitation'],
  'Membranas e ROG':                 ['guided bone regeneration membrane', 'barrier membrane GBR'],
  'Sobredentadura':                  ['implant overdenture', 'implant-retained complete denture'],
  'Complicações em implantes':       ['dental implant complications', 'implant failure risk factors'],
  'Tecido mole peri-implantar':      ['peri-implant soft tissue management', 'keratinized mucosa implant'],

  // ===== PERIODONTIA =====
  'Doença periodontal crônica':      ['chronic periodontitis treatment', 'periodontal disease management'],
  'Periodontite agressiva':          ['aggressive periodontitis', 'periodontal disease young adults'],
  'Gengivite':                       ['gingivitis treatment', 'plaque-induced gingivitis'],
  'Regeneração tecidual guiada':     ['guided tissue regeneration periodontal', 'GTR periodontal regeneration'],
  'Cirurgia mucogengival':           ['mucogingival surgery gingival recession', 'root coverage surgery'],
  'Periodontia e diabetes':          ['periodontal disease diabetes mellitus', 'periodontitis glycemic control'],
  'Raspagem e alisamento radicular': ['scaling root planing periodontal', 'nonsurgical periodontal debridement'],
  'Cirurgia regenerativa':           ['regenerative periodontal surgery', 'periodontal bone regeneration'],
  'Enxerto gengival livre':          ['free gingival graft', 'gingival autograft keratinized'],
  'Terapia fotodinâmica':            ['photodynamic therapy periodontitis', 'antimicrobial photodynamic dental'],
  'Defeitos ósseos verticais':       ['vertical bone defect periodontal', 'intrabony defect treatment regeneration'],
  'Microbioma periodontal':          ['periodontal microbiome', 'subgingival microbiota periodontitis'],

  // ===== DENTÍSTICA =====
  'Resinas compostas nanoparticuladas': ['nanocomposite resin dental', 'nanofiller composite restoration'],
  'Clareamento dental':              ['tooth whitening bleaching', 'carbamide peroxide dental bleaching'],
  'Facetas de porcelana':            ['porcelain veneers aesthetic', 'ceramic veneer preparation'],
  'Laminados cerâmicos':             ['ceramic laminate veneer', 'minimal invasive ceramic restoration'],
  'Adesão dental':                   ['dental adhesive bonding system', 'dentin bonding agent'],
  'Erosão dental':                   ['dental erosion acid wear', 'tooth erosion treatment'],
  'Sensibilidade dentinária':        ['dentin hypersensitivity treatment', 'dentinal sensitivity desensitizing'],
  'Sistemas cerâmicos (zircônia, dissilicato)': ['lithium disilicate ceramic crown', 'zirconia ceramic restoration'],

  // ===== BUCOMAXILOFACIAL =====
  'Trauma facial':                   ['facial trauma maxillofacial surgery', 'maxillofacial injury treatment'],
  'Fraturas mandibulares':           ['mandibular fracture treatment ORIF', 'jaw fracture fixation'],
  'Cirurgia de terceiros molares':   ['third molar surgery extraction', 'wisdom tooth surgical removal'],
  'Carcinoma espinocelular oral':    ['oral squamous cell carcinoma treatment', 'oral cancer surgery'],
  'Cistos odontogênicos':            ['odontogenic cyst treatment surgery', 'dentigerous cyst removal'],
  'Bifosfonatos e osteonecrose':     ['medication-related osteonecrosis jaw MRONJ', 'bisphosphonate osteonecrosis'],

  // ===== PRÓTESE =====
  'Prótese total convencional':      ['complete denture fabrication', 'conventional full denture'],
  'Prótese parcial removível':       ['removable partial denture design', 'cast partial denture RPD'],
  'Prótese fixa unitária':           ['single unit dental crown', 'dental crown restoration'],
  'Zircônia em prótese fixa':        ['zirconia fixed prosthesis', 'monolithic zirconia restoration'],
  'CAD/CAM em prótese':              ['CAD CAM dental prosthesis', 'digital prosthetics CAD CAM'],
  'Reabilitação oral completa':      ['full mouth rehabilitation prosthodontics', 'complete oral rehabilitation'],

  // ===== ENDODONTIA =====
  'Tratamento de canal convencional':     ['root canal treatment endodontics', 'nonsurgical endodontic therapy'],
  'Retratamento endodôntico':             ['endodontic retreatment nonsurgical', 'failed root canal retreatment'],
  'Instrumentação rotatória NiTi':        ['NiTi rotary endodontic file', 'nickel titanium rotary instrumentation'],
  'Regeneração pulpar em dentes imaturos':['pulp revascularization immature teeth', 'regenerative endodontics'],
  'Biopulpotomia em dentes permanentes':  ['vital pulp therapy permanent teeth', 'direct pulp capping MTA'],
  'Tomografia em endodontia':             ['CBCT endodontic diagnosis', 'cone beam CT root canal anatomy'],

  // ===== ODONTOPEDIATRIA =====
  'Cárie precoce na infância':       ['early childhood caries prevention treatment', 'severe early childhood caries'],
  'Pulpotomia em molares decíduos':  ['pulpotomy primary molar deciduous', 'MTA pulpotomy primary teeth'],
  'Traumatismo dental em crianças':  ['dental trauma children management', 'primary teeth trauma treatment'],
  'Hipomineralização molar-incisivo (HMI)': ['molar incisor hypomineralization MIH', 'MIH treatment management'],
  'Fluoretação e prevenção':         ['fluoride prevention caries children', 'fluoride varnish application caries'],

  // ===== DTM E DOR OROFACIAL =====
  'Bruxismo do sono':                ['sleep bruxism management treatment', 'nocturnal bruxism polysomnography'],
  'Bruxismo em vigília':             ['awake bruxism treatment', 'daytime bruxism management'],
  'Artralgia da ATM':                ['TMJ arthralgia treatment', 'temporomandibular joint pain management'],
  'Placa oclusal estabilizadora':    ['occlusal stabilization splint TMD', 'Michigan splint temporomandibular'],
  'Toxina botulínica (Botox) em DTM':['botulinum toxin TMD bruxism', 'botox masseter injection bruxism'],
  'Dor miofascial':                  ['myofascial pain orofacial trigger point', 'masticatory myofascial pain syndrome'],

  // ===== RADIOLOGIA =====
  'CBCT 3D em diagnóstico':          ['cone beam computed tomography dental diagnosis', 'CBCT oral diagnosis'],
  'Radiografia periapical digital':  ['digital periapical radiograph', 'intraoral digital radiography'],
  'Diagnóstico de cárie por imagem': ['radiographic caries detection bitewing', 'bitewing radiograph caries diagnosis'],
  'Inteligência artificial em radiologia': ['artificial intelligence dental radiology diagnosis', 'deep learning radiograph detection'],

  // ===== LEGACY ALIASES =====
  'Expansão palatina':               ['palatal expansion orthodontics', 'rapid palatal expansion'],
  'Periimplantite':                  ['peri-implantitis', 'peri-implant disease'],
  'Disfunção temporomandibular':     ['temporomandibular disorder treatment', 'TMD management'],
  'DTM e dor orofacial':             ['temporomandibular disorder orofacial pain', 'jaw pain temporomandibular'],
  'Ortodontia & ATM':                ['orthodontics temporomandibular joint', 'malocclusion TMJ relationship'],
};

const ESPECIALIDADE_FALLBACK = {
  'Ortodontia':           ['orthodontics malocclusion clinical trial', 'orthodontic therapy randomized'],
  'Implantodontia':       ['dental implants osseointegration clinical', 'implant dentistry randomized'],
  'Periodontia':          ['periodontal disease treatment clinical', 'periodontology randomized controlled'],
  'Endodontia':           ['root canal treatment endodontics clinical', 'endodontic therapy outcomes'],
  'Dentística':           ['restorative dentistry composite clinical', 'esthetic dentistry randomized'],
  'Prótese':              ['prosthodontics dental prosthesis clinical', 'prosthetic dentistry outcomes'],
  'Bucomaxilofacial':     ['oral maxillofacial surgery clinical', 'maxillofacial surgical outcomes'],
  'Odontopediatria':      ['pediatric dentistry clinical trial', 'children dental treatment outcomes'],
  'DTM e Dor Orofacial':  ['temporomandibular disorder treatment clinical', 'orofacial pain randomized'],
  'Radiologia':           ['dental radiology diagnosis clinical', 'oral radiology CBCT outcomes'],
};

// ── Evidence level detection ──────────────────────────────────────────────────

const EVIDENCE_PATTERNS = [
  { re: /\bmeta.analys/i,                    level: 'Meta-análise' },
  { re: /\bsystematic\s+review/i,            level: 'Revisão Sistemática' },
  { re: /\brandomized\s+controlled|\brct\b/i,level: 'RCT' },
  { re: /\bprospective\s+cohort|\bcohort\b/i,level: 'Estudo Coorte' },
  { re: /\bcase\s+report|\bclinical\s+case/i,level: 'Caso Clínico' },
  { re: /\bin\s+vitro|\bcell\s+culture/i,    level: 'In Vitro' },
  { re: /\banimal\s+model|\bin\s+vivo\b/i,   level: 'Estudo Animal' },
];

function detectEvidenceLevel(title = '', abstract = '') {
  const text = `${title} ${abstract}`;
  for (const { re, level } of EVIDENCE_PATTERNS) {
    if (re.test(text)) return level;
  }
  return 'Estudo';
}

// ── PubMed rate limiter (3 req/s without NCBI key) ───────────────────────────

let _lastPubMed = 0;
async function throttle() {
  const gap = 400 - (Date.now() - _lastPubMed);
  if (gap > 0) await new Promise(r => setTimeout(r, gap));
  _lastPubMed = Date.now();
}

// ── Fetch a single article from PubMed ───────────────────────────────────────

async function fetchOne(pmid) {
  const path = `/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract${NCBI_API_PARAM}`;
  await throttle();
  const res = await request({ hostname: 'eutils.ncbi.nlm.nih.gov', path, method: 'GET' }, null);
  if (res.status !== 200) return null;
  const xml = res.body;

  const titleM  = xml.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  const abstractMs = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g) || [];
  if (!titleM) return null;

  const title   = titleM[1].replace(/<[^>]+>/g, '').trim();
  const abstract = abstractMs.map(a => a.replace(/<[^>]+>/g, '').trim()).join(' ').slice(0, 1200);
  const journalM = xml.match(/<Title>([\s\S]*?)<\/Title>/);
  const yearM    = xml.match(/<Year>(\d{4})<\/Year>/);
  const authMs   = xml.match(/<LastName>([\s\S]*?)<\/LastName>/g) || [];
  const authors  = authMs.slice(0, 3).map(a => a.replace(/<[^>]+>/g, '').trim());
  const authorStr = authors.length
    ? authors.join(', ') + (authMs.length > 3 ? ' et al.' : '')
    : '';

  return {
    pmid:    String(pmid),
    title,
    abstract,
    journal: journalM ? journalM[1].trim() : '',
    year:    yearM    ? yearM[1]           : String(new Date().getFullYear()),
    authors: authorStr,
  };
}

// ── Search PubMed for a query term ───────────────────────────────────────────

async function searchOne(query, excludePmids = new Set()) {
  const encoded    = encodeURIComponent(query);
  const searchPath = `/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=20&sort=date&retmode=json&datetype=pdat&reldate=1825${NCBI_API_PARAM}`;

  await throttle();
  const res = await request({ hostname: 'eutils.ncbi.nlm.nih.gov', path: searchPath, method: 'GET' }, null);
  if (res.status !== 200) return null;

  const ids   = JSON.parse(res.body).esearchresult?.idlist || [];
  if (!ids.length) return null;

  const fresh = ids.filter(id => !excludePmids.has(String(id)));
  const pool  = fresh.length ? fresh : ids;

  // Try candidates until one has a useful abstract
  for (const pmid of pool.slice(0, 5)) {
    if (excludePmids.has(String(pmid))) continue;
    const art = await fetchOne(pmid);
    if (art && art.abstract && art.abstract.length > 80) return art;
  }
  return null;
}

// ── Exported search: try terms in order until one succeeds ───────────────────

async function searchPubMed(terms, excludePmids = new Set(), context = '') {
  for (const term of (Array.isArray(terms) ? terms : [terms])) {
    try {
      const result = await searchOne(term, excludePmids);
      if (result) {
        log.info('[pubmed] found', { term: term.slice(0, 60), pmid: result.pmid, context });
        return result;
      }
    } catch (err) {
      log.warn('[pubmed] search error', { term, err: err.message });
    }
  }
  return null;
}

// ── Get search terms for a PT theme name ─────────────────────────────────────

function getSearchTerms(tema, especialidades = []) {
  if (TEMA_MAP[tema]) return TEMA_MAP[tema];
  // Specialty fallback
  for (const esp of especialidades) {
    if (ESPECIALIDADE_FALLBACK[esp]) return ESPECIALIDADE_FALLBACK[esp];
  }
  return ['dental research clinical', 'oral health evidence'];
}

// ── Build digest-compatible article object from raw PubMed data ───────────────
// Fills fields expected by email-template.js / buildDigestEmail().

function toDigestArticle(raw, tema, especialidade) {
  const nivel = detectEvidenceLevel(raw.title, raw.abstract);
  // Estimate reading time: ~200 words/min; abstract is a proxy for article length
  const wordCount  = (raw.abstract || '').split(/\s+/).filter(Boolean).length;
  const tempoLeitura = Math.max(3, Math.round(wordCount / 40)); // proxy: abstract ≈ 5% of full text

  return {
    pmid:            raw.pmid,
    titulo_pt:       null,          // not yet translated
    titulo:          raw.title,
    resumo_pt:       raw.abstract,  // English — will show in resumo block
    impacto_pratico: null,          // no clinical relevance yet — block hidden
    achados_principais: null,
    nivel_evidencia: nivel,
    journal:         raw.journal,
    year:            raw.year,
    authors:         raw.authors,
    tempo_leitura:   tempoLeitura,
    isOpenAccess:    false,
    especialidade,
    tema,
    relevanceScore:  40,            // baseline for fallback articles
    status:          'active',
    _source:         'pubmed_fallback',
  };
}

// ── Fetch N articles from PubMed for a user (when Firestore artigos is sparse) ─

async function pubmedFallbackArticles(user, sentPmids, targetCount = 5) {
  const results     = [];
  const usedPmids   = new Set(sentPmids);
  const especialidade = Array.isArray(user.especialidade) ? user.especialidade[0] || '' : user.especialidade || '';
  const especialidades = user.especialidades || (especialidade ? [especialidade] : []);
  const temas       = Array.isArray(user.temas) ? user.temas.filter(Boolean) : [];

  // 1. Try user's selected themes first
  for (const tema of temas) {
    if (results.length >= targetCount) break;
    const terms = TEMA_MAP[tema];
    if (!terms) continue;
    try {
      const raw = await searchPubMed(terms, usedPmids, tema);
      if (raw) {
        results.push(toDigestArticle(raw, tema, especialidade));
        usedPmids.add(raw.pmid);
      }
    } catch (err) {
      log.warn('[pubmed] fallback tema error', { tema, err: err.message });
    }
  }

  // 2. If still short, use specialty-level fallback terms
  if (results.length < Math.min(targetCount, 3)) {
    const fbTerms = ESPECIALIDADE_FALLBACK[especialidade] || ['dental clinical trial'];
    try {
      const raw = await searchPubMed(fbTerms, usedPmids, especialidade + ' specialty fallback');
      if (raw) {
        results.push(toDigestArticle(raw, especialidade, especialidade));
        usedPmids.add(raw.pmid);
      }
    } catch (err) {
      log.warn('[pubmed] fallback specialty error', { especialidade, err: err.message });
    }
  }

  return results;
}

module.exports = {
  TEMA_MAP,
  ESPECIALIDADE_FALLBACK,
  searchPubMed,
  getSearchTerms,
  detectEvidenceLevel,
  pubmedFallbackArticles,
  toDigestArticle,
};
