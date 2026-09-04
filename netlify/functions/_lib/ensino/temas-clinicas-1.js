'use strict';
// Taxonomia de ENSINO — parte 2: Dentística, Endodontia, Periodontia e
// Prótese dentária (especialidades do CFO com clínica na graduação).
// Profundidade de programa de disciplina + especialização.

module.exports = [
  {
    nome: 'Dentística', ciclo: 'clínico', cfo: true,
    descricao: 'Restaurar forma, função e estética com o mínimo de desgaste.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Introdução e nomenclatura', paginas: ['O que é dentística hoje: mínima intervenção', 'Classificação de Black e limitações', 'Classificação por sítio e estádio', 'Nomenclatura de cavidades e paredes'] },
        { nome: 'Instrumental', paginas: ['Instrumentos manuais cortantes', 'Brocas: formas, numeração e usos', 'Alta e baixa rotação', 'Instrumentos para inserção e acabamento', 'Matrizes, cunhas e porta-matriz'] },
        { nome: 'Isolamento do campo', paginas: ['Por que isolar: evidência', 'Isolamento absoluto: materiais', 'Passo a passo por região', 'Grampos: escolha e situações difíceis', 'Isolamento relativo: quando aceitar', 'Erros e soluções'] },
        { nome: 'Princípios do preparo', paginas: ['Etapas do preparo cavitário', 'Preparo para amálgama × adesivo', 'Preparos conservadores: túnel, slot e fenda', 'Ângulos, retenção e resistência', 'Remoção seletiva de tecido cariado'] },
        { nome: 'Proteção do complexo dentino-pulpar', paginas: ['Resposta pulpar ao preparo', 'Quando forrar e quando não', 'Hidróxido de cálcio, MTA e ionômero', 'Capeamento pulpar indireto', 'Capeamento pulpar direto: critérios e técnica'] },
      ] },
      { nome: 'Adesão e resinas', temas: [
        { nome: 'Adesão na prática', paginas: ['Condicionamento do esmalte e da dentina', 'Aplicação do adesivo: erros que anulam a adesão', 'Umidade da dentina', 'Adesivos universais: modos'] },
        { nome: 'Resina composta: escolha e manipulação', paginas: ['Tipos e indicação por região', 'Seleção de cor: escala e técnica', 'Fotopolimerização correta', 'Inserção incremental e contração', 'Resinas bulk fill'] },
      ] },
      { nome: 'Restaurações diretas em posteriores', temas: [
        { nome: 'Classe I e II em resina', paginas: ['Preparo', 'Matriz seccional e ponto de contato', 'Técnica incremental oblíqua', 'Escultura oclusal', 'Ajuste oclusal', 'Acabamento e polimento'] },
        { nome: 'Amálgama', paginas: ['Indicações atuais', 'Preparo classe I e II', 'Condensação e escultura', 'Acabamento e polimento', 'Substituição × reparo'] },
        { nome: 'Ionômero de vidro em posteriores', paginas: ['Indicações', 'Técnica e proteção', 'Restauração sanduíche', 'Tratamento restaurador atraumático'] },
        { nome: 'Grandes destruições', paginas: ['Pinos e retenção intrarradicular em dentes vitais', 'Restauração de dentes tratados endodonticamente', 'Quando indicar restauração indireta'] },
      ] },
      { nome: 'Restaurações diretas em anteriores', temas: [
        { nome: 'Classe III e V', paginas: ['Preparo e acesso', 'Técnica restauradora', 'Classe V: cárie × lesão não cariosa'] },
        { nome: 'Classe IV e fraturas', paginas: ['Guia de silicone', 'Estratificação: dentina, esmalte e efeitos', 'Colagem de fragmento'] },
        { nome: 'Estética direta', paginas: ['Fechamento de diastema', 'Facetas diretas', 'Recontorno e conoide', 'Textura, forma e polimento'] },
      ] },
      { nome: 'Lesões não cariosas e sensibilidade', temas: [
        { nome: 'Lesões não cariosas', paginas: ['Erosão: causas e diagnóstico', 'Abrasão e abfração', 'Atrição e bruxismo', 'Quando restaurar', 'Prevenção'] },
        { nome: 'Hipersensibilidade dentinária', paginas: ['Mecanismo', 'Diagnóstico diferencial', 'Dessensibilizantes e laser', 'Tratamento restaurador'] },
      ] },
      { nome: 'Restaurações indiretas', temas: [
        { nome: 'Inlay, onlay e overlay', paginas: ['Indicações', 'Princípios de preparo', 'Preparo passo a passo', 'Provisório', 'Moldagem ou escaneamento', 'Materiais: cerâmica × resina'] },
        { nome: 'Cimentação adesiva', paginas: ['Tratamento da peça por material', 'Tratamento do dente', 'Cimento resinoso: escolha', 'Remoção de excessos e polimerização', 'Selamento dentinário imediato'] },
        { nome: 'Facetas cerâmicas', paginas: ['Indicações e contraindicações', 'Planejamento e mock-up', 'Preparos: guias e profundidade', 'Provisórios', 'Prova e cimentação', 'Facetas sem preparo'] },
        { nome: 'Coroas em dentística', paginas: ['Endocrown', 'Coroa parcial', 'Limites com a prótese'] },
      ] },
      { nome: 'Clareamento', temas: [
        { nome: 'Fundamentos', paginas: ['Etiologia das alterações de cor', 'Mecanismo do clareamento', 'Agentes e concentrações'] },
        { nome: 'Técnicas', paginas: ['Clareamento caseiro supervisionado', 'Clareamento de consultório', 'Técnica combinada', 'Dentes não vitais: técnicas', 'Luz e laser: o que a evidência diz'] },
        { nome: 'Efeitos e situações especiais', paginas: ['Sensibilidade: prevenção e manejo', 'Efeitos em esmalte e restaurações', 'Manchas por fluorose: microabrasão e infiltrante', 'Manchas por tetraciclina', 'Clareamento em adolescentes'] },
      ] },
      { nome: 'Manutenção e falhas', temas: [
        { nome: 'Longevidade', paginas: ['Por que restaurações falham', 'Avaliação de restaurações: critérios', 'Reparo × substituição', 'Acompanhamento'] },
      ] },
      { nome: 'Estética e fluxo digital', temas: [
        { nome: 'Planejamento estético', paginas: ['Análise do sorriso', 'Proporções e formas dentárias', 'Planejamento digital do sorriso', 'Mock-up: confecção e uso'] },
        { nome: 'Cor', paginas: ['Ciência da cor', 'Seleção visual e digital', 'Comunicação com o laboratório', 'Fotografia para cor'] },
        { nome: 'Dentística digital', paginas: ['Escaneamento em restaurações indiretas', 'Restaurações CAD/CAM em sessão única', 'Impressão 3D de guias e provisórios'] },
      ] },
      { nome: 'Dentística em situações especiais', temas: [
        { nome: 'Pacientes e condições', paginas: ['Dentística no idoso', 'Dentística em dentes com defeitos de esmalte', 'Dentística após clareamento e ortodontia', 'Dentística no paciente com bruxismo'] },
      ] },
    ],
  },
  {
    nome: 'Endodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Da dor de dente ao canal obturado: diagnóstico, acesso, preparo e obturação.',
    modulos: [
      { nome: 'Bases biológicas', temas: [
        { nome: 'Complexo dentino-pulpar aplicado', paginas: ['Polpa: defesa e reparo', 'Dentina terciária', 'Envelhecimento e calcificação', 'Periápice: tecidos'] },
        { nome: 'Patologias pulpares', paginas: ['Polpa normal e pulpite reversível', 'Pulpite irreversível sintomática e assintomática', 'Necrose pulpar', 'Reabsorção interna', 'Classificação clínica atual'] },
        { nome: 'Patologias periapicais', paginas: ['Periodontite apical sintomática e assintomática', 'Abscesso apical agudo e crônico', 'Osteíte condensante', 'Granuloma e cisto: diferenças'] },
        { nome: 'Microbiologia endodôntica', paginas: ['Vias de infecção', 'Biofilme intrarradicular', 'Infecção persistente e extrarradicular'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Exame e testes', paginas: ['Anamnese da dor', 'Teste térmico frio e calor', 'Teste elétrico', 'Percussão, palpação e mobilidade', 'Teste de cavidade e transiluminação', 'Sondagem e fístula'] },
        { nome: 'Imagem', paginas: ['Radiografia periapical: técnica e leitura', 'Angulações e localização', 'Tomografia: quando pedir'] },
        { nome: 'Diagnóstico diferencial', paginas: ['Dor odontogênica × não odontogênica', 'Lesão endo-perio', 'Trincas e fraturas', 'Dor referida'] },
        { nome: 'Plano e prognóstico', paginas: ['Tratar, retratar ou extrair', 'Restaurabilidade', 'Prognóstico'] },
      ] },
      { nome: 'Anatomia e acesso', temas: [
        { nome: 'Anatomia interna', paginas: ['Câmara pulpar e assoalho', 'Número de canais por grupo', 'Classificação de Vertucci', 'Canais MV2, istmos e canal em C', 'Curvaturas: classificação e medida', 'Forame e delta apical'] },
        { nome: 'Abertura coronária', paginas: ['Princípios', 'Forma de contorno dente a dente', 'Localização de canais e ultrassom', 'Magnificação', 'Erros: perfuração e desvio'] },
        { nome: 'Odontometria', paginas: ['Comprimento de trabalho: conceitos', 'Localizador apical: uso e limites', 'Radiografia com lima', 'Limite apical'] },
      ] },
      { nome: 'Preparo do canal', temas: [
        { nome: 'Instrumentos', paginas: ['Limas manuais: tipos e padronização', 'Ligas de níquel-titânio', 'Sistemas rotatórios contínuos', 'Sistemas reciprocantes', 'Motores e torque'] },
        { nome: 'Técnicas de instrumentação', paginas: ['Coroa-ápice e escalonada', 'Glide path e patência', 'Protocolo rotatório passo a passo', 'Protocolo reciprocante', 'Canais curvos e calcificados'] },
        { nome: 'Irrigação', paginas: ['Objetivos', 'Hipoclorito: concentração, volume e tempo', 'EDTA e ácido cítrico', 'Clorexidina', 'Ativação: ultrassônica e sônica', 'Protocolo final', 'Acidente com hipoclorito'] },
        { nome: 'Medicação intracanal', paginas: ['Hidróxido de cálcio', 'Outras medicações', 'Quando usar e por quanto tempo'] },
        { nome: 'Acidentes durante o preparo', paginas: ['Fratura de instrumento: prevenir e resolver', 'Degrau e desvio', 'Perfuração', 'Extrusão de material'] },
      ] },
      { nome: 'Obturação', temas: [
        { nome: 'Materiais', paginas: ['Guta-percha', 'Cimentos: resinosos, biocerâmicos e outros', 'Propriedades ideais'] },
        { nome: 'Técnicas', paginas: ['Condensação lateral', 'Cone único', 'Termoplastificadas: onda contínua e injeção', 'Critérios de qualidade', 'Remoção de excessos'] },
        { nome: 'Sessão única × múltiplas', paginas: ['Evidência', 'Critérios de decisão', 'Selamento provisório'] },
        { nome: 'Restauração pós-endodôntica', paginas: ['Por que é urgente', 'Pinos: quando', 'Comunicação com dentística e prótese'] },
      ] },
      { nome: 'Situações clínicas especiais', temas: [
        { nome: 'Emergências', paginas: ['Pulpite: conduta', 'Abscesso: drenagem', 'Flare-up', 'Medicação sistêmica'] },
        { nome: 'Traumatismo', paginas: ['Conduta endodôntica no trauma', 'Reabsorções: tipos e tratamento', 'Contenção'] },
        { nome: 'Dentes jovens', paginas: ['Pulpotomia em permanentes jovens', 'Apicificação', 'Revascularização e endodontia regenerativa'] },
        { nome: 'Endodontia no idoso e no paciente especial', paginas: ['Canais calcificados', 'Pacientes sistêmicos'] },
      ] },
      { nome: 'Retratamento e cirurgia', temas: [
        { nome: 'Retratamento', paginas: ['Quando retratar', 'Remoção de guta-percha', 'Remoção de pinos', 'Desobstrução e ultrassom', 'Perfurações: MTA'] },
        { nome: 'Cirurgia paraendodôntica', paginas: ['Indicações', 'Retalho e osteotomia', 'Apicectomia e retropreparo', 'Materiais retrobturadores', 'Pós-operatório e prognóstico'] },
      ] },
      { nome: 'Tecnologia e acompanhamento', temas: [
        { nome: 'Recursos', paginas: ['Microscópio', 'Ultrassom', 'Laser e fotodinâmica', 'Endodontia guiada'] },
        { nome: 'Proservação', paginas: ['Critérios de sucesso', 'Intervalos', 'Reparo periapical'] },
      ] },
      { nome: 'Endodontia e outras áreas', temas: [
        { nome: 'Interfaces', paginas: ['Lesão endo-perio: classificação e conduta', 'Endodontia e prótese: pinos e restaurabilidade', 'Endodontia e ortodontia: movimento de dentes tratados', 'Endodontia e implantes: manter ou extrair'] },
        { nome: 'Farmacologia em endodontia', paginas: ['Analgesia e anti-inflamatórios', 'Antibióticos: quando realmente', 'Anestesia em pulpite: técnicas complementares'] },
        { nome: 'Endodontia em decíduos e no paciente especial', paginas: ['Particularidades', 'Pacientes sistêmicos e anticoagulados'] },
      ] },
    ],
  },
  {
    nome: 'Periodontia', ciclo: 'clínico', cfo: true,
    descricao: 'Gengiva e osso: diagnosticar, raspar, operar e manter.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Periodonto saudável', paginas: ['Gengiva: partes e características', 'Ligamento, cemento e osso alveolar', 'Biótipo e fenótipo', 'Inserção tecidual supracrestal (tradicionalmente "espaço biológico" ou distância biológica)'] },
        { nome: 'Etiopatogenia', paginas: ['Biofilme e cálculo', 'Da gengivite à periodontite', 'Resposta do hospedeiro e destruição', 'Fatores de risco: fumo, diabetes e genética', 'Fatores locais: restaurações e anatomia'] },
        { nome: 'Periodontia e sistemia', paginas: ['Diabetes', 'Doença cardiovascular', 'Gestação', 'Doenças respiratórias e outras'] },
        { nome: 'Epidemiologia', paginas: ['Prevalência', 'Índices periodontais'] },
      ] },
      { nome: 'Classificação 2017', temas: [
        { nome: 'Saúde e gengivite', paginas: ['Saúde em periodonto intacto e reduzido', 'Gengivite induzida por biofilme', 'Doenças gengivais não induzidas por biofilme'] },
        { nome: 'Periodontite', paginas: ['Estágios I a IV', 'Graus A, B e C', 'Extensão e distribuição', 'Como estadiar passo a passo'] },
        { nome: 'Outras condições', paginas: ['Doenças necrosantes', 'Periodontite como manifestação de doença sistêmica', 'Abscessos e lesões endo-perio', 'Deformidades mucogengivais', 'Trauma oclusal', 'Condições periimplantares'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Exame periodontal', paginas: ['Sondagem: técnica e forças', 'Profundidade, nível de inserção e recessão', 'Sangramento e supuração', 'Mobilidade', 'Furcas: classificação e sondagem', 'Periograma completo'] },
        { nome: 'Exames complementares', paginas: ['Radiografia: perda óssea', 'Tomografia', 'Testes microbiológicos e biomarcadores'] },
        { nome: 'Prognóstico e plano', paginas: ['Prognóstico dente a dente', 'Fases do tratamento', 'Dentes questionáveis: manter ou extrair', 'Quando encaminhar'] },
      ] },
      { nome: 'Tratamento não cirúrgico', temas: [
        { nome: 'Controle de biofilme', paginas: ['Orientação de higiene', 'Escovação e interdentais', 'Motivação e adesão', 'Antissépticos'] },
        { nome: 'Instrumentação', paginas: ['Curetas de Gracey: áreas', 'Curetas universais e foices', 'Ultrassom e piezo', 'Raspagem e alisamento radicular passo a passo', 'Afiação', 'Boca completa × quadrantes'] },
        { nome: 'Coadjuvantes', paginas: ['Antibióticos sistêmicos: quando', 'Antimicrobianos locais', 'Laser e fotodinâmica', 'Controle de fatores de risco'] },
        { nome: 'Reavaliação', paginas: ['Quando e o que medir', 'Critérios de sucesso', 'Decisão cirúrgica'] },
        { nome: 'Situações especiais', paginas: ['Abscesso periodontal', 'Doenças necrosantes', 'Lesões endo-perio', 'Hipersensibilidade pós-raspagem'] },
      ] },
      { nome: 'Cirurgia periodontal', temas: [
        { nome: 'Princípios', paginas: ['Indicações e contraindicações', 'Instrumental', 'Incisões e retalhos', 'Suturas', 'Pós-operatório'] },
        { nome: 'Cirurgia ressectiva', paginas: ['Gengivectomia e gengivoplastia', 'Retalho de Widman modificado', 'Retalho de reposicionamento apical', 'Osteotomia e osteoplastia', 'Cirurgia de furca: tunelização e hemissecção'] },
        { nome: 'Aumento de coroa clínica', paginas: ['Indicações estéticas e restauradoras', 'Planejamento com a inserção tecidual supracrestal', 'Técnica', 'Cicatrização e tempo para restaurar'] },
        { nome: 'Cirurgia regenerativa', paginas: ['Defeitos ósseos: classificação', 'Regeneração tecidual guiada', 'Enxertos e biomateriais', 'Proteínas da matriz do esmalte', 'Fatores de crescimento', 'Regeneração de furca'] },
      ] },
      { nome: 'Cirurgia plástica periodontal', temas: [
        { nome: 'Recessões', paginas: ['Etiologia', 'Classificação de Cairo e Miller', 'Indicações de recobrimento'] },
        { nome: 'Técnicas', paginas: ['Enxerto gengival livre', 'Enxerto de tecido conjuntivo: remoção', 'Retalho posicionado coronalmente', 'Túnel', 'Matrizes colágenas e substitutos', 'Recobrimento em múltiplas recessões'] },
        { nome: 'Outras', paginas: ['Frenectomia', 'Aumento de gengiva queratinizada', 'Preservação e reconstrução de papila', 'Cirurgia estética com prótese'] },
      ] },
      { nome: 'Periodontia e outras áreas', temas: [
        { nome: 'Interfaces', paginas: ['Periodontia e ortodontia', 'Periodontia e prótese', 'Periodontia e endodontia', 'Trauma oclusal e contenção'] },
      ] },
      { nome: 'Implantes e manutenção', temas: [
        { nome: 'Tecidos periimplantares', paginas: ['Diferenças do periodonto', 'Saúde periimplantar'] },
        { nome: 'Mucosite e periimplantite', paginas: ['Diagnóstico', 'Fatores de risco', 'Tratamento não cirúrgico', 'Tratamento cirúrgico', 'Prevenção'] },
        { nome: 'Terapia periodontal de suporte', paginas: ['Objetivos', 'Intervalos por risco', 'Protocolo da consulta', 'Recidiva'] },
      ] },
      { nome: 'Farmacologia e tecnologias em periodontia', temas: [
        { nome: 'Medicamentos', paginas: ['Antibióticos sistêmicos: protocolos', 'Moduladores do hospedeiro', 'Antissépticos e dentifrícios terapêuticos', 'Aumento gengival medicamentoso'] },
        { nome: 'Tecnologias', paginas: ['Laser e terapia fotodinâmica', 'Piezocirurgia', 'Microscopia e microcirurgia periodontal', 'Fluxo digital em periodontia'] },
        { nome: 'Periodontia em populações especiais', paginas: ['Gestantes', 'Diabéticos e cardiopatas', 'Fumantes: cessação', 'Idosos e pacientes com deficiência'] },
      ] },
    ],
  },
  {
    nome: 'Prótese dentária', ciclo: 'clínico', cfo: true,
    descricao: 'Repor dentes: da coroa unitária à prótese total, do preparo à entrega.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Planejamento em prótese', paginas: ['Exame e diagnóstico protético', 'Modelos de estudo e enceramento', 'Escolha entre fixa, removível e implante', 'Prognóstico e comunicação'] },
        { nome: 'Oclusão em prótese', paginas: ['Dimensão vertical', 'Relação cêntrica e registro', 'Esquema oclusal por tipo de prótese', 'Articuladores e arco facial revisados'] },
        { nome: 'Estética', paginas: ['Análise facial e do sorriso', 'Proporções dentárias', 'Cor: seleção e comunicação', 'Planejamento digital do sorriso'] },
      ] },
      { nome: 'Prótese fixa unitária', temas: [
        { nome: 'Princípios dos preparos', paginas: ['Preservação, retenção e resistência', 'Términos cervicais: tipos e indicações', 'Instrumental de preparo', 'Preparo em dente vital: proteção'] },
        { nome: 'Preparos por tipo', paginas: ['Coroa total metalocerâmica', 'Coroa total cerâmica', 'Coroa em zircônia', 'Coroa metálica', 'Preparos para dentes posteriores e anteriores'] },
        { nome: 'Dente tratado endodonticamente', paginas: ['Quanto de dente sobra: efeito férula', 'Núcleo metálico fundido', 'Pino de fibra de vidro', 'Preparo do canal e cimentação do pino', 'Reconstrução com resina'] },
        { nome: 'Provisórios', paginas: ['Funções', 'Técnicas direta e indireta', 'Materiais', 'Ajuste e cimentação provisória'] },
        { nome: 'Afastamento gengival e moldagem', paginas: ['Fio retrator e técnicas', 'Substâncias hemostáticas', 'Moldagem com elastômero', 'Escaneamento intraoral', 'Modelo de trabalho e troquel'] },
        { nome: 'Prova e cimentação', paginas: ['Prova de infraestrutura', 'Prova de cerâmica e ajuste', 'Ajuste oclusal', 'Cimentação convencional', 'Cimentação adesiva', 'Cimentação de zircônia'] },
      ] },
      { nome: 'Prótese parcial fixa', temas: [
        { nome: 'Planejamento', paginas: ['Indicações e contraindicações', 'Pilares: lei de Ante e critérios', 'Pônticos: tipos', 'Conectores rígidos e semirrígidos', 'Prótese em cantiléver'] },
        { nome: 'Execução', paginas: ['Paralelismo dos preparos', 'Provisórios de múltiplos elementos', 'Soldagem e passividade', 'Instalação e manutenção'] },
        { nome: 'Prótese adesiva', paginas: ['Indicações', 'Preparo', 'Cimentação'] },
      ] },
      { nome: 'Prótese parcial removível', temas: [
        { nome: 'Fundamentos', paginas: ['Indicações', 'Classificação de Kennedy e regras de Applegate', 'Biomecânica: suporte dental e mucoso'] },
        { nome: 'Componentes', paginas: ['Conectores maiores superiores e inferiores', 'Conectores menores', 'Apoios e nichos', 'Retentores: grampos circunferenciais e de barra', 'Retentores indiretos', 'Selas e dentes'] },
        { nome: 'Delineamento', paginas: ['Delineador e equador protético', 'Vias de inserção', 'Áreas retentivas', 'Desenho da estrutura por classe de Kennedy'] },
        { nome: 'Etapas clínicas', paginas: ['Preparo de boca: nichos e planos guia', 'Moldagem anatômica', 'Moldagem funcional e modelo alterado', 'Prova da estrutura', 'Registro oclusal', 'Prova de dentes', 'Instalação e ajustes', 'Manutenção e reembasamento'] },
        { nome: 'Prótese removível provisória', paginas: ['Prótese acrílica', 'Flexível: quando'] },
      ] },
      { nome: 'Prótese total', temas: [
        { nome: 'O paciente edêntulo', paginas: ['Anatomia das arcadas edêntulas', 'Reabsorção e classificação do rebordo', 'Exame e expectativas', 'Psicologia do edêntulo'] },
        { nome: 'Moldagem', paginas: ['Moldeira de estoque e moldagem anatômica', 'Moldeira individual', 'Selamento periférico', 'Moldagem funcional', 'Modelo de trabalho e caixa de moldagem'] },
        { nome: 'Registros', paginas: ['Bases de prova e planos de orientação', 'Dimensão vertical: métodos', 'Relação cêntrica: obtenção e registro', 'Arco facial e montagem'] },
        { nome: 'Dentes e montagem', paginas: ['Seleção: forma, tamanho e cor', 'Montagem dos anteriores', 'Montagem dos posteriores', 'Oclusão balanceada bilateral', 'Prova estética e funcional'] },
        { nome: 'Acrilização e instalação', paginas: ['Ceroplastia e inclusão', 'Acrilização e remontagem', 'Instalação e orientações', 'Ajustes e controles'] },
        { nome: 'Manutenção e problemas', paginas: ['Higiene da prótese', 'Estomatite protética', 'Reembasamento e reparo', 'Prótese total imediata', 'Prótese total unimaxilar'] },
        { nome: 'Overdenture', paginas: ['Sobre raízes', 'Sobre implantes: sistemas de retenção', 'Etapas'] },
      ] },
      { nome: 'Prótese sobre implante', temas: [
        { nome: 'Fundamentos', paginas: ['Componentes protéticos', 'Cimentada × parafusada', 'Perfil de emergência', 'Torque e passividade'] },
        { nome: 'Etapas', paginas: ['Moldagem de transferência: aberta e fechada', 'Escaneamento com scan body', 'Provisórios e condicionamento gengival', 'Instalação e manutenção'] },
        { nome: 'Reabilitações', paginas: ['Unitária', 'Parcial', 'Protocolo e prótese total fixa', 'Overdenture', 'Complicações protéticas'] },
      ] },
      { nome: 'Fluxo digital e laboratório', temas: [
        { nome: 'Odontologia digital', paginas: ['Escaneamento intraoral', 'Desenho assistido', 'Fresagem e impressão 3D', 'Articulador virtual', 'Provisórios e guias digitais'] },
        { nome: 'Comunicação com o laboratório', paginas: ['Ordem de serviço', 'Fotos e cor', 'Conferência do trabalho', 'Erros mais comuns'] },
      ] },
    ],
  },
];
