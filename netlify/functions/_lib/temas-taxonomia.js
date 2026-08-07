// TAXONOMIA DE TEMAS por especialidade (fundador, 08/08) — a linguagem que o
// dentista BUSCA (congressos CFO/ABO/SBPqO + recorrência PubMed + termo
// clínico consagrado, não jargão acadêmico).
//
// Fonte única de verdade do filtro de temas da /biblioteca e da classificação
// (enriquecimento prospectivo + migração retroativa). Cópia JSON de
// referência: docs/taxonomia-temas.json (teste garante sincronia).
//
// Adaptações da lista do fundador às 11 especialidades CANÔNICAS do sistema:
//   • "CIRURGIA" → Bucomaxilofacial;  "ATM / DOR OROFACIAL" → DTM e Dor
//     Orofacial;  "ESTÉTICA" foi distribuída (facetas/clareamento/design do
//     sorriso já vivem em Dentística; HOF/toxina em Bucomaxilofacial e DTM);
//   • Estomatologia (medicina oral) ganhou lista própria — é canônica no
//     sistema e não constava no rascunho.

const TAXONOMIA = {
  'Ortodontia': [
    'Alinhadores invisíveis', 'Ancoragem esquelética e mini-implantes', 'Cirurgia ortognática',
    'Contenção e recidiva', 'Extração vs. não extração', 'Expansão palatina',
    'Classe II', 'Classe III', 'Apinhamento', 'Sobremordida', 'Mordida aberta',
    'Mordida cruzada', 'ATM e ortodontia', 'Surgery-first', 'Biomecânica ortodôntica',
    'Distalização', 'Ortodontia e sono/apneia',
  ],
  'Implantodontia': [
    'Carga imediata', 'Implante em zona estética', 'Peri-implantite', 'Osseointegração',
    'Enxerto ósseo', 'Membranas e ROG', 'Implante unitário', 'Prótese sobre implante',
    'Superfície de implante', 'All-on-four', 'Levantamento de seio maxilar',
    'Reabsorção óssea', 'Implante imediato pós-extração', 'Planejamento digital em implantodontia',
  ],
  'Periodontia': [
    'Raspagem e alisamento radicular', 'Regeneração periodontal', 'Cirurgia mucogengival',
    'Enxerto gengival', 'Recobrimento radicular', 'Peri-implantite', 'Microbioma oral',
    'Antibioticoterapia periodontal', 'Gengivite', 'Periodontite', 'Biótipo e fenótipo gengival',
    'Periodontia e doenças sistêmicas', 'Terapia de suporte periodontal',
  ],
  'Endodontia': [
    'Terapia pulpar vital', 'Retratamento endodôntico', 'Irrigação intracanal',
    'Hipoclorito de sódio', 'Instrumentação mecanizada', 'Obturação do canal',
    'Dor pós-operatória', 'Cirurgia paraendodôntica', 'Traumatismo dentário',
    'MTA e cimentos biocerâmicos', 'Tomografia em endodontia', 'Anestesia em endodontia',
    'Medicação intracanal', 'Regeneração pulpar',
  ],
  'Dentística': [
    'Clareamento dental', 'Resina composta', 'Cerâmicas e laminados', 'Facetas e lentes de contato',
    'Protocolo adesivo', 'Selantes', 'Cárie e remineralização', 'Erosão dental',
    'Hipersensibilidade dentinária', 'Restauração em dentes posteriores', 'Resina bulk fill',
    'Design do sorriso', 'Fluorose', 'Materiais bioativos',
  ],
  'Bucomaxilofacial': [
    'Terceiros molares', 'Enxerto ósseo', 'Medicamentos antirreabsortivos e MRONJ',
    'Cirurgia pré-protética', 'Trauma maxilofacial', 'Cistos e tumores',
    'Cirurgia ortognática', 'Alveolite', 'Anestesia e sedação', 'Harmonização orofacial',
    'Fissuras labiopalatinas', 'Infecções odontogênicas',
  ],
  'Prótese': [
    'CAD/CAM', 'Prótese total', 'Prótese parcial removível', 'Coroa unitária',
    'Overdenture', 'Zircônia', 'Fluxo digital', 'Escaneamento intraoral',
    'Oclusão', 'Reabilitação oral completa', 'Prótese provisória',
    'Prótese sobre implante', 'Cimentação', 'Materiais protéticos',
  ],
  'Odontopediatria': [
    'Cárie precoce da infância', 'Pulpotomia e terapia pulpar decídua', 'Traumatismo em dentes decíduos',
    'Selantes', 'Mantenedor de espaço', 'Fluorose', 'Manejo de comportamento e ansiedade',
    'Erupção dentária', 'Hábitos orais', 'Flúor e prevenção', 'Anestesia e sedação em odontopediatria',
    'Hipomineralização molar-incisivo',
  ],
  'Radiologia': [
    'Tomografia computadorizada de feixe cônico', 'Radiografia periapical digital', 'Radiografia panorâmica',
    'Dosimetria e proteção radiológica', 'Inteligência artificial em imagem', 'Lesão periapical',
    'Lesões ósseas dos maxilares', 'Seio maxilar', 'Cefalometria', 'Ultrassonografia e novas modalidades',
  ],
  'DTM e Dor Orofacial': [
    'Bruxismo', 'Placa oclusal', 'Disfunção temporomandibular', 'Artrite e artrose da ATM',
    'Dor miofascial', 'Dor orofacial crônica', 'Toxina botulínica', 'Artroscopia e cirurgia da ATM',
    'Deslocamento de disco', 'DTM e ortodontia', 'Terapias conservadoras em DTM', 'Dor neuropática orofacial',
  ],
  'Estomatologia': [
    'Câncer bucal', 'Lesões potencialmente malignas', 'Líquen plano oral', 'Leucoplasia',
    'Candidíase oral', 'Xerostomia e hipossalivação', 'HPV e lesões orais', 'Biópsia e diagnóstico',
    'Manifestações orais de doenças sistêmicas', 'Estomatite aftosa', 'Halitose', 'Medicina oral e oncologia',
  ],
};

// Lista plana de temas válidos de uma especialidade ('' quando desconhecida).
function temasDe(especialidade) {
  return TAXONOMIA[especialidade] || [];
}

// true se o tema é válido para a especialidade (comparação exata — a
// classificação SEMPRE escolhe da lista; nada de tema livre).
function temaValido(tema, especialidade) {
  return temasDe(especialidade).includes(String(tema || ''));
}

module.exports = { TAXONOMIA, temasDe, temaValido };
