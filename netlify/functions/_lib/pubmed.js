// PubMed REST helpers — shared by daily-digest.js (fallback) and ingest-pubmed.js.
// Provides: TEMA_MAP, ESPECIALIDADE_FALLBACK, throttled search, evidence detection.

const { request } = require('../_lib');
const log         = require('./logger');
const { resolveModel } = require('./ai-config');

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

// ── Specialty → its themes (for coherent fallback pool) ─────────────────────

const ESPECIALIDADE_TEMAS = {
  'Ortodontia':         ['Alinhadores invisíveis','Biomecânica ortodôntica','Cefalometria','Mini-implantes / TADs','Expansão maxilar','Contenção e recidiva','Tratamento de Classe II','Tratamento de Classe III','Mordida aberta','Mordida cruzada posterior','Sobremordida profunda','Ortodontia em adultos','Ortodontia e sono/apneia','Inteligência artificial em ortodontia'],
  'Implantodontia':     ['Osseointegração','Carga imediata','Peri-implantite','Membranas e ROG','Elevação de seio maxilar','All-on-4 e All-on-X','Planejamento digital 3D','Complicações em implantes','Tecido mole peri-implantar','Implantes curtos','Sobredentadura','Enxertos ósseos autógenos','Enxertos com biomateriais'],
  'Periodontia':        ['Doença periodontal crônica','Regeneração tecidual guiada','Raspagem e alisamento radicular','Cirurgia regenerativa','Enxerto gengival livre','Terapia fotodinâmica','Defeitos ósseos verticais','Periodontia e diabetes','Microbioma periodontal','Cirurgia mucogengival'],
  'Endodontia':         ['Tratamento de canal convencional','Retratamento endodôntico','Instrumentação rotatória NiTi','Regeneração pulpar em dentes imaturos','Biopulpotomia em dentes permanentes','Tomografia em endodontia'],
  'Dentística':         ['Resinas compostas nanoparticuladas','Clareamento dental','Facetas de porcelana','Laminados cerâmicos','Adesão dental','Erosão dental','Sensibilidade dentinária','Sistemas cerâmicos (zircônia, dissilicato)'],
  'Prótese':            ['Prótese total convencional','Prótese parcial removível','Prótese fixa unitária','Zircônia em prótese fixa','CAD/CAM em prótese','Reabilitação oral completa'],
  'Bucomaxilofacial':   ['Trauma facial','Fraturas mandibulares','Cirurgia de terceiros molares','Carcinoma espinocelular oral','Cistos odontogênicos','Bifosfonatos e osteonecrose'],
  'Odontopediatria':    ['Cárie precoce na infância','Pulpotomia em molares decíduos','Traumatismo dental em crianças','Hipomineralização molar-incisivo (HMI)','Fluoretação e prevenção'],
  'DTM e Dor Orofacial':['Bruxismo do sono','Artralgia da ATM','Placa oclusal estabilizadora','Toxina botulínica (Botox) em DTM','Dor miofascial'],
  'Radiologia':         ['CBCT 3D em diagnóstico','Radiografia periapical digital','Diagnóstico de cárie por imagem','Inteligência artificial em radiologia'],
};

// ── Build digest-compatible article object from raw PubMed data ───────────────

function toDigestArticle(raw, tema, especialidade) {
  const nivel      = detectEvidenceLevel(raw.title, raw.abstract);
  const wordCount  = (raw.abstract || '').split(/\s+/).filter(Boolean).length;
  const tempoLeitura = Math.max(3, Math.round(wordCount / 40));

  return {
    pmid:              raw.pmid,
    titulo_pt:         null,
    titulo:            raw.title,
    resumo_pt:         null,         // will be set by enrichWithClaude or left null
    impacto_pratico:   null,         // will be set by enrichWithClaude
    achados_principais:null,
    nivel_evidencia:   nivel,
    journal:           raw.journal,
    year:              raw.year,
    authors:           raw.authors,
    tempo_leitura:     tempoLeitura,
    isOpenAccess:      false,
    especialidade,
    tema,
    relevanceScore:    40,
    status:            'active',
    _source:           'pubmed_fallback',
    _rawAbstract:      raw.abstract,  // kept for Claude enrichment
    data:              raw.year ? new Date(parseInt(raw.year, 10), 0, 1).toISOString() : new Date().toISOString(),
  };
}

// ── Claude enrichment: results-focused impacto_pratico + PT resumo ────────────
// Requires valid ANTHROPIC_API_KEY. Returns enriched fields or null on failure.

async function enrichWithClaude(article, anthropicKey) {
  if (!anthropicKey) return null;
  const title    = article.titulo || article.title || '';
  const abstract = article._rawAbstract || '';
  if (!abstract || abstract.length < 80) return null;

  const prompt = `Você é um editor científico odontológico brasileiro altamente experiente.

Leia este artigo científico e gere SOMENTE um JSON válido sem markdown.

Título: ${title}
Especialidade: ${article.especialidade}
Abstract: ${abstract}

Regras obrigatórias:
- "titulo_pt": título traduzido para português, conciso e fiel ao original. Máximo 120 caracteres.
- "impacto_pratico": 2-3 frases com resultado principal + direção do efeito + magnitude numérica (quando disponível) + implicação clínica objetiva. Formato: "Pacientes tratados com X apresentaram Y% de Z em comparação a W — achado que sugere/suporta/questiona [conduta clínica]."
- "resumo_pt": 3-4 frases em português descrevendo o que foi estudado, como foi estudado, principal achado com dado numérico, e conclusão clínica. NÃO ser genérico. Incluir números específicos do abstract quando disponíveis.
- "nivel_evidencia": um de: Meta-análise, Revisão Sistemática, RCT, Estudo Coorte, Caso Clínico, In Vitro, Estudo Animal, Revisão Narrativa, Estudo

JSON:
{"titulo_pt":"...","impacto_pratico":"...","resumo_pt":"...","nivel_evidencia":"..."}`;

  const payload = JSON.stringify({
    model:      resolveModel('ENRICH_MODEL'),
    max_tokens: 800,
    messages:   [{ role: 'user', content: prompt }],
  });
  const buf = Buffer.from(payload, 'utf8');

  try {
    const res = await request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
        'content-length':    buf.length,
      },
    }, buf);

    if (res.status !== 200) {
      log.warn('[pubmed] enrichWithClaude API error', { status: res.status, pmid: article.pmid });
      return null;
    }

    const text = JSON.parse(res.body).content?.[0]?.text || '';
    const m    = text.match(/\{[\s\S]*\}/);
    if (!m) {
      log.warn('[pubmed] enrichWithClaude: no JSON in response', { pmid: article.pmid, preview: text.slice(0, 100) });
      return null;
    }
    let parsed;
    try {
      parsed = JSON.parse(m[0]);
    } catch (parseErr) {
      log.warn('[pubmed] enrichWithClaude: JSON parse failed', { pmid: article.pmid, err: parseErr.message, preview: m[0].slice(0, 100) });
      return null;
    }

    log.info('[pubmed] enrichWithClaude ok', {
      pmid:          article.pmid,
      has_titulo_pt: !!parsed.titulo_pt,
      has_resumo:    !!parsed.resumo_pt,
      has_impacto:   !!parsed.impacto_pratico,
    });

    return {
      titulo_pt:        parsed.titulo_pt         || null,
      impacto_pratico:  parsed.impacto_pratico   || null,
      resumo_pt:        parsed.resumo_pt          || null,
      nivel_evidencia:  parsed.nivel_evidencia    || article.nivel_evidencia,
    };
  } catch (err) {
    log.warn('[pubmed] enrichWithClaude failed', { pmid: article.pmid, err: err.message });
    return null;
  }
}

// ── Fetch N articles from PubMed for a user — aggressive fallback strategy ────
// Priority: user's explicit temas → all specialty temas (shuffled) → specialty fallback terms.
// Each article is enriched via Claude if anthropicKey is provided.

async function pubmedFallbackArticles(user, sentPmids, targetCount = 5, anthropicKey = null) {
  const results    = [];
  const usedPmids  = new Set(sentPmids);
  const esp        = Array.isArray(user.especialidade) ? user.especialidade[0] || '' : user.especialidade || '';
  const userTemas  = Array.isArray(user.temas) ? user.temas.filter(Boolean) : [];

  // Build ordered query pool: user's temas first, then all themes of the specialty
  const allEspTemas = ESPECIALIDADE_TEMAS[esp] || [];
  const extraTemas  = allEspTemas.filter(t => !userTemas.includes(t));
  // Deterministic shuffle via date offset for daily diversity
  const dayOffset   = Math.floor(Date.now() / 86400000);
  const shuffled    = [...extraTemas].sort((a, b) => {
    const ha = (a.charCodeAt(0) + dayOffset) % extraTemas.length;
    const hb = (b.charCodeAt(0) + dayOffset) % extraTemas.length;
    return ha - hb;
  });
  const temaPool = [...userTemas, ...shuffled];

  // Try each tema in pool
  for (const tema of temaPool) {
    if (results.length >= targetCount) break;
    const terms = TEMA_MAP[tema];
    if (!terms) continue;
    try {
      const raw = await searchPubMed(terms, usedPmids, `${esp}/${tema}`);
      if (!raw) continue;
      const article = toDigestArticle(raw, tema, esp);
      // Enrich with Claude (results-focused summaries in PT)
      if (anthropicKey) {
        const enriched = await enrichWithClaude(article, anthropicKey);
        if (enriched) Object.assign(article, enriched);
      }
      // If no Claude enrichment, use English abstract as resumo fallback
      if (!article.resumo_pt && raw.abstract) {
        article.resumo_pt = raw.abstract.slice(0, 800);
      }
      results.push(article);
      usedPmids.add(String(raw.pmid));
    } catch (err) {
      log.warn('[pubmed] fallback tema error', { tema, err: err.message });
    }
  }

  // Last resort: specialty-level generic terms
  if (results.length < Math.min(targetCount, 3)) {
    const fbTerms = ESPECIALIDADE_FALLBACK[esp] || ['dental clinical trial randomized'];
    for (const term of fbTerms) {
      if (results.length >= targetCount) break;
      try {
        const raw = await searchPubMed([term], usedPmids, `${esp} generic fallback`);
        if (!raw) continue;
        const article = toDigestArticle(raw, esp, esp);
        if (anthropicKey) {
          const enriched = await enrichWithClaude(article, anthropicKey);
          if (enriched) Object.assign(article, enriched);
        }
        if (!article.resumo_pt && raw.abstract) article.resumo_pt = raw.abstract.slice(0, 800);
        results.push(article);
        usedPmids.add(String(raw.pmid));
      } catch (err) {
        log.warn('[pubmed] generic fallback error', { term, err: err.message });
      }
    }
  }

  log.info('[pubmed] fallback complete', { esp, requested: targetCount, found: results.length });
  return results;
}

module.exports = {
  TEMA_MAP,
  ESPECIALIDADE_FALLBACK,
  ESPECIALIDADE_TEMAS,
  searchPubMed,
  getSearchTerms,
  detectEvidenceLevel,
  enrichWithClaude,
  pubmedFallbackArticles,
  toDigestArticle,
};
