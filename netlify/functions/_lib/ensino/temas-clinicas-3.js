'use strict';
// Taxonomia de ENSINO — parte 4: Radiologia e imaginologia, Estomatologia,
// Patologia oral e maxilofacial e Saúde coletiva.

module.exports = [
  {
    nome: 'Radiologia odontológica e imaginologia', ciclo: 'clínico', cfo: true,
    descricao: 'Produzir, interpretar e proteger: do periapical à tomografia.',
    modulos: [
      { nome: 'Física e formação da imagem', temas: [
        { nome: 'Raios X', paginas: ['Natureza e propriedades', 'Produção: tubo, ânodo e cátodo', 'Espectro e filtração', 'Interação com a matéria', 'Aparelho odontológico: componentes'] },
        { nome: 'Fatores da imagem', paginas: ['Quilovoltagem, miliamperagem e tempo', 'Densidade e contraste', 'Nitidez e distorção', 'Colimação e distância'] },
        { nome: 'Receptores', paginas: ['Filme e processamento químico', 'Sensores digitais: CCD e CMOS', 'Placas de fósforo', 'Processamento e armazenamento digital', 'Erros de processamento'] },
      ] },
      { nome: 'Radioproteção', temas: [
        { nome: 'Efeitos biológicos', paginas: ['Efeitos determinísticos e estocásticos', 'Dose: unidades', 'Doses dos exames odontológicos comparadas'] },
        { nome: 'Proteção', paginas: ['Princípios: justificação, otimização e limitação', 'Radioproteção baseada em justificação e otimização: seleção do exame, campo e dose', 'ALARA na prática', 'Proteção do paciente: avental e colar exigidos pela RDC 611/2022 e o debate internacional (ADA/AAOMR 2023)', 'Proteção do operador e da sala', 'RDC 611/2022: requisitos para serviços odontológicos', 'Gestantes e crianças', 'Critérios de seleção de exames'] },
      ] },
      { nome: 'Técnicas intrabucais', temas: [
        { nome: 'Periapical', paginas: ['Técnica do paralelismo', 'Técnica da bissetriz', 'Posicionadores', 'Sequência da boca completa', 'Angulações por região'] },
        { nome: 'Interproximal e oclusal', paginas: ['Interproximal: técnica e indicações', 'Oclusal: técnicas superiores e inferiores', 'Indicações'] },
        { nome: 'Técnicas de localização', paginas: ['Clark e paralaxe', 'Técnica de Le Master e Donovan', 'Localização de inclusos e corpos estranhos'] },
        { nome: 'Erros técnicos', paginas: ['Alongamento e encurtamento', 'Sobreposição', 'Corte de cone', 'Dupla exposição e movimento', 'Como corrigir cada um'] },
        { nome: 'Pacientes especiais', paginas: ['Crianças', 'Reflexo de vômito', 'Edêntulos', 'Pacientes com limitação de abertura'] },
      ] },
      { nome: 'Técnicas extrabucais', temas: [
        { nome: 'Panorâmica', paginas: ['Princípio e camada de imagem', 'Posicionamento', 'Anatomia na panorâmica', 'Imagens fantasmas e artefatos', 'Erros de posicionamento', 'Indicações e limitações'] },
        { nome: 'Telerradiografia', paginas: ['Lateral: técnica', 'Frontal', 'Cefalostato e magnificação'] },
        { nome: 'Outras incidências', paginas: ['Waters e Caldwell', 'Towne e Hirtz', 'Incidências para ATM', 'Mão e punho'] },
      ] },
      { nome: 'Tomografia e imagem avançada', temas: [
        { nome: 'Tomografia de feixe cônico', paginas: ['Princípio e aquisição', 'Campo de visão e voxel', 'Reconstruções: axial, coronal, sagital e panorâmica', 'Artefatos', 'Indicações por especialidade', 'Dose e justificação', 'Software e medidas'] },
        { nome: 'Outros exames', paginas: ['Tomografia computadorizada médica', 'Ressonância magnética: ATM e tecidos moles', 'Ultrassonografia', 'Cintilografia e PET', 'Sialografia'] },
      ] },
      { nome: 'Anatomia radiográfica', temas: [
        { nome: 'Intrabucal', paginas: ['Maxila anterior e posterior', 'Mandíbula anterior e posterior', 'Estruturas dentárias', 'Variações da normalidade'] },
        { nome: 'Extrabucal', paginas: ['Panorâmica: estruturas por região', 'Telerradiografia: pontos', 'Seios paranasais'] },
      ] },
      { nome: 'Interpretação', temas: [
        { nome: 'Princípios', paginas: ['Sistemática de leitura', 'Descrição de lesões: localização, forma, limites e conteúdo', 'Radiolúcido, radiopaco e misto', 'Efeitos sobre estruturas vizinhas'] },
        { nome: 'Cárie e periodonto', paginas: ['Cárie: interproximal e oclusal', 'Cárie adjacente a restaurações (secundária) e radicular', 'Perda óssea horizontal e vertical', 'Cálculo e furcas'] },
        { nome: 'Alterações pulpares e periapicais', paginas: ['Calcificações e reabsorções', 'Lesões periapicais', 'Osteíte condensante'] },
        { nome: 'Anomalias dentárias', paginas: ['Número, tamanho e forma', 'Estrutura', 'Erupção e posição'] },
        { nome: 'Cistos e tumores', paginas: ['Padrões radiográficos dos cistos', 'Tumores odontogênicos', 'Lesões fibro-ósseas', 'Lesões malignas'] },
        { nome: 'Trauma, infecção e sistêmicas', paginas: ['Fraturas', 'Osteomielite e osteonecrose', 'Doenças sistêmicas no osso maxilar'] },
        { nome: 'Calcificações e seios', paginas: ['Calcificações de tecidos moles', 'Sialolitos', 'Sinusite e lesões do seio'] },
        { nome: 'ATM na imagem', paginas: ['Anatomia normal', 'Alterações degenerativas', 'Disco na ressonância'] },
      ] },
      { nome: 'Laudo e gestão', temas: [
        { nome: 'Laudo radiológico', paginas: ['Estrutura do laudo', 'Como descrever uma lesão', 'Modelos', 'Responsabilidade legal'] },
        { nome: 'Clínica de radiologia', paginas: ['Montagem e legislação', 'Controle de qualidade', 'Armazenamento e LGPD'] },
      ] },
    ],
  },
  {
    nome: 'Estomatologia', ciclo: 'clínico', cfo: true,
    descricao: 'Diagnosticar as doenças da boca: da afta ao câncer.',
    modulos: [
      { nome: 'Método diagnóstico', temas: [
        { nome: 'Exame', paginas: ['Anamnese em estomatologia', 'Exame extraoral e linfonodos', 'Exame intraoral sistemático', 'Exame das glândulas salivares'] },
        { nome: 'Lesões fundamentais', paginas: ['Mácula e mancha', 'Pápula, nódulo e placa', 'Vesícula, bolha e pústula', 'Erosão, úlcera e fissura', 'Como descrever uma lesão'] },
        { nome: 'Exames complementares', paginas: ['Biópsia incisional e excisional: técnica', 'Citologia esfoliativa', 'Punção aspirativa', 'Exames laboratoriais', 'Azul de toluidina e autofluorescência', 'Requisição para o patologista'] },
        { nome: 'Variações da normalidade', paginas: ['Grânulos de Fordyce e leucoedema', 'Linha alba e morsicatio', 'Língua geográfica, fissurada e pilosa', 'Tórus e exostoses', 'Varizes linguais', 'Pigmentação fisiológica'] },
      ] },
      { nome: 'Infecções', temas: [
        { nome: 'Fúngicas', paginas: ['Candidíase pseudomembranosa', 'Candidíase eritematosa e estomatite protética', 'Queilite angular', 'Candidíase hiperplásica', 'Micoses profundas: paracoccidioidomicose'] },
        { nome: 'Virais', paginas: ['Herpes simples primário e recorrente', 'Varicela e herpes-zóster', 'Papiloma, verruga e condiloma', 'Mononucleose e citomegalovírus', 'Herpangina e doença mão-pé-boca', 'HIV: manifestações orais'] },
        { nome: 'Bacterianas', paginas: ['Sífilis: estágios', 'Tuberculose', 'Actinomicose', 'Gengivite necrosante', 'Escarlatina e outras'] },
      ] },
      { nome: 'Lesões ulceradas e vesicobolhosas', temas: [
        { nome: 'Úlceras', paginas: ['Úlcera traumática', 'Estomatite aftosa recorrente: tipos e tratamento', 'Doença de Behçet', 'Úlceras por medicamentos e radioterapia'] },
        { nome: 'Doenças vesicobolhosas', paginas: ['Pênfigo vulgar', 'Penfigoide das membranas mucosas', 'Eritema multiforme', 'Epidermólise bolhosa', 'Diagnóstico diferencial e imunofluorescência'] },
      ] },
      { nome: 'Lesões brancas, vermelhas e pigmentadas', temas: [
        { nome: 'Lesões brancas', paginas: ['Leucoplasia: tipos e conduta', 'Líquen plano oral', 'Reações liquenoides', 'Leucoplasia pilosa', 'Nevo branco esponjoso', 'Queratose friccional'] },
        { nome: 'Lesões vermelhas', paginas: ['Eritroplasia', 'Candidíase eritematosa', 'Glossite e deficiências nutricionais', 'Lúpus eritematoso'] },
        { nome: 'Lesões pigmentadas', paginas: ['Mácula melanótica', 'Nevo e melanoma', 'Tatuagem por amálgama', 'Pigmentação por medicamentos e doenças sistêmicas'] },
      ] },
      { nome: 'Câncer de boca', temas: [
        { nome: 'Epidemiologia e fatores de risco', paginas: ['Números no Brasil', 'Tabaco, álcool e HPV', 'Exposição solar e lábio'] },
        { nome: 'Desordens potencialmente malignas', paginas: ['Leucoplasia e eritroplasia', 'Queilite actínica', 'Fibrose submucosa', 'Acompanhamento'] },
        { nome: 'Carcinoma espinocelular', paginas: ['Apresentação clínica por sítio', 'Diagnóstico precoce: o que olhar', 'Estadiamento TNM', 'Tratamento: cirurgia, radio e quimioterapia', 'Prognóstico'] },
        { nome: 'Outros tumores malignos', paginas: ['Tumores de glândula salivar', 'Linfomas', 'Sarcomas e metástases'] },
        { nome: 'O paciente oncológico', paginas: ['Adequação bucal antes do tratamento', 'Mucosite', 'Xerostomia e cárie de radiação', 'Osteorradionecrose', 'Trismo e disfagia', 'Reabilitação'] },
      ] },
      { nome: 'Glândulas salivares', temas: [
        { nome: 'Alterações de fluxo', paginas: ['Xerostomia: causas e manejo', 'Sialorreia', 'Síndrome de Sjögren'] },
        { nome: 'Lesões', paginas: ['Mucocele e rânula', 'Sialolitíase', 'Sialadenites', 'Tumores benignos e malignos: sinais'] },
      ] },
      { nome: 'Lesões proliferativas e tumores benignos', temas: [
        { nome: 'Lesões reacionais', paginas: ['Hiperplasia fibrosa inflamatória', 'Granuloma piogênico', 'Lesão periférica de células gigantes', 'Fibroma ossificante periférico', 'Hiperplasia papilar'] },
        { nome: 'Tumores benignos', paginas: ['Lipoma, hemangioma e linfangioma', 'Neurofibroma e schwannoma', 'Tumor de células granulares'] },
      ] },
      { nome: 'Manifestações de doenças sistêmicas', temas: [
        { nome: 'Sistêmicas na boca', paginas: ['Diabetes', 'Anemias e leucemias', 'Doenças gastrointestinais', 'Doenças renais e hepáticas', 'Endocrinopatias', 'Doenças autoimunes e dermatológicas', 'Reações a medicamentos'] },
        { nome: 'Dor e sensações', paginas: ['Síndrome da ardência bucal', 'Disgeusia', 'Halitose'] },
      ] },
      { nome: 'Lesões ósseas e dos maxilares', temas: [
        { nome: 'Clínica das lesões ósseas', paginas: ['Cistos: apresentação e conduta', 'Tumores odontogênicos: sinais', 'Lesões fibro-ósseas', 'Osteonecrose por medicamentos'] },
      ] },
    ],
  },
  {
    nome: 'Patologia oral e maxilofacial', ciclo: 'clínico', cfo: true,
    descricao: 'O que a lesão é por dentro: histopatologia das doenças da boca e dos maxilares.',
    modulos: [
      { nome: 'Método', temas: [
        { nome: 'Do espécime ao laudo', paginas: ['Fixação e envio', 'Processamento e cortes', 'Colorações e imunoistoquímica', 'Laudo histopatológico: como ler', 'Correlação clínico-patológica'] },
      ] },
      { nome: 'Alterações de desenvolvimento', temas: [
        { nome: 'Dos dentes', paginas: ['Anomalias de número, tamanho e forma', 'Amelogênese imperfeita', 'Dentinogênese imperfeita e displasias', 'Hipoplasias e fluorose', 'Alterações de erupção'] },
        { nome: 'Da face e da boca', paginas: ['Fissuras', 'Cistos de desenvolvimento não odontogênicos', 'Anomalias da língua e dos lábios'] },
      ] },
      { nome: 'Patologia pulpar e periapical', temas: [
        { nome: 'Polpa', paginas: ['Pulpite: histopatologia', 'Necrose', 'Calcificações e reabsorção interna'] },
        { nome: 'Periápice', paginas: ['Granuloma periapical', 'Cisto periapical e residual', 'Abscesso e celulite', 'Osteíte condensante'] },
      ] },
      { nome: 'Cistos', temas: [
        { nome: 'Cistos odontogênicos', paginas: ['Cisto dentígero', 'Cisto de erupção', 'Ceratocisto odontogênico', 'Cisto periodontal lateral e botrioide', 'Cisto gengival', 'Cisto odontogênico glandular', 'Cisto odontogênico calcificante'] },
        { nome: 'Cistos não odontogênicos', paginas: ['Cisto do ducto nasopalatino', 'Cisto nasolabial', 'Pseudocistos: ósseo traumático e aneurismático', 'Cistos dermoide e branquial'] },
      ] },
      { nome: 'Tumores odontogênicos', temas: [
        { nome: 'Epiteliais', paginas: ['Classificação da OMS 2022 (5ª edição): o que mudou', 'Ameloblastoma: tipos', 'Tumor odontogênico adenomatoide', 'Tumor odontogênico epitelial calcificante', 'Tumor odontogênico escamoso'] },
        { nome: 'Mistos e mesenquimais', paginas: ['Odontoma', 'Fibroma ameloblástico', 'Mixoma odontogênico', 'Cementoblastoma', 'Fibroma odontogênico'] },
        { nome: 'Malignos', paginas: ['Carcinomas odontogênicos', 'Sarcomas odontogênicos'] },
      ] },
      { nome: 'Lesões ósseas', temas: [
        { nome: 'Fibro-ósseas', paginas: ['Displasia fibrosa', 'Displasia cemento-óssea', 'Fibroma ossificante'] },
        { nome: 'Células gigantes e outras', paginas: ['Lesão central de células gigantes', 'Querubismo', 'Tumor marrom do hiperparatireoidismo', 'Doença de Paget', 'Osteomas e síndrome de Gardner'] },
        { nome: 'Inflamatórias e necrose', paginas: ['Osteomielite aguda e crônica', 'Osteorradionecrose', 'Osteonecrose por medicamentos'] },
        { nome: 'Tumores ósseos', paginas: ['Osteossarcoma', 'Condrossarcoma', 'Sarcoma de Ewing', 'Metástases'] },
      ] },
      { nome: 'Patologia dos tecidos moles', temas: [
        { nome: 'Lesões reacionais', paginas: ['Hiperplasia fibrosa', 'Granuloma piogênico', 'Lesão periférica de células gigantes', 'Fibroma ossificante periférico'] },
        { nome: 'Tumores de tecidos moles', paginas: ['Lipoma', 'Tumores vasculares', 'Tumores neurais', 'Tumores musculares', 'Sarcomas de tecidos moles'] },
        { nome: 'Epitélio', paginas: ['Papiloma e lesões por HPV', 'Displasia epitelial: graduação', 'Carcinoma in situ', 'Carcinoma espinocelular: histologia e graduação', 'Carcinoma verrucoso', 'Melanoma'] },
      ] },
      { nome: 'Glândulas salivares', temas: [
        { nome: 'Não neoplásicas', paginas: ['Mucocele e rânula', 'Sialadenites', 'Sialometaplasia necrosante', 'Síndrome de Sjögren: histologia'] },
        { nome: 'Tumores', paginas: ['Adenoma pleomórfico', 'Tumor de Warthin', 'Carcinoma mucoepidermoide', 'Carcinoma adenoide cístico', 'Outros carcinomas'] },
      ] },
      { nome: 'Doenças dermatológicas, autoimunes e hematológicas', temas: [
        { nome: 'Mucocutâneas', paginas: ['Líquen plano', 'Pênfigo e penfigoide', 'Lúpus', 'Eritema multiforme'] },
        { nome: 'Hematológicas e outras', paginas: ['Leucemias e linfomas', 'Histiocitose de células de Langerhans', 'Anemias', 'Amiloidose'] },
      ] },
      { nome: 'Patologia do periodonto e periimplantar', temas: [
        { nome: 'Histopatologia periodontal', paginas: ['Gengivite: estágios histológicos', 'Periodontite: bolsa e perda de inserção', 'Lesões gengivais não induzidas por biofilme', 'Aumentos gengivais: hiperplasia medicamentosa e fibromatose'] },
        { nome: 'Periimplantar', paginas: ['Mucosite e periimplantite: histologia', 'Reação a corpo estranho'] },
      ] },
      { nome: 'Infecções na histopatologia', temas: [
        { nome: 'Fúngicas, virais e bacterianas', paginas: ['Candidíase e micoses profundas na lâmina', 'Alterações citopáticas virais', 'Granulomas infecciosos: tuberculose e sífilis', 'Actinomicose'] },
      ] },
    ],
  },
  {
    nome: 'Saúde coletiva', ciclo: 'clínico', cfo: true,
    descricao: 'O SUS, a epidemiologia e a saúde bucal da população.',
    modulos: [
      { nome: 'Sistema Único de Saúde', temas: [
        { nome: 'História e bases', paginas: ['Reforma sanitária e Constituição de 1988', 'Leis 8.080 e 8.142', 'Princípios e diretrizes', 'Controle social e conselhos'] },
        { nome: 'Organização', paginas: ['Níveis de atenção', 'Redes de atenção à saúde', 'Regionalização e pactuação', 'Financiamento'] },
        { nome: 'Atenção primária', paginas: ['Estratégia Saúde da Família', 'Equipe de saúde bucal: composição e atribuições', 'Territorialização', 'Acolhimento e classificação de risco', 'Visita domiciliar'] },
      ] },
      { nome: 'Política de saúde bucal', temas: [
        { nome: 'Política Nacional de Saúde Bucal', paginas: ['Brasil Sorridente e a Lei 14.572/2023: a política virou lei', 'Centros de Especialidades Odontológicas', 'Laboratórios regionais de prótese', 'Unidades odontológicas móveis', 'Fluoretação das águas'] },
        { nome: 'Programas e ações', paginas: ['Saúde na escola', 'Atenção à gestante e ao bebê', 'Saúde bucal do idoso e de pessoas com deficiência', 'Populações vulneráveis e indígenas'] },
      ] },
      { nome: 'Epidemiologia', temas: [
        { nome: 'Fundamentos', paginas: ['Conceitos: prevalência, incidência e risco', 'Medidas de associação', 'Desenhos de estudo epidemiológico', 'Vigilância em saúde'] },
        { nome: 'Epidemiologia em saúde bucal', paginas: ['Índices: CPO-D e ceo-d', 'Índice periodontal comunitário', 'Índices de fluorose, oclusão e edentulismo', 'SB Brasil 2023: principais resultados e implicações', 'Série histórica: SB Brasil 2003, 2010 e 2023', 'Como fazer um levantamento', 'Calibração de examinadores'] },
        { nome: 'Determinantes sociais', paginas: ['Modelo de determinação social', 'Desigualdades em saúde bucal', 'Fatores de risco comuns'] },
      ] },
      { nome: 'Promoção e educação em saúde', temas: [
        { nome: 'Promoção da saúde', paginas: ['Carta de Ottawa e conceitos', 'Prevenção: níveis', 'Estratégias populacionais e de alto risco'] },
        { nome: 'Educação em saúde', paginas: ['Métodos e materiais', 'Grupos e escolas', 'Comunicação em saúde', 'Avaliação de programas educativos'] },
        { nome: 'Fluoretação e políticas preventivas', paginas: ['Fluoretação: evidência e vigilância', 'Dentifrício fluoretado como política', 'Açúcar: políticas'] },
      ] },
      { nome: 'Planejamento e gestão', temas: [
        { nome: 'Planejamento em saúde', paginas: ['Diagnóstico situacional', 'Planejamento estratégico situacional', 'Metas e indicadores', 'Avaliação'] },
        { nome: 'Gestão do serviço', paginas: ['Processo de trabalho da equipe', 'Sistemas de informação: e-SUS', 'Financiamento e indicadores da Atenção Primária: modelo vigente (Portaria 3.493/2024) e o que substituiu', 'Auditoria e regulação'] },
        { nome: 'Trabalho em equipe', paginas: ['Auxiliar e técnico em saúde bucal', 'Interprofissionalidade', 'Educação permanente'] },
      ] },
      { nome: 'Saúde bucal por ciclo de vida', temas: [
        { nome: 'Gestante e primeira infância', paginas: ['Pré-natal odontológico', 'Puericultura e primeiros anos', 'Cárie precoce como problema coletivo'] },
        { nome: 'Escolar e adolescente', paginas: ['Programas escolares', 'Adolescência e vulnerabilidades'] },
        { nome: 'Adulto e idoso', paginas: ['Trabalhador e acesso', 'Idoso e edentulismo como problema coletivo', 'Pessoas com deficiência'] },
      ] },
      { nome: 'Pesquisa em saúde coletiva', temas: [
        { nome: 'Métodos', paginas: ['Pesquisa quantitativa e qualitativa', 'Avaliação de serviços', 'Análise de dados secundários: DATASUS'] },
        { nome: 'Temas atuais', paginas: ['Saúde bucal e pandemias', 'Fluoretação e desinformação', 'Açúcar, ultraprocessados e políticas'] },
      ] },
      { nome: 'Odontologia e sociedade', temas: [
        { nome: 'Profissão', paginas: ['Mercado de trabalho e distribuição', 'Odontologia suplementar e planos', 'Bioética e saúde coletiva'] },
        { nome: 'Legislação sanitária', paginas: ['Vigilância sanitária', 'Normas para consultórios', 'Notificação compulsória'] },
      ] },
    ],
  },
];
