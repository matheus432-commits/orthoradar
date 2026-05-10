const https = require("https");

// PT theme name -> array of English PubMed search terms (tried in order as fallback)
const TEMA_MAP = {
  // ===== ORTODONTIA =====
  "Alinhadores invisíveis": ["clear aligners orthodontics", "invisible aligners treatment", "aligner orthodontic therapy"],
  "Biomecânica ortodôntica": ["orthodontic biomechanics", "orthodontic force tooth movement", "biomechanics fixed appliance"],
  "Cefalometria": ["cephalometric analysis orthodontics", "cephalometry craniofacial", "lateral cephalogram orthodontics"],
  "Mini-implantes / TADs": ["temporary anchorage devices orthodontics", "mini-implant orthodontic anchorage", "skeletal anchorage TADs"],
  "Mini-implantes/TADs": ["temporary anchorage devices orthodontics", "mini-implant orthodontic anchorage", "skeletal anchorage TADs"],
  "Expansão maxilar": ["rapid maxillary expansion", "maxillary expansion orthodontics", "palatal expansion appliance"],
  "Cirurgia ortognática": ["orthognathic surgery", "jaw surgery malocclusion", "bimaxillary osteotomy"],
  "Ortodontia e ATM": ["temporomandibular disorder orthodontics", "orthodontic treatment TMJ", "malocclusion TMD"],
  "Ancoragem esquelética": ["skeletal anchorage orthodontics", "orthodontic bone anchorage", "temporary anchorage devices"],
  "Contenção e recidiva": ["orthodontic retention relapse", "retainer post-treatment", "orthodontic stability retention"],
  "Ortodontia interceptiva": ["interceptive orthodontics", "early orthodontic treatment children", "preventive orthodontics"],
  "Aparelho fixo estético": ["aesthetic orthodontic bracket", "ceramic bracket orthodontics", "cosmetic fixed appliance"],
  "Extração em ortodontia": ["extraction orthodontics", "premolar extraction orthodontics", "tooth extraction orthodontic treatment"],
  "Ortodontia lingual": ["lingual orthodontics", "lingual bracket system", "lingual braces treatment"],
  "Self-ligating": ["self-ligating bracket", "passive self-ligating orthodontics", "self-ligating appliance"],
  "Torque e angulação": ["torque angulation orthodontics", "bracket prescription torque", "root torque mechanics"],
  "Crescimento e desenvolvimento facial": ["craniofacial growth development", "facial growth orthodontics", "dentofacial development children"],
  "Ortodontia em adultos": ["adult orthodontics treatment", "orthodontic therapy adults", "malocclusion treatment adult patients"],
  "Respiração oral e má-oclusão": ["mouth breathing malocclusion", "oral breathing dentofacial effects", "nasal breathing orthodontics"],
  "Ortodontia e sono/apneia": ["obstructive sleep apnea orthodontics", "mandibular advancement orthodontic appliance", "sleep disordered breathing orthodontics"],
  "Tratamento de Classe II": ["Class II malocclusion treatment", "Angle Class II orthodontics", "mandibular retrognathism treatment"],
  "Tratamento de Classe III": ["Class III malocclusion treatment", "skeletal Class III orthopedics", "prognathism orthodontic treatment"],
  "Mordida aberta": ["anterior open bite treatment", "open bite orthodontics", "vertical malocclusion open bite"],
  "Mordida cruzada posterior": ["posterior crossbite correction", "unilateral crossbite treatment", "transverse maxillary deficiency"],
  "Sobremordida profunda": ["deep overbite correction orthodontics", "deep bite treatment", "overbite intrusion mechanics"],
  "Inteligência artificial em ortodontia": ["artificial intelligence orthodontics", "machine learning cephalometric analysis", "deep learning dental diagnosis orthodontics"],

  // ===== IMPLANTODONTIA =====
  "Osseointegração": ["osseointegration dental implant", "implant bone integration", "bone implant interface biology"],
  "Carga imediata": ["immediate loading dental implants", "immediate implant provisionalization", "same-day implant loading"],
  "Enxertos ósseos autógenos": ["autogenous bone graft implant", "autologous bone graft dental", "iliac crest bone graft implant"],
  "Enxertos com biomateriais": ["bone substitute implant", "xenograft dental augmentation", "synthetic bone substitute implant"],
  "Implantes zigomáticos": ["zygomatic implants atrophic maxilla", "zygoma implants rehabilitation", "pterygoid zygomatic implant"],
  "Prótese sobre implante": ["implant-supported prosthesis", "implant-retained restoration", "prosthetic implant rehabilitation"],
  "Peri-implantite": ["peri-implantitis treatment", "peri-implant disease management", "periimplantitis therapy"],
  "Planejamento digital 3D": ["digital implant planning 3D CBCT", "computer-guided implant surgery", "virtual implant planning"],
  "All-on-4 e All-on-X": ["All-on-4 dental implant technique", "full arch implant rehabilitation", "tilted implants edentulous"],
  "Implantes em maxila posterior": ["posterior maxillary implants", "sinus floor elevation implant", "maxillary sinus implant"],
  "Implantes em mandíbula posterior": ["posterior mandibular implants", "mandibular implant placement", "posterior mandible implant"],
  "Elevação de seio maxilar": ["sinus floor elevation implant", "maxillary sinus lift augmentation", "sinus augmentation dental implant"],
  "Implantes estreitos (mini-implantes)": ["narrow diameter implants", "mini implants prosthetic use", "small diameter dental implants"],
  "Implantes curtos": ["short dental implants", "short implants posterior region", "reduced height implants"],
  "Tecido mole peri-implantar": ["peri-implant soft tissue management", "mucosal tissue around implant", "keratinized mucosa implant"],
  "Carga diferida": ["delayed loading dental implants", "conventional implant loading protocol", "two-stage implant procedure"],
  "Reabilitação com implantes unitários": ["single tooth implant restoration", "single implant crown", "single unit implant"],
  "Implantes em pacientes sistêmicos": ["dental implants systemic disease", "implants diabetes patients", "medically compromised dental implants"],
  "Complicações em implantes": ["dental implant complications", "implant failure risk factors", "peri-implant biological complications"],
  "Sobredentadura": ["implant overdenture", "implant-retained complete denture", "mandibular overdenture implants"],
  "Membranas e ROG": ["guided bone regeneration membrane", "barrier membrane GBR", "collagen membrane bone augmentation"],
  "Biofilme peri-implantar": ["peri-implant biofilm bacteria", "implant surface bacterial biofilm", "microbial biofilm implant"],
  "Impressão digital em implantes": ["digital impression implants intraoral scanner", "digital workflow implants", "intraoral scan implant restoration"],
  "Implantes imediatos pós-extração": ["immediate implant post-extraction", "fresh socket immediate implant placement", "extraction socket implant"],
  "Implantes em adolescentes": ["dental implants adolescents", "implants growing patients", "young patients dental implants"],

  // ===== PERIODONTIA =====
  "Doença periodontal crônica": ["chronic periodontitis treatment", "generalized chronic periodontitis", "periodontal disease management"],
  "Periodontite agressiva": ["aggressive periodontitis", "generalized aggressive periodontitis", "periodontal disease young adults"],
  "Gengivite": ["gingivitis treatment", "plaque-induced gingivitis", "gingival inflammation management"],
  "Regeneração tecidual guiada": ["guided tissue regeneration periodontal", "GTR periodontal regeneration", "membrane guided tissue regeneration"],
  "Cirurgia mucogengival": ["mucogingival surgery gingival recession", "coronally advanced flap", "root coverage surgery"],
  "Periodontia e diabetes": ["periodontal disease diabetes mellitus", "periodontitis glycemic control", "diabetic periodontitis treatment"],
  "Periodontia e doenças cardiovasculares": ["periodontal disease cardiovascular risk", "periodontitis heart disease", "periodontal systemic cardiovascular"],
  "Lasers em periodontia": ["laser periodontal treatment", "Er:YAG laser periodontitis", "photodynamic therapy periodontal"],
  "Manutenção periodontal": ["periodontal maintenance supportive therapy", "supportive periodontal treatment recall", "periodontal recall therapy"],
  "Raspagem e alisamento radicular": ["scaling root planing periodontal", "nonsurgical periodontal debridement", "subgingival scaling"],
  "Cirurgia ressectiva": ["resective periodontal surgery", "osseous resection periodontitis", "periodontal osseous surgery"],
  "Cirurgia regenerativa": ["regenerative periodontal surgery", "periodontal bone regeneration", "enamel matrix derivative periodontal"],
  "Enxerto gengival livre": ["free gingival graft", "gingival autograft keratinized", "free gingival graft recession"],
  "Retalho de reposicionamento": ["coronally advanced flap gingival", "periodontal flap repositioning", "pedicle flap root coverage"],
  "Tratamento de furca": ["furcation involvement treatment periodontal", "furcation defect management", "molar furcation therapy"],
  "Abscesso periodontal": ["periodontal abscess treatment", "acute periodontal abscess management", "periodontal abscess drainage"],
  "Periodontia e tabagismo": ["smoking periodontal disease", "tobacco use periodontitis", "smokers periodontal therapy"],
  "Microbioma periodontal": ["periodontal microbiome", "subgingival microbiota periodontitis", "oral microbiome periodontal disease"],
  "Periodontia e gestação": ["periodontal disease pregnancy", "pregnancy gingivitis", "prenatal periodontal treatment"],
  "Periodontia e osteoporose": ["osteoporosis periodontal disease", "bone density periodontal", "osteoporosis alveolar bone"],
  "Medicação de suporte periodontal": ["systemic antibiotics periodontitis", "antimicrobial adjunct periodontal", "doxycycline periodontal adjunctive"],
  "Terapia fotodinâmica": ["photodynamic therapy periodontitis", "antimicrobial photodynamic dental", "photosensitizer periodontal bacteria"],
  "Ozônio em periodontia": ["ozone therapy periodontal disease", "ozone periodontal treatment", "ozonated oil periodontal"],
  "Periodontia estética": ["aesthetic periodontal surgery", "gingival aesthetics treatment", "pink aesthetics periodontal"],
  "Defeitos ósseos verticais": ["vertical bone defect periodontal", "intrabony defect treatment regeneration", "angular bone loss periodontal"],

  // ===== DENTÍSTICA =====
  "Resinas compostas nanoparticuladas": ["nanocomposite resin dental", "nanofiller composite restoration", "nanoparticle composite material dental"],
  "Clareamento dental": ["tooth whitening bleaching", "carbamide peroxide dental bleaching", "tooth bleaching clinical effectiveness"],
  "Facetas de porcelana": ["porcelain veneers aesthetic", "ceramic veneer preparation", "feldspathic porcelain veneer"],
  "Laminados cerâmicos": ["ceramic laminate veneer", "minimal invasive ceramic restoration", "thin veneer ceramic tooth"],
  "Adesão dental": ["dental adhesive bonding system", "dentin bonding agent", "enamel dentin adhesion"],
  "Estética digital (DSD)": ["digital smile design", "smile design digital workflow", "DSD dental aesthetics planning"],
  "Restaurações indiretas em cerâmica": ["indirect ceramic restoration", "ceramic inlay onlay indirect", "all-ceramic dental restoration"],
  "Inlays e onlays": ["ceramic inlay onlay", "partial indirect restoration posterior", "composite inlay restoration"],
  "Cárie e mínima intervenção": ["minimally invasive dentistry caries", "minimal intervention caries management", "conservative caries treatment"],
  "Fluorose e tratamento": ["dental fluorosis treatment", "enamel fluorosis aesthetics", "fluorosis microabrasion bleaching"],
  "Erosão dental": ["dental erosion acid wear", "tooth erosion treatment", "erosive tooth wear management"],
  "Sensibilidade dentinária": ["dentin hypersensitivity treatment", "dentinal sensitivity desensitizing", "tooth sensitivity management"],
  "Bruxismo e dentística": ["bruxism restorative dentistry", "parafunctional bruxism restoration failure", "bruxism ceramic restoration"],
  "Mock-up digital": ["digital mock-up dentistry", "dental wax-up mock-up", "diagnostic mock-up aesthetic planning"],
  "Pigmentações e manchamentos": ["tooth staining discoloration treatment", "intrinsic extrinsic tooth discoloration", "dental pigmentation management"],
  "Restaurações em dentes anteriores": ["anterior composite restoration aesthetic", "direct anterior composite", "anterior tooth composite restoration"],
  "Sistemas cerâmicos (zircônia, dissilicato)": ["lithium disilicate ceramic crown", "zirconia ceramic restoration", "glass ceramic dental crown"],
  "Fotopolimerização e luz LED": ["LED light curing composite resin", "photo-polymerization dental composite", "curing light effectiveness composite"],
  "Cor em dentística": ["tooth shade selection composite", "dental color matching", "VITA shade dental"],
  "Tratamento de cavidades classe IV": ["Class IV composite restoration", "incisal angle composite", "anterior Class IV restoration"],
  "Restaurações cervicais": ["cervical composite restoration Class V", "Class V abfraction restoration", "cervical erosion restoration"],
  "Dentística minimamente invasiva": ["minimally invasive dentistry conservation", "conservative tooth preparation", "micro-invasive approach caries"],
  "Materiais provisórios estéticos": ["provisional restoration aesthetics", "temporary crown material", "interim dental restoration"],
  "Técnica incremental em compósito": ["incremental composite layering technique", "composite resin stratification", "layering composite posterior"],
  "Polimento e acabamento": ["composite finishing polishing technique", "resin surface polishing", "surface finishing composite restoration"],

  // ===== BUCOMAXILOFACIAL =====
  "Trauma facial": ["facial trauma maxillofacial surgery", "maxillofacial injury treatment", "facial bone fracture management"],
  "Fraturas mandibulares": ["mandibular fracture treatment ORIF", "jaw fracture fixation", "mandible fracture surgery"],
  "Fraturas do terço médio": ["midface fracture treatment", "zygomatic fracture repair", "Le Fort fracture classification"],
  "Patologia oral benigna": ["oral benign pathology diagnosis", "benign oral lesion treatment", "oral soft tissue benign"],
  "Cistos odontogênicos": ["odontogenic cyst treatment surgery", "dentigerous cyst removal", "odontogenic keratocyst management"],
  "Tumores benignos dos maxilares": ["jaw benign tumor treatment", "ameloblastoma surgery", "odontogenic tumor maxillofacial"],
  "Carcinoma espinocelular oral": ["oral squamous cell carcinoma treatment", "oral cancer surgery", "OSCC prognosis management"],
  "Reconstrução mandibular": ["mandibular reconstruction fibula flap", "jaw reconstruction surgery", "mandible reconstruction plate"],
  "Distração osteogênica": ["distraction osteogenesis jaw", "alveolar distraction osteogenesis", "mandibular distraction lengthening"],
  "Transplante de osso": ["autologous bone graft oral surgery", "bone block graft jaw", "bone transplant maxillofacial"],
  "Enxertos microvascularizados": ["microvascular free flap oral reconstruction", "fibula free flap mandible", "free flap maxillofacial reconstruction"],
  "Articulação temporomandibular cirúrgica": ["temporomandibular joint surgery", "TMJ arthroplasty surgery", "total joint replacement TMJ"],
  "Cirurgia de terceiros molares": ["third molar surgery extraction", "wisdom tooth surgical removal", "impacted third molar surgery"],
  "Doenças das glândulas salivares": ["salivary gland disease treatment", "sialolithiasis calculi removal", "parotid gland pathology"],
  "Fissura labiopalatina": ["cleft lip palate surgery", "palatoplasty cheiloplasty repair", "cleft palate treatment outcomes"],
  "Cirurgia pré-protética": ["preprosthetic surgery oral", "alveoloplasty bone reduction", "vestibuloplasty oral preprosthetic"],
  "Complicações pós-operatórias": ["postoperative complications oral surgery", "alveolar osteitis dry socket", "surgical site infection oral"],
  "Anestesia local em BMF": ["local anesthesia oral surgery", "inferior alveolar nerve block", "regional anesthesia dental surgery"],
  "Implantes zigomáticos em BMF": ["zygomatic implants severe atrophy", "zygoma implant surgery technique", "zygomatic fixture placement"],
  "Medicina do sono e cirurgia": ["sleep apnea surgical treatment", "uvulopalatopharyngoplasty sleep apnea", "mandibular advancement surgery sleep"],
  "Bifosfonatos e osteonecrose": ["medication-related osteonecrosis jaw MRONJ", "bisphosphonate osteonecrosis", "antiresorptive jaw osteonecrosis"],
  "Cirurgia oncológica oral": ["oral cancer surgery resection", "neck dissection oncology oral", "oncological jaw surgery"],
  "Reconstrução com retalhos locais": ["local flap oral reconstruction", "buccal fat pad flap closure", "palatal flap oral defect"],
  "Cirurgia minimamente invasiva": ["minimally invasive oral surgery technique", "piezoelectric surgery bone", "flapless oral surgery"],

  // ===== PRÓTESE =====
  "Prótese total convencional": ["complete denture fabrication", "conventional full denture", "complete edentulous denture"],
  "Prótese parcial removível": ["removable partial denture design", "cast partial denture RPD", "removable prosthesis partial"],
  "Prótese fixa unitária": ["single unit dental crown", "full coverage crown prosthesis", "dental crown restoration"],
  "Prótese fixa de múltiplos elementos": ["fixed partial denture bridge", "dental bridge multi-unit", "fixed prosthesis multiple units"],
  "Oclusão em prótese": ["dental occlusion prosthodontics", "centric relation prosthodontics", "occlusal scheme prosthetics"],
  "Reabilitação oral completa": ["full mouth rehabilitation prosthodontics", "complete oral rehabilitation", "full mouth reconstruction"],
  "Materiais cerâmicos para prótese": ["dental ceramic material crown", "ceramic prosthetic material", "porcelain crown material"],
  "Zircônia em prótese fixa": ["zirconia fixed prosthesis", "zirconia crown bridge", "monolithic zirconia restoration"],
  "CAD/CAM em prótese": ["CAD CAM dental prosthesis", "computer aided dental restoration milling", "digital prosthetics CAD CAM"],
  "Prótese implanto-suportada": ["implant-supported fixed prosthesis", "implant-retained crown", "implant prosthetic rehabilitation"],
  "Prótese parcial imediata": ["immediate partial denture", "transitional partial denture", "interim partial denture post-extraction"],
  "Prótese provisória": ["provisional dental restoration", "temporary crown prosthetics", "interim dental prosthesis"],
  "Overdenture sobre implantes": ["implant overdenture mandibular", "implant-retained complete overdenture", "ball attachment implant overdenture"],
  "Prótese bucomaxilofacial": ["maxillofacial prosthetics rehabilitation", "facial prosthesis auricular ocular", "prosthetic rehabilitation maxillofacial"],
  "Reembasamento de próteses": ["denture relining rebasing", "chairside reline denture", "denture rebase technique"],
  "Prótese em pacientes geriátricos": ["geriatric prosthodontics", "elderly edentulous denture", "dental prosthetics elderly patients"],
  "Estética em prótese fixa": ["aesthetic fixed prosthodontics", "cosmetic crown veneer restoration", "anterior aesthetic prosthesis"],
  "Cimentação adesiva": ["resin cement adhesive luting", "adhesive cementation dental crown", "luting agent ceramic bonding"],
  "Prótese e bruxismo": ["bruxism prosthodontics management", "occlusal protection bruxism prosthesis", "parafunctional bruxism restoration"],
  "Desordens oclusais": ["occlusal disorder treatment", "malocclusion prosthodontic management", "occlusal adjustment therapy"],
  "Impressão digital em prótese": ["digital impression prosthodontics intraoral scanner", "digital workflow dental prosthetics", "intraoral scan prosthesis"],
  "Cera e moldagem funcional": ["functional impression complete denture", "jaw relation records wax rim", "occlusal record denture"],
  "Prótese e ATM": ["TMD prosthodontic management", "temporomandibular prosthetics occlusion", "oral rehabilitation TMD"],
  "Sorrisos compostos": ["smile rehabilitation composite prosthetics", "anterior smile aesthetic restoration", "smile design fixed prosthetics"],
  "Prótese e estética facial": ["facial aesthetic dental rehabilitation", "smile makeover prosthodontics", "cosmetic dental prosthetic facial"],

  // ===== ENDODONTIA =====
  "Tratamento de canal convencional": ["root canal treatment endodontics", "nonsurgical endodontic therapy", "root canal therapy outcome"],
  "Retratamento endodôntico": ["endodontic retreatment nonsurgical", "root canal retreatment", "failed root canal retreatment"],
  "Cirurgia perirradicular (apicectomia)": ["periradicular surgery apicectomy", "endodontic microsurgery apicoectomy", "root end surgery endodontics"],
  "Regeneração pulpar em dentes imaturos": ["pulp revascularization immature teeth", "regenerative endodontics apexogenesis", "apexification immature tooth"],
  "Instrumentação rotatória NiTi": ["NiTi rotary endodontic file", "nickel titanium rotary instrumentation", "rotary file root canal shaping"],
  "Instrumentação reciprocante": ["reciprocating endodontic system", "WaveOne reciprocating file", "single file reciprocating endodontics"],
  "Irrigação com hipoclorito de sódio": ["sodium hypochlorite root canal irrigation", "NaOCl endodontic irrigant", "endodontic irrigation efficacy"],
  "EDTA e quelantes em endodontia": ["EDTA chelation root canal", "smear layer removal endodontics", "chelating agent endodontics"],
  "Obturação endodôntica": ["root canal obturation gutta-percha", "warm vertical compaction endodontics", "root canal filling technique"],
  "Diagnóstico diferencial de dor endodôntica": ["endodontic pain differential diagnosis", "pulp vitality testing", "irreversible pulpitis diagnosis"],
  "Perfuração radicular": ["root perforation repair endodontics", "iatrogenic root perforation", "MTA repair perforation"],
  "Fratura de instrumento": ["fractured instrument endodontics retrieval", "separated file root canal", "instrument separation endodontic management"],
  "Dente com rizogênese incompleta": ["open apex endodontics apexification", "immature root canal MTA", "incomplete root formation endodontics"],
  "Reabsorção radicular": ["root resorption endodontic treatment", "external internal root resorption", "inflammatory root resorption management"],
  "Traumatismo dentário e endodontia": ["dental trauma endodontic sequelae", "traumatized tooth pulp necrosis", "avulsion replantation endodontics"],
  "Cimentos endodônticos": ["root canal sealer biocompatibility", "endodontic sealer", "resin-based endodontic sealer"],
  "Tomografia em endodontia": ["CBCT endodontic diagnosis", "cone beam CT root canal anatomy", "3D endodontic imaging"],
  "Endodontia em dentes com anatomia complexa": ["complex root canal anatomy treatment", "C-shaped canal endodontics", "calcified root canal treatment"],
  "Lasers em endodontia": ["laser endodontic disinfection", "Er:YAG laser root canal", "photobiomodulation endodontics"],
  "Medicação intracanal": ["intracanal medication calcium hydroxide", "interappointment dressing endodontics", "calcium hydroxide root canal"],
  "Dente com câmara calcificada": ["calcified pulp chamber endodontics", "pulp calcification root canal access", "calcified canal treatment"],
  "Endodontia em dentes posteriores": ["molar root canal treatment endodontics", "posterior tooth endodontic", "mandibular molar root canal"],
  "Biopulpotomia em dentes permanentes": ["vital pulp therapy permanent teeth", "partial pulpotomy MTA mineral trioxide", "direct pulp capping MTA"],
  "Dor pós-operatória em endodontia": ["postoperative pain endodontic treatment", "post-endodontic flare-up", "endodontic pain management postoperative"],
  "Prognóstico endodôntico": ["endodontic treatment prognosis outcome", "root canal success rate factors", "endodontic prognosis evidence"],

  // ===== ODONTOPEDIATRIA =====
  "Cárie precoce na infância": ["early childhood caries prevention treatment", "severe early childhood caries", "baby bottle caries management"],
  "Traumatismo dental em crianças": ["dental trauma children management", "primary teeth trauma treatment", "tooth avulsion children replantation"],
  "Pulpotomia em molares decíduos": ["pulpotomy primary molar deciduous", "MTA pulpotomy primary teeth", "formocresol pulpotomy deciduous"],
  "Pulpectomia em decíduos": ["pulpectomy primary teeth", "root canal primary deciduous teeth", "radicular pulp treatment primary"],
  "Odontologia para bebês": ["infant oral health dental care", "baby oral hygiene dental visit", "oral health infants toddlers"],
  "Fluoretação e prevenção": ["fluoride prevention caries children", "fluoride varnish application caries", "water fluoridation dental caries"],
  "Selantes de fóssulas e fissuras": ["pit fissure sealant caries prevention", "dental sealant effectiveness children", "resin sealant application"],
  "Ortopedia funcional dos maxilares": ["functional jaw orthopedics children", "dentofacial orthopedics pediatric", "myofunctional appliance children"],
  "Respiração oral na infância": ["mouth breathing children dentofacial effects", "oral breathing malocclusion children", "nasal obstruction dental development"],
  "Hábitos orais deletérios": ["oral habits sucking children dental", "thumb sucking pacifier malocclusion", "digit sucking habit intervention"],
  "Ansiedade e medo em odontopediatria": ["dental anxiety fear children management", "child dental phobia", "pediatric dental anxiety"],
  "Técnicas de manejo comportamental": ["behavior management pediatric dentistry", "tell show do technique children", "child cooperation dental treatment"],
  "Sedação em odontopediatria": ["pediatric dental sedation nitrous oxide", "conscious sedation children dentistry", "nitrous oxide sedation pediatric dental"],
  "Anestesia geral em odontopediatria": ["general anesthesia pediatric dentistry", "dental treatment general anesthesia children", "pediatric dental GA outcome"],
  "Traumatismo em dentes permanentes jovens": ["young permanent tooth trauma treatment", "complicated crown fracture permanent tooth", "avulsion young permanent tooth"],
  "Erupção dentária e anomalias": ["tooth eruption anomaly children", "delayed tooth eruption causes", "ectopic eruption permanent teeth"],
  "Dentes supranumerários": ["supernumerary teeth mesiodens treatment", "hyperdontia management", "supernumerary tooth extraction children"],
  "Dentes neonatais": ["natal neonatal teeth management", "neonatal tooth treatment", "natal tooth oral findings"],
  "Nutrição e saúde bucal infantil": ["nutrition child oral health caries", "dietary sugar consumption caries children", "diet dental caries pediatric"],
  "Fissura labiopalatina na infância": ["cleft lip palate pediatric dental", "cleft palate feeding dental", "cleft palate dental development"],
  "Doença periodontal em crianças": ["periodontal disease children pediatric", "pediatric periodontal treatment", "prepubertal periodontitis"],
  "Atualização em cariologia pediátrica": ["pediatric caries management update", "silver diamine fluoride caries arrest", "caries risk assessment children"],
  "Hipomineralização molar-incisivo (HMI)": ["molar incisor hypomineralization MIH", "MIH treatment management", "enamel hypomineralization molar"],
  "Reabilitação oral pediátrica": ["pediatric oral rehabilitation stainless steel crown", "primary teeth full coverage crown", "full mouth rehabilitation children"],
  "Primeiro atendimento odontológico": ["first dental visit child anticipatory guidance", "infant oral examination", "pediatric dental first visit"],

  // ===== DTM E DOR OROFACIAL =====
  "Bruxismo do sono": ["sleep bruxism management treatment", "nocturnal bruxism polysomnography", "sleep bruxism etiology"],
  "Bruxismo em vigília": ["awake bruxism treatment", "daytime bruxism management", "waking bruxism biofeedback"],
  "Artralgia da ATM": ["TMJ arthralgia treatment", "temporomandibular joint pain management", "articular TMJ pain"],
  "Deslocamento de disco com redução": ["disc displacement reduction TMJ clicking", "anterior disc displacement clicking", "TMJ disc clicking treatment"],
  "Deslocamento de disco sem redução": ["disc displacement without reduction TMJ", "closed lock temporomandibular", "non-reducing disc displacement"],
  "Osteoartrite da ATM": ["temporomandibular joint osteoarthritis treatment", "TMJ osteoarthrosis management", "degenerative TMJ disease"],
  "Mialgia mastigatória": ["masticatory muscle pain myalgia treatment", "jaw muscle pain", "masseter myofascial pain"],
  "Dor miofascial": ["myofascial pain orofacial trigger point", "masticatory myofascial pain syndrome", "facial myofascial pain treatment"],
  "Placa oclusal estabilizadora": ["occlusal stabilization splint TMD", "flat plane occlusal splint", "Michigan splint temporomandibular"],
  "Placa oclusal de reposicionamento": ["mandibular repositioning appliance TMJ", "anterior repositioning splint disc", "disc recapture splint TMJ"],
  "Biofeedback em DTM": ["biofeedback TMD treatment", "EMG biofeedback bruxism jaw", "biofeedback orofacial pain"],
  "Toxina botulínica (Botox) em DTM": ["botulinum toxin TMD bruxism", "botox masseter injection bruxism", "botulinum toxin jaw pain"],
  "Fisioterapia orofacial": ["physical therapy TMD orofacial", "physiotherapy temporomandibular jaw", "jaw exercises physical therapy TMD"],
  "Diagnóstico por imagem da ATM (CBCT/RM)": ["TMJ imaging CBCT MRI diagnosis", "cone beam CT temporomandibular joint", "MRI disc displacement TMJ diagnosis"],
  "Dor crônica orofacial": ["chronic orofacial pain management", "persistent facial pain treatment", "chronic orofacial pain syndrome"],
  "Neuralgia do trigêmeo": ["trigeminal neuralgia treatment", "facial neuralgia management therapy", "trigeminal pain carbamazepine"],
  "Cefaleia tensional e odontologia": ["tension-type headache dentistry", "dental occlusion headache", "temporomandibular headache"],
  "Oclusão e DTM": ["dental occlusion temporomandibular disorder", "occlusal factors TMD", "malocclusion TMJ pain"],
  "Relação oclusal e postura": ["dental occlusion body posture", "mandibular position cervical posture", "occlusion postural relationship"],
  "Diagnóstico diferencial de dores faciais": ["differential diagnosis facial pain orofacial", "orofacial pain classification diagnosis", "facial pain differential diagnosis"],
  "Dor neuropática orofacial": ["orofacial neuropathic pain", "atypical facial pain neuropathy", "burning mouth syndrome neuropathic"],
  "Impacto psicossocial das DTMs": ["psychosocial impact temporomandibular disorder", "quality of life TMD", "anxiety depression temporomandibular"],
  "Tratamento multidisciplinar em DTM": ["multidisciplinary TMD treatment approach", "interdisciplinary orofacial pain management", "team-based temporomandibular treatment"],
  "Laser de baixa intensidade em DTM": ["low-level laser therapy TMD", "LLLT temporomandibular pain", "photobiomodulation TMJ pain laser"],
  "Qualidade de sono e DTM": ["sleep quality temporomandibular disorder", "sleep disturbance TMD orofacial pain", "insomnia orofacial pain"],

  // ===== RADIOLOGIA =====
  "CBCT 3D em diagnóstico": ["cone beam computed tomography dental diagnosis", "CBCT oral diagnosis", "3D imaging dental CBCT"],
  "Radiografia periapical digital": ["digital periapical radiograph", "digital periapical X-ray technique", "intraoral digital radiography"],
  "Panorâmica e suas limitações": ["panoramic radiography limitations dental", "orthopantomogram diagnostic accuracy", "panoramic X-ray dental"],
  "Diagnóstico de cárie por imagem": ["radiographic caries detection bitewing", "interproximal caries radiograph", "bitewing radiograph caries diagnosis"],
  "Diagnóstico periodontal por radiografia": ["periodontal bone loss radiographic assessment", "alveolar bone level radiograph", "radiographic periodontal diagnosis"],
  "Planejamento de implantes com CBCT": ["CBCT implant planning", "implant site assessment 3D CBCT", "3D planning dental implant placement"],
  "CBCT em endodontia": ["CBCT endodontic diagnosis root canal", "cone beam CT root canal anatomy", "3D endodontic imaging"],
  "CBCT em ortodontia": ["CBCT orthodontic diagnosis airway", "cone beam CT cephalometric orthodontics", "3D imaging orthodontics CBCT"],
  "Redução de dose em radiologia odontológica": ["radiation dose reduction dental radiology", "low dose dental X-ray technique", "dose optimization dental imaging"],
  "Inteligência artificial em radiologia": ["artificial intelligence dental radiology diagnosis", "deep learning radiograph detection", "AI dental X-ray diagnosis"],
  "Detecção automática de cárie por IA": ["AI automated caries detection radiograph", "machine learning dental caries radiograph", "neural network caries detection"],
  "Radiologia em patologia oral": ["radiographic oral pathology diagnosis", "jaw lesion radiographic", "oral pathology dental imaging"],
  "Imagem da ATM por RM": ["MRI temporomandibular joint disc", "TMJ magnetic resonance imaging", "MRI disc displacement TMJ"],
  "Sialografia": ["sialography salivary gland imaging", "salivary duct sialography", "sialoendoscopy salivary imaging"],
  "Radioprotecção em odontologia": ["radiation protection dentistry ALARA", "dental X-ray patient safety", "radiation dose dental protection"],
  "Interpretação de achados incidentais": ["incidental findings CBCT dental", "cone beam CT unexpected pathology", "CBCT incidental oral findings"],
  "Diagnóstico de reabsorções radiculares": ["root resorption radiographic diagnosis", "external root resorption imaging", "root resorption CBCT detection"],
  "Lesões periapicais em imagem": ["periapical lesion radiographic imaging", "apical periodontitis CBCT", "periapical pathology diagnosis imaging"],
  "CBCT em cirurgia guiada": ["CBCT guided implant surgery", "computer guided surgery 3D planning", "surgical guide 3D printing implant"],
  "Tomossíntese em odontologia": ["dental tomosynthesis imaging", "digital tomosynthesis oral", "tomosynthesis caries detection"],
  "Fantomas e calibração em radiologia": ["dental phantom calibration radiology", "image quality dental radiography", "radiographic phantom calibration dental"],
  "Imagem em trauma facial": ["facial trauma radiographic CT", "CT scan facial fracture assessment", "maxillofacial trauma imaging"],
  "Princípios de proteção radiológica": ["radiological protection principles dental", "ionizing radiation safety dental", "radiation dose patient dental"],
  "Radiologia em pediatria": ["pediatric dental radiology", "children dental X-ray technique", "pediatric radiographic technique dental"],
  "Teleradiologia e laudos remotos": ["teleradiology dental remote reporting", "remote radiographic report dental", "digital radiograph teleconsultation"]
};

// Reverse lookup: tema PT name -> which specialty it belongs to
// Built from the same THEMES structure in index.html
const TEMA_TO_ESPECIALIDADE = {};
(function() {
  const THEMES_BY_SPEC = {
    "Ortodontia": ["Alinhadores invisíveis","Biomecânica ortodôntica","Cefalometria","Mini-implantes / TADs","Expansão maxilar","Cirurgia ortognática","Ortodontia e ATM","Ancoragem esquelética","Contenção e recidiva","Ortodontia interceptiva","Aparelho fixo estético","Extração em ortodontia","Ortodontia lingual","Self-ligating","Torque e angulação","Crescimento e desenvolvimento facial","Ortodontia em adultos","Respiração oral e má-oclusão","Ortodontia e sono/apneia","Tratamento de Classe II","Tratamento de Classe III","Mordida aberta","Mordida cruzada posterior","Sobremordida profunda","Inteligência artificial em ortodontia"],
    "Implantodontia": ["Osseointegração","Carga imediata","Enxertos ósseos autógenos","Enxertos com biomateriais","Implantes zigomáticos","Prótese sobre implante","Peri-implantite","Planejamento digital 3D","All-on-4 e All-on-X","Implantes em maxila posterior","Implantes em mandíbula posterior","Elevação de seio maxilar","Implantes estreitos (mini-implantes)","Implantes curtos","Tecido mole peri-implantar","Carga diferida","Reabilitação com implantes unitários","Implantes em pacientes sistêmicos","Complicações em implantes","Sobredentadura","Membranas e ROG","Biofilme peri-implantar","Impressão digital em implantes","Implantes imediatos pós-extração","Implantes em adolescentes"],
    "Periodontia": ["Doença periodontal crônica","Periodontite agressiva","Gengivite","Regeneração tecidual guiada","Cirurgia mucogengival","Periodontia e diabetes","Periodontia e doenças cardiovasculares","Lasers em periodontia","Manutenção periodontal","Raspagem e alisamento radicular","Cirurgia ressectiva","Cirurgia regenerativa","Enxerto gengival livre","Retalho de reposicionamento","Tratamento de furca","Abscesso periodontal","Periodontia e tabagismo","Microbioma periodontal","Periodontia e gestação","Periodontia e osteoporose","Medicação de suporte periodontal","Terapia fotodinâmica","Ozônio em periodontia","Periodontia estética","Defeitos ósseos verticais"],
    "Dentística": ["Resinas compostas nanoparticuladas","Clareamento dental","Facetas de porcelana","Laminados cerâmicos","Adesão dental","Estética digital (DSD)","Restaurações indiretas em cerâmica","Inlays e onlays","Cárie e mínima intervenção","Fluorose e tratamento","Erosão dental","Sensibilidade dentinária","Bruxismo e dentística","Mock-up digital","Pigmentações e manchamentos","Restaurações em dentes anteriores","Sistemas cerâmicos (zircônia, dissilicato)","Fotopolimerização e luz LED","Cor em dentística","Tratamento de cavidades classe IV","Restaurações cervicais","Dentística minimamente invasiva","Materiais provisórios estéticos","Técnica incremental em compósito","Polimento e acabamento"],
    "Bucomaxilofacial": ["Cirurgia ortognática","Trauma facial","Fraturas mandibulares","Fraturas do terço médio","Patologia oral benigna","Cistos odontogênicos","Tumores benignos dos maxilares","Carcinoma espinocelular oral","Reconstrução mandibular","Distração osteogênica","Transplante de osso","Enxertos microvascularizados","Articulação temporomandibular cirúrgica","Cirurgia de terceiros molares","Doenças das glândulas salivares","Fissura labiopalatina","Cirurgia pré-protética","Complicações pós-operatórias","Anestesia local em BMF","Implantes zigomáticos em BMF","Medicina do sono e cirurgia","Bifosfonatos e osteonecrose","Cirurgia oncológica oral","Reconstrução com retalhos locais","Cirurgia minimamente invasiva"],
    "Prótese": ["Prótese total convencional","Prótese parcial removível","Prótese fixa unitária","Prótese fixa de múltiplos elementos","Oclusão em prótese","Reabilitação oral completa","Materiais cerâmicos para prótese","Zircônia em prótese fixa","CAD/CAM em prótese","Prótese implanto-suportada","Prótese parcial imediata","Prótese provisória","Overdenture sobre implantes","Prótese bucomaxilofacial","Reembasamento de próteses","Prótese em pacientes geriátricos","Estética em prótese fixa","Cimentação adesiva","Prótese e bruxismo","Desordens oclusais","Impressão digital em prótese","Cera e moldagem funcional","Prótese e ATM","Sorrisos compostos","Prótese e estética facial"],
    "Endodontia": ["Tratamento de canal convencional","Retratamento endodôntico","Cirurgia perirradicular (apicectomia)","Regeneração pulpar em dentes imaturos","Instrumentação rotatória NiTi","Instrumentação reciprocante","Irrigação com hipoclorito de sódio","EDTA e quelantes em endodontia","Obturação endodôntica","Diagnóstico diferencial de dor endodôntica","Perfuração radicular","Fratura de instrumento","Dente com rizogênese incompleta","Reabsorção radicular","Traumatismo dentário e endodontia","Cimentos endodônticos","Tomografia em endodontia","Endodontia em dentes com anatomia complexa","Lasers em endodontia","Medicação intracanal","Dente com câmara calcificada","Endodontia em dentes posteriores","Biopulpotomia em dentes permanentes","Dor pós-operatória em endodontia","Prognóstico endodôntico"],
    "Odontopediatria": ["Cárie precoce na infância","Traumatismo dental em crianças","Pulpotomia em molares decíduos","Pulpectomia em decíduos","Odontologia para bebês","Fluoretação e prevenção","Selantes de fóssulas e fissuras","Ortopedia funcional dos maxilares","Respiração oral na infância","Hábitos orais deletérios","Ansiedade e medo em odontopediatria","Técnicas de manejo comportamental","Sedação em odontopediatria","Anestesia geral em odontopediatria","Traumatismo em dentes permanentes jovens","Erupção dentária e anomalias","Dentes supranumerários","Dentes neonatais","Nutrição e saúde bucal infantil","Fissura labiopalatina na infância","Doença periodontal em crianças","Atualização em cariologia pediátrica","Hipomineralização molar-incisivo (HMI)","Reabilitação oral pediátrica","Primeiro atendimento odontológico"],
    "DTM e Dor Orofacial": ["Bruxismo do sono","Bruxismo em vigília","Artralgia da ATM","Deslocamento de disco com redução","Deslocamento de disco sem redução","Osteoartrite da ATM","Mialgia mastigatória","Dor miofascial","Placa oclusal estabilizadora","Placa oclusal de reposicionamento","Biofeedback em DTM","Toxina botulínica (Botox) em DTM","Fisioterapia orofacial","Diagnóstico por imagem da ATM (CBCT/RM)","Dor crônica orofacial","Neuralgia do trigêmeo","Cefaleia tensional e odontologia","Oclusão e DTM","Relação oclusal e postura","Diagnóstico diferencial de dores faciais","Dor neuropática orofacial","Impacto psicossocial das DTMs","Tratamento multidisciplinar em DTM","Laser de baixa intensidade em DTM","Qualidade de sono e DTM"],
    "Radiologia": ["CBCT 3D em diagnóstico","Radiografia periapical digital","Panorâmica e suas limitações","Diagnóstico de cárie por imagem","Diagnóstico periodontal por radiografia","Planejamento de implantes com CBCT","CBCT em endodontia","CBCT em ortodontia","Redução de dose em radiologia odontológica","Inteligência artificial em radiologia","Detecção automática de cárie por IA","Radiologia em patologia oral","Imagem da ATM por RM","Sialografia","Radioprotecção em odontologia","Interpretação de achados incidentais","Diagnóstico de reabsorções radiculares","Lesões periapicais em imagem","CBCT em cirurgia guiada","Tomossíntese em odontologia","Fantomas e calibração em radiologia","Imagem em trauma facial","Princípios de proteção radiológica","Radiologia em pediatria","Teleradiologia e laudos remotos"]
  };
  for (const [esp, temas] of Object.entries(THEMES_BY_SPEC)) {
    for (const t of temas) { TEMA_TO_ESPECIALIDADE[t] = esp; }
  }
})();

// Legacy single-string fallback for themes not in TEMA_MAP
const TEMA_EN_LEGACY = {
  "Expansão palatina": ["palatal expansion orthodontics", "rapid palatal expansion", "maxillary expansion RPE"],
  "Periimplantite": ["peri-implantitis", "periimplantitis treatment", "peri-implant disease"],
  "Disfunção temporomandibular": ["temporomandibular disorder treatment", "TMD management", "temporomandibular dysfunction"],
  "DTM e dor orofacial": ["temporomandibular disorder orofacial pain", "TMD orofacial pain management", "jaw pain temporomandibular"],
  "Ortodontia & ATM": ["orthodontics temporomandibular joint", "orthodontic treatment TMD", "malocclusion TMJ relationship"]
};

// Specialty-level fallback terms (used if no theme matches)
const ESPECIALIDADE_FALLBACK = {
  "Ortodontia": ["orthodontics malocclusion treatment", "orthodontic therapy", "dental malocclusion orthodontic"],
  "Implantodontia": ["dental implants osseointegration", "implant dentistry", "dental implant therapy"],
  "Periodontia": ["periodontal disease treatment", "periodontology clinical", "periodontal therapy"],
  "Endodontia": ["root canal treatment endodontics", "endodontic therapy", "pulp disease treatment"],
  "Dentística": ["restorative dentistry", "dental restoration composite", "esthetic dentistry"],
  "Prótese": ["prosthodontics dental prosthesis", "prosthetic dentistry", "dental rehabilitation"],
  "Bucomaxilofacial": ["oral maxillofacial surgery", "maxillofacial surgical treatment", "oral surgery"],
  "Odontopediatria": ["pediatric dentistry", "children dental treatment", "pediatric oral health"],
  "DTM e Dor Orofacial": ["temporomandibular disorder treatment", "orofacial pain management", "jaw pain TMD"],
  "Radiologia": ["dental radiology diagnosis", "oral radiology imaging", "dental diagnostic imaging"]
};

// HTTP helper
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// Firestore: list all users (paginated)
async function getUsers(projectId, apiKey) {
  let allDocs = [];
  let pageToken = null;
  do {
    const qs = "pageSize=300&key=" + apiKey + (pageToken ? "&pageToken=" + pageToken : "");
    const path = "/v1/projects/" + projectId + "/databases/(default)/documents/cadastros?" + qs;
    const res = await request({ hostname: "firestore.googleapis.com", path, method: "GET" }, null);
    if (res.status !== 200) { console.error("Firestore list error:", res.body); break; }
    const json = JSON.parse(res.body);
    if (json.documents) allDocs = allDocs.concat(json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);
  if (!allDocs.length) return [];
  return allDocs.map(doc => {
    const f = doc.fields || {};
    const temas = f.temas?.stringValue
      ? f.temas.stringValue.split(',').map(t => t.trim()).filter(Boolean)
      : (f.temas?.arrayValue?.values || []).map(v => v.stringValue || '').filter(Boolean);
    const especialidades = f.especialidade?.arrayValue?.values
      ? f.especialidade.arrayValue.values.map(v => v.stringValue || '').filter(Boolean)
      : f.especialidade?.stringValue
        ? [f.especialidade.stringValue]
        : [];
    const especialidade = especialidades[0] || '';
    return {
      nome: f.nome?.stringValue || "",
      email: f.email?.stringValue || "",
      especialidade,
      especialidades,
      temas,
      ativo: f.ativo?.booleanValue !== false
    };
  }).filter(u => u.email && u.ativo !== false);
}

// Firestore: get sent PMIDs for a user (anti-repeat)
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

// PubMed: search a single English term
async function trySearchPubMed(query, excludePmids = []) {
  const encoded = encodeURIComponent(query);
  const searchPath = "/entrez/eutils/esearch.fcgi?db=pubmed&term=" + encoded + "&retmax=20&sort=date&retmode=json&datetype=pdat&reldate=1825";
  const searchRes = await request({ hostname: "eutils.ncbi.nlm.nih.gov", path: searchPath, method: "GET" }, null);
  if (searchRes.status !== 200) return null;
  const searchJson = JSON.parse(searchRes.body);
  const ids = searchJson.esearchresult?.idlist || [];
  if (ids.length === 0) return null;
  const freshIds = ids.filter(id => !excludePmids.includes(id));
  const candidates = freshIds.length > 0 ? freshIds : ids;
  const pmid = candidates[Math.floor(Math.random() * candidates.length)];
  const fetchPath = "/entrez/eutils/efetch.fcgi?db=pubmed&id=" + pmid + "&retmode=xml&rettype=abstract";
  const fetchRes = await request({ hostname: "eutils.ncbi.nlm.nih.gov", path: fetchPath, method: "GET" }, null);
  if (fetchRes.status !== 200) return null;
  const xml = fetchRes.body;
  const titleMatch = xml.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Artigo sem titulo";
  const abstractMatch = xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
  let abstract = "";
  if (abstractMatch) { abstract = abstractMatch.map(a => a.replace(/<[^>]+>/g, "").trim()).join(" "); }
  const journalMatch = xml.match(/<Title>([\s\S]*?)<\/Title>/);
  const journal = journalMatch ? journalMatch[1].trim() : "";
  const yearMatch = xml.match(/<Year>(\d{4})<\/Year>/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
  const authorMatches = xml.match(/<LastName>([\s\S]*?)<\/LastName>/g) || [];
  const authors = authorMatches.slice(0, 3).map(a => a.replace(/<[^>]+>/g, "").trim());
  const authorStr = authors.length > 0 ? authors.join(", ") + (authorMatches.length > 3 ? " et al." : "") : "Autores nao informados";
  return { pmid, title, abstract: abstract.substring(0, 1200), journal, year, authors: authorStr };
}

// PubMed: try each term in array with fallback, log failures
async function searchPubMed(terms, excludePmids = [], context = "") {
  for (const term of terms) {
    try {
      const result = await trySearchPubMed(term, excludePmids);
      if (result) {
        console.log(`[PubMed] Found article for "${term}"${context ? " (" + context + ")" : ""}`);
        return result;
      }
      console.log(`[PubMed] No results for term: "${term}"${context ? " (" + context + ")" : ""}`);
    } catch (e) {
      console.warn(`[PubMed] Error searching "${term}": ${e.message}`);
    }
  }
  console.warn(`[PubMed] All terms exhausted for: ${context || terms[0]}`);
  return null;
}

// Resolve English search terms for a given PT theme name
function getSearchTerms(tema, especialidade) {
  if (TEMA_MAP[tema]) return TEMA_MAP[tema];
  if (TEMA_EN_LEGACY[tema]) return TEMA_EN_LEGACY[tema];
  console.log(`[Terms] Theme not in map: "${tema}" — using specialty fallback`);
  return ESPECIALIDADE_FALLBACK[especialidade] || ["dental research clinical", "oral health evidence"];
}

// Generate structured summary
function generateSummary(article, especialidade, tema) {
  if (!article.abstract || article.abstract.length < 50) {
    return "Resumo detalhado nao disponivel para este artigo. Acesse o link abaixo para ler o artigo completo no PubMed.";
  }
  const abs = article.abstract;
  const sentences = abs.split(/\.\s+/).filter(s => s.length > 20);
  const intro = sentences[0] || abs.substring(0, 200);
  const body = sentences.slice(1, Math.min(sentences.length - 1, 5)).join(". ");
  const conclusion = sentences[sentences.length - 1] || "";
  return intro + (body ? ". " + body : "") + (conclusion && conclusion !== intro ? ". " + conclusion : "") + ".";
}

// Build email HTML
function buildEmail(user, article, tema) {
  const pubmedUrl = "https://pubmed.ncbi.nlm.nih.gov/" + article.pmid + "/";
  const summary = generateSummary(article, user.especialidade, tema);
  const firstName = user.nome.split(" ")[0];
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
<span style="font-size:1.4rem;font-weight:800;background:linear-gradient(135deg,#0ea5e9,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">OdontoFeed</span>
<p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Artigo do Dia · ${new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p>
</div>
<div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
<p style="color:#64748b;font-size:0.9rem;margin:0 0 20px;">Olá, <strong style="color:#0f172a;">${firstName}</strong>! Seu artigo diário de <strong style="color:#0ea5e9;">${user.especialidade}</strong> chegou.</p>
<div style="margin-bottom:20px;"><span style="background:#eff6ff;color:#0ea5e9;border:1px solid #bfdbfe;padding:5px 14px;border-radius:999px;font-size:0.78rem;font-weight:600;">${tema}</span></div>
<h1 style="font-size:1.15rem;font-weight:800;color:#0f172a;line-height:1.4;margin:0 0 20px;">${article.title}</h1>
<div style="background:#f8fafc;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:0.82rem;color:#64748b;">
<span style="margin-right:16px;">📚 <strong>${article.journal}</strong></span>
<span style="margin-right:16px;">📅 ${article.year}</span>
<span>👥 ${article.authors}</span>
</div>
<div style="border-left:3px solid #0ea5e9;padding-left:18px;margin-bottom:28px;">
<p style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0ea5e9;margin:0 0 10px;">Resumo</p>
<p style="color:#334155;font-size:0.9rem;line-height:1.75;margin:0;">${summary}</p>
</div>
<div style="text-align:center;margin-bottom:8px;">
<a href="${pubmedUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;">Ler artigo completo no PubMed →</a>
</div>
<p style="text-align:center;color:#94a3b8;font-size:0.78rem;margin-top:12px;">PMID: ${article.pmid}</p>
</div>
<div style="background:#0b1120;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
<p style="color:#475569;font-size:0.78rem;margin:0;">OdontoFeed — Ciência odontológica direto para você</p>
<p style="color:#334155;font-size:0.72rem;margin:8px 0 0;"><a href="https://odontofeed.com/.netlify/functions/unsubscribe?email=${encodeURIComponent(user.email)}" style="color:#475569;text-decoration:underline;">Cancelar recebimento</a></p>
</div>
</div>
</body>
</html>`;
}

// Save article to Firestore
async function saveArticleToFirestore(projectId, apiKey, data) {
  const fields = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = { integerValue: String(val) };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else fields[key] = { stringValue: String(val) };
  }
  const body = JSON.stringify({ fields });
  return new Promise((resolve, reject) => {
    const bodyBuffer = Buffer.from(body, 'utf8');
    const options = {
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + projectId + '/databases/(default)/documents/artigos_enviados?key=' + apiKey,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': bodyBuffer.length }
    };
    const req = https.request(options, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// Send email via Resend
async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({ from: "OdontoFeed <artigos@odontofeed.com>", to, subject, html });
  return request({
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
  }, payload);
}

// Main handler
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
        console.log(`[Skip] No themes for ${user.email} — trying specialty fallback`);
        const fallbackTerms = ESPECIALIDADE_FALLBACK[user.especialidade] || ["dental research clinical evidence"];
        const sentPmids = await getSentPmids(projectId, apiKey, user.email);
        const article = await searchPubMed(fallbackTerms, sentPmids, user.especialidade + " fallback");
        if (!article) { console.warn(`[Skip] No article found for ${user.email} via fallback`); skipped++; continue; }
        const html = buildEmail(user, article, user.especialidade);
        const subject = "🧪 " + article.title.substring(0, 70) + (article.title.length > 70 ? "..." : "");
        const emailRes = await sendEmail(resendKey, user.email, subject, html);
        if (emailRes.status === 200 || emailRes.status === 201) {
          sent++;
          await saveArticleToFirestore(projectId, apiKey, {
            email: user.email, especialidade: user.especialidade, tema: user.especialidade,
            titulo: article.title || '', resumo: article.abstract || '',
            pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/' + article.pmid + '/',
            pmid: String(article.pmid || ''), data: new Date().toISOString()
          }).catch(e => console.warn('Could not save article:', e.message));
        } else { errors++; }
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      // Filter temas to only those belonging to the user's selected specialties
      const userSpecs = new Set(
        user.especialidades && user.especialidades.length ? user.especialidades : [user.especialidade]
      );
      const validTemas = temas.filter(t => {
        const temaEsp = TEMA_TO_ESPECIALIDADE[t];
        return !temaEsp || userSpecs.has(temaEsp);
      });
      const temaPool = validTemas.length > 0 ? validTemas : temas;
      if (validTemas.length < temas.length) {
        console.log(`[Filter] ${user.email}: ${temas.length - validTemas.length} tema(s) filtered out (wrong specialty). Pool: ${validTemas.length}`);
      }

      // Pick tema by day-based rotation so all themes are covered over time
      const dayNumber = Math.floor(Date.now() / 86400000);
      const tema = temaPool[dayNumber % temaPool.length];
      const terms = getSearchTerms(tema, user.especialidade);
      const sentPmids = await getSentPmids(projectId, apiKey, user.email);
      console.log(`[Dispatch] ${user.email} | tema: "${tema}" | terms: ${terms.length} | sentPmids: ${sentPmids.length}`);

      let article = await searchPubMed(terms, sentPmids, tema);

      // If chosen theme failed, try other themes from user's valid list
      if (!article && temaPool.length > 1) {
        const otherTemas = temaPool.filter(t => t !== tema);
        for (const altTema of otherTemas) {
          const altTerms = getSearchTerms(altTema, user.especialidade);
          console.log(`[Fallback] Trying alternate theme "${altTema}" for ${user.email}`);
          article = await searchPubMed(altTerms, sentPmids, altTema);
          if (article) break;
        }
      }

      // Last resort: specialty-level fallback
      if (!article) {
        const fallbackTerms = ESPECIALIDADE_FALLBACK[user.especialidade] || ["dental research clinical evidence"];
        console.log(`[Fallback] Using specialty fallback for ${user.email}: ${user.especialidade}`);
        article = await searchPubMed(fallbackTerms, sentPmids, user.especialidade + " specialty fallback");
      }

      if (!article) {
        console.warn(`[Error] No article found for ${user.email} after all fallbacks`);
        errors++;
        continue;
      }

      console.log(`[Found] "${article.title.substring(0, 60)}" for ${user.email}`);
      const html = buildEmail(user, article, tema);
      const subject = "🧪 " + article.title.substring(0, 70) + (article.title.length > 70 ? "..." : "");
      const emailRes = await sendEmail(resendKey, user.email, subject, html);
      if (emailRes.status === 200 || emailRes.status === 201) {
        console.log(`[Sent] Email to ${user.email}`);
        sent++;
        await saveArticleToFirestore(projectId, apiKey, {
          email: user.email, especialidade: user.especialidade, tema,
          titulo: article.title || '', resumo: article.abstract || '',
          pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/' + article.pmid + '/',
          pmid: String(article.pmid || ''), data: new Date().toISOString()
        }).catch(e => console.warn('Could not save article history:', e.message));
      } else {
        console.error(`[Error] Email to ${user.email}: ${emailRes.status} ${emailRes.body.substring(0, 100)}`);
        errors++;
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[Error] Processing ${user.email}: ${err.message}`);
      errors++;
    }
  }
  const result = { sent, errors, skipped, total: users.length, timestamp: new Date().toISOString() };
  console.log("Daily dispatch complete:", result);
  return { statusCode: 200, body: JSON.stringify(result) };
};

// Direct execution support
if (require.main === module) {
  exports.handler({}).then(r => {
    console.log('Done:', r.statusCode, r.body);
    process.exit(r.statusCode === 200 ? 0 : 1);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
