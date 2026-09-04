'use strict';
// Taxonomia de ENSINO — parte 2: especialidades clínicas centrais da
// graduação (todas reconhecidas pelo CFO). Mesma estrutura de temas-base.js.

module.exports = [
  {
    nome: 'Dentística', ciclo: 'clínico', cfo: true,
    descricao: 'Restaurar forma, função e estética com o mínimo de desgaste.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Princípios do preparo cavitário', paginas: ['Classificação de Black e nomenclatura', 'Princípios biomecânicos do preparo', 'Preparos conservadores para adesivos', 'Instrumentos rotatórios e manuais'] },
        { nome: 'Isolamento do campo', paginas: ['Isolamento absoluto: passo a passo', 'Grampos e situações difíceis', 'Isolamento relativo: quando aceitar'] },
        { nome: 'Proteção do complexo dentino-pulpar', paginas: ['Quando forrar e quando não', 'Materiais: hidróxido de cálcio, MTA e ionômero', 'Capeamento pulpar direto e indireto'] },
      ] },
      { nome: 'Restaurações diretas', temas: [
        { nome: 'Resina composta em posteriores', paginas: ['Seleção do material', 'Técnica incremental e estratificação', 'Matrizes e ponto de contato', 'Acabamento e polimento', 'Falhas e reparo'] },
        { nome: 'Resina composta em anteriores', paginas: ['Seleção de cor e estratificação natural', 'Classe III, IV e V', 'Fechamento de diastema', 'Facetas diretas', 'Guia de silicone'] },
        { nome: 'Amálgama', paginas: ['Indicações atuais', 'Preparo e condensação', 'Escultura e acabamento'] },
        { nome: 'Ionômero de vidro', paginas: ['Indicações', 'Técnica e proteção superficial', 'Tratamento restaurador atraumático'] },
      ] },
      { nome: 'Restaurações indiretas e estética', temas: [
        { nome: 'Inlay, onlay e overlay', paginas: ['Indicações e preparo', 'Cerâmica × resina de laboratório', 'Cimentação adesiva passo a passo'] },
        { nome: 'Facetas cerâmicas', paginas: ['Planejamento e mock-up', 'Preparos minimamente invasivos', 'Cimentação e controle de cor'] },
        { nome: 'Clareamento', paginas: ['Mecanismo e agentes', 'Clareamento de consultório e caseiro', 'Dentes não vitais', 'Sensibilidade: prevenção e manejo', 'Manchas por fluorose e tetraciclina'] },
        { nome: 'Lesões não cariosas', paginas: ['Erosão, abrasão, abfração e atrição', 'Diagnóstico da causa', 'Hipersensibilidade dentinária: tratamento'] },
      ] },
    ],
  },
  {
    nome: 'Endodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Da dor de dente ao canal obturado: diagnóstico, acesso, preparo e obturação.',
    modulos: [
      { nome: 'Diagnóstico', temas: [
        { nome: 'Patologias pulpares e periapicais', paginas: ['Pulpite reversível e irreversível', 'Necrose pulpar', 'Periodontite apical aguda e crônica', 'Abscesso apical', 'Classificação clínica atual'] },
        { nome: 'Testes e exame', paginas: ['Teste térmico e elétrico', 'Percussão e palpação', 'Radiografias e tomografia em endodontia', 'Dor referida e diagnóstico diferencial'] },
      ] },
      { nome: 'Preparo do canal', temas: [
        { nome: 'Anatomia interna', paginas: ['Número de canais por dente', 'Classificações de Vertucci', 'Canais MV2 e istmos', 'Curvaturas e como medir'] },
        { nome: 'Abertura coronária', paginas: ['Formas de contorno por grupo de dentes', 'Localização dos canais', 'Erros: perfuração e desvio'] },
        { nome: 'Odontometria', paginas: ['Localizador apical', 'Radiografia com lima', 'Limite apical de trabalho'] },
        { nome: 'Instrumentação', paginas: ['Limas manuais: técnicas escalonadas', 'Sistemas rotatórios e reciprocantes', 'Patência e glide path', 'Fratura de instrumento: prevenir e resolver'] },
        { nome: 'Irrigação e medicação', paginas: ['Hipoclorito: concentração e volume', 'EDTA e clorexidina', 'Ativação da irrigação', 'Hidróxido de cálcio intracanal', 'Acidente com hipoclorito'] },
      ] },
      { nome: 'Obturação e além', temas: [
        { nome: 'Obturação', paginas: ['Cimentos endodônticos', 'Condensação lateral', 'Termoplastificação e cone único', 'Critérios de qualidade radiográfica'] },
        { nome: 'Sessão única × múltiplas', paginas: ['Evidência e critérios de decisão', 'Restauração pós-endodôntica imediata'] },
        { nome: 'Retratamento e cirurgia', paginas: ['Quando retratar', 'Remoção de guta-percha e pinos', 'Cirurgia paraendodôntica', 'Perfurações e MTA'] },
        { nome: 'Traumatismo e dentes jovens', paginas: ['Apicificação e revascularização', 'Pulpotomia em permanentes jovens', 'Reabsorções: tipos e conduta'] },
        { nome: 'Emergências endodônticas', paginas: ['Abertura e drenagem', 'Medicação sistêmica', 'Flare-up'] },
      ] },
    ],
  },
  {
    nome: 'Periodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Gengiva e osso: diagnosticar, raspar, operar e manter.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Periodonto saudável', paginas: ['Gengiva, ligamento, cemento e osso', 'Biótipo e fenótipo gengival', 'Espaço biológico'] },
        { nome: 'Etiopatogenia', paginas: ['Biofilme e cálculo', 'Resposta do hospedeiro', 'Fatores de risco: fumo e diabetes', 'Periodontite e doenças sistêmicas'] },
        { nome: 'Classificação 2017', paginas: ['Saúde e gengivite', 'Periodontite: estágios e graus', 'Condições periimplantares', 'Doenças necrosantes e outras'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Exame periodontal', paginas: ['Sondagem: técnica e erros', 'Periograma completo', 'Sangramento, supuração e mobilidade', 'Furcas: classificação e sondagem', 'Radiografia periodontal'] },
        { nome: 'Prognóstico e plano', paginas: ['Prognóstico dente a dente', 'Fases do tratamento periodontal', 'Quando encaminhar'] },
      ] },
      { nome: 'Tratamento não cirúrgico', temas: [
        { nome: 'Instrumentação', paginas: ['Curetas de Gracey e universais', 'Ultrassom', 'Raspagem e alisamento radicular passo a passo', 'Afiação de instrumentos', 'Reavaliação'] },
        { nome: 'Coadjuvantes', paginas: ['Clorexidina e antissépticos', 'Antibióticos sistêmicos e locais', 'Controle de fatores de risco'] },
      ] },
      { nome: 'Tratamento cirúrgico', temas: [
        { nome: 'Cirurgia ressectiva', paginas: ['Gengivectomia', 'Retalho de Widman modificado', 'Osteotomia e osteoplastia', 'Aumento de coroa clínica'] },
        { nome: 'Cirurgia regenerativa', paginas: ['Regeneração tecidual guiada', 'Enxertos ósseos e biomateriais', 'Proteínas da matriz do esmalte'] },
        { nome: 'Cirurgia plástica periodontal', paginas: ['Recessões: classificação de Cairo', 'Enxerto de tecido conjuntivo', 'Retalho posicionado coronalmente', 'Matrizes colágenas', 'Frenectomia'] },
      ] },
      { nome: 'Manutenção e periimplantar', temas: [
        { nome: 'Terapia de suporte', paginas: ['Intervalos por risco', 'Protocolo de consulta de manutenção'] },
        { nome: 'Mucosite e periimplantite', paginas: ['Diagnóstico', 'Tratamento não cirúrgico e cirúrgico', 'Prevenção'] },
      ] },
    ],
  },
  {
    nome: 'Prótese dentária', ciclo: 'clínico', cfo: true,
    descricao: 'Repor dentes: da coroa unitária à prótese total, do preparo à entrega.',
    modulos: [
      { nome: 'Prótese fixa', temas: [
        { nome: 'Planejamento', paginas: ['Indicações e contraindicações', 'Dentes suporte e lei de Ante', 'Prótese fixa × implante'] },
        { nome: 'Preparos', paginas: ['Princípios dos preparos', 'Preparo para coroa total metalocerâmica', 'Preparo para cerâmica pura', 'Términos cervicais', 'Retenção e resistência'] },
        { nome: 'Núcleos', paginas: ['Núcleo metálico fundido', 'Pino de fibra de vidro', 'Quando o dente ainda aguenta'] },
        { nome: 'Provisórios e moldagem', paginas: ['Provisórios: técnicas', 'Afastamento gengival', 'Moldagem com elastômeros', 'Escaneamento intraoral'] },
        { nome: 'Prova e cimentação', paginas: ['Prova de infraestrutura e cerâmica', 'Ajuste oclusal', 'Cimentação convencional e adesiva', 'Cimentação de zircônia'] },
        { nome: 'Prótese adesiva', paginas: ['Indicações', 'Preparo e cimentação'] },
      ] },
      { nome: 'Prótese parcial removível', temas: [
        { nome: 'Classificação e planejamento', paginas: ['Classificação de Kennedy', 'Delineamento e equador protético', 'Vias de inserção'] },
        { nome: 'Componentes', paginas: ['Conectores maiores e menores', 'Retentores e grampos', 'Apoios e nichos', 'Selas e dentes artificiais'] },
        { nome: 'Etapas clínicas', paginas: ['Preparo de boca', 'Moldagem anatômica e funcional', 'Prova da estrutura', 'Registro oclusal', 'Instalação e ajustes'] },
      ] },
      { nome: 'Prótese total', temas: [
        { nome: 'O paciente edêntulo', paginas: ['Anatomia das arcadas edêntulas', 'Reabsorção do rebordo', 'Exame e expectativas'] },
        { nome: 'Etapas', paginas: ['Moldagem anatômica e funcional', 'Plano de orientação e dimensão vertical', 'Registro de relação cêntrica', 'Seleção e montagem dos dentes', 'Prova e instalação', 'Ajustes pós-instalação'] },
        { nome: 'Oclusão e manutenção', paginas: ['Oclusão balanceada bilateral', 'Reembasamento', 'Estomatite protética e higiene'] },
        { nome: 'Overdenture', paginas: ['Sobre implantes e sobre raízes', 'Sistemas de retenção'] },
      ] },
      { nome: 'Prótese sobre implante', temas: [
        { nome: 'Fundamentos', paginas: ['Cimentada × parafusada', 'Componentes protéticos', 'Moldagem de transferência', 'Protocolo e prótese total fixa'] },
      ] },
      { nome: 'Fluxo digital', temas: [
        { nome: 'Odontologia digital em prótese', paginas: ['Escaneamento e desenho', 'Fresagem e impressão 3D', 'Planejamento digital do sorriso'] },
      ] },
    ],
  },
  {
    nome: 'Cirurgia e traumatologia bucomaxilofacial', ciclo: 'clínico', cfo: true,
    descricao: 'Da exodontia simples às fraturas de face.',
    modulos: [
      { nome: 'Princípios cirúrgicos', temas: [
        { nome: 'Avaliação pré-operatória', paginas: ['Anamnese cirúrgica', 'Exames e risco', 'Pacientes anticoagulados, diabéticos e cardiopatas', 'Bifosfonatos e osteonecrose'] },
        { nome: 'Instrumental e técnica', paginas: ['Instrumental cirúrgico: reconhecer cada um', 'Incisões e retalhos', 'Suturas: fios e pontos', 'Cicatrização e reparo'] },
      ] },
      { nome: 'Exodontia', temas: [
        { nome: 'Exodontia simples', paginas: ['Indicações', 'Técnica de fórceps dente a dente', 'Alavancas: princípios', 'Cuidados pós-operatórios'] },
        { nome: 'Exodontia complexa e dentes inclusos', paginas: ['Retalhos e osteotomia', 'Terceiros molares: classificação e técnica', 'Caninos inclusos', 'Odontossecção'] },
        { nome: 'Acidentes e complicações', paginas: ['Fratura radicular e de tábua óssea', 'Comunicação bucossinusal', 'Lesão nervosa', 'Alveolite', 'Hemorragia'] },
      ] },
      { nome: 'Cirurgias bucais', temas: [
        { nome: 'Cirurgia pré-protética', paginas: ['Alveoloplastia e exostoses', 'Frenectomia', 'Aprofundamento de sulco'] },
        { nome: 'Infecções', paginas: ['Abscessos: drenagem', 'Espaços fasciais', 'Osteomielite', 'Quando internar'] },
        { nome: 'Cistos e tumores', paginas: ['Enucleação e marsupialização', 'Biópsia: técnicas', 'Tumores odontogênicos: conduta'] },
        { nome: 'Cirurgia periapical', paginas: ['Apicectomia e obturação retrógrada'] },
      ] },
      { nome: 'Trauma e deformidades', temas: [
        { nome: 'Traumatologia', paginas: ['Atendimento inicial e ATLS para o dentista', 'Fraturas de mandíbula', 'Fraturas de maxila e zigoma', 'Fixação interna rígida', 'Trauma dentoalveolar'] },
        { nome: 'Cirurgia ortognática', paginas: ['Indicações e planejamento', 'Osteotomias: Le Fort I e sagital', 'Preparo ortodôntico'] },
        { nome: 'Articulação temporomandibular', paginas: ['Luxação: redução', 'Anquilose', 'Cirurgia da ATM: indicações'] },
        { nome: 'Fissuras labiopalatinas', paginas: ['Classificação', 'Protocolo de tratamento por idade'] },
      ] },
    ],
  },
  {
    nome: 'Implantodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Planejar, instalar e reabilitar implantes com previsibilidade.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Osseointegração', paginas: ['Conceito e histologia', 'Superfícies de implante', 'Estabilidade primária e secundária'] },
        { nome: 'Planejamento', paginas: ['Exame e tomografia', 'Guia cirúrgico e cirurgia guiada', 'Posição tridimensional ideal', 'Contraindicações e risco'] },
      ] },
      { nome: 'Cirurgia', temas: [
        { nome: 'Técnica cirúrgica', paginas: ['Protocolo de fresagem', 'Um e dois estágios', 'Implante imediato', 'Carga imediata: critérios'] },
        { nome: 'Enxertos e regeneração', paginas: ['Preservação alveolar', 'Levantamento de seio maxilar', 'Enxertos em bloco e biomateriais', 'Regeneração óssea guiada', 'Manejo de tecidos moles'] },
        { nome: 'Complicações', paginas: ['Lesão nervosa', 'Falha precoce e tardia', 'Periimplantite: tratamento'] },
      ] },
      { nome: 'Prótese sobre implante', temas: [
        { nome: 'Reabilitação', paginas: ['Unitário, parcial e total', 'Overdenture e protocolo', 'Componentes e torques', 'Passividade e manutenção'] },
      ] },
    ],
  },
  {
    nome: 'Odontopediatria', ciclo: 'clínico', cfo: true,
    descricao: 'Atender a criança: comportamento, prevenção, dente decíduo e trauma.',
    modulos: [
      { nome: 'A criança na cadeira', temas: [
        { nome: 'Desenvolvimento e comportamento', paginas: ['Fases do desenvolvimento infantil', 'Técnicas de manejo: dizer-mostrar-fazer e outras', 'Ansiedade e medo', 'Contenção e sedação: quando'] },
        { nome: 'Primeira consulta e bebê', paginas: ['Odontologia para bebês', 'Cárie precoce da infância', 'Hábitos: chupeta, dedo e mamadeira', 'Amamentação e saúde bucal'] },
      ] },
      { nome: 'Prevenção e clínica', temas: [
        { nome: 'Prevenção na infância', paginas: ['Flúor por idade', 'Selantes', 'Orientação de dieta', 'Higiene por faixa etária'] },
        { nome: 'Dentística em decíduos', paginas: ['Restaurações em decíduos', 'Coroas de aço', 'Tratamento restaurador atraumático', 'Diamino fluoreto de prata'] },
        { nome: 'Terapia pulpar em decíduos', paginas: ['Diagnóstico pulpar na criança', 'Pulpotomia', 'Pulpectomia', 'Materiais obturadores reabsorvíveis'] },
        { nome: 'Cirurgia e anestesia na criança', paginas: ['Exodontia de decíduos', 'Anestesia: doses e técnicas', 'Dentes natais e neonatais'] },
      ] },
      { nome: 'Desenvolvimento da oclusão', temas: [
        { nome: 'Oclusão decídua e mista', paginas: ['Espaços primatas e plano terminal', 'Fase do patinho feio', 'Perda precoce e mantenedores de espaço', 'Recuperadores de espaço'] },
        { nome: 'Ortodontia preventiva na infância', paginas: ['Mordida cruzada anterior e posterior', 'Hábitos deletérios e interceptação'] },
      ] },
      { nome: 'Trauma e situações especiais', temas: [
        { nome: 'Traumatismo em decíduos', paginas: ['Classificação e conduta', 'Consequências para o permanente'] },
        { nome: 'Alterações de esmalte', paginas: ['Hipomineralização molar-incisivo', 'Amelogênese e dentinogênese imperfeitas', 'Fluorose'] },
        { nome: 'Crianças com necessidades especiais', paginas: ['Abordagem e adaptações', 'Síndromes mais comuns'] },
      ] },
    ],
  },
  {
    nome: 'Ortodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Crescimento, diagnóstico e movimentação dentária: da interceptação ao aparelho fixo e alinhadores.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Crescimento craniofacial', paginas: ['Teorias do crescimento', 'Crescimento da maxila e da mandíbula', 'Surto de crescimento e maturação', 'Idade óssea: vértebras cervicais'] },
        { nome: 'Desenvolvimento da oclusão', paginas: ['Da dentição decídua à permanente', 'Chaves de oclusão de Andrews', 'Classificação de Angle', 'Etiologia das más oclusões'] },
        { nome: 'Biologia do movimento', paginas: ['Reações teciduais ao movimento', 'Forças: tipo, magnitude e duração', 'Reabsorção radicular', 'Ancoragem: conceitos'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Documentação', paginas: ['Exame clínico e facial', 'Fotografias e modelos', 'Análise de modelos e discrepância', 'Análise da dentição mista'] },
        { nome: 'Cefalometria', paginas: ['Pontos e planos', 'Análises de Steiner, Ricketts e McNamara', 'Padrão facial', 'Interpretação prática'] },
        { nome: 'Plano de tratamento', paginas: ['Extração × não extração', 'Objetivos e sequenciamento', 'Limites da ortodontia'] },
      ] },
      { nome: 'Interceptação e ortopedia', temas: [
        { nome: 'Ortodontia preventiva e interceptativa', paginas: ['Mantenedores e recuperadores de espaço', 'Mordida cruzada: expansão', 'Hábitos: grade palatina e outros', 'Extrações seriadas'] },
        { nome: 'Classe II', paginas: ['Aparelho extrabucal', 'Propulsores mandibulares: Herbst, Twin Block e outros', 'Distalização de molares', 'Tempo certo: surto de crescimento'] },
        { nome: 'Classe III', paginas: ['Máscara facial e expansão', 'Mentoneira', 'Compensação × cirurgia'] },
        { nome: 'Mordida aberta e profunda', paginas: ['Etiologia e interceptação', 'Controle vertical', 'Intrusão e extrusão'] },
      ] },
      { nome: 'Aparelhos e mecânica', temas: [
        { nome: 'Aparelho fixo', paginas: ['Bráquetes: prescrições e colagem', 'Fios: sequência e propriedades', 'Fases: alinhamento, nivelamento e fechamento', 'Autoligados'] },
        { nome: 'Biomecânica', paginas: ['Centro de resistência e rotação', 'Momento e força', 'Mecânica de deslize e alças', 'Torque e controle radicular'] },
        { nome: 'Ancoragem esquelética', paginas: ['Mini-implantes: sítios e técnica', 'Aplicações: intrusão, Distalização e retração', 'Falhas'] },
        { nome: 'Alinhadores', paginas: ['Planejamento digital', 'Attachments e movimentos previsíveis', 'Limites e refinamentos'] },
        { nome: 'Finalização e contenção', paginas: ['Critérios de finalização', 'Contenção fixa e removível', 'Recidiva'] },
      ] },
      { nome: 'Situações especiais', temas: [
        { nome: 'Ortodontia no adulto', paginas: ['Periodonto reduzido', 'Preparo para prótese e implante', 'Ortodontia e cirurgia ortognática'] },
        { nome: 'Caninos e dentes impactados', paginas: ['Diagnóstico precoce', 'Tracionamento'] },
        { nome: 'Fissuras e síndromes', paginas: ['Ortodontia no paciente fissurado', 'Enxerto alveolar: tempo'] },
      ] },
    ],
  },
  {
    nome: 'Radiologia odontológica e imaginologia', ciclo: 'clínico', cfo: true,
    descricao: 'Produzir, interpretar e proteger: do periapical à tomografia.',
    modulos: [
      { nome: 'Física e proteção', temas: [
        { nome: 'Raios X', paginas: ['Produção e propriedades', 'Aparelho: componentes', 'Fatores que afetam a imagem', 'Radiografia digital: sensores e placas'] },
        { nome: 'Radioproteção', paginas: ['Efeitos biológicos', 'Princípios ALARA', 'Legislação e sala', 'Gestantes e crianças'] },
      ] },
      { nome: 'Técnicas', temas: [
        { nome: 'Intrabucais', paginas: ['Periapical: paralelismo e bissetriz', 'Interproximal', 'Oclusal', 'Localização: Clark e outras', 'Erros técnicos e como corrigir'] },
        { nome: 'Extrabucais', paginas: ['Panorâmica: técnica e artefatos', 'Telerradiografia', 'Outras incidências'] },
        { nome: 'Tomografia e outros exames', paginas: ['Tomografia de feixe cônico: princípios', 'Quando pedir tomografia', 'Ressonância, ultrassom e cintilografia: usos'] },
      ] },
      { nome: 'Interpretação', temas: [
        { nome: 'Anatomia radiográfica', paginas: ['Estruturas normais intra e extrabucais', 'Variações que confundem'] },
        { nome: 'Alterações', paginas: ['Cárie e periodonto', 'Lesões periapicais', 'Cistos e tumores: padrões', 'Anomalias dentárias', 'Calcificações e seios', 'ATM na imagem'] },
        { nome: 'Laudo', paginas: ['Como descrever uma lesão', 'Modelo de laudo'] },
      ] },
    ],
  },
  {
    nome: 'Estomatologia', ciclo: 'clínico', cfo: true,
    descricao: 'Diagnosticar as doenças da boca: da afta ao câncer.',
    modulos: [
      { nome: 'Método', temas: [
        { nome: 'Exame e lesões fundamentais', paginas: ['Roteiro do exame da mucosa', 'Lesões fundamentais: mácula, pápula, vesícula e outras', 'Como descrever uma lesão', 'Biópsia e citologia'] },
        { nome: 'Variações da normalidade', paginas: ['Grânulos de Fordyce, leucoedema e linha alba', 'Língua geográfica e fissurada', 'Tórus e exostoses'] },
      ] },
      { nome: 'Doenças', temas: [
        { nome: 'Infecções', paginas: ['Candidíase: formas', 'Herpes e outras viroses', 'Papiloma e HPV', 'Sífilis e tuberculose na boca'] },
        { nome: 'Lesões ulceradas e vesicobolhosas', paginas: ['Afta recorrente', 'Pênfigo e penfigoide', 'Eritema multiforme', 'Úlcera traumática'] },
        { nome: 'Lesões brancas, vermelhas e pigmentadas', paginas: ['Leucoplasia e eritroplasia', 'Líquen plano', 'Lesões pigmentadas e melanoma'] },
        { nome: 'Câncer de boca', paginas: ['Fatores de risco', 'Carcinoma espinocelular: reconhecer cedo', 'Estadiamento e encaminhamento', 'Manifestações orais da radioterapia e quimioterapia', 'Osteorradionecrose'] },
        { nome: 'Glândulas salivares', paginas: ['Mucocele e rânula', 'Sialolitíase', 'Síndrome de Sjögren', 'Tumores de glândula'] },
        { nome: 'Manifestações de doenças sistêmicas', paginas: ['Diabetes, anemia e leucemia', 'HIV', 'Doenças autoimunes'] },
      ] },
    ],
  },
  {
    nome: 'Patologia oral e maxilofacial', ciclo: 'clínico', cfo: true,
    descricao: 'O que a lesão é por dentro: histopatologia das doenças da boca e dos maxilares.',
    modulos: [
      { nome: 'Desenvolvimento e dente', temas: [
        { nome: 'Anomalias de desenvolvimento', paginas: ['Anomalias de número, tamanho e forma', 'Defeitos de esmalte e dentina', 'Fissuras e cistos de desenvolvimento'] },
        { nome: 'Patologia pulpar e periapical', paginas: ['Pulpite', 'Granuloma e cisto periapical', 'Abscesso'] },
      ] },
      { nome: 'Cistos e tumores', temas: [
        { nome: 'Cistos odontogênicos e não odontogênicos', paginas: ['Cisto dentígero e ceratocisto', 'Cisto periodontal lateral e outros', 'Cisto do ducto nasopalatino'] },
        { nome: 'Tumores odontogênicos', paginas: ['Ameloblastoma', 'Odontoma', 'Mixoma e outros'] },
        { nome: 'Lesões ósseas', paginas: ['Displasia fibrosa e cemento-óssea', 'Lesão central de células gigantes', 'Osteomielite e osteonecrose'] },
      ] },
      { nome: 'Tecidos moles', temas: [
        { nome: 'Lesões reacionais', paginas: ['Fibroma e hiperplasia fibrosa', 'Granuloma piogênico', 'Lesão periférica de células gigantes'] },
        { nome: 'Neoplasias', paginas: ['Carcinoma espinocelular: histologia e graduação', 'Tumores de glândula salivar', 'Lesões mesenquimais'] },
        { nome: 'Doenças dermatológicas e autoimunes', paginas: ['Líquen plano', 'Pênfigo e penfigoide', 'Lúpus'] },
      ] },
    ],
  },
  {
    nome: 'Saúde coletiva', ciclo: 'clínico', cfo: true,
    descricao: 'O SUS, a epidemiologia e a saúde bucal da população.',
    modulos: [
      { nome: 'Sistema de saúde', temas: [
        { nome: 'SUS', paginas: ['Princípios e diretrizes', 'Leis 8.080 e 8.142', 'Financiamento e gestão', 'Atenção primária e Estratégia Saúde da Família'] },
        { nome: 'Política Nacional de Saúde Bucal', paginas: ['Brasil Sorridente', 'Equipe de saúde bucal', 'Centros de Especialidades Odontológicas', 'Laboratórios de prótese'] },
      ] },
      { nome: 'Epidemiologia', temas: [
        { nome: 'Epidemiologia em saúde bucal', paginas: ['Índices: CPO-D, ceo-d, CPI e outros', 'SB Brasil: o que mostrou', 'Levantamentos epidemiológicos: como fazer'] },
        { nome: 'Promoção de saúde', paginas: ['Determinantes sociais', 'Educação em saúde', 'Fluoretação das águas', 'Programas escolares'] },
      ] },
      { nome: 'Gestão e trabalho', temas: [
        { nome: 'Planejamento e avaliação', paginas: ['Diagnóstico de território', 'Planejamento estratégico', 'Indicadores e avaliação'] },
        { nome: 'Processo de trabalho', paginas: ['Trabalho em equipe e auxiliares', 'Acolhimento e classificação de risco', 'Vigilância em saúde'] },
      ] },
    ],
  },
];
