const https = require("https");

// =============================================================
// DICIONARIO COMPLETO PT -> EN PARA BUSCA NO PUBMED
// Cada tema tem nome em PT (exibido ao dentista) e lista de
// termos em ingles para busca cientifica no PubMed/MeSH.
// A busca usa os termos em ordem, com fallback automatico.
// =============================================================
const TEMAS_DB = [
  // ---- ORTODONTIA ----
  { pt: "Alinhadores invisiveis", en: ["clear aligners", "invisible aligners orthodontics", "aligner orthodontic treatment"] },
  { pt: "Expansao maxilar", en: ["rapid maxillary expansion", "maxillary expansion", "maxillary disjunction", "palatal expansion"] },
  { pt: "Apinhamento dentario", en: ["dental crowding", "malocclusion crowding", "tooth crowding orthodontics"] },
  { pt: "Biomecânica ortodontica", en: ["orthodontic biomechanics", "orthodontic forces biomechanics", "bracket mechanics orthodontics"] },
  { pt: "Cefalometria", en: ["cephalometry orthodontics", "cephalometric analysis", "cephalometric measurements"] },
  { pt: "Mini-implantes ortodonticos", en: ["temporary anchorage devices orthodontics", "mini-implants orthodontics", "skeletal anchorage orthodontics"] },
  { pt: "Mini-implantes / TADs", en: ["temporary anchorage devices orthodontics", "mini-implants orthodontics", "skeletal anchorage orthodontics"] },
  { pt: "Mini-implantes/TADs", en: ["temporary anchorage devices orthodontics", "mini-implants orthodontics", "skeletal anchorage orthodontics"] },
  { pt: "Aparelho fixo", en: ["fixed orthodontic appliance", "fixed braces orthodontics", "brackets fixed appliance"] },
  { pt: "Retencao ortodontica", en: ["orthodontic retention", "orthodontic retainer", "relapse orthodontics retention"] },
  { pt: "Mordida aberta", en: ["open bite malocclusion", "anterior open bite", "skeletal open bite orthodontics"] },
  { pt: "Mordida cruzada", en: ["crossbite orthodontics", "posterior crossbite", "anterior crossbite malocclusion"] },
  { pt: "Classe II ortodontica", en: ["Class II malocclusion orthodontics", "skeletal Class II treatment", "mandibular retrognathism orthodontics"] },
  { pt: "Classe III ortodontica", en: ["Class III malocclusion orthodontics", "skeletal Class III treatment", "mandibular prognathism orthodontics"] },
  { pt: "Expansao palatina", en: ["palatal expansion", "rapid palatal expansion", "maxillary expansion appliance"] },
  // ---- IMPLANTODONTIA ----
  { pt: "Osseointegração", en: ["osseointegration dental implants", "osseointegration implant", "bone implant interface"] },
  { pt: "Carga imediata", en: ["immediate loading dental implants", "immediate implant loading", "same day implants"] },
  { pt: "Enxertos osseos autogenos", en: ["autogenous bone graft dental", "autologous bone graft implants", "autogenous bone transplant"] },
  { pt: "Enxertos com biomateriais", en: ["bone graft biomaterial dental implant", "synthetic bone substitute implants", "xenograft bone implant"] },
  { pt: "Periimplantite", en: ["peri-implantitis", "periimplant disease", "peri-implant infection treatment"] },
  { pt: "Implante unitario", en: ["single tooth implant", "single unit dental implant", "implant supported crown"] },
  { pt: "All-on-4", en: ["all-on-4 implants", "full arch implant rehabilitation", "implant supported full arch prosthesis"] },
  { pt: "Elevacao do seio maxilar", en: ["sinus lift dental implants", "maxillary sinus augmentation", "sinus floor elevation"] },
  { pt: "Implante imediato", en: ["immediate implant placement", "post-extraction immediate implant", "fresh socket implant"] },
  // ---- PERIODONTIA ----
  { pt: "Doenca periodontal", en: ["periodontal disease", "periodontitis treatment", "chronic periodontitis"] },
  { pt: "Doença periodontal crônica", en: ["chronic periodontitis", "periodontal disease treatment", "periodontitis management"] },
  { pt: "Periodontite agressiva", en: ["aggressive periodontitis", "generalized aggressive periodontitis treatment", "early onset periodontitis"] },
  { pt: "Gengivite", en: ["gingivitis", "gingival inflammation", "gingivitis treatment"] },
  { pt: "Regeneracao tecidual guiada", en: ["guided tissue regeneration", "GTR periodontics", "membrane guided bone regeneration"] },
  { pt: "Regeneração tecidual guiada", en: ["guided tissue regeneration", "GTR periodontics", "membrane guided bone regeneration"] },
  { pt: "Cirurgia periodontal", en: ["periodontal surgery", "flap surgery periodontitis", "periodontal surgical treatment"] },
  { pt: "Raspagem e alisamento radicular", en: ["scaling root planing", "non-surgical periodontal therapy", "subgingival debridement"] },
  { pt: "Recessao gengival", en: ["gingival recession", "gingival recession treatment", "recession coverage gingival graft"] },
  { pt: "Enxerto gengival", en: ["gingival graft", "connective tissue graft periodontics", "free gingival graft"] },
  { pt: "Mobilidade dentaria", en: ["tooth mobility periodontitis", "dental mobility periodontal disease", "mobile teeth periodontics"] },
  // ---- ENDODONTIA ----
  { pt: "Tratamento de canal", en: ["root canal treatment", "endodontic treatment", "pulpectomy root canal"] },
  { pt: "Tratamento de canal convencional", en: ["root canal treatment", "conventional endodontic treatment", "pulpectomy root canal"] },
  { pt: "Retratamento endodontico", en: ["endodontic retreatment", "root canal retreatment", "non-surgical retreatment endodontics"] },
  { pt: "Retratamento endodôntico", en: ["endodontic retreatment", "root canal retreatment", "non-surgical retreatment endodontics"] },
  { pt: "Cirurgia apical", en: ["periapical surgery", "apicoectomy", "endodontic microsurgery"] },
  { pt: "Cirurgia perirradicular", en: ["periradicular surgery apicectomy", "periapical surgery", "apicoectomy endodontics"] },
  { pt: "Pulpotomia", en: ["pulpotomy", "vital pulp therapy", "partial pulpotomy"] },
  { pt: "Instrumentacao mecanica", en: ["rotary endodontics", "nickel titanium files endodontics", "mechanical instrumentation root canal"] },
  { pt: "Medicacao intracanal", en: ["intracanal medication endodontics", "calcium hydroxide endodontics", "antimicrobial intracanal dressing"] },
  { pt: "Lesao perirradicular", en: ["periapical lesion", "periradicular lesion treatment", "apical periodontitis"] },
  // ---- DENTISTICA / ESTETICA ----
  { pt: "Clareamento dental", en: ["tooth whitening", "dental bleaching", "teeth whitening clinical"] },
  { pt: "Facetas ceramicas", en: ["ceramic veneers", "porcelain veneers aesthetics", "dental veneers clinical"] },
  { pt: "Facetas de porcelana", en: ["porcelain veneers", "ceramic veneers aesthetics", "dental veneers"] },
  { pt: "Laminados ceramicos", en: ["ceramic laminate veneers", "dental laminates", "porcelain laminate veneers"] },
  { pt: "Resina composta", en: ["composite resin restoration", "direct composite restoration", "composite resin dental"] },
  { pt: "Resinas compostas nanoparticuladas", en: ["nanocomposite resin dental", "nanofilled composite resin", "nanoparticle composite restoration"] },
  { pt: "Carie dentaria", en: ["dental caries", "tooth decay treatment", "caries prevention"] },
  { pt: "Adesivos dentarios", en: ["dental adhesive systems", "dentin bonding agents", "adhesive dentistry"] },
  { pt: "Selantes de fissura", en: ["dental sealants", "pit fissure sealants", "fissure sealant prevention"] },
  { pt: "Sensibilidade dentinaria", en: ["dentin hypersensitivity", "dentinal sensitivity treatment", "tooth sensitivity"] },
  // ---- PROTESE ----
  { pt: "Protese total", en: ["complete denture", "full denture prosthetics", "complete denture rehabilitation"] },
  { pt: "Prótese total convencional", en: ["complete denture", "conventional complete denture", "full denture prosthetics"] },
  { pt: "Protese parcial removivel", en: ["removable partial denture", "partial denture prosthetics", "RPD prosthetics"] },
  { pt: "Prótese parcial removível", en: ["removable partial denture", "partial denture prosthetics", "RPD prosthetics"] },
  { pt: "Coroa ceramica", en: ["all-ceramic crown", "zirconia crown", "porcelain crown dental"] },
  { pt: "Protese sobre implante", en: ["implant supported prosthesis", "implant prosthetics", "implant crown prosthesis"] },
  { pt: "Protese fixa", en: ["fixed partial denture", "dental bridge prosthetics", "fixed prosthesis dentistry"] },
  { pt: "Prótese fixa unitária", en: ["single crown prosthesis", "fixed dental prosthesis", "single unit crown"] },
  { pt: "Prótese fixa de múltiplos elementos", en: ["fixed dental prosthesis", "fixed partial denture", "dental bridge multiple units"] },
  { pt: "Reabilitacao oral", en: ["full mouth rehabilitation", "oral rehabilitation prosthetics", "complete oral reconstruction"] },
  { pt: "Oclusao e ATM", en: ["occlusion temporomandibular joint", "TMJ occlusion treatment", "occlusal rehabilitation"] },
  { pt: "Zirconia", en: ["zirconia dental prosthetics", "zirconia ceramic restorations", "monolithic zirconia crown"] },
  // ---- CIRURGIA ----
  { pt: "Extracao dental", en: ["tooth extraction", "dental extraction technique", "atraumatic tooth extraction"] },
  { pt: "Terceiro molar", en: ["third molar extraction", "wisdom tooth impacted", "mandibular third molar surgery"] },
  { pt: "Cirurgia ortognatica", en: ["orthognathic surgery", "corrective jaw surgery", "Le Fort osteotomy"] },
  { pt: "Fissura labiopalatina", en: ["cleft lip palate surgery", "cleft palate repair", "palatoplasty cleft"] },
  { pt: "Cistos e tumores", en: ["jaw cysts tumors", "odontogenic cysts treatment", "oral tumors surgery"] },
  { pt: "Trauma facial", en: ["facial trauma", "maxillofacial trauma treatment", "facial injury management"] },
  { pt: "Fraturas mandibulares", en: ["mandibular fractures", "mandible fracture treatment", "jaw fracture surgery"] },
  { pt: "Fraturas do terço médio", en: ["midface fractures", "zygoma fracture", "Le Fort fractures"] },
  { pt: "Trauma bucomaxilofacial", en: ["maxillofacial trauma", "facial fracture treatment", "mandible fracture surgery"] },
  // ---- ODONTOPEDIATRIA ----
  { pt: "Carie precoce na infancia", en: ["early childhood caries", "nursing bottle caries", "ECC early childhood caries"] },
  { pt: "Cárie precoce na infância", en: ["early childhood caries", "nursing bottle caries", "ECC early childhood caries"] },
  { pt: "Selantes pediatricos", en: ["dental sealants children", "fissure sealants pediatric", "pit fissure sealant pediatric"] },
  { pt: "Pulpotomia pediatrica", en: ["pulpotomy primary teeth", "pediatric pulpotomy", "vital pulp therapy children"] },
  { pt: "Pulpotomia em molares decíduos", en: ["pulpotomy primary molars", "deciduous molar pulpotomy", "vital pulp therapy primary teeth"] },
  { pt: "Fluorose", en: ["dental fluorosis", "fluorosis treatment", "enamel fluorosis"] },
  { pt: "Traumatismo dental infantil", en: ["dental trauma children", "tooth trauma pediatric", "traumatic dental injuries children"] },
  { pt: "Traumatismo dental em crianças", en: ["dental trauma children", "tooth trauma pediatric", "traumatic dental injuries children"] },
  { pt: "Comportamento infantil na odontologia", en: ["child behavior dentistry", "pediatric dental anxiety", "behavior management children dentistry"] },
  { pt: "Dentição mista", en: ["mixed dentition", "primary permanent teeth transition", "mixed dentition orthodontics"] },
  { pt: "Habitos orais", en: ["oral habits children", "digit sucking habit", "pacifier oral habit"] },
  // ---- HARMONIZACAO OROFACIAL ----
  { pt: "Toxina botulinica", en: ["botulinum toxin dental", "botox orofacial aesthetic", "botulinum toxin facial aesthetics"] },
  { pt: "Preenchimento facial", en: ["facial filler dentistry", "hyaluronic acid filler orofacial", "facial volume restoration"] },
  { pt: "Design do sorriso", en: ["smile design digital", "digital smile design", "aesthetic smile planning"] },
  { pt: "Gengiva gums estetica", en: ["gummy smile treatment", "aesthetic crown lengthening", "gingival contouring aesthetics"] },
  { pt: "Lente de contato dental", en: ["ultra-thin veneers", "contact lens veneer dental", "minimal preparation veneers"] },
  { pt: "Bruxismo", en: ["bruxism treatment", "sleep bruxism management", "tooth grinding bruxism"] },
  { pt: "Bruxismo do sono", en: ["sleep bruxism", "nocturnal bruxism treatment", "sleep bruxism management"] },
  { pt: "Bruxismo em vigília", en: ["awake bruxism", "wakefulness bruxism", "diurnal bruxism treatment"] },
  { pt: "Disfuncao temporomandibular", en: ["temporomandibular disorders", "TMD treatment", "temporomandibular joint dysfunction"] },
  { pt: "Artralgia da ATM", en: ["temporomandibular joint pain", "TMJ arthralgia", "temporomandibular joint disorder pain"] },
  // ---- SAUDE BUCAL / GERAL ----
  { pt: "Saude bucal e doencas sistemicas", en: ["oral health systemic disease", "periodontal systemic connection", "dental health cardiovascular"] },
  { pt: "Odontologia do esporte", en: ["sports dentistry", "dental injuries sports", "mouthguard sports dentistry"] },
  { pt: "Saude bucal do idoso", en: ["geriatric dentistry", "elderly oral health", "gerodontology"] },
  { pt: "Sedacao consciente", en: ["conscious sedation dentistry", "dental sedation", "nitrous oxide dental sedation"] },
  { pt: "Odontologia baseada em evidencias", en: ["evidence based dentistry", "clinical evidence dental treatment", "systematic review dentistry"] },  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- IMPLANTODONTIA EXTRA ----  { pt: "Implantes zigomaticos", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  { pt: "Implante zigomatico", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  // ---- PERIODONTIA EXTRA ----  { pt: "Cirurgia mucogengival", en: ["mucogingival surgery", "periodontal plastic surgery", "root coverage surgery"] },  // ---- DESLOCAMENTO DISCO ATM ----  { pt: "Deslocamento de disco", en: ["temporomandibular disc displacement", "TMJ disc displacement treatment", "articular disc TMJ"] },  { pt: "Deslocamento de disco com reducao", en: ["temporomandibular disc displacement reduction", "TMJ disc displacement", "articular disc reduction"] },  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- IMPLANTODONTIA EXTRA ----  { pt: "Implantes zigomaticos", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  { pt: "Implante zigomatico", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  // ---- PERIODONTIA EXTRA ----  { pt: "Cirurgia mucogengival", en: ["mucogingival surgery", "periodontal plastic surgery", "root coverage surgery"] },  // ---- DESLOCAMENTO DISCO ATM ----  { pt: "Deslocamento de disco", en: ["temporomandibular disc displacement", "TMJ disc displacement treatment", "articular disc TMJ"] },  { pt: "Deslocamento de disco com reducao", en: ["temporomandibular disc displacement reduction", "TMJ disc displacement", "articular disc reduction"] },  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- IMPLANTODONTIA EXTRA ----  { pt: "Implantes zigomaticos", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  { pt: "Implante zigomatico", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  // ---- PERIODONTIA EXTRA ----  { pt: "Cirurgia mucogengival", en: ["mucogingival surgery", "periodontal plastic surgery", "root coverage surgery"] },  // ---- DESLOCAMENTO DISCO ATM ----  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- IMPLANTODONTIA EXTRA ----  { pt: "Implantes zigomaticos", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  { pt: "Implante zigomatico", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  // ---- PERIODONTIA EXTRA ----  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- IMPLANTODONTIA EXTRA ----  { pt: "Implantes zigomaticos", en: ["zygomatic implants", "zygoma implants atrophic maxilla", "zygomatic anchorage implants"] },  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  { pt: "Patologia oral", en: ["oral pathology", "oral mucosal lesions", "oral cancer diagnosis"] },  { pt: "Lesoes cancerigenas", en: ["oral potentially malignant lesions", "oral leukoplakia", "oral cancer risk"] },  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  { pt: "Panoramica e suas limitacoes", en: ["panoramic radiograph limitations", "dental panoramic radiography", "orthopantomogram diagnosis"] },  // ---- PATOLOGIA ORAL ----  // ---- RADIOLOGIA ----  { pt: "CBCT 3D em diagnostico", en: ["cone beam computed tomography CBCT dental", "CBCT 3D dental diagnosis", "CBCT endodontics"] },  { pt: "Radiografia periapical digital", en: ["digital periapical radiography", "periapical radiograph diagnosis", "intraoral digital radiography"] },  // ---- RADIOLOGIA ----
];

// Build lookup map for fast access: normalized PT -> entry
const TEMA_MAP = new Map();
TEMAS_DB.forEach(t => {
  const key = t.pt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  TEMA_MAP.set(key, t);
});

function normalizePt(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Get PubMed search terms for a Portuguese topic
function getPubmedTerms(temaPt) {
  const key = normalizePt(temaPt);
  if (TEMA_MAP.has(key)) {
    return TEMA_MAP.get(key).en;
  }
  // Partial match fallback
  for (const [k, entry] of TEMA_MAP.entries()) {
    if (key.length > 4 && (k.includes(key) || key.includes(k))) {
      console.log("[TRANSLATION] Partial match: '" + temaPt + "' -> '" + entry.pt + "'");
      return entry.en;
    }
  }
  // Last resort: use original term
  console.warn("[TRANSLATION] No translation for: '" + temaPt + "'. Using original.");
  return [temaPt];
}

// ---- HTTP HELPER ----
function request(opts, bodyStr) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let data = "";
      res.on("data", c => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---- FIREBASE ----
async function getUsers(projectId, apiKey) {
  const path = "/v1/projects/" + projectId + "/databases/(default)/documents/cadastros?pageSize=200&key=" + apiKey;
  const res = await request({ hostname: "firestore.googleapis.com", path, method: "GET" }, null);
  if (res.status !== 200) {
    console.error("Firestore list error:", res.body.substring(0, 300));
    return [];
  }
  const json = JSON.parse(res.body);
  if (!json.documents) return [];
  return json.documents.map(doc => {
    const f = doc.fields || {};
    return {
      nome: f.nome?.stringValue || "",
      email: f.email?.stringValue || "",
      especialidade: f.especialidade?.stringValue || "",
      temas: (f.temas?.arrayValue?.values || []).map(v => v.stringValue || "").filter(Boolean),
      ativo: f.ativo?.booleanValue !== false
    };
  }).filter(u => u.email && u.ativo !== false);
}

async function getSentPmids(projectId, apiKey, email) {
  const path = "/v1/projects/" + projectId + "/databases/(default)/documents:runQuery?key=" + apiKey;
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: "artigos_enviados" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "email" },
          op: "EQUAL",
          value: { stringValue: email }
        }
      },
      select: { fields: [{ fieldPath: "pmid" }] },
      limit: 500
    }
  });
  try {
    const res = await request({
      hostname: "firestore.googleapis.com",
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, body);
    if (res.status !== 200) return [];
    const results = JSON.parse(res.body);
    return results
      .filter(r => r.document?.fields?.pmid)
      .map(r => r.document.fields.pmid.stringValue || r.document.fields.pmid.integerValue || "")
      .filter(Boolean);
  } catch (e) {
    console.warn("Could not fetch sent PMIDs:", e.message);
    return [];
  }
}

async function saveSentPmid(projectId, apiKey, email, pmid, tema) {
  const path = "/v1/projects/" + projectId + "/databases/(default)/documents/artigos_enviados?key=" + apiKey;
  const body = JSON.stringify({
    fields: {
      email: { stringValue: email },
      pmid: { stringValue: String(pmid) },
      tema: { stringValue: tema || "" },
      data: { stringValue: new Date().toISOString() }
    }
  });
  try {
    await request({
      hostname: "firestore.googleapis.com",
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, body);
  } catch (e) {
    console.error("[FIREBASE] Error saving PMID:", e.message);
  }
}

// ---- PUBMED SEARCH ----
async function searchPubMedSingleTerm(query, sentPmids) {
  const q = encodeURIComponent(query + "[Title/Abstract] AND hasabstract[text]");
  const path = "/entrez/eutils/esearch.fcgi?db=pubmed&term=" + q + "&retmax=20&sort=relevance&retmode=json";
  try {
    const res = await request({
      hostname: "eutils.ncbi.nlm.nih.gov",
      path,
      method: "GET",
      headers: { "User-Agent": "OdontoFeed/1.0 (artigos@odontofeed.com)" }
    }, null);
    if (res.status !== 200) return null;
    const json = JSON.parse(res.body);
    const ids = json.esearchresult?.idlist || [];
    const available = ids.filter(id => !sentPmids.includes(String(id)));
    return available.length > 0 ? available[0] : null;
  } catch (e) {
    return null;
  }
}

async function searchPubMedWithFallback(temaPt, sentPmids) {
  const terms = getPubmedTerms(temaPt);
  console.log("[PUBMED] Searching '" + temaPt + "' with " + terms.length + " EN term(s)");
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    console.log("[PUBMED] Attempt " + (i + 1) + "/" + terms.length + ": " + term);
    const pmid = await searchPubMedSingleTerm(term, sentPmids);
    if (pmid) {
      console.log("[PUBMED] Found PMID " + pmid + " via: " + term);
      return { pmid, termUsed: term };
    }
    await new Promise(r => setTimeout(r, 350));
  }
  console.warn("[PUBMED] No article found for all terms of '" + temaPt + "'");
  return null;
}

async function fetchArticleDetails(projectId, apiKey, pmid) {
  // esummary for metadata
  const sumPath = "/entrez/eutils/esummary.fcgi?db=pubmed&id=" + pmid + "&retmode=json";
  // efetch for abstract
  const fetchPath = "/entrez/eutils/efetch.fcgi?db=pubmed&id=" + pmid + "&retmode=xml&rettype=abstract";
  try {
    const [sumRes, fetchRes] = await Promise.all([
      request({ hostname: "eutils.ncbi.nlm.nih.gov", path: sumPath, method: "GET", headers: { "User-Agent": "OdontoFeed/1.0 (artigos@odontofeed.com)" } }, null),
      request({ hostname: "eutils.ncbi.nlm.nih.gov", path: fetchPath, method: "GET", headers: { "User-Agent": "OdontoFeed/1.0 (artigos@odontofeed.com)" } }, null)
    ]);
    const json = JSON.parse(sumRes.body);
    const result = json.result?.[pmid];
    if (!result) return null;
    const xml = fetchRes.body;
    const titleMatch = xml.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : result.title || "Artigo sem titulo";
    const abstractMatch = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
    const abstract = abstractMatch ? abstractMatch.map(a => a.replace(/<[^>]+>/g, "").trim()).join(" ") : "";
    return {
      pmid,
      title,
      abstract: abstract.substring(0, 600),
      authors: (result.authors || []).slice(0, 3).map(a => a.name).join(", "),
      journal: result.fulljournalname || result.source || "",
      year: result.pubdate ? result.pubdate.substring(0, 4) : "",
      url: "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/"
    };
  } catch (e) {
    return null;
  }
}

// ---- EMAIL (RESEND) ----
function buildMail(user, article, tema) {
  const pubmedUrl = "https://pubmed.ncbi.nlm.nih.gov/" + article.pmid + "/";
  const firstName = (user.nome || "").split(" ")[0] || "Dentista";
  const summary = article.abstract ? article.abstract.substring(0, 400) + (article.abstract.length > 400 ? "..." : "") : "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
<span style="font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OdontoFeed</span>
<p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Artigo Científico do Dia</p>
</div>
<div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
<p style="color:#64748b;font-size:0.9rem;margin:0 0 20px;">Olá, <strong style="color:#0f172a;">${firstName}</strong>!</p>
<div style="margin-bottom:20px;"><span style="background:#eff6ff;color:#0ea5e9;border:1px solid #bfdbfe;padding:4px 12px;border-radius:20px;font-size:0.78rem;font-weight:600;">${tema}</span></div>
<h1 style="font-size:1.15rem;font-weight:800;color:#0f172a;line-height:1.4;margin:0 0 20px;">${article.title}</h1>
<div style="background:#f8fafc;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:0.82rem;">
<span style="margin-right:16px;">📖 <strong>${article.journal}</strong></span>
<span style="margin-right:16px;">📅 ${article.year}</span>
<span>👥 ${article.authors}</span>
</div>
${summary ? `<div style="border-left:3px solid #0ea5e9;padding-left:18px;margin-bottom:28px;">
<p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0ea5e9;margin:0 0 8px;">Resumo</p>
<p style="color:#334155;font-size:0.9rem;line-height:1.75;margin:0;">${summary}</p>
</div>` : ""}
<a href="${pubmedUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;font-size:0.95rem;">Leia o artigo completo no PubMed →</a>
</div>
<div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center;">
<p style="font-size:0.75rem;color:#94a3b8;margin:0;">OdontoFeed · Atualizações científicas para dentistas<br>
<a href="https://odontofeed.com/unsubscribe" style="color:#94a3b8;">Cancelar inscrição</a></p>
</div>
</div>
</body>
</html>`;
}

async function sendEmail(resendKey, toEmail, article, user, tema) {
  const html = buildMail(user, article, tema);
  const subject = "Novo artigo: " + article.title.substring(0, 80) + (article.title.length > 80 ? "..." : "");
  const body = JSON.stringify({
    from: "OdontoFeed <artigos@odontofeed.com>",
    to: [toEmail],
    subject,
    html
  });
  return request({
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      "Authorization": "Bearer " + resendKey,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body)
    }
  }, body);
}

// ---- MAIN HANDLER ----
exports.handler = async function(event) {
  console.log("OdontoFeed daily dispatch started:", new Date().toISOString());

  const projectId = process.env.FIREBASE_PROJECT_ID || "orthoradar";
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!apiKey || !resendKey) {
    console.error("Missing env vars: FIREBASE_API_KEY or RESEND_API_KEY");
    return { statusCode: 500, body: "Missing env vars" };
  }

  const users = await getUsers(projectId, apiKey);
  console.log("Users found:", users.length);

  let sent = 0, errors = 0, skipped = 0;

  for (const user of users) {
    try {
      const temas = (Array.isArray(user.temas) ? user.temas : []).filter(Boolean);

      if (temas.length === 0) {
        console.log("[SKIP] No themes for", user.email);
        skipped++;
        continue;
      }

      // Pick a random theme
      const tema = temas[Math.floor(Math.random() * temas.length)];
      console.log("[USER]", user.email, "| Theme:", tema);

      const sentPmids = await getSentPmids(projectId, apiKey, user.email);
      console.log("[USER]", user.email, "| Sent PMIDs so far:", sentPmids.length);

      // Try to find article for chosen theme, then try alternates
      let searchResult = await searchPubMedWithFallback(tema, sentPmids);
      let usedTema = tema;

      if (!searchResult) {
        console.warn("[FALLBACK] Trying alternate themes for", user.email);
        for (const altTema of temas.filter(t => t !== tema)) {
          searchResult = await searchPubMedWithFallback(altTema, sentPmids);
          if (searchResult) { usedTema = altTema; break; }
          await new Promise(r => setTimeout(r, 350));
        }
      }

      if (!searchResult) {
        console.warn("[SKIP]", user.email, "- no article found for any theme. Skipping gracefully.");
        skipped++;
        continue;
      }

      const article = await fetchArticleDetails(projectId, apiKey, searchResult.pmid);
      if (!article) {
        console.warn("[SKIP] Could not fetch article details for PMID:", searchResult.pmid);
        skipped++;
        continue;
      }

      console.log("[ARTICLE] Title:", article.title.substring(0, 80));
      console.log("[ARTICLE] EN term used:", searchResult.termUsed);

      const emailResult = await sendEmail(resendKey, user.email, article, user, usedTema);
      if (emailResult.status >= 200 && emailResult.status < 300) {
        await saveSentPmid(projectId, apiKey, user.email, searchResult.pmid, usedTema);
        console.log("[OK] Email sent to", user.email, "| PMID:", searchResult.pmid, "| Term:", searchResult.termUsed);
        sent++;
      } else {
        console.error("[ERROR] Email failed for", user.email, "| Status:", emailResult.status, "| Body:", emailResult.body.substring(0, 200));
        errors++;
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error("[ERROR] Processing", user.email, ":", err.message);
      errors++;
    }
  }

  const result = { sent, errors, skipped, total: users.length, timestamp: new Date().toISOString() };
  console.log("Daily dispatch complete:", result);
  return { statusCode: 200, body: JSON.stringify(result) };
};

// Direct execution support (GitHub Actions)
if (require.main === module) {
  exports.handler({}).then(r => {
    console.log("Done:", r.statusCode, r.body);
    process.exit(r.statusCode === 200 ? 0 : 1);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
  }
