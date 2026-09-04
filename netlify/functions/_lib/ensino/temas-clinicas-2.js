'use strict';
// Taxonomia de ENSINO — parte 3: Cirurgia e traumatologia bucomaxilofacial,
// Implantodontia, Odontopediatria e Ortodontia.

module.exports = [
  {
    nome: 'Cirurgia e traumatologia bucomaxilofacial', ciclo: 'clínico', cfo: true,
    descricao: 'Da exodontia simples às fraturas de face.',
    modulos: [
      { nome: 'Princípios', temas: [
        { nome: 'Avaliação pré-operatória', paginas: ['Anamnese cirúrgica', 'Exames laboratoriais e imagem', 'Classificação de risco', 'Consentimento e planejamento'] },
        { nome: 'Pacientes de risco', paginas: ['Anticoagulados e antiagregados', 'Diabéticos', 'Cardiopatas e hipertensos', 'Gestantes', 'Bifosfonatos e osteonecrose', 'Irradiados', 'Imunossuprimidos'] },
        { nome: 'Instrumental', paginas: ['Diérese: bisturis e tesouras', 'Fórceps: numeração e usos', 'Alavancas', 'Afastadores e pinças', 'Sindesmótomos e curetas', 'Síntese: porta-agulhas e fios'] },
        { nome: 'Técnica cirúrgica básica', paginas: ['Assepsia e paramentação', 'Incisões: princípios', 'Retalhos: tipos e desenho', 'Osteotomia e irrigação', 'Hemostasia', 'Suturas: fios e pontos'] },
        { nome: 'Reparo e pós-operatório', paginas: ['Cicatrização de tecidos moles e osso', 'Medicação pós-operatória', 'Orientações', 'Retorno e remoção de sutura'] },
      ] },
      { nome: 'Exodontia', temas: [
        { nome: 'Fundamentos', paginas: ['Indicações e contraindicações', 'Princípios mecânicos', 'Posição do operador e do paciente', 'Sindesmotomia e luxação'] },
        { nome: 'Técnica com fórceps', paginas: ['Incisivos e caninos superiores', 'Pré-molares superiores', 'Molares superiores', 'Anteriores e pré-molares inferiores', 'Molares inferiores'] },
        { nome: 'Alavancas e raízes', paginas: ['Princípios das alavancas', 'Remoção de raízes residuais', 'Odontossecção', 'Quando abrir retalho'] },
        { nome: 'Exodontia em situações especiais', paginas: ['Decíduos', 'Múltiplas e alveoloplastia', 'Dentes anquilosados', 'Exodontia com preservação alveolar'] },
      ] },
      { nome: 'Dentes inclusos', temas: [
        { nome: 'Terceiros molares', paginas: ['Indicações de remoção e evidência', 'Classificações de Pell-Gregory e Winter', 'Avaliação radiográfica e relação com o canal', 'Técnica: inferiores', 'Técnica: superiores', 'Coronectomia'] },
        { nome: 'Caninos e outros inclusos', paginas: ['Localização', 'Exposição para tracionamento', 'Remoção cirúrgica', 'Supranumerários'] },
      ] },
      { nome: 'Acidentes e complicações', temas: [
        { nome: 'Transoperatórias', paginas: ['Fratura radicular e de tábua óssea', 'Fratura de tuberosidade', 'Deslocamento de raiz para seio ou espaço', 'Comunicação bucossinusal', 'Lesão nervosa', 'Hemorragia', 'Luxação de ATM'] },
        { nome: 'Pós-operatórias', paginas: ['Alveolite', 'Infecção', 'Trismo e edema', 'Parestesia: conduta', 'Hemorragia tardia'] },
      ] },
      { nome: 'Infecções', temas: [
        { nome: 'Infecções odontogênicas', paginas: ['Fisiopatologia e estágios', 'Espaços fasciais', 'Princípios de tratamento', 'Drenagem intra e extraoral', 'Antibioticoterapia', 'Quando internar'] },
        { nome: 'Infecções específicas', paginas: ['Pericoronarite', 'Osteomielite', 'Sinusite odontogênica', 'Angina de Ludwig', 'Fasciíte necrosante'] },
      ] },
      { nome: 'Cirurgia pré-protética e de tecidos moles', temas: [
        { nome: 'Cirurgia pré-protética', paginas: ['Alveoloplastia', 'Exostoses e tórus', 'Tuberosidade e rebordo em lâmina', 'Aprofundamento de sulco', 'Hiperplasias'] },
        { nome: 'Tecidos moles', paginas: ['Frenectomia labial e lingual', 'Biópsia: incisional e excisional', 'Mucocele e rânula', 'Fibromas e lesões reacionais'] },
      ] },
      { nome: 'Cistos e tumores', temas: [
        { nome: 'Cistos', paginas: ['Diagnóstico e imagem', 'Enucleação', 'Marsupialização e descompressão', 'Ceratocisto: conduta'] },
        { nome: 'Tumores', paginas: ['Tumores odontogênicos: conduta por tipo', 'Ameloblastoma: ressecção × conservador', 'Lesões de células gigantes', 'Reconstrução após ressecção'] },
      ] },
      { nome: 'Cirurgia periapical e endodôntica', temas: [
        { nome: 'Cirurgia periapical', paginas: ['Indicações', 'Apicectomia e obturação retrógrada', 'Reimplante intencional', 'Hemissecção e amputação radicular'] },
      ] },
      { nome: 'Traumatologia', temas: [
        { nome: 'Atendimento inicial', paginas: ['Avaliação primária e secundária', 'Vias aéreas e hemorragia', 'Exame da face', 'Imagem no trauma'] },
        { nome: 'Fraturas de mandíbula', paginas: ['Classificação e sítios', 'Sinais e diagnóstico', 'Redução fechada e bloqueio', 'Fixação interna rígida', 'Fraturas de côndilo', 'Complicações'] },
        { nome: 'Fraturas do terço médio', paginas: ['Le Fort I, II e III', 'Zigomático e arco', 'Naso-órbito-etmoidal', 'Fraturas orbitárias', 'Nasais'] },
        { nome: 'Trauma dentoalveolar e tecidos moles', paginas: ['Fraturas alveolares', 'Reimplante e contenção', 'Lacerações e sutura estética'] },
      ] },
      { nome: 'Cirurgia ortognática e deformidades', temas: [
        { nome: 'Deformidades dentofaciais', paginas: ['Diagnóstico e análise facial', 'Cefalometria cirúrgica', 'Planejamento virtual', 'Preparo ortodôntico'] },
        { nome: 'Técnicas', paginas: ['Osteotomia Le Fort I', 'Osteotomia sagital do ramo', 'Mentoplastia', 'Cirurgia segmentar', 'Distração osteogênica', 'Pós-operatório e estabilidade'] },
        { nome: 'Fissuras labiopalatinas', paginas: ['Classificação', 'Protocolo por idade', 'Enxerto alveolar secundário', 'Equipe multiprofissional'] },
      ] },
      { nome: 'ATM e glândulas', temas: [
        { nome: 'Cirurgia da ATM', paginas: ['Luxação: redução e tratamento', 'Anquilose', 'Artrocentese e artroscopia', 'Cirurgia aberta e prótese de ATM'] },
        { nome: 'Glândulas salivares', paginas: ['Sialolitíase: remoção', 'Sialoendoscopia', 'Tumores: princípios'] },
      ] },
      { nome: 'Implantes e reconstrução', temas: [
        { nome: 'Reconstrução óssea', paginas: ['Enxertos autógenos: áreas doadoras', 'Enxerto de calota e crista ilíaca', 'Biomateriais e membranas', 'Reconstrução microcirúrgica: noções'] },
      ] },
      { nome: 'Anestesia e ambiente hospitalar', temas: [
        { nome: 'Sedação e anestesia geral', paginas: ['Indicações', 'Avaliação pré-anestésica', 'Intubação nasotraqueal', 'Recuperação'] },
        { nome: 'Rotina hospitalar', paginas: ['Internação e prescrição', 'Evolução', 'Alta'] },
      ] },
    ],
  },
  {
    nome: 'Implantodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Planejar, instalar e reabilitar implantes com previsibilidade.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Osseointegração', paginas: ['Histórico e conceito', 'Histologia da interface', 'Estabilidade primária e secundária', 'Fatores que interferem'] },
        { nome: 'Implantes', paginas: ['Macrogeometria e roscas', 'Superfícies', 'Conexões: hexágono externo, interno e cone morse', 'Plataforma switching', 'Implantes curtos, estreitos e zigomáticos'] },
        { nome: 'Biologia dos tecidos periimplantares', paginas: ['Osso: qualidade e quantidade', 'Mucosa periimplantar', 'Inserção tecidual supracrestal ao redor do implante'] },
      ] },
      { nome: 'Planejamento', temas: [
        { nome: 'Avaliação', paginas: ['Anamnese e fatores de risco', 'Exame clínico', 'Tomografia: leitura', 'Classificação do rebordo', 'Contraindicações'] },
        { nome: 'Planejamento reverso', paginas: ['Enceramento e guia', 'Posição tridimensional ideal', 'Distâncias mínimas', 'Número e distribuição de implantes'] },
        { nome: 'Planejamento digital', paginas: ['Software de planejamento', 'Guia cirúrgico impresso', 'Cirurgia guiada: fluxo completo', 'Navegação'] },
      ] },
      { nome: 'Cirurgia', temas: [
        { nome: 'Técnica básica', paginas: ['Instrumental e kit cirúrgico', 'Retalho e sem retalho', 'Protocolo de fresagem', 'Torque de inserção', 'Um e dois estágios', 'Sutura e pós-operatório'] },
        { nome: 'Momento da instalação', paginas: ['Implante imediato: critérios', 'Precoce e tardio', 'Preservação alveolar'] },
        { nome: 'Carga', paginas: ['Carga imediata: critérios', 'Carga precoce e convencional', 'Provisórios sobre implante'] },
        { nome: 'Cirurgia em regiões especiais', paginas: ['Zona estética', 'Posterior de mandíbula e nervo', 'Posterior de maxila e seio', 'Paciente edêntulo total'] },
      ] },
      { nome: 'Enxertos e regeneração', temas: [
        { nome: 'Biomateriais', paginas: ['Autógeno, alógeno, xenógeno e sintético', 'Membranas', 'Fatores de crescimento e concentrados plaquetários'] },
        { nome: 'Técnicas', paginas: ['Regeneração óssea guiada', 'Enxerto em bloco', 'Levantamento de seio: janela lateral', 'Levantamento de seio: via crestal', 'Expansão e split crest', 'Distração'] },
        { nome: 'Tecidos moles', paginas: ['Enxerto de conjuntivo ao redor de implantes', 'Aumento de mucosa queratinizada', 'Manejo estético de papila'] },
      ] },
      { nome: 'Prótese sobre implante', temas: [
        { nome: 'Componentes e moldagem', paginas: ['Pilares: tipos', 'Moldagem aberta e fechada', 'Escaneamento', 'Verificação de passividade'] },
        { nome: 'Reabilitações', paginas: ['Unitária cimentada e parafusada', 'Parcial', 'Protocolo: planejamento e execução', 'Overdenture: sistemas', 'All-on-four: conceito'] },
        { nome: 'Oclusão e manutenção', paginas: ['Oclusão em implantes', 'Torque e afrouxamento', 'Manutenção e higiene'] },
      ] },
      { nome: 'Complicações', temas: [
        { nome: 'Cirúrgicas', paginas: ['Lesão nervosa', 'Perfuração do seio', 'Hemorragia', 'Falha precoce'] },
        { nome: 'Biológicas', paginas: ['Mucosite', 'Periimplantite: diagnóstico e tratamento', 'Fatores de risco'] },
        { nome: 'Mecânicas e estéticas', paginas: ['Fratura de componentes', 'Falha de cimento e afrouxamento', 'Recessão e perda de papila', 'Remoção de implantes'] },
      ] },
      { nome: 'Zona estética', temas: [
        { nome: 'Planejamento estético', paginas: ['Fatores de risco estético', 'Linha do sorriso e fenótipo', 'Posição do implante na zona estética', 'Momento da instalação no anterior'] },
        { nome: 'Tecidos e provisórios', paginas: ['Condicionamento gengival com provisório', 'Enxertos de conjuntivo no anterior', 'Perfil de emergência personalizado', 'Transferência do perfil ao laboratório'] },
      ] },
      { nome: 'Implantodontia digital', temas: [
        { nome: 'Fluxo digital', paginas: ['Tomografia e escaneamento: fusão', 'Planejamento protético-cirúrgico virtual', 'Guias: tipos e precisão', 'Prótese imediata pré-fabricada'] },
        { nome: 'Cirurgia guiada na prática', paginas: ['Protocolo passo a passo', 'Erros e limites', 'Navegação dinâmica'] },
      ] },
      { nome: 'Farmacologia e pacientes de risco', temas: [
        { nome: 'Medicação em implantodontia', paginas: ['Profilaxia antibiótica: evidência', 'Analgesia e anti-inflamatórios', 'Antissépticos no pós-operatório'] },
        { nome: 'Pacientes de risco', paginas: ['Fumantes', 'Diabéticos', 'Antirreabsortivos e osteonecrose', 'Irradiados', 'Bruxismo e sobrecarga'] },
      ] },
      { nome: 'Manutenção', temas: [
        { nome: 'Programa de manutenção', paginas: ['Intervalos e o que avaliar', 'Instrumentação ao redor de implantes', 'Higiene do paciente com prótese sobre implante', 'Radiografias de controle'] },
      ] },
    ],
  },
  {
    nome: 'Odontopediatria', ciclo: 'clínico', cfo: true,
    descricao: 'Atender a criança: comportamento, prevenção, dente decíduo e trauma.',
    modulos: [
      { nome: 'A criança e a família', temas: [
        { nome: 'Desenvolvimento', paginas: ['Fases do desenvolvimento físico e psicológico', 'Desenvolvimento da dentição', 'Crescimento craniofacial na infância'] },
        { nome: 'Manejo do comportamento', paginas: ['Classificação do comportamento', 'Dizer-mostrar-fazer e outras técnicas básicas', 'Reforço positivo e distração', 'Controle de voz e mão sobre a boca', 'Estabilização protetora', 'Presença dos pais', 'Sedação e anestesia geral: quando'] },
        { nome: 'Ansiedade e dor', paginas: ['Medo odontológico na criança', 'Escalas', 'Anestesia sem trauma'] },
      ] },
      { nome: 'Odontologia para bebês', temas: [
        { nome: 'Primeira consulta', paginas: ['Quando e como', 'Orientação aos pais', 'Exame joelho a joelho'] },
        { nome: 'Amamentação e hábitos', paginas: ['Amamentação e saúde bucal', 'Mamadeira e cárie precoce', 'Chupeta e dedo', 'Freio lingual e anquiloglossia'] },
        { nome: 'Cárie precoce da infância', paginas: ['Definição e etiologia', 'Diagnóstico', 'Tratamento e controle', 'Prevenção'] },
        { nome: 'Alterações no bebê', paginas: ['Dentes natais e neonatais', 'Cistos de erupção', 'Erupção: sintomas e mitos'] },
      ] },
      { nome: 'Prevenção', temas: [
        { nome: 'Flúor e dieta na infância', paginas: ['Dentifrício por idade', 'Verniz e aplicação profissional', 'Fluorose: prevenção', 'Orientação de dieta'] },
        { nome: 'Selantes e higiene', paginas: ['Selantes em decíduos e permanentes', 'Higiene por faixa etária', 'Escovação supervisionada'] },
        { nome: 'Risco e programas', paginas: ['Avaliação de risco na criança', 'Programas escolares e coletivos'] },
      ] },
      { nome: 'Diagnóstico e imagem', temas: [
        { nome: 'Exame da criança', paginas: ['Anamnese com os pais', 'Exame clínico', 'Radiografias em odontopediatria: indicações e técnicas', 'Diagnóstico de cárie em decíduos'] },
      ] },
      { nome: 'Dentística em decíduos', temas: [
        { nome: 'Fundamentos', paginas: ['Particularidades do decíduo', 'Isolamento na criança', 'Materiais para decíduos'] },
        { nome: 'Técnicas', paginas: ['Restaurações em resina e ionômero', 'Coroas de aço: indicação e técnica', 'Coroas de zircônia e estéticas', 'Tratamento restaurador atraumático', 'Técnica de Hall', 'Diamino fluoreto de prata'] },
      ] },
      { nome: 'Terapia pulpar', temas: [
        { nome: 'Diagnóstico pulpar na criança', paginas: ['Sinais e sintomas', 'Testes: limitações', 'Radiografia'] },
        { nome: 'Decíduos', paginas: ['Proteção pulpar', 'Pulpotomia: materiais e técnica', 'Pulpectomia: instrumentação e obturação', 'Materiais obturadores reabsorvíveis', 'Quando extrair'] },
        { nome: 'Permanentes jovens', paginas: ['Capeamento e pulpotomia', 'Apicificação', 'Revascularização'] },
      ] },
      { nome: 'Cirurgia e anestesia', temas: [
        { nome: 'Anestesia na criança', paginas: ['Doses por peso', 'Técnicas', 'Prevenção de mordida'] },
        { nome: 'Cirurgia', paginas: ['Exodontia de decíduos', 'Supranumerários', 'Frenectomia', 'Ulectomia'] },
      ] },
      { nome: 'Oclusão e interceptação', temas: [
        { nome: 'Desenvolvimento da oclusão', paginas: ['Dentição decídua: espaços e planos terminais', 'Dentição mista: fases', 'Fase do patinho feio', 'Análise de espaço'] },
        { nome: 'Manutenção de espaço', paginas: ['Perda precoce: consequências', 'Mantenedores fixos e removíveis', 'Recuperadores de espaço', 'Extração seriada: noções'] },
        { nome: 'Interceptação', paginas: ['Mordida cruzada anterior e posterior', 'Hábitos: intervenção', 'Aparelhos removíveis simples', 'Quando encaminhar'] },
      ] },
      { nome: 'Trauma e alterações', temas: [
        { nome: 'Trauma em decíduos', paginas: ['Epidemiologia', 'Classificação e conduta por lesão', 'Sequelas no permanente', 'Acompanhamento'] },
        { nome: 'Trauma em permanentes jovens', paginas: ['Fraturas e luxações', 'Avulsão', 'Contenção'] },
        { nome: 'Alterações de estrutura', paginas: ['Hipomineralização molar-incisivo', 'Amelogênese e dentinogênese imperfeitas', 'Fluorose', 'Hipoplasia'] },
        { nome: 'Alterações de erupção e número', paginas: ['Retardo de erupção', 'Anquilose de decíduos', 'Agenesias e supranumerários'] },
      ] },
      { nome: 'Situações especiais', temas: [
        { nome: 'Crianças com necessidades especiais', paginas: ['Abordagem', 'Síndrome de Down, autismo e paralisia cerebral', 'Cardiopatias congênitas'] },
        { nome: 'Adolescente', paginas: ['Particularidades', 'Erosão e transtornos alimentares', 'Piercing e hábitos'] },
        { nome: 'Maus-tratos e ética', paginas: ['Sinais de maus-tratos', 'Notificação', 'Consentimento dos pais'] },
        { nome: 'Odontologia do sono na criança', paginas: ['Respiração bucal', 'Apneia e ronco', 'Sinais e encaminhamento'] },
      ] },
      { nome: 'Farmacologia e emergências pediátricas', temas: [
        { nome: 'Prescrição para crianças', paginas: ['Cálculo de dose por peso', 'Analgésicos e anti-inflamatórios pediátricos', 'Antibióticos pediátricos', 'Formas farmacêuticas e sabor'] },
        { nome: 'Sedação na criança', paginas: ['Sedação oral e inalatória', 'Monitoramento', 'Critérios de alta'] },
        { nome: 'Emergências na criança', paginas: ['Particularidades do suporte básico pediátrico', 'Reações a medicamentos', 'Ingestão de flúor'] },
      ] },
    ],
  },
  {
    nome: 'Ortodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Crescimento, diagnóstico e movimentação dentária: da interceptação ao aparelho fixo e alinhadores.',
    modulos: [
      { nome: 'Crescimento e desenvolvimento', temas: [
        { nome: 'Crescimento craniofacial', paginas: ['Conceitos: crescimento e desenvolvimento', 'Teorias do crescimento', 'Mecanismos: sutura, cartilagem e remodelação', 'Crescimento da maxila', 'Crescimento da mandíbula', 'Rotações de crescimento'] },
        { nome: 'Maturação', paginas: ['Surto de crescimento puberal', 'Idade óssea: mão e punho', 'Vértebras cervicais', 'Implicações no tempo de tratamento'] },
        { nome: 'Desenvolvimento da oclusão', paginas: ['Dentição decídua', 'Dentição mista: primeira e segunda fase', 'Dentição permanente', 'Chaves de oclusão de Andrews'] },
      ] },
      { nome: 'Más oclusões', temas: [
        { nome: 'Classificação', paginas: ['Classificação de Angle', 'Classificação esquelética', 'Classificação de Andrews e outras', 'Índices de necessidade de tratamento'] },
        { nome: 'Etiologia', paginas: ['Fatores genéticos e ambientais', 'Hábitos: sucção, deglutição e respiração', 'Perda precoce e cárie', 'Anomalias dentárias', 'Teoria da equivalência de Moyers'] },
        { nome: 'Características por tipo', paginas: ['Classe I com apinhamento', 'Classe II divisão 1 e 2', 'Classe III', 'Mordida aberta', 'Mordida profunda', 'Mordida cruzada', 'Assimetrias'] },
      ] },
      { nome: 'Biologia do movimento', temas: [
        { nome: 'Reações teciduais', paginas: ['Ligamento e osso sob força', 'Pressão e tensão', 'Hialinização', 'Remodelação'] },
        { nome: 'Forças', paginas: ['Magnitude, duração e direção', 'Forças ideais por tipo de movimento', 'Efeitos de forças excessivas', 'Reabsorção radicular'] },
        { nome: 'Efeitos colaterais', paginas: ['Descalcificação e lesões brancas', 'Recessão e deiscências', 'Dor e mobilidade', 'Aceleração do movimento'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Exame clínico', paginas: ['Anamnese ortodôntica', 'Análise facial frontal e de perfil', 'Exame intraoral e funcional', 'ATM e hábitos'] },
        { nome: 'Documentação', paginas: ['Fotografias', 'Modelos e escaneamento', 'Radiografias: panorâmica e periapicais', 'Tomografia: quando'] },
        { nome: 'Análise de modelos', paginas: ['Discrepância de modelo', 'Análise da dentição mista: Moyers e Tanaka-Johnston', 'Bolton', 'Curva de Spee e índices'] },
        { nome: 'Cefalometria', paginas: ['Pontos, linhas e planos', 'Análise de Steiner', 'Análise de Ricketts', 'Análise de McNamara', 'Análise de Tweed e USP', 'Padrão facial e tipo de crescimento', 'Sobreposições', 'Cefalometria digital'] },
        { nome: 'Plano de tratamento', paginas: ['Lista de problemas', 'Objetivos', 'Extração × não extração', 'Sequenciamento', 'Limites e alternativas', 'Consentimento'] },
      ] },
      { nome: 'Ortodontia preventiva e interceptativa', temas: [
        { nome: 'Fundamentos', paginas: ['Níveis de prevenção', 'Quando intervir cedo: evidência', 'Fase I e fase II'] },
        { nome: 'Espaço', paginas: ['Mantenedores de espaço', 'Recuperadores de espaço', 'Extrações seriadas', 'Desgastes de decíduos'] },
        { nome: 'Hábitos', paginas: ['Sucção: abordagem', 'Grade palatina e outros aparelhos', 'Deglutição e fonoaudiologia', 'Respiração bucal'] },
        { nome: 'Mordidas cruzadas', paginas: ['Cruzada anterior: plano inclinado e aparelhos', 'Cruzada posterior: expansão', 'Expansão rápida da maxila: aparelhos e ativação', 'Expansão lenta'] },
        { nome: 'Interceptação de outras más oclusões', paginas: ['Mordida aberta precoce', 'Mordida profunda precoce', 'Apinhamento incipiente', 'Caninos ectópicos: diagnóstico precoce'] },
      ] },
      { nome: 'Ortopedia funcional e mecânica', temas: [
        { nome: 'Classe II', paginas: ['Aparelho extrabucal: tipos e efeitos', 'Propulsores removíveis: Bionator e Twin Block', 'Propulsores fixos: Herbst e outros', 'Distalização de molares: aparelhos', 'Tempo certo: surto de crescimento', 'Classe II no adulto'] },
        { nome: 'Classe III', paginas: ['Máscara facial e expansão', 'Mentoneira', 'Ancoragem esquelética na Classe III', 'Compensação × cirurgia'] },
        { nome: 'Dimensão vertical', paginas: ['Mordida aberta: controle vertical', 'Mordida profunda: intrusão e extrusão', 'Placas e aparelhos de contenção vertical'] },
      ] },
      { nome: 'Aparelhos fixos', temas: [
        { nome: 'Componentes', paginas: ['Bráquetes: tipos e prescrições', 'Bandas e tubos', 'Fios: ligas e propriedades', 'Acessórios: elásticos, molas e ligaduras'] },
        { nome: 'Colagem', paginas: ['Preparo e posicionamento', 'Colagem direta e indireta', 'Erros de posicionamento', 'Descolagem e remoção de resina'] },
        { nome: 'Fases do tratamento', paginas: ['Alinhamento e nivelamento', 'Sequência de fios', 'Correção da relação molar', 'Fechamento de espaços', 'Finalização e detalhamento'] },
        { nome: 'Sistemas', paginas: ['Edgewise standard', 'Straight wire: prescrições', 'Autoligados: evidência', 'Aparelhos linguais'] },
      ] },
      { nome: 'Biomecânica', temas: [
        { nome: 'Fundamentos', paginas: ['Centro de resistência e de rotação', 'Força, momento e relação momento-força', 'Tipos de movimento', 'Sistemas estaticamente determinados'] },
        { nome: 'Mecânica de fechamento', paginas: ['Mecânica de deslize', 'Alças: tipos e ativação', 'Fricção'] },
        { nome: 'Ancoragem', paginas: ['Conceito e classificação', 'Reforço de ancoragem convencional', 'Ancoragem esquelética: mini-implantes', 'Sítios, técnica de instalação e falhas', 'Miniplacas', 'Aplicações: intrusão, Distalização, retração e mesialização'] },
        { nome: 'Torque e controle', paginas: ['Torque nos bráquetes e nos fios', 'Controle radicular', 'Dobras de primeira, segunda e terceira ordem'] },
      ] },
      { nome: 'Alinhadores', temas: [
        { nome: 'Fundamentos', paginas: ['Materiais e biomecânica', 'Indicações e limites', 'Planejamento digital', 'Attachments e movimentos previsíveis'] },
        { nome: 'Clínica', paginas: ['Protocolo de uso', 'Desgaste interproximal', 'Refinamentos', 'Elásticos e auxiliares', 'Alinhadores em adolescentes'] },
      ] },
      { nome: 'Finalização e contenção', temas: [
        { nome: 'Finalização', paginas: ['Critérios de finalização', 'Ajustes finais', 'Estética do sorriso ao final'] },
        { nome: 'Contenção', paginas: ['Por que há recidiva', 'Contenção fixa: confecção', 'Contenção removível', 'Protocolo e tempo', 'Fibrotomia e outros recursos'] },
      ] },
      { nome: 'Ortodontia em adultos e interdisciplinar', temas: [
        { nome: 'Adulto', paginas: ['Particularidades', 'Periodonto reduzido', 'Ortodontia pré-protética', 'Intrusão e verticalização de molares'] },
        { nome: 'Ortodontia e cirurgia ortognática', paginas: ['Diagnóstico', 'Preparo ortodôntico', 'Cirurgia primeiro', 'Finalização'] },
        { nome: 'Dentes impactados', paginas: ['Caninos: localização e tracionamento', 'Outros dentes', 'Transplante'] },
        { nome: 'Interfaces', paginas: ['Ortodontia e periodontia', 'Ortodontia e DTM', 'Ortodontia e implantes', 'Fissuras e síndromes', 'Odontologia do sono'] },
      ] },
      { nome: 'Evidência em ortodontia', temas: [
        { nome: 'O que a evidência diz sobre aparelhos e abordagens', paginas: ['Autoligados × convencionais', 'Alinhadores × aparelho fixo', 'Aparelhos funcionais: efeito esquelético real', 'Prescrições e sistemas: diferenças que importam', 'Aceleração do movimento: o que funciona', 'Tratamento precoce × tardio', 'Como ler um ensaio clínico em ortodontia'] },
      ] },
      { nome: 'Tecnologia e gestão', temas: [
        { nome: 'Ortodontia digital', paginas: ['Escaneamento e setup', 'Bráquetes personalizados', 'Impressão de aparelhos', 'Monitoramento remoto'] },
        { nome: 'Gestão do tratamento', paginas: ['Consultas e intervalos', 'Emergências ortodônticas', 'Higiene e prevenção durante o tratamento', 'Documentação e ética'] },
      ] },
    ],
  },
];
