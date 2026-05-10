// get-themes.js
// Retorna o catalogo completo de temas validados por especialidade.
// Apenas os nomes em PT sao retornados ao frontend.
// Os termos EN ficam somente no backend (daily-articles.js).
// Este endpoint é público (sem autenticacao necessaria).

// CATALOGO COMPLETO: PT display names agrupados por especialidade
// Todos os temas aqui possuem termos EN validos no PubMed (validados em daily-articles.js)
const THEMES_CATALOG = {
  "Ortodontia": [
    "Alinhadores invisíveis",
    "Expansão maxilar",
    "Apinhamento dentário",
    "Biomecânica ortodôntica",
    "Cefalometria",
    "Mini-implantes / TADs",
    "Aparelho fixo",
    "Retenção ortodôntica",
    "Mordida aberta",
    "Mordida cruzada",
    "Classe II ortodôntica",
    "Classe III ortodôntica"
  ],
  "Implantodontia": [
    "Osseointegração",
    "Carga imediata",
    "Enxertos ósseos autógenos",
    "Enxertos com biomateriais",
    "Periimplantite",
    "Implante unitário",
    "All-on-4",
    "Elevação do seio maxilar",
    "Implante imediato"
  ],
  "Periodontia": [
    "Doença periodontal crônica",
    "Periodontite agressiva",
    "Gengivite",
    "Regeneração tecidual guiada",
    "Cirurgia periodontal",
    "Raspagem e alisamento radicular",
    "Recessão gengival",
    "Enxerto gengival",
    "Mobilidade dentária"
  ],
  "Endodontia": [
    "Tratamento de canal convencional",
    "Retratamento endodôntico",
    "Cirurgia perirradicular",
    "Pulpotomia",
    "Instrumentação mecânica",
    "Medicação intracanal",
    "Lesão perirradicular"
  ],
  "Dentística": [
    "Clareamento dental",
    "Facetas de porcelana",
    "Laminados cerâmicos",
    "Resinas compostas nanoparticuladas",
    "Cárie dentária",
    "Adesivos dentários",
    "Selantes de fissura",
    "Sensibilidade dentinária"
  ],
  "Prótese": [
    "Prótese total convencional",
    "Prótese parcial removível",
    "Prótese fixa unitária",
    "Prótese fixa de múltiplos elementos",
    "Prótese sobre implante",
    "Reabilitação oral",
    "Oclusão e ATM",
    "Zircônia"
  ],
  "Bucomaxilofacial": [
    "Cirurgia ortognática",
    "Trauma facial",
    "Fraturas mandibulares",
    "Fraturas do terço médio",
    "Terceiro molar",
    "Cistos e tumores",
    "Extração dental"
  ],
  "Odontopediatria": [
    "Cárie precoce na infância",
    "Pulpotomia em molares decíduos",
    "Traumatismo dental em crianças",
    "Fluorose",
    "Selantes pediátricos",
    "Dentição mista",
    "Hábitos orais",
    "Comportamento infantil na odontologia"
  ],
  "DTM e Dor Orofacial": [
    "Bruxismo do sono",
    "Bruxismo em vigília",
    "Artralgia da ATM",
    "Disfunção temporomandibular",
    "Toxina botulínica",
    "Preenchimento facial"
  ],
  "Radiologia": [
    "CBCT 3D em diagnóstico",
    "Radiografia periapical digital",
    "Panorâmica e suas limitações"
  ]
};

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  "Cache-Control": "public, max-age=3600"
};

exports.handler = async function(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const spec = event.queryStringParameters && event.queryStringParameters.especialidade;

  if (spec) {
    // Return themes for a specific specialty
    const themes = THEMES_CATALOG[spec] || [];
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ especialidade: spec, temas: themes })
    };
  }

  // Return full catalog
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ catalog: THEMES_CATALOG, especialidades: Object.keys(THEMES_CATALOG) })
  };
};
