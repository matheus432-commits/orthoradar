'use strict';
// Taxonomia de ENSINO — parte 1: ciclo básico e pré-clínico da graduação.
//
// Fonte única dos temas que viram apostilas/guias para o aluno e aulas/
// provas para o professor. Estrutura: área → módulos → temas → páginas.
// "Páginas" são as unidades de apostila (cada uma vira um guia ilustrado).
//
// Base do levantamento (01/09/2026): DCN Odontologia (Res. CNE/CES 3/2021),
// portarias do componente específico do ENADE (2016/2019/2023), ementas e
// planos de ensino públicos (UFMG, FOUSP, FOP-Unicamp, UFPel, UENP, UFG,
// UFPR, UFJF-GV, Bahiana, UniRios) e conteúdos programáticos de editais de
// concurso e residência. Nomes em linguagem da sala de aula, sem siglas
// antes da palavra comum. Termo canônico: "Distalização" (nunca
// "Distanciamento").

module.exports = [
  {
    nome: 'Anatomia de cabeça e pescoço', ciclo: 'básico', cfo: false,
    descricao: 'Ossos, músculos, vasos e nervos que o dentista precisa enxergar por trás de cada procedimento.',
    modulos: [
      { nome: 'Crânio e face', temas: [
        { nome: 'Ossos do crânio e da face', paginas: ['Neurocrânio e viscerocrânio', 'Maxila: processos, seio e forames', 'Mandíbula: corpo, ramo, côndilo e canal mandibular', 'Osso temporal e fossa mandibular', 'Suturas e fontanelas', 'Forames da base do crânio e o que passa por cada um'] },
        { nome: 'Fossas e espaços', paginas: ['Fossa infratemporal', 'Fossa pterigopalatina', 'Espaços fasciais e vias de disseminação de infecções', 'Assoalho da boca e espaço submandibular'] },
      ] },
      { nome: 'Músculos e articulação', temas: [
        { nome: 'Músculos da mastigação', paginas: ['Masseter, temporal, pterigóideo medial e lateral', 'Origem, inserção, ação e inervação', 'Músculos supra e infra-hióideos', 'Palpação muscular no exame clínico'] },
        { nome: 'Músculos da expressão facial', paginas: ['Grupo orbicular da boca e elevadores do lábio', 'Depressores e mentual', 'Bucinador e platisma', 'Aplicação em anestesia e harmonização'] },
        { nome: 'Articulação temporomandibular', paginas: ['Componentes: côndilo, disco, eminência e cápsula', 'Ligamentos e movimentos', 'Biomecânica da abertura e do fechamento', 'Vascularização e inervação'] },
      ] },
      { nome: 'Vasos e nervos', temas: [
        { nome: 'Nervo trigêmeo', paginas: ['Divisões oftálmica, maxilar e mandibular', 'Nervo alveolar superior posterior, médio e anterior', 'Nervo alveolar inferior, lingual e bucal', 'Nervo mentual e incisivo', 'Mapa de inervação dente a dente'] },
        { nome: 'Nervo facial e outros pares', paginas: ['Trajeto e ramos do facial', 'Glossofaríngeo, vago e hipoglosso na boca', 'Paralisia facial transitória após anestesia'] },
        { nome: 'Vascularização', paginas: ['Artéria carótida externa e ramos', 'Artéria maxilar e seus segmentos', 'Drenagem venosa e plexo pterigóideo', 'Sangramento: onde e por quê'] },
        { nome: 'Sistema linfático', paginas: ['Cadeias cervicais', 'Linfonodos de drenagem da boca', 'Palpação de linfonodos no exame'] },
      ] },
      { nome: 'Cavidade oral e anexos', temas: [
        { nome: 'Glândulas salivares', paginas: ['Parótida, submandibular e sublingual', 'Ductos e óstios', 'Glândulas salivares menores'] },
        { nome: 'Língua, palato e faringe', paginas: ['Músculos da língua e inervação', 'Palato duro e mole', 'Anel linfático de Waldeyer', 'Deglutição'] },
        { nome: 'Seio maxilar', paginas: ['Anatomia e relações com raízes', 'Comunicação bucossinusal', 'Implicações em cirurgia e implantes'] },
      ] },
    ],
  },
  {
    nome: 'Anatomia dental e escultura', ciclo: 'básico', cfo: false,
    descricao: 'Reconhecer cada dente, decíduo e permanente, e reproduzir sua forma em cera.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Nomenclatura e notação', paginas: ['Faces, terços e bordas', 'Notação FDI, universal e Palmer', 'Dentições decídua, mista e permanente'] },
        { nome: 'Cronologia de erupção', paginas: ['Decíduos: sequência e idades', 'Permanentes: sequência e idades', 'Tabela para consulta rápida', 'Variações e atrasos'] },
      ] },
      { nome: 'Dentes permanentes', temas: [
        { nome: 'Incisivos', paginas: ['Incisivos centrais superiores', 'Incisivos laterais superiores', 'Incisivos inferiores', 'Diferenças entre direito e esquerdo'] },
        { nome: 'Caninos', paginas: ['Canino superior', 'Canino inferior', 'Guia canina e função'] },
        { nome: 'Pré-molares', paginas: ['Primeiro e segundo pré-molar superior', 'Primeiro e segundo pré-molar inferior', 'Raízes e número de canais'] },
        { nome: 'Molares', paginas: ['Primeiro molar superior e tubérculo de Carabelli', 'Segundo e terceiro molar superior', 'Primeiro molar inferior', 'Segundo e terceiro molar inferior', 'Anatomia interna e câmara pulpar'] },
      ] },
      { nome: 'Dentes decíduos', temas: [
        { nome: 'Características gerais', paginas: ['Diferenças decíduo × permanente', 'Câmara pulpar ampla e cornos altos', 'Raízes divergentes e rizólise'] },
        { nome: 'Dente a dente', paginas: ['Incisivos e caninos decíduos', 'Primeiro molar decíduo', 'Segundo molar decíduo'] },
      ] },
      { nome: 'Escultura', temas: [
        { nome: 'Técnica de escultura em cera', paginas: ['Instrumental e passo a passo', 'Escultura de incisivo e canino', 'Escultura de pré-molar e molar', 'Erros comuns e como corrigir'] },
        { nome: 'Anomalias de forma e número', paginas: ['Dens in dente, geminação e fusão', 'Taurodontia e dilaceração', 'Agenesias e supranumerários'] },
      ] },
    ],
  },
  {
    nome: 'Histologia e embriologia bucal', ciclo: 'básico', cfo: false,
    descricao: 'Como os tecidos da boca se formam e como são por dentro. Uma das disciplinas com mais reprovação.',
    modulos: [
      { nome: 'Embriologia', temas: [
        { nome: 'Desenvolvimento da face e do palato', paginas: ['Arcos faringeos e derivados', 'Formação da face semana a semana', 'Palatogênese', 'Fissuras labiais e palatinas: origem embriológica'] },
        { nome: 'Odontogênese', paginas: ['Lâmina dental e estágios de botão, capuz e campânula', 'Amelogênese', 'Dentinogênese', 'Formação da raiz e bainha de Hertwig', 'Erupção e rizólise', 'Anomalias de desenvolvimento e sua origem'] },
      ] },
      { nome: 'Tecidos dentais', temas: [
        { nome: 'Esmalte', paginas: ['Composição e prismas', 'Estrias de Retzius e linhas incrementais', 'Junção amelodentinária', 'Implicações no condicionamento ácido'] },
        { nome: 'Dentina e polpa', paginas: ['Tipos de dentina: primária, secundária e terciária', 'Túbulos dentinários e sensibilidade', 'Complexo dentino-pulpar', 'Zonas da polpa e células', 'Envelhecimento pulpar'] },
        { nome: 'Cemento', paginas: ['Cemento acelular e celular', 'Cementogênese', 'Hipercementose'] },
      ] },
      { nome: 'Periodonto e mucosa', temas: [
        { nome: 'Ligamento periodontal e osso alveolar', paginas: ['Fibras de Sharpey e grupos de fibras', 'Osso alveolar: lâmina dura e cortical', 'Remodelação óssea e movimento ortodôntico'] },
        { nome: 'Mucosa oral', paginas: ['Mucosa mastigatória, de revestimento e especializada', 'Epitélio juncional e sulco gengival', 'Papilas linguais e botões gustativos'] },
        { nome: 'Glândulas salivares', paginas: ['Ácinos serosos, mucosos e mistos', 'Sistema de ductos', 'Composição e funções da saliva'] },
      ] },
    ],
  },
  {
    nome: 'Fisiologia e bioquímica aplicadas', ciclo: 'básico', cfo: false,
    descricao: 'O funcionamento do corpo que muda a conduta na cadeira: saliva, dor, coagulação, sistema cardiovascular.',
    modulos: [
      { nome: 'Fisiologia oral', temas: [
        { nome: 'Saliva', paginas: ['Formação e controle da secreção', 'Capacidade tampão e pH', 'Fluxo salivar: medida e valores', 'Xerostomia e hipossalivação'] },
        { nome: 'Mastigação, deglutição e fonação', paginas: ['Ciclo mastigatório', 'Fases da deglutição', 'Deglutição atípica'] },
        { nome: 'Dor e sensibilidade', paginas: ['Vias da dor orofacial', 'Teoria hidrodinâmica', 'Modulação e dor referida'] },
      ] },
      { nome: 'Fisiologia sistêmica para o dentista', temas: [
        { nome: 'Cardiovascular', paginas: ['Pressão arterial: medida e valores', 'Efeitos do vasoconstritor', 'Síncope vasovagal'] },
        { nome: 'Hemostasia', paginas: ['Cascata da coagulação', 'Exames: TP, INR, TTPA e plaquetas', 'Anticoagulantes e antiagregantes no consultório'] },
        { nome: 'Endócrino e metabólico', paginas: ['Diabetes e cicatrização', 'Tireoide e consultório', 'Osso, cálcio e vitamina D'] },
      ] },
      { nome: 'Bioquímica', temas: [
        { nome: 'Mineralização', paginas: ['Hidroxiapatita e trocas iônicas', 'Desmineralização e remineralização', 'Flúor: mecanismo de ação'] },
        { nome: 'Biofilme e metabolismo bacteriano', paginas: ['Curva de Stephan', 'Açúcares e ácidos', 'Placa: formação e maturação'] },
      ] },
    ],
  },
  {
    nome: 'Microbiologia e imunologia oral', ciclo: 'básico', cfo: false,
    descricao: 'Quem vive na boca, como adoece e como o corpo responde.',
    modulos: [
      { nome: 'Microbiota', temas: [
        { nome: 'Microbiota oral', paginas: ['Colonização e sucessão', 'Principais gêneros e nichos', 'Disbiose'] },
        { nome: 'Biofilme dental', paginas: ['Etapas de formação', 'Película adquirida', 'Controle mecânico e químico'] },
      ] },
      { nome: 'Microrganismos das doenças', temas: [
        { nome: 'Cárie', paginas: ['Streptococcus mutans e lactobacilos', 'Hipótese ecológica da placa'] },
        { nome: 'Doença periodontal', paginas: ['Complexo vermelho e Porphyromonas gingivalis', 'Fatores de virulência'] },
        { nome: 'Infecções endodônticas', paginas: ['Flora primária e secundária', 'Enterococcus faecalis'] },
        { nome: 'Fungos e vírus', paginas: ['Candida e candidíase', 'Herpes simples e zóster', 'HPV e papiloma', 'HIV: manifestações orais'] },
      ] },
      { nome: 'Imunologia', temas: [
        { nome: 'Resposta imune na boca', paginas: ['Imunidade inata e adaptativa', 'IgA secretora', 'Inflamação: sinais e mediadores'] },
        { nome: 'Hipersensibilidade e alergia', paginas: ['Tipos de hipersensibilidade', 'Alergia a látex, anestésico e metais', 'Anafilaxia: reconhecer e agir'] },
      ] },
    ],
  },
  {
    nome: 'Patologia geral', ciclo: 'básico', cfo: false,
    descricao: 'Os mecanismos gerais da doença que depois aparecem em toda lesão da boca.',
    modulos: [
      { nome: 'Lesão e adaptação celular', temas: [
        { nome: 'Lesão celular', paginas: ['Lesão reversível e irreversível', 'Necrose e apoptose', 'Atrofia, hipertrofia, hiperplasia e metaplasia'] },
        { nome: 'Inflamação e reparo', paginas: ['Inflamação aguda', 'Inflamação crônica e granulomas', 'Cicatrização por primeira e segunda intenção', 'Reparo alveolar após exodontia'] },
      ] },
      { nome: 'Distúrbios circulatórios e neoplasias', temas: [
        { nome: 'Edema, hemorragia e trombose', paginas: ['Edema', 'Hemorragia e hematoma', 'Trombose e embolia'] },
        { nome: 'Neoplasias', paginas: ['Benigno × maligno', 'Carcinogênese', 'Nomenclatura dos tumores', 'Estadiamento TNM'] },
      ] },
    ],
  },
  {
    nome: 'Farmacologia e terapêutica', ciclo: 'básico', cfo: false,
    descricao: 'O que prescrever, quanto, por quanto tempo, e o que nunca combinar.',
    modulos: [
      { nome: 'Princípios', temas: [
        { nome: 'Farmacocinética e farmacodinâmica', paginas: ['Absorção, distribuição, metabolismo e excreção', 'Meia-vida e posologia', 'Agonistas e antagonistas', 'Vias de administração'] },
        { nome: 'Prescrição', paginas: ['Receita: partes e regras', 'Receituário de controle especial', 'Cálculo de dose pediátrica', 'Interações medicamentosas mais comuns'] },
      ] },
      { nome: 'Grupos de fármacos', temas: [
        { nome: 'Analgésicos', paginas: ['Dipirona e paracetamol', 'Opioides: quando e como', 'Escada analgésica'] },
        { nome: 'Anti-inflamatórios', paginas: ['AINEs: ibuprofeno, nimesulida, cetorolaco', 'Corticoides: dexametasona e protocolos', 'Contraindicações e efeitos adversos'] },
        { nome: 'Antibióticos', paginas: ['Amoxicilina e clavulanato', 'Alternativas para alérgicos: clindamicina e azitromicina', 'Metronidazol', 'Profilaxia da endocardite', 'Resistência e uso racional'] },
        { nome: 'Ansiolíticos e sedação', paginas: ['Benzodiazepínicos', 'Sedação consciente com óxido nitroso', 'Cuidados e monitoramento'] },
        { nome: 'Antifúngicos e antivirais', paginas: ['Nistatina e fluconazol', 'Aciclovir', 'Clorexidina e antissépticos'] },
      ] },
      { nome: 'Pacientes especiais na prescrição', temas: [
        { nome: 'Gestantes e lactantes', paginas: ['Categorias de risco', 'O que pode e o que não pode', 'Anestesia na gestante'] },
        { nome: 'Crianças, idosos e doentes sistêmicos', paginas: ['Ajustes por idade', 'Insuficiência renal e hepática', 'Pacientes anticoagulados', 'Bifosfonatos e osteonecrose'] },
      ] },
    ],
  },
  {
    nome: 'Anestesiologia', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Técnicas de anestesia local, do cálculo de dose ao que fazer quando falha.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Anestésicos locais', paginas: ['Mecanismo de ação', 'Lidocaína, articaína, mepivacaína, prilocaína e bupivacaína', 'Vasoconstritores: epinefrina e felipressina', 'Dose máxima e cálculo por tubete', 'Escolha do anestésico por paciente'] },
        { nome: 'Instrumental', paginas: ['Seringa carpule, agulhas e tubetes', 'Aspiração e prevenção de injeção intravascular', 'Descarte'] },
      ] },
      { nome: 'Técnicas', temas: [
        { nome: 'Maxila', paginas: ['Infiltrativa supraperiosteal', 'Bloqueio do alveolar superior posterior', 'Bloqueio do infraorbitário', 'Nasopalatino e palatino maior', 'Anestesia intraligamentar'] },
        { nome: 'Mandíbula', paginas: ['Bloqueio do alveolar inferior: reparos e passo a passo', 'Técnica de Gow-Gates e Vazirani-Akinosi', 'Bloqueio do mentual e incisivo', 'Bloqueio do bucal', 'Anestesia intraóssea'] },
        { nome: 'Anestesia em crianças', paginas: ['Particularidades anatômicas', 'Doses por peso', 'Manejo comportamental durante a injeção'] },
      ] },
      { nome: 'Falhas e complicações', temas: [
        { nome: 'Por que a anestesia falhou', paginas: ['Inflamação e pH', 'Variações anatômicas', 'Técnicas complementares'] },
        { nome: 'Complicações locais e sistêmicas', paginas: ['Hematoma, trismo e parestesia', 'Paralisia facial transitória', 'Toxicidade e overdose', 'Reações alérgicas', 'Lipotimia'] },
      ] },
    ],
  },
  {
    nome: 'Biossegurança e ergonomia', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Não contaminar, não se contaminar e não se lesionar.',
    modulos: [
      { nome: 'Controle de infecção', temas: [
        { nome: 'Cadeia de infecção', paginas: ['Vias de transmissão no consultório', 'Precauções padrão', 'Vacinação do profissional'] },
        { nome: 'Processamento de artigos', paginas: ['Limpeza, desinfecção e esterilização', 'Autoclave: ciclos e testes', 'Classificação de Spaulding', 'Embalagem e validade'] },
        { nome: 'Superfícies e resíduos', paginas: ['Barreiras e desinfetantes', 'Água das linhas do equipo', 'Resíduos: classificação e descarte', 'Perfurocortantes e conduta após acidente'] },
      ] },
      { nome: 'Ergonomia', temas: [
        { nome: 'Posição de trabalho', paginas: ['Posições do relógio', 'Trabalho a quatro mãos', 'Visão direta e indireta'] },
        { nome: 'Prevenção de lesões', paginas: ['Lesões por esforço repetitivo', 'Alongamentos e pausas', 'Iluminação e magnificação'] },
      ] },
    ],
  },
  {
    nome: 'Materiais dentários', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Composição, manipulação e por que cada material falha quando falha.',
    modulos: [
      { nome: 'Propriedades', temas: [
        { nome: 'Propriedades dos materiais', paginas: ['Propriedades mecânicas: resistência, módulo e dureza', 'Propriedades físicas: térmicas, ópticas e sorção', 'Biocompatibilidade', 'Adesão: conceitos'] },
      ] },
      { nome: 'Materiais de moldagem e modelo', temas: [
        { nome: 'Gessos', paginas: ['Tipos I a V', 'Proporção e manipulação', 'Expansão de presa e erros'] },
        { nome: 'Hidrocoloides', paginas: ['Alginato: manipulação e vazamento', 'Sinérese e embebição'] },
        { nome: 'Elastômeros', paginas: ['Silicone de adição e condensação', 'Poliéter', 'Técnicas de moldagem: dupla e simultânea', 'Erros de moldagem'] },
        { nome: 'Ceras e resinas acrílicas', paginas: ['Ceras: tipos e usos', 'Resina acrílica termo e autopolimerizável', 'Godiva'] },
      ] },
      { nome: 'Materiais restauradores', temas: [
        { nome: 'Amálgama', paginas: ['Composição e reação de presa', 'Manipulação e condensação', 'Corrosão e mercúrio: segurança'] },
        { nome: 'Resinas compostas', paginas: ['Matriz, carga e silano', 'Classificação por partícula', 'Contração de polimerização e fator C', 'Fotopolimerizadores e técnica incremental', 'Bulk fill'] },
        { nome: 'Sistemas adesivos', paginas: ['Condicionamento total e autocondicionante', 'Camada híbrida', 'Adesivos universais', 'Degradação da interface'] },
        { nome: 'Cimentos', paginas: ['Ionômero de vidro convencional e modificado', 'Hidróxido de cálcio e MTA', 'Óxido de zinco e eugenol', 'Fosfato de zinco', 'Cimentos resinosos'] },
        { nome: 'Cerâmicas', paginas: ['Feldspática, dissilicato de lítio e zircônia', 'Processamento: prensada, CAD/CAM', 'Condicionamento e cimentação de cada cerâmica'] },
        { nome: 'Ligas metálicas', paginas: ['Ligas nobres e não nobres', 'Fundição e defeitos', 'Titânio'] },
      ] },
    ],
  },
  {
    nome: 'Oclusão', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Como os dentes se encontram e por que isso decide restaurações, próteses e dor.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Determinantes da oclusão', paginas: ['Determinantes posteriores: ATM', 'Determinantes anteriores: guia incisal e canina', 'Curvas de Spee e Wilson', 'Dimensão vertical'] },
        { nome: 'Posições e movimentos', paginas: ['Relação cêntrica e máxima intercuspidação', 'Movimentos de Bennett e ângulo de Bennett', 'Lateralidade e protrusão', 'Contatos: trabalho, balanceio e interferências'] },
        { nome: 'Esquemas oclusais', paginas: ['Oclusão mutuamente protegida', 'Função em grupo', 'Oclusão balanceada bilateral'] },
      ] },
      { nome: 'Instrumentos e prática', temas: [
        { nome: 'Articuladores', paginas: ['Tipos: não ajustável, semi e totalmente ajustável', 'Arco facial e montagem', 'Registros interoclusais'] },
        { nome: 'Enceramento diagnóstico', paginas: ['Técnica de enceramento progressivo', 'Cúspides, cristas e sulcos', 'Ajuste oclusal: princípios'] },
        { nome: 'Placas oclusais', paginas: ['Indicações', 'Placa de Michigan: confecção e ajuste', 'Acompanhamento'] },
      ] },
    ],
  },
  {
    nome: 'Cariologia e prevenção', ciclo: 'pré-clínico', cfo: false,
    descricao: 'A doença mais comum do mundo: entender, detectar, parar e prevenir.',
    modulos: [
      { nome: 'A doença cárie', temas: [
        { nome: 'Etiologia', paginas: ['Fatores: biofilme, dieta, hospedeiro e tempo', 'Cárie como doença biofilme-açúcar dependente', 'Fatores de risco individuais'] },
        { nome: 'Histopatologia', paginas: ['Lesão de esmalte: zonas', 'Lesão de dentina: zonas e dentina afetada × infectada', 'Cárie radicular'] },
        { nome: 'Detecção e classificação', paginas: ['Exame visual e ICDAS', 'Radiografia interproximal', 'Métodos auxiliares: fluorescência e transiluminação', 'Atividade × inatividade da lesão'] },
      ] },
      { nome: 'Prevenção', temas: [
        { nome: 'Flúor', paginas: ['Mecanismo de ação', 'Água, dentifrício, verniz e gel', 'Fluorose: risco por idade', 'Protocolos por risco'] },
        { nome: 'Controle de biofilme e dieta', paginas: ['Técnicas de escovação', 'Fio dental e escovas interdentais', 'Orientação de dieta', 'Xilitol e substitutos'] },
        { nome: 'Selantes e tratamento não invasivo', paginas: ['Selantes: indicação e técnica', 'Infiltrante resinoso', 'Diamino fluoreto de prata', 'Tratamento restaurador atraumático'] },
        { nome: 'Risco e manejo', paginas: ['Avaliação de risco de cárie', 'Intervalo de retorno por risco', 'Mínima intervenção: princípios'] },
      ] },
    ],
  },
  {
    nome: 'Propedêutica e clínica integrada', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Anamnese, exame, prontuário e plano de tratamento: o que vem antes de qualquer procedimento.',
    modulos: [
      { nome: 'Exame do paciente', temas: [
        { nome: 'Anamnese', paginas: ['Roteiro de anamnese', 'Perguntas que mudam a conduta', 'Sinais vitais', 'Classificação ASA'] },
        { nome: 'Exame físico', paginas: ['Exame extraoral', 'Exame intraoral sistemático', 'Palpação de linfonodos e ATM', 'Exame dos tecidos moles passo a passo'] },
        { nome: 'Exames complementares', paginas: ['Quando pedir hemograma, glicemia e coagulograma', 'Como ler os valores', 'Encaminhamento ao médico'] },
      ] },
      { nome: 'Prontuário e planejamento', temas: [
        { nome: 'Prontuário odontológico', paginas: ['Documentos obrigatórios', 'Odontograma', 'Termos de consentimento', 'Guarda e sigilo'] },
        { nome: 'Plano de tratamento', paginas: ['Fases: urgência, adequação, reabilitação e manutenção', 'Sequenciamento entre especialidades', 'Orçamento e comunicação com o paciente'] },
        { nome: 'Fotografia clínica', paginas: ['Equipamento básico', 'Protocolo de fotos', 'Uso ético das imagens'] },
      ] },
    ],
  },
  {
    nome: 'Urgências e emergências', ciclo: 'pré-clínico', cfo: false,
    descricao: 'O que fazer nos primeiros minutos: dor, trauma, sangramento e emergência médica na cadeira.',
    modulos: [
      { nome: 'Emergências médicas no consultório', temas: [
        { nome: 'Reconhecer e agir', paginas: ['Kit de emergência: o que ter', 'Síncope e lipotimia', 'Hipoglicemia', 'Crise hipertensiva e angina', 'Crise convulsiva', 'Crise asmática', 'Anafilaxia e adrenalina', 'Suporte básico de vida e desfibrilador'] },
      ] },
      { nome: 'Urgências odontológicas', temas: [
        { nome: 'Dor de origem dental', paginas: ['Diagnóstico diferencial pulpar e periapical', 'Abertura de urgência', 'Pericoronarite', 'Alveolite'] },
        { nome: 'Trauma dental', paginas: ['Classificação das lesões', 'Avulsão: minuto a minuto', 'Luxações e fraturas', 'Contenção: tipos e tempo'] },
        { nome: 'Sangramento e infecção', paginas: ['Hemorragia pós-exodontia', 'Abscesso e drenagem', 'Angina de Ludwig: quando é hospital'] },
      ] },
    ],
  },
  {
    nome: 'Metodologia científica e bioestatística', ciclo: 'básico', cfo: false,
    descricao: 'Ler um artigo sem medo, montar um TCC e entender um valor de p.',
    modulos: [
      { nome: 'Pesquisa', temas: [
        { nome: 'Tipos de estudo', paginas: ['Relato de caso e série', 'Transversal, caso-controle e coorte', 'Ensaio clínico randomizado', 'Revisão sistemática e metanálise', 'Pirâmide da evidência'] },
        { nome: 'Como ler um artigo', paginas: ['Estrutura IMRD', 'Vieses mais comuns', 'Resultados: o que olhar primeiro'] },
        { nome: 'TCC e ética em pesquisa', paginas: ['Pergunta de pesquisa', 'Busca em bases: PubMed e outras', 'Comitê de ética e termo de consentimento', 'Normas ABNT e Vancouver'] },
      ] },
      { nome: 'Estatística', temas: [
        { nome: 'Estatística descritiva', paginas: ['Média, mediana e desvio padrão', 'Tabelas e gráficos', 'Prevalência e incidência'] },
        { nome: 'Inferência', paginas: ['Valor de p e intervalo de confiança', 'Testes mais usados e quando', 'Tamanho de amostra', 'Sensibilidade, especificidade e valores preditivos'] },
      ] },
    ],
  },
];
