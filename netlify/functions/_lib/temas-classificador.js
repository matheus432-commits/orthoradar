// CLASSIFICADOR DE TEMAS — DETERMINÍSTICO, SEM IA (decisão do fundador 08/08:
// "os requests vão falhar / vamos ver outra alternativa" — zero chamadas de
// API, zero custo, zero falha de rede; roda em milissegundos e é testável).
//
// Como funciona: cada tema da TAXONOMIA tem um padrão de palavras-chave
// (raízes PT + EN). O classificador pontua título (peso 3) + resumo (peso 1)
// e escolhe o tema de maior pontuação da ESPECIALIDADE do artigo; empate
// resolve pela ordem da lista (mais específico primeiro). Sem match → ''
// (o dropdown da biblioteca só mostra temas reais; nada de tema inventado).

const { TAXONOMIA, temaValido } = require('./temas-taxonomia');

// Padrões por especialidade — mesmos NOMES da TAXONOMIA (teste garante).
// A ORDEM aqui é a prioridade de DESEMPATE (tema mais específico primeiro):
// num título com dois assuntos ("expansão assistida por mini-implantes"),
// vence o que define o estudo, não o acessório.
const PADROES = {
  'Ortodontia': [
    ['Expansão palatina', /expans[ãa]o (palatina|maxilar|r[áa]pida)|palatal expansion|maxillary expansion|\bmarpe\b|\brme\b/i],
    ['Alinhadores invisíveis', /alinhador|aligner|invisalign/i],
    ['Ancoragem esquelética e mini-implantes', /mini-?(implante|screw|parafuso)|\btads?\b|ancoragem esquel|skeletal anchorage|miniscrew/i],
    ['Cirurgia ortognática', /ortogn[áa]tic|orthognathic/i],
    ['Contenção e recidiva', /conten[çc][ãa]o|recidiva|retainer|retention|relapse/i],
    ['Extração vs. não extração', /extra[çc][ãa]o.*(ortod|premolar|pré-molar)|extraction.*(orthod|premolar)|non-?extraction/i],
    ['Classe II', /classe ii\b|class ii\b|classe 2\b/i],
    ['Classe III', /classe iii\b|class iii\b|classe 3\b/i],
    ['Apinhamento', /apinha|crowding/i],
    ['Sobremordida', /sobremordida|overbite|deep bite|mordida profunda/i],
    ['Mordida aberta', /mordida aberta|open bite/i],
    ['Mordida cruzada', /mordida cruzada|crossbite/i],
    ['ATM e ortodontia', /\batm\b.*ortod|\btmj\b.*orthod|temporomandibular.*ortod/i],
    ['Surgery-first', /surgery-?first/i],
    ['Biomecânica ortodôntica', /biomec[âa]nic|fio ortod|archwire|torque|for[çc]a ortod/i],
    ['Distalização', /distaliza|distaliz/i],
    ['Ortodontia e sono/apneia', /apneia|apnea|\bosa\b|sono|sleep/i],
  ],
  'Implantodontia': [
    ['Carga imediata', /carga imediata|immediate load/i],
    ['Implante em zona estética', /zona est[ée]tica|esthetic zone|anterior maxilla.*implant/i],
    ['Peri-implantite', /peri-?implantit|peri-?implant (disease|mucosit)/i],
    ['Osseointegração', /osseointegra|osseointegrat/i],
    ['Enxerto ósseo', /enxerto [óo]sseo|bone graft|xenograft|aloenxerto|allograft/i],
    ['Membranas e ROG', /membrana|membrane|regenera[çc][ãa]o [óo]ssea guiada|guided bone regeneration|\bgbr\b|\brog\b/i],
    ['Implante unitário', /implante unit[áa]rio|single implant|single-?tooth implant/i],
    ['Prótese sobre implante', /pr[óo]tese sobre implante|implant-?supported (prosthesis|crown|denture)/i],
    ['Superfície de implante', /superf[íi]cie (de |do )?implante|implant surface|tratamento de superf/i],
    ['All-on-four', /all-?on-?(4|four|6|six)/i],
    ['Levantamento de seio maxilar', /levantamento d[eo] seio|sinus (lift|floor|augmentation)|seio maxilar.*(enxerto|elevac)/i],
    ['Reabsorção óssea', /reabsor[çc][ãa]o [óo]ssea|bone (loss|resorption)|perda [óo]ssea/i],
    ['Implante imediato pós-extração', /implante imediato|immediate implant/i],
    ['Planejamento digital em implantodontia', /guia cir[úu]rgic|guided surgery|planejamento (digital|virtual)|surgical guide/i],
  ],
  'Periodontia': [
    ['Raspagem e alisamento radicular', /raspagem|alisamento|scaling|root planing|debridament/i],
    ['Regeneração periodontal', /regenera[çc][ãa]o (periodontal|tecidual)|periodontal regeneration|emdogain|amelogenin/i],
    ['Cirurgia mucogengival', /mucogengival|mucogingival/i],
    ['Recobrimento radicular', /recobrimento radicular|root coverage|recess[ãa]o gengival|gingival recession/i],
    ['Enxerto gengival', /enxerto (gengival|de tecido|conjuntivo)|gingival graft|connective tissue graft/i],
    ['Peri-implantite', /peri-?implantit/i],
    ['Microbioma oral', /microbio(ma|ta)|microbiome|biofilme subgengival/i],
    ['Antibioticoterapia periodontal', /antibi[óo]tic|antimicrobial|azitromicina|metronidazol|amoxicilina/i],
    ['Gengivite', /gengivite|gingivitis/i],
    ['Periodontite', /periodontite|periodontitis/i],
    ['Biótipo e fenótipo gengival', /(bi[óo]|fen[óo])tipo gengival|gingival (bio|pheno)type|espessura gengival/i],
    ['Periodontia e doenças sistêmicas', /diabetes|cardiovascular|sist[êe]mic|systemic|gesta[çc][ãa]o|pregnancy/i],
    ['Terapia de suporte periodontal', /terapia de suporte|manuten[çc][ãa]o periodontal|supportive periodontal/i],
  ],
  'Endodontia': [
    ['Terapia pulpar vital', /polpa vital|vital pulp|pulpotomia|capeamento pulpar|pulp capping/i],
    ['Retratamento endodôntico', /retratamento|retreatment/i],
    ['Irrigação intracanal', /irriga[çc][ãa]o|irrigant|irrigation|\bpui\b|ultrass[ôo]nica passiva/i],
    ['Hipoclorito de sódio', /hipoclorito|hypochlorite|naocl/i],
    ['Instrumentação mecanizada', /instrumenta[çc][ãa]o|rot[aá]t[óo]ri|reciprocant|reciproc|niti|lima/i],
    ['Obturação do canal', /obtura[çc][ãa]o|obturation|guta-?percha|gutta-?percha|termoplastific/i],
    ['Dor pós-operatória', /dor p[óo]s-?operat[óo]ria|post-?operative pain|flare-?up/i],
    ['Cirurgia paraendodôntica', /paraendod[ôo]ntic|apicectomia|apicoectomy|endodontic (micro)?surgery|retro-?obtura/i],
    ['Traumatismo dentário', /traumatismo|avuls[ãa]o|avulsion|luxa[çc][ãa]o dent|dental trauma|reimplante/i],
    ['MTA e cimentos biocerâmicos', /\bmta\b|biocer[âa]mic|bioceramic|biodentine|agregado tri[óo]xido/i],
    ['Tomografia em endodontia', /tomografia.*(endod|canal|periapical)|cbct.*(endod|canal|root)/i],
    ['Anestesia em endodontia', /anestesia|anesthes|bloqueio do nervo/i],
    ['Medicação intracanal', /medica[çc][ãa]o intracanal|intracanal medicat|hidr[óo]xido de c[áa]lcio|calcium hydroxide/i],
    ['Regeneração pulpar', /regenera[çc][ãa]o pulpar|revasculariza|regenerative endodontic|revitaliza/i],
  ],
  'Dentística': [
    ['Clareamento dental', /clareamento|bleaching|whitening|per[óo]xido/i],
    ['Resina composta', /resina composta|composite resin|resin composite|comp[óo]sito/i],
    ['Cerâmicas e laminados', /cer[âa]mic|ceramic|porcelana|porcelain|dissilicato|disilicate/i],
    ['Facetas e lentes de contato', /faceta|veneer|lente de contato/i],
    ['Protocolo adesivo', /adesiv|adhesive|bonding|condicionamento [áa]cido|etch/i],
    ['Selantes', /selante|sealant/i],
    ['Cárie e remineralização', /c[áa]rie|caries|remineraliza|cpp-?acp|icdas/i],
    ['Erosão dental', /eros[ãa]o|erosion|desgaste erosivo|erosive/i],
    ['Hipersensibilidade dentinária', /hipersensibilidade|hypersensitivity|dessensibiliza|desensitiz/i],
    ['Restauração em dentes posteriores', /restaura[çc][ãa]o.*(posterior|molar|classe ii)|posterior restoration/i],
    ['Resina bulk fill', /bulk-? ?fill/i],
    ['Design do sorriso', /design do sorriso|smile design|planejamento est[ée]tico digital|\bdsd\b/i],
    ['Fluorose', /fluorose|fluorosis/i],
    ['Materiais bioativos', /bioativ|bioactive|giômero|giomer|ion[ôo]mero|ionomer/i],
  ],
  'Bucomaxilofacial': [
    ['Terceiros molares', /terceiro(s)? molar|third molar|\bsiso\b|impactad/i],
    ['Enxerto ósseo', /enxerto [óo]sseo|bone graft/i],
    ['Medicamentos antirreabsortivos e MRONJ', /\bmronj\b|\bbronj\b|osteonecrose|bisfosfonat|bisphosphonat|denosumab|antirreabsortiv/i],
    ['Cirurgia pré-protética', /pr[ée]-?prot[ée]tic|pre-?prosthetic/i],
    ['Trauma maxilofacial', /trauma (maxilo)?facial|fratura (mandibular|maxilar|zigom|facial)|facial fracture/i],
    ['Cistos e tumores', /cisto|cyst|tumor|ameloblastoma|odontoma|querat/i],
    ['Cirurgia ortognática', /ortogn[áa]tic|orthognathic/i],
    ['Alveolite', /alveolite|dry socket|oste[íi]te alveolar/i],
    ['Anestesia e sedação', /anestesia|sedac[ãa]o|sedation|anesthes/i],
    ['Harmonização orofacial', /harmoniza[çc][ãa]o|preenchedor|filler|[áa]cido hialur[ôo]nico|toxina botul/i],
    ['Fissuras labiopalatinas', /fissura|fenda (labial|palatina)|cleft/i],
    ['Infecções odontogênicas', /infec[çc][ãa]o odontog|odontogenic infection|abscesso|celulite facial/i],
  ],
  'Prótese': [
    ['CAD/CAM', /cad-?\/?-?cam|fresag|milling|usinag/i],
    ['Prótese total', /pr[óo]tese total|complete denture|dentadura/i],
    ['Prótese parcial removível', /parcial remov[íi]vel|removable partial|\bppr\b/i],
    ['Coroa unitária', /coroa (unit[áa]ria|total)|single crown|full crown/i],
    ['Overdenture', /overdenture/i],
    ['Zircônia', /zirc[ôo]nia|zirconia/i],
    ['Fluxo digital', /fluxo digital|digital workflow|protocolo digital/i],
    ['Escaneamento intraoral', /escaneamento|intraoral scan|impress[ãa]o digital|digital impression/i],
    ['Oclusão', /oclus[ãa]o|occlusion|dimens[ãa]o vertical|articulador/i],
    ['Reabilitação oral completa', /reabilita[çc][ãa]o (oral|bucal)|full-?mouth rehab/i],
    ['Prótese provisória', /provis[óo]ri|provisional|interim (prosthesis|restoration)/i],
    ['Prótese sobre implante', /sobre implante|implant-?supported/i],
    ['Cimentação', /cimenta[çc][ãa]o|cementation|cimento resinoso|resin cement/i],
    ['Materiais protéticos', /pmma|polimetil|resina acr[íi]lica|acrylic resin|peek\b|impress[ãa]o 3d|3d-?print/i],
  ],
  'Odontopediatria': [
    ['Cárie precoce da infância', /c[áa]rie precoce|early childhood caries|\becc\b|c[áa]rie de mamadeira/i],
    ['Pulpotomia e terapia pulpar decídua', /pulpotomia|pulpectomia|terapia pulpar|dente dec[íi]duo.*(polpa|pulpar)|primary (tooth|teeth).*pulp/i],
    ['Traumatismo em dentes decíduos', /trauma.*dec[íi]duo|primary (tooth|teeth).*(trauma|injur)|avuls[ãa]o.*dec[íi]duo/i],
    ['Selantes', /selante|sealant/i],
    ['Mantenedor de espaço', /mantenedor de espa[çc]o|space maintainer/i],
    ['Fluorose', /fluorose|fluorosis/i],
    ['Manejo de comportamento e ansiedade', /ansiedade|anxiety|manejo (de )?comportamento|behavio(u)?r (management|guidance)|medo odontol/i],
    ['Erupção dentária', /erup[çc][ãa]o|eruption/i],
    ['Hábitos orais', /h[áa]bito|chupeta|pacifier|suc[çc][ãa]o digital|thumb sucking|amamenta/i],
    ['Flúor e prevenção', /fl[úu]or|fluoride|verniz|varnish|preven[çc][ãa]o/i],
    ['Anestesia e sedação em odontopediatria', /sedac[ãa]o|sedation|[óo]xido nitroso|nitrous oxide|anestesia geral/i],
    ['Hipomineralização molar-incisivo', /hipomineraliza|\bhmi\b|\bmih\b|molar-?incisor/i],
  ],
  'Radiologia': [
    ['Inteligência artificial em imagem', /intelig[êe]ncia artificial|artificial intelligence|deep learning|machine learning|rede neural|neural network/i],
    ['Tomografia computadorizada de feixe cônico', /feixe c[ôo]nico|cone-? ?beam|\bcbct\b|tomografia/i],
    ['Radiografia periapical digital', /periapical (digital|radiograph)|radiografia periapical|sensor digital/i],
    ['Radiografia panorâmica', /panor[âa]mica|panoramic/i],
    ['Dosimetria e proteção radiológica', /dose|dosimetria|radioprote[çc]|radiation (dose|protection)|\balara\b/i],
    ['Lesão periapical', /les[ãa]o periapical|periapical (lesion|radioluc)/i],
    ['Lesões ósseas dos maxilares', /les[ãa]o [óo]ssea|bone lesion|radioluc[êe]ncia|osteol[íi]tic/i],
    ['Seio maxilar', /seio maxilar|maxillary sinus/i],
    ['Cefalometria', /cefalom[ée]tric|cephalometric/i],
    ['Ultrassonografia e novas modalidades', /ultrassom|ultrassonografia|ultrasound|resson[âa]ncia|\bmri\b/i],
  ],
  'DTM e Dor Orofacial': [
    ['Bruxismo', /bruxismo|bruxism/i],
    ['Placa oclusal', /placa (oclusal|estabilizadora|miorrelaxante)|occlusal splint|f[ée]rula|night ?guard/i],
    ['Disfunção temporomandibular', /disfun[çc][ãa]o temporomandibular|\bdtm\b|\btmd\b|temporomandibular disorder/i],
    ['Artrite e artrose da ATM', /artrite|artrose|osteoartrite|osteoarthritis|arthritis/i],
    ['Dor miofascial', /miofascial|myofascial|ponto-?gatilho|trigger point/i],
    ['Dor orofacial crônica', /dor (orofacial )?cr[ôo]nica|chronic (orofacial )?pain/i],
    ['Toxina botulínica', /toxina botul|botulinum|botox/i],
    ['Artroscopia e cirurgia da ATM', /artroscopia|arthroscop|artrocentese|arthrocentesis|cirurgia da atm/i],
    ['Deslocamento de disco', /deslocamento d[eo] disco|disc displacement/i],
    ['DTM e ortodontia', /(dtm|tmd).*(ortod|orthod)|(ortod|orthod).*(dtm|tmd)/i],
    ['Terapias conservadoras em DTM', /fisioterapia|physical therapy|laser de baixa|photobiomodul|fotobiomodul|acupuntura|counseling/i],
    ['Dor neuropática orofacial', /neurop[áa]tic|neuralgia|trig[êe]min|burning mouth|ard[êe]ncia bucal/i],
  ],
  'Estomatologia': [
    ['Câncer bucal', /c[âa]ncer (bucal|oral|de boca)|oral cancer|carcinoma|\bcec\b|squamous cell/i],
    ['Lesões potencialmente malignas', /potencialmente maligna|potentially malignant|displasia|dysplasia/i],
    ['Líquen plano oral', /l[íi]quen|lichen/i],
    ['Leucoplasia', /leucoplasia|leukoplakia|eritroplasia|erythroplakia/i],
    ['Candidíase oral', /candid[íi]ase|candidiasis|candida/i],
    ['Xerostomia e hipossalivação', /xerostomia|hipossaliva|boca seca|dry mouth|salivary flow/i],
    ['HPV e lesões orais', /\bhpv\b|papiloma|papilloma/i],
    ['Biópsia e diagnóstico', /bi[óo]psia|biopsy|citologia|diagn[óo]stico (de )?les/i],
    ['Manifestações orais de doenças sistêmicas', /manifesta[çc][ãa]o oral|oral manifestation|doen[çc]a sist[êe]mica|l[úu]pus|crohn|hiv/i],
    ['Estomatite aftosa', /afta|aphthous|estomatite/i],
    ['Halitose', /halitose|halitosis|mau h[áa]lito/i],
    ['Medicina oral e oncologia', /oncol[óo]gic|quimioterapia|chemotherapy|radioterapia|radiotherapy|mucosite|mucositis/i],
  ],
};

// Classifica UM artigo: melhor tema da especialidade dele, '' sem match.
// Pontuação: ocorrência no TÍTULO vale 3, no resumo vale 1.
function classificarTema(artigo) {
  const esp = artigo?.especialidade || '';
  const padroes = PADROES[esp];
  if (!padroes) return '';
  const titulo = String(artigo.titulo_pt || artigo.titulo || '');
  const resumo = String(artigo.resumo_pt || '') + ' ' + String(artigo.abstract || '');
  let melhor = '', melhorPts = 0;
  for (const [tema, rx] of padroes) {
    const pts = (rx.test(titulo) ? 3 : 0) + (rx.test(resumo) ? 1 : 0);
    if (pts > melhorPts) { melhor = tema; melhorPts = pts; }
  }
  return melhor;
}

module.exports = { PADROES, classificarTema };

// Coerência com a taxonomia (checada também em teste): todo tema dos padrões
// precisa existir na TAXONOMIA da mesma especialidade.
for (const [esp, lista] of Object.entries(PADROES)) {
  for (const [tema] of lista) {
    if (!temaValido(tema, esp)) throw new Error(`[temas] padrão órfão: "${tema}" não está na TAXONOMIA de ${esp}`);
  }
}
