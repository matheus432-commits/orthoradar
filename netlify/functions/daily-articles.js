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
  { pt: "Aparelho fixo", en: ["fixed orthodontic appliance", "fixed braces orthodontics", "brackets fixed appliance"] },
  { pt: "Retencao ortodontica", en: ["orthodontic retention", "orthodontic retainer", "relapse orthodontics retention"] },
  { pt: "Mordida aberta", en: ["open bite malocclusion", "anterior open bite", "skeletal open bite orthodontics"] },
  { pt: "Mordida cruzada", en: ["crossbite orthodontics", "posterior crossbite", "anterior crossbite malocclusion"] },
  { pt: "Classe II ortodontica", en: ["Class II malocclusion orthodontics", "skeletal Class II treatment", "mandibular retrognathism orthodontics"] },
  { pt: "Classe III ortodontica", en: ["Class III malocclusion orthodontics", "skeletal Class III treatment", "mandibular prognathism orthodontics"] },
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
  { pt: "Gengivite", en: ["gingivitis", "gingival inflammation", "gingivitis treatment"] },
  { pt: "Regeneracao tecidual guiada", en: ["guided tissue regeneration", "GTR periodontics", "membrane guided bone regeneration"] },
  { pt: "Cirurgia periodontal", en: ["periodontal surgery", "flap surgery periodontitis", "periodontal surgical treatment"] },
  { pt: "Raspagem e alisamento radicular", en: ["scaling root planing", "non-surgical periodontal therapy", "subgingival debridement"] },
  { pt: "Recessao gengival", en: ["gingival recession", "gingival recession treatment", "recession coverage gingival graft"] },
  { pt: "Enxerto gengival", en: ["gingival graft", "connective tissue graft periodontics", "free gingival graft"] },
  { pt: "Mobilidade dentaria", en: ["tooth mobility periodontitis", "dental mobility periodontal disease", "mobile teeth periodontics"] },
  { pt: "Periodontite agressiva", en: ["aggressive periodontitis", "generalized aggressive periodontitis treatment", "early onset periodontitis"] },
  // ---- ENDODONTIA ----
  { pt: "Tratamento de canal", en: ["root canal treatment", "endodontic treatment", "pulpectomy root canal"] },
  { pt: "Retratamento endodontico", en: ["endodontic retreatment", "root canal retreatment", "non-surgical retreatment endodontics"] },
  { pt: "Cirurgia apical", en: ["periapical surgery", "apicoectomy", "endodontic microsurgery"] },
  { pt: "Pulpotomia", en: ["pulpotomy", "vital pulp therapy", "partial pulpotomy"] },
  { pt: "Biopulpectomia", en: ["pulpectomy endodontics", "total pulp extirpation", "root canal pulpectomy"] },
  { pt: "Instrumentacao mecanica", en: ["rotary endodontics", "nickel titanium files endodontics", "mechanical instrumentation root canal"] },
  { pt: "Medicacao intracanal", en: ["intracanal medication endodontics", "calcium hydroxide endodontics", "antimicrobial intracanal dressing"] },
  { pt: "Diagnostico endodontico", en: ["endodontic diagnosis", "pulp vitality testing", "periapical diagnosis"] },
  { pt: "Lesao perirradicular", en: ["periapical lesion", "periradicular lesion treatment", "apical periodontitis"] },
  // ---- DENTISTICA / ESTETICA ----
  { pt: "Clareamento dental", en: ["tooth whitening", "dental bleaching", "teeth whitening clinical"], },
  { pt: "Facetas ceramicas", en: ["ceramic veneers", "porcelain veneers aesthetics", "dental veneers clinical"] },
  { pt: "Resina composta", en: ["composite resin restoration", "direct composite restoration", "composite resin dental"] },
  { pt: "Carie dentaria", en: ["dental caries", "tooth decay treatment", "caries prevention"] },
  { pt: "Adesivos dentarios", en: ["dental adhesive systems", "dentin bonding agents", "adhesive dentistry"] },
  { pt: "Restauracao direta", en: ["direct dental restoration", "composite restoration anterior", "direct composite placement"] },
  { pt: "Selantes de fissura", en: ["dental sealants", "pit fissure sealants", "fissure sealant prevention"] },
  { pt: "Sensibilidade dentinaria", en: ["dentin hypersensitivity", "dentinal sensitivity treatment", "tooth sensitivity"] },
  { pt: "Infiltrante resinoso", en: ["resin infiltration caries", "icon caries infiltration", "proximal caries infiltrant"] },
  // ---- PROTESE ----
  { pt: "Protese total", en: ["complete denture", "full denture prosthetics", "complete denture rehabilitation"] },
  { pt: "Protese parcial removivel", en: ["removable partial denture", "partial denture prosthetics", "RPD prosthetics"] },
  { pt: "Coroa ceramica", en: ["all-ceramic crown", "zirconia crown", "porcelain crown dental"] },
  { pt: "Protese sobre implante", en: ["implant supported prosthesis", "implant prosthetics", "implant crown prosthesis"] },
  { pt: "Overdenture", en: ["overdenture implant", "implant retained overdenture", "mandibular overdenture"] },
  { pt: "Reabilitacao oral", en: ["full mouth rehabilitation", "oral rehabilitation prosthetics", "complete oral reconstruction"] },
  { pt: "Protese fixa", en: ["fixed partial denture", "dental bridge prosthetics", "fixed prosthesis dentistry"] },
  { pt: "Oclusao e ATM", en: ["occlusion temporomandibular joint", "TMJ occlusion treatment", "occlusal rehabilitation"] },
  { pt: "Zirconia", en: ["zirconia dental prosthetics", "zirconia ceramic restorations", "monolithic zirconia crown"] },
  // ---- CIRURGIA ----
  { pt: "Extracao dental", en: ["tooth extraction", "dental extraction technique", "atraumatic tooth extraction"] },
  { pt: "Terceiro molar", en: ["third molar extraction", "wisdom tooth impacted", "mandibular third molar surgery"] },
  { pt: "Cirurgia ortognatica", en: ["orthognathic surgery", "corrective jaw surgery", "Le Fort osteotomy"] },
  { pt: "Fissura labiopalatina", en: ["cleft lip palate surgery", "cleft palate repair", "palatoplasty cleft"] },
  { pt: "Cistos e tumores", en: ["jaw cysts tumors", "odontogenic cysts treatment", "oral tumors surgery"] },
  { pt: "Implante cirurgia", en: ["implant surgery technique", "surgical implant placement", "dental implant surgery protocol"] },
  { pt: "Distratores osseos", en: ["bone distraction osteogenesis", "distraction osteogenesis jaw", "alveolar distraction"] },
  { pt: "Trauma bucomaxilofacial", en: ["maxillofacial trauma", "facial fracture treatment", "mandible fracture surgery"] },
  // ---- ODONTOPEDIATRIA ----
  { pt: "Carie precoce na infancia", en: ["early childhood caries", "nursing bottle caries", "ECC early childhood caries"] },
  { pt: "Selantes pediatricos", en: ["dental sealants children", "fissure sealants pediatric", "pit fissure sealant pediatric"] },
  { pt: "Pulpotomia pediatrica", en: ["pulpotomy primary teeth", "pediatric pulpotomy", "vital pulp therapy children"] },
  { pt: "Fluorose", en: ["dental fluorosis", "fluorosis treatment", "enamel fluorosis"] },
  { pt: "Traumatismo dental infantil", en: ["dental trauma children", "tooth trauma pediatric", "traumatic dental injuries children"] },
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
  { pt: "Disfuncao temporomandibular", en: ["temporomandibular disorders", "TMD treatment", "temporomandibular joint dysfunction"] },
  // ---- SAUDE BUCAL / GERAL ----
  { pt: "Saude bucal e doencas sistemicas", en: ["oral health systemic disease", "periodontal systemic connection", "dental health cardiovascular"] },
  { pt: "Odontologia do esporte", en: ["sports dentistry", "dental injuries sports", "mouthguard sports dentistry"] },
  { pt: "Saude bucal do idoso", en: ["geriatric dentistry", "elderly oral health", "gerodontology"] },
  { pt: "Sedacao consciente", en: ["conscious sedation dentistry", "dental sedation", "nitrous oxide dental sedation"] },
  { pt: "Odontologia baseada em evidencias", en: ["evidence based dentistry", "clinical evidence dental treatment", "systematic review dentistry"] },
];

// Build lookup map for fast access: normalized PT -> entry
const TEMA_MAP = new Map();
TEMAS_DB.forEach(t => {
  const key = t.pt.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  TEMA_MAP.set(key, t);
});

function normalizePt(str) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Get PubMed search terms for a Portuguese topic
// Returns array of English search terms (with fallbacks)
function getPubmedTerms(temaPt) {
  const key = normalizePt(temaPt);
  if (TEMA_MAP.has(key)) {
    return TEMA_MAP.get(key).en;
  }
  // Partial match fallback
  for (const [k, entry] of TEMA_MAP.entries()) {
    if (k.includes(key) || key.includes(k)) {
      console.log("[TRANSLATION] Partial match for '" + temaPt + "' -> '" + entry.pt + "'");
      return entry.en;
    }
  }
  // Last resort: use original term as-is (may fail on PubMed)
  console.warn("[TRANSLATION] No translation found for: '" + temaPt + "'. Using original term.");
  return [temaPt];
}

// ---- FIREBASE ----
function firestoreRequest(projectId, apiKey, path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "firestore.googleapis.com",
      path: "/v1/projects/" + projectId + "/databases/(default)/documents/" + path + "?key=" + apiKey,
      method: method || "GET",
      headers: { "Content-Type": "application/json" }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("JSON parse error: " + data.substring(0, 200))); }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function parseFirestoreValue(val) {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return parseInt(val.integerValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.arrayValue) return (val.arrayValue.values || []).map(parseFirestoreValue);
  if (val.mapValue) {
    const obj = {};
    Object.entries(val.mapValue.fields || {}).forEach(([k, v]) => (obj[k] = parseFirestoreValue(v)));
    return obj;
  }
  return null;
}

async function getUsers(projectId, apiKey) {
  const data = await firestoreRequest(projectId, apiKey, "users");
  if (!data.documents) return [];
  return data.documents.map(doc => {
    const fields = doc.fields || {};
    return {
      email: parseFirestoreValue(fields.email),
      temas: parseFirestoreValue(fields.temas) || [],
      name: parseFirestoreValue(fields.name) || "",
      docId: doc.name.split("/").pop()
    };
  }).filter(u => u.email);
}

async function getSentPmids(projectId, apiKey, email) {
  try {
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    const data = await firestoreRequest(projectId, apiKey, "sent_articles/" + safeEmail);
    if (data.error) return [];
    const fields = data.fields || {};
    return parseFirestoreValue(fields.pmids) || [];
  } catch (e) {
    return [];
  }
}

async function saveSentPmid(projectId, apiKey, email, pmid) {
  try {
    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    const existing = await getSentPmids(projectId, apiKey, email);
    const updated = [...new Set([...existing, String(pmid)])];
    await firestoreRequest(projectId, apiKey, "sent_articles/" + safeEmail + "?updateMask.fieldPaths=pmids", "PATCH", {
      fields: { pmids: { arrayValue: { values: updated.map(id => ({ stringValue: id })) } } }
    });
  } catch (e) {
    console.error("[FIREBASE] Error saving PMID:", e.message);
  }
}

// ---- PUBMED SEARCH ----
// Search PubMed with a single English query term
// Returns first article not in sentPmids, or null
function searchPubMedSingleTerm(query, sentPmids) {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(query + "[Title/Abstract] AND hasabstract[text]");
    const options = {
      hostname: "eutils.ncbi.nlm.nih.gov",
      path: "/entrez/eutils/esearch.fcgi?db=pubmed&term=" + q + "&retmax=20&sort=relevance&retmode=json",
      method: "GET",
      headers: { "User-Agent": "OdontoFeed/1.0 (artigos@odontofeed.com)" }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const ids = (json.esearchresult && json.esearchresult.idlist) ? json.esearchresult.idlist : [];
          const available = ids.filter(id => !sentPmids.includes(String(id)));
          resolve(available.length > 0 ? available[0] : null);
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// Search with fallback: tries each EN term until finding a result
async function searchPubMedWithFallback(temaPt, sentPmids) {
  const terms = getPubmedTerms(temaPt);
  console.log("[PUBMED] Searching for '" + temaPt + "' with " + terms.length + " term(s):", terms.join("; "));
  
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    console.log("[PUBMED] Attempt " + (i+1) + "/" + terms.length + ": '" + term + "'");
    const pmid = await searchPubMedSingleTerm(term, sentPmids);
    if (pmid) {
      console.log("[PUBMED] Found PMID " + pmid + " using term: '" + term + "'");
      return { pmid, termUsed: term };
    }
    console.log("[PUBMED] No result for term: '" + term + "'");
    await new Promise(r => setTimeout(r, 400));
  }
  
  console.warn("[PUBMED] All " + terms.length + " terms exhausted for '" + temaPt + "' - no article found");
  return null;
}

function fetchArticleDetails(pmid) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "eutils.ncbi.nlm.nih.gov",
      path: "/entrez/eutils/esummary.fcgi?db=pubmed&id=" + pmid + "&retmode=json",
      method: "GET",
      headers: { "User-Agent": "OdontoFeed/1.0 (artigos@odontofeed.com)" }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const result = json.result && json.result[pmid];
          if (!result) return resolve(null);
          resolve({
            pmid,
            title: result.title || "Untitled",
            authors: (result.authors || []).slice(0, 3).map(a => a.name).join(", "),
            journal: result.fulljournalname || result.source || "",
            year: result.pubdate ? result.pubdate.substring(0, 4) : "",
            url: "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/"
          });
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.end();
  });
}

// ---- EMAIL (RESEND) ----
function sendEmail(resendKey, toEmail, article, temaPt) {
  return new Promise((resolve, reject) => {
    const authorsText = article.authors ? "Autores: " + article.authors + "\n" : "";
    const journalText = article.journal ? "Periódico: " + article.journal + (article.year ? " (" + article.year + ")" : "") + "\n" : "";
    const htmlBody = [
      "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto;'>",
      "<div style='background:#2d6a4f;padding:20px;border-radius:8px 8px 0 0;'>",
      "<h2 style='color:#fff;margin:0;'>OdontoFeed</h2>",
      "<p style='color:#d8f3dc;margin:4px 0 0;'>Artigo científico do dia</p>",
      "</div>",
      "<div style='padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;'>",
      "<p style='color:#555;'>Tema: <strong>" + temaPt + "</strong></p>",
      "<h3 style='color:#1b4332;'>" + article.title + "</h3>",
      article.authors ? "<p style='color:#666;font-size:14px;'>" + article.authors + "</p>" : "",
      article.journal ? "<p style='color:#888;font-size:13px;'><em>" + article.journal + (article.year ? ", " + article.year : "") + "</em></p>" : "",
      "<a href='" + article.url + "' style='display:inline-block;margin-top:16px;padding:12px 24px;background:#2d6a4f;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;'>Ler no PubMed</a>",
      "<hr style='margin:24px 0;border:none;border-top:1px solid #eee;'>",
      "<p style='font-size:12px;color:#aaa;'>OdontoFeed - Atualizações científicas para dentistas.<br>",
      "<a href='https://odontofeed.com/unsubscribe' style='color:#aaa;'>Cancelar inscrição</a></p>",
      "</div></div>"
    ].join("");

    const body = JSON.stringify({
      from: "OdontoFeed <artigos@odontofeed.com>",
      to: [toEmail],
      subject: "Novo artigo: " + article.title.substring(0, 80) + (article.title.length > 80 ? "..." : ""),
      html: htmlBody
    });

    const options = {
      hostname: "api.resend.com",
      path: "/emails",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + resendKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
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

      // Get already-sent PMIDs to avoid repeats
      const sentPmids = await getSentPmids(projectId, apiKey, user.email);
      console.log("[USER]", user.email, "| Sent PMIDs so far:", sentPmids.length);

      // Search PubMed with EN terms + fallback
      const searchResult = await searchPubMedWithFallback(tema, sentPmids);

      if (!searchResult) {
        console.warn("[SKIP] No article found for theme '" + tema + "' (all synonyms tried) for", user.email);
        // Try a different random theme if available
        let found = false;
        for (const altTema of temas.filter(t => t !== tema)) {
          console.log("[RETRY] Trying alternate theme '" + altTema + "' for", user.email);
          const altResult = await searchPubMedWithFallback(altTema, sentPmids);
          if (altResult) {
            const article = await fetchArticleDetails(altResult.pmid);
            if (article) {
              const emailResult = await sendEmail(resendKey, user.email, article, altTema);
              if (emailResult.status >= 200 && emailResult.status < 300) {
                await saveSentPmid(projectId, apiKey, user.email, altResult.pmid);
                console.log("[OK] Email sent to", user.email, "| Alt theme:", altTema, "| PMID:", altResult.pmid);
                sent++;
                found = true;
                break;
              }
            }
          }
          await new Promise(r => setTimeout(r, 400));
        }
        if (!found) {
          console.warn("[SKIP] Skipping", user.email, "- no valid article found for any theme");
          skipped++;
        }
        continue;
      }

      // Fetch article details
      const article = await fetchArticleDetails(searchResult.pmid);
      if (!article) {
        console.warn("[SKIP] Could not fetch details for PMID:", searchResult.pmid);
        skipped++;
        continue;
      }

      console.log("[ARTICLE] Title:", article.title.substring(0, 80));

      // Send email
      const emailResult = await sendEmail(resendKey, user.email, article, tema);
      if (emailResult.status >= 200 && emailResult.status < 300) {
        await saveSentPmid(projectId, apiKey, user.email, searchResult.pmid);
        console.log("[OK] Email sent to", user.email, "| PMID:", searchResult.pmid, "| Term used:", searchResult.termUsed);
        sent++;
      } else {
        console.error("[ERROR] Email failed for", user.email, "| Status:", emailResult.status, "| Body:", emailResult.body.substring(0, 200));
        errors++;
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error("[ERROR] Processing user", user.email, ":", err.message);
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
