'use strict';
// Taxonomia de ENSINO — parte 5: demais especialidades reconhecidas pelo CFO
// (a maioria só aparece na graduação como tópico; aqui ganham escopo de
// especialização, mestrado e residência: um módulo por disciplina do curso).

module.exports = [
  {
    nome: 'Disfunção temporomandibular e dor orofacial', ciclo: 'pós', cfo: true,
    descricao: 'Dor na face que não é dente: diagnosticar, tratar e saber quando não é com o dentista.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Anatomia e fisiologia aplicadas', paginas: ['ATM revisada para a clínica', 'Músculos mastigatórios e cervicais', 'Neurofisiologia da dor', 'Dor aguda × crônica', 'Sensibilização periférica e central', 'Dor referida e convergência'] },
        { nome: 'Epidemiologia e etiologia', paginas: ['Prevalência', 'Modelo biopsicossocial', 'Fatores predisponentes, iniciadores e perpetuantes', 'Oclusão e DTM: o que a evidência diz', 'Genética e sexo'] },
        { nome: 'Classificação', paginas: ['Critérios diagnósticos para DTM: eixo I e II', 'DTM muscular', 'DTM articular: deslocamentos de disco', 'Doenças degenerativas e inflamatórias', 'Classificação internacional das dores orofaciais', 'Classificação das cefaleias'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Anamnese e exame', paginas: ['História da dor: roteiro', 'Escalas e questionários', 'Palpação muscular padronizada', 'Palpação e ausculta da ATM', 'Medidas de movimento mandibular', 'Exame cervical e postural', 'Exame neurológico básico'] },
        { nome: 'Imagem e exames', paginas: ['Radiografias e tomografia da ATM', 'Ressonância: disco e efusão', 'Quando pedir cada exame', 'Exames laboratoriais em artrites', 'Polissonografia: leitura básica'] },
        { nome: 'Diagnóstico diferencial', paginas: ['Dor odontogênica × não odontogênica', 'Neuralgia do trigêmeo e outras neuralgias', 'Cefaleias primárias: migrânea e tensional', 'Cefaleias trigêmino-autonômicas', 'Dor neuropática e pós-traumática', 'Síndrome da ardência bucal', 'Dor de origem cervical, sinusal e otológica', 'Arterite temporal e sinais de alerta'] },
      ] },
      { nome: 'Tratamento conservador', temas: [
        { nome: 'Educação e autocuidado', paginas: ['Explicar a dor ao paciente', 'Controle de hábitos', 'Termoterapia e exercícios', 'Higiene do sono', 'Dieta e postura'] },
        { nome: 'Placas oclusais', paginas: ['Tipos e indicações', 'Placa estabilizadora: confecção e ajuste', 'Placa reposicionadora', 'Placas parciais: riscos', 'Acompanhamento e efeitos adversos'] },
        { nome: 'Fisioterapia e recursos físicos', paginas: ['Exercícios terapêuticos', 'Terapia manual', 'Laser, TENS e ultrassom', 'Agulhamento seco', 'Fisioterapia cervical'] },
        { nome: 'Farmacologia da dor orofacial', paginas: ['Analgésicos e anti-inflamatórios', 'Relaxantes musculares', 'Antidepressivos tricíclicos e duais', 'Anticonvulsivantes', 'Opioides na dor crônica: limites', 'Infiltrações e bloqueios', 'Toxina botulínica na DTM'] },
        { nome: 'Abordagem psicológica', paginas: ['Terapia cognitivo-comportamental', 'Manejo do estresse', 'Catastrofização e cinesiofobia', 'Trabalho com a psicologia'] },
      ] },
      { nome: 'Condições específicas', temas: [
        { nome: 'Bruxismo', paginas: ['Bruxismo do sono e em vigília', 'Diagnóstico e polissonografia', 'Manejo', 'Bruxismo em crianças', 'Bruxismo e restaurações'] },
        { nome: 'Deslocamentos e degeneração', paginas: ['Deslocamento de disco com e sem redução', 'Travamento agudo: manobras', 'Osteoartrite', 'Artrites sistêmicas', 'Hipermobilidade e luxação recorrente'] },
        { nome: 'Odontologia do sono', paginas: ['Apneia obstrutiva: bases', 'Papel do dentista e triagem', 'Aparelhos de avanço mandibular: indicação e titulação', 'Efeitos adversos dos aparelhos', 'Acompanhamento com a medicina do sono', 'Ronco e apneia na criança'] },
        { nome: 'Dores neuropáticas', paginas: ['Neuralgia do trigêmeo: tratamento', 'Dor neuropática pós-traumática', 'Dor persistente idiopática', 'Neuralgia pós-herpética'] },
        { nome: 'DTM em populações especiais', paginas: ['Crianças e adolescentes', 'Idosos', 'Pacientes com dor generalizada e fibromialgia', 'DTM e ortodontia'] },
      ] },
      { nome: 'Tratamento invasivo', temas: [
        { nome: 'Procedimentos', paginas: ['Artrocentese', 'Viscossuplementação', 'Artroscopia', 'Cirurgia aberta: indicações', 'Quando a cirurgia não ajuda'] },
      ] },
      { nome: 'Pesquisa e prática', temas: [
        { nome: 'Clínica de dor', paginas: ['Estruturar uma clínica de dor orofacial', 'Equipe multiprofissional', 'Documentação e desfechos', 'Leitura crítica da literatura em dor'] },
      ] },
    ],
  },
  {
    nome: 'Odontogeriatria', ciclo: 'pós', cfo: true,
    descricao: 'O paciente idoso: polifarmácia, fragilidade e reabilitação possível.',
    modulos: [
      { nome: 'Envelhecimento', temas: [
        { nome: 'Bases', paginas: ['Envelhecimento populacional no Brasil', 'Fisiologia do envelhecimento', 'Teorias do envelhecimento', 'Fragilidade e avaliação geriátrica ampla', 'Capacidade funcional e dependência', 'Estatuto do Idoso e políticas'] },
        { nome: 'Boca do idoso', paginas: ['Alterações dos dentes: desgaste e escurecimento', 'Periodonto no idoso', 'Mucosa e língua', 'Saliva e xerostomia', 'Edentulismo e reabsorção', 'Alterações da deglutição e disfagia', 'Paladar e olfato'] },
      ] },
      { nome: 'Doenças e medicamentos', temas: [
        { nome: 'Doenças cardiovasculares e metabólicas', paginas: ['Hipertensão e cardiopatias', 'Diabetes', 'Dislipidemias e obesidade', 'Doença renal crônica'] },
        { nome: 'Doenças osteoarticulares', paginas: ['Osteoporose e antirreabsortivos', 'Artrite e artrose', 'Osteonecrose por medicamentos'] },
        { nome: 'Doenças neurológicas e psiquiátricas', paginas: ['Doença de Parkinson', 'Demências: comunicação e conduta', 'Acidente vascular cerebral: sequelas', 'Depressão e ansiedade'] },
        { nome: 'Polifarmácia', paginas: ['Interações mais comuns', 'Medicamentos que causam xerostomia', 'Anticoagulantes no idoso', 'Ajuste de dose renal e hepático', 'Prescrição segura no idoso'] },
      ] },
      { nome: 'Clínica', temas: [
        { nome: 'Exame e planejamento', paginas: ['Anamnese com cuidador', 'Avaliação cognitiva rápida', 'Plano de tratamento realista', 'Consentimento e autonomia'] },
        { nome: 'Prevenção no idoso', paginas: ['Cárie radicular: prevenção e diamino fluoreto de prata', 'Higiene adaptada e escovas', 'Manutenção periodontal', 'Cuidado com próteses'] },
        { nome: 'Dentística e endodontia', paginas: ['Restaurações em dentes com desgaste', 'Cárie radicular: restauração', 'Endodontia em canais calcificados'] },
        { nome: 'Reabilitação', paginas: ['Prótese total no idoso', 'Prótese parcial removível no idoso', 'Overdentures', 'Implantes no idoso', 'Adaptação e expectativas', 'Reembasamento e reparos'] },
        { nome: 'Estomatologia geriátrica', paginas: ['Estomatite protética', 'Candidíase', 'Lesões potencialmente malignas', 'Câncer de boca no idoso', 'Lesões traumáticas por prótese'] },
        { nome: 'Cirurgia no idoso', paginas: ['Avaliação de risco', 'Exodontias e alveoloplastia', 'Cicatrização'] },
      ] },
      { nome: 'Cuidado e contexto', temas: [
        { nome: 'Atendimento fora do consultório', paginas: ['Atendimento domiciliar: equipamentos', 'Instituições de longa permanência', 'Higiene bucal do dependente e do cuidador', 'Pneumonia aspirativa e saúde bucal', 'Nutrição e saúde bucal'] },
        { nome: 'Ética e fim de vida', paginas: ['Autonomia e consentimento no idoso', 'Cuidados paliativos', 'Violência contra o idoso', 'Interdisciplinaridade em geriatria'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia para pacientes com necessidades especiais', ciclo: 'pós', cfo: true,
    descricao: 'Atender quem precisa de adaptação: deficiências, síndromes, doenças sistêmicas graves.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Conceitos', paginas: ['Quem é o paciente com necessidades especiais', 'Classificação', 'Legislação e direitos', 'Acessibilidade e adaptação do consultório', 'Comunicação com paciente e cuidador', 'Rede de atenção e CEO'] },
        { nome: 'Manejo', paginas: ['Manejo comportamental adaptado', 'Estabilização protetora: indicações e ética', 'Sedação consciente', 'Anestesia geral: indicações e fluxo', 'Prevenção intensiva', 'Adaptações de higiene'] },
      ] },
      { nome: 'Deficiências e transtornos', temas: [
        { nome: 'Deficiência intelectual e síndromes', paginas: ['Síndrome de Down: características e conduta', 'Síndromes genéticas frequentes', 'Deficiência intelectual: abordagem'] },
        { nome: 'Transtorno do espectro autista', paginas: ['Características', 'Dessensibilização e rotinas', 'Ambiente e comunicação visual', 'Seletividade alimentar e saúde bucal'] },
        { nome: 'Deficiências motoras', paginas: ['Paralisia cerebral', 'Lesão medular', 'Distrofias musculares', 'Posicionamento na cadeira'] },
        { nome: 'Deficiências sensoriais', paginas: ['Deficiência visual', 'Deficiência auditiva e Libras', 'Surdocegueira'] },
        { nome: 'Transtornos psiquiátricos', paginas: ['Esquizofrenia e transtorno bipolar', 'Transtornos alimentares', 'Dependência química', 'Medicamentos psiquiátricos e boca'] },
      ] },
      { nome: 'Doenças sistêmicas', temas: [
        { nome: 'Cardiovasculares e respiratórias', paginas: ['Cardiopatias congênitas e adquiridas', 'Profilaxia de endocardite', 'Hipertensão grave', 'Asma e DPOC'] },
        { nome: 'Hematológicas', paginas: ['Hemofilia e von Willebrand', 'Anemia falciforme', 'Plaquetopenias', 'Anticoagulação'] },
        { nome: 'Oncológicas', paginas: ['Pacientes em quimioterapia', 'Radioterapia de cabeça e pescoço', 'Transplante de medula'] },
        { nome: 'Renais, hepáticas e transplantados', paginas: ['Diálise', 'Transplante renal e hepático', 'Imunossupressão'] },
        { nome: 'Neurológicas', paginas: ['Epilepsia', 'Doenças neuromusculares', 'Esclerose múltipla'] },
        { nome: 'Infecciosas e endócrinas', paginas: ['HIV', 'Hepatites', 'Diabetes descompensado', 'Tireoidopatias'] },
      ] },
      { nome: 'Grupos especiais', temas: [
        { nome: 'Gestantes e outros', paginas: ['Gestante de alto risco', 'Paciente com fissura', 'Paciente acamado'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia hospitalar', ciclo: 'pós', cfo: true,
    descricao: 'O dentista na equipe do hospital: UTI, oncologia e cuidados paliativos.',
    modulos: [
      { nome: 'Ambiente hospitalar', temas: [
        { nome: 'Estrutura e rotina', paginas: ['Organização do hospital', 'Prontuário, evolução e prescrição hospitalar', 'Comissões e protocolos', 'Legislação da odontologia hospitalar', 'Segurança do paciente'] },
        { nome: 'Equipe', paginas: ['Equipe multiprofissional', 'Interconsulta e parecer', 'Comunicação com médicos e enfermagem', 'Rounds e discussão de casos'] },
        { nome: 'Exames', paginas: ['Interpretação de exames laboratoriais', 'Imagem hospitalar', 'Sinais vitais e monitorização', 'Gasometria e eletrólitos: noções'] },
        { nome: 'Controle de infecção hospitalar', paginas: ['Precauções por via de transmissão', 'Bactérias multirresistentes', 'Higiene das mãos no hospital'] },
      ] },
      { nome: 'Paciente crítico', temas: [
        { nome: 'UTI', paginas: ['Higiene bucal na UTI: protocolo', 'Pneumonia associada à ventilação', 'Paciente intubado e traqueostomizado', 'Lesões por pressão na boca', 'Sedação e agitação'] },
        { nome: 'Emergências no hospital', paginas: ['Suporte básico e avançado', 'Hemorragia bucal em internados', 'Infecções odontogênicas graves', 'Trauma facial no pronto-socorro'] },
      ] },
      { nome: 'Condições clínicas', temas: [
        { nome: 'Oncologia', paginas: ['Adequação bucal pré-tratamento', 'Mucosite: prevenção e laser', 'Osteorradionecrose e osteonecrose', 'Transplante de medula e doença do enxerto', 'Infecções oportunistas'] },
        { nome: 'Comprometidos sistemicamente', paginas: ['Anticoagulados e cardiopatas', 'Diálise e transplante renal', 'Diabéticos descompensados', 'Gestantes de alto risco', 'Neurológicos e acamados'] },
        { nome: 'Cirurgia em ambiente hospitalar', paginas: ['Atendimento sob anestesia geral', 'Pacientes com necessidades especiais no hospital', 'Pré e pós-operatório', 'Centro cirúrgico: rotina'] },
        { nome: 'Cuidados paliativos', paginas: ['Conforto bucal no fim da vida', 'Xerostomia e candidíase', 'Comunicação e ética', 'Luto e equipe'] },
      ] },
      { nome: 'O essencial para a graduação', temas: [
        { nome: 'O que todo dentista precisa saber do hospital', paginas: ['Reconhecer o paciente hospitalizado ou recém-internado', 'Higiene oral e prevenção de complicações', 'Interconsulta: como pedir e responder', 'Segurança do paciente', 'Quando encaminhar'] },
      ] },
      { nome: 'Pediatria e neonatologia', temas: [
        { nome: 'Criança hospitalizada', paginas: ['UTI neonatal e pediátrica', 'Oncologia pediátrica', 'Cardiopatas congênitos'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia legal', ciclo: 'pós', cfo: true,
    descricao: 'Ética, direito e perícia: o que protege o dentista e o paciente.',
    modulos: [
      { nome: 'Ética e legislação', temas: [
        { nome: 'Código de ética odontológica', paginas: ['Princípios', 'Deveres e direitos', 'Relação com pacientes', 'Relação com colegas e equipe', 'Publicidade e redes sociais', 'Infrações, processo ético e penas'] },
        { nome: 'Exercício profissional', paginas: ['Lei 5.081/66', 'Conselhos: CFO e CROs', 'Especialidades: registro', 'Auxiliares e técnicos', 'Exercício ilegal'] },
        { nome: 'Legislação aplicada', paginas: ['Código Civil e responsabilidade', 'Código de Defesa do Consumidor', 'Código Penal: lesão corporal e omissão', 'Lei Geral de Proteção de Dados', 'Legislação sanitária e trabalhista', 'Estatutos da criança e do idoso'] },
      ] },
      { nome: 'Responsabilidade profissional', temas: [
        { nome: 'Responsabilidade civil', paginas: ['Obrigação de meio e de resultado', 'Culpa: imperícia, imprudência e negligência', 'Dano e nexo causal', 'Indenização e dano moral', 'Responsabilidade de clínicas e planos'] },
        { nome: 'Defesa', paginas: ['Documentação que protege', 'Processo ético, cível e penal', 'Seguro de responsabilidade', 'Mediação e conciliação', 'Casos reais comentados'] },
      ] },
      { nome: 'Documentação', temas: [
        { nome: 'Prontuário', paginas: ['Componentes obrigatórios', 'Preenchimento e evolução', 'Guarda e prazo', 'Prontuário eletrônico e assinatura digital', 'Imagens e sigilo'] },
        { nome: 'Termos e contratos', paginas: ['Consentimento livre e esclarecido', 'Contrato de prestação de serviço', 'Atestados e declarações', 'Receitas e documentos de sedação', 'Orçamento e nota fiscal'] },
      ] },
      { nome: 'Perícia e identificação', temas: [
        { nome: 'Identificação humana', paginas: ['Métodos de identificação', 'Identificação pela arcada dentária', 'Estimativa de idade', 'Estimativa de sexo e ancestralidade: métodos e limitações', 'Rugoscopia palatina e queiloscopia', 'DNA em odontologia', 'Imagem forense'] },
        { nome: 'Antropologia forense', paginas: ['Exame de ossadas', 'Desastres em massa: protocolo', 'Reconstrução facial', 'Tafonomia: noções'] },
        { nome: 'Perícia odontolegal', paginas: ['Laudos e pareceres', 'Avaliação de dano corporal', 'Marcas de mordida: histórico, limitações e evidência científica', 'Perícia em processos cíveis e trabalhistas', 'Perícia em planos de saúde', 'Perícia administrativa e previdenciária'] },
      ] },
      { nome: 'Traumatologia forense', temas: [
        { nome: 'Lesões', paginas: ['Classificação das lesões corporais', 'Lesões na face e na boca', 'Violência doméstica e maus-tratos: reconhecer e notificar', 'Exame de corpo de delito'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia do trabalho', ciclo: 'pós', cfo: true,
    descricao: 'Saúde bucal do trabalhador e doenças ocupacionais da boca.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Saúde do trabalhador', paginas: ['História e conceitos', 'Legislação trabalhista e previdenciária', 'Normas regulamentadoras relevantes', 'Programas de saúde ocupacional', 'Rede de atenção à saúde do trabalhador'] },
        { nome: 'Odontologia na empresa', paginas: ['Exames admissional, periódico e demissional', 'Programas de saúde bucal', 'Absenteísmo e saúde bucal', 'Custo e retorno', 'Odontologia ocupacional em serviços públicos'] },
      ] },
      { nome: 'Doenças e riscos', temas: [
        { nome: 'Riscos ocupacionais', paginas: ['Químicos: ácidos, metais e poeiras', 'Físicos: ruído, vibração e radiação', 'Biológicos', 'Ergonômicos e psicossociais', 'Mapa de risco'] },
        { nome: 'Doenças ocupacionais da boca', paginas: ['Erosão por ácidos', 'Pigmentações e linhas', 'Lesões de mucosa por agentes químicos', 'Trauma e DTM ocupacional', 'Câncer ocupacional'] },
        { nome: 'Profissões de risco', paginas: ['Indústria química e galvanoplastia', 'Padeiros e confeiteiros', 'Mergulhadores e aviadores', 'Músicos de sopro', 'Profissionais da saúde'] },
      ] },
      { nome: 'Perícia e gestão', temas: [
        { nome: 'Perícia', paginas: ['Nexo causal', 'Perícia previdenciária', 'Laudos e comunicação de acidente'] },
        { nome: 'Epidemiologia ocupacional', paginas: ['Indicadores', 'Vigilância', 'Promoção de saúde no trabalho', 'Ergonomia do próprio dentista'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia do esporte', ciclo: 'pós', cfo: true,
    descricao: 'Atleta: proteção, trauma e desempenho.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Odontologia e esporte', paginas: ['Histórico e escopo', 'Fisiologia do exercício: noções', 'Saúde bucal e desempenho', 'Exame pré-participação', 'Trabalho com a equipe multiprofissional'] },
        { nome: 'Trauma no esporte', paginas: ['Epidemiologia por modalidade', 'Prevenção', 'Atendimento em campo', 'Kit de emergência esportivo', 'Concussão: sinais'] },
      ] },
      { nome: 'Protetores e prevenção', temas: [
        { nome: 'Protetores bucais', paginas: ['Tipos e evidência', 'Protetor personalizado: confecção', 'Ajuste e manutenção', 'Protetores em aparelho ortodôntico', 'Protetores por modalidade'] },
        { nome: 'Riscos específicos', paginas: ['Erosão e bebidas esportivas', 'Cárie e suplementos', 'Bruxismo e DTM no atleta', 'Foco infeccioso e lesões musculares', 'Respiração e desempenho'] },
      ] },
      { nome: 'Legislação e ética', temas: [
        { nome: 'Doping', paginas: ['Substâncias proibidas e medicamentos odontológicos', 'Prescrição para atletas', 'Ética no esporte', 'Atuação em clubes e eventos'] },
      ] },
    ],
  },
  {
    nome: 'Prótese bucomaxilofacial', ciclo: 'pós', cfo: true,
    descricao: 'Reabilitar faces mutiladas: obturadores, próteses oculares e faciais.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Defeitos', paginas: ['Etiologia: câncer, trauma e malformações', 'Classificação dos defeitos maxilares', 'Defeitos mandibulares', 'Defeitos faciais', 'Planejamento com a equipe', 'Aspectos psicossociais'] },
        { nome: 'Materiais', paginas: ['Silicones', 'Resinas', 'Pigmentação e caracterização', 'Adesivos e retenção', 'Materiais de moldagem facial'] },
        { nome: 'Tecnologia', paginas: ['Escaneamento facial', 'Impressão 3D de moldes', 'Planejamento digital'] },
      ] },
      { nome: 'Próteses intraorais', temas: [
        { nome: 'Obturadores', paginas: ['Obturador cirúrgico', 'Obturador provisório', 'Obturador definitivo', 'Moldagem de defeitos maxilares', 'Fala e deglutição com obturador'] },
        { nome: 'Outras', paginas: ['Prótese para mandibulectomia', 'Prótese de palato mole e velofaríngea', 'Placas para fissurados e ortopedia pré-cirúrgica', 'Protetores para radioterapia'] },
      ] },
      { nome: 'Próteses extraorais', temas: [
        { nome: 'Faciais', paginas: ['Prótese ocular: confecção', 'Prótese orbital', 'Prótese auricular', 'Prótese nasal', 'Próteses combinadas', 'Retenção por implantes extraorais'] },
        { nome: 'Cuidados', paginas: ['Higiene e durabilidade', 'Aspectos psicológicos', 'Reabilitação após radioterapia', 'Acompanhamento'] },
      ] },
    ],
  },
  {
    nome: 'Ortopedia funcional dos maxilares', ciclo: 'pós', cfo: true,
    descricao: 'Corrigir a má oclusão pela função: aparelhos removíveis que estimulam o crescimento.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['Filosofia e história', 'Diferenças em relação à ortodontia', 'Crescimento e estímulo funcional', 'Leis de Planas', 'Neurofisiologia da função'] },
        { nome: 'Diagnóstico', paginas: ['Diagnóstico funcional', 'Análise postural e respiratória', 'Modelos e mudança de postura terapêutica', 'Exames de imagem', 'Documentação'] },
      ] },
      { nome: 'Aparelhos', temas: [
        { nome: 'Aparelhos clássicos', paginas: ['Bionator de Balters', 'Aparelhos de Planas: pistas diretas e indiretas', 'Simões Network', 'Bimler e Fränkel', 'Ativador e Klammt'] },
        { nome: 'Laboratório', paginas: ['Materiais e fios', 'Confecção passo a passo', 'Ativação e ajustes', 'Reparos'] },
      ] },
      { nome: 'Clínica', temas: [
        { nome: 'Tratamento por má oclusão', paginas: ['Classe II', 'Classe III', 'Mordida cruzada', 'Mordida aberta e profunda', 'Apinhamento', 'Assimetrias'] },
        { nome: 'Situações especiais', paginas: ['Respiração bucal e ronco', 'Hábitos', 'Adultos e DTM', 'Integração com ortodontia', 'Contenção e acompanhamento'] },
      ] },
      { nome: 'Tradição e evidência', temas: [
        { nome: 'O que é fundamento, o que é escola e o que a evidência sustenta', paginas: ['Fundamentos aceitos do crescimento e da função', 'Filosofias de tratamento: Planas, Balters, Bimler, Fränkel e Simões', 'Evidência sobre aparelhos funcionais removíveis', 'Alegações controversas e como apresentá-las ao paciente'] },
      ] },
    ],
  },
  {
    nome: 'Harmonização orofacial', ciclo: 'pós', cfo: true,
    descricao: 'Toxina, preenchedores e bioestimuladores com anatomia e segurança.',
    nota: 'Escopo profissional sujeito às normas do CFO e às decisões judiciais vigentes na data da publicação: a Resolução CFO 198/2019 foi anulada pelo TRF1 em agosto de 2026 e o CFO recorre. Toda página desta área deve trazer a data da última revisão regulatória.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Anatomia aplicada', paginas: ['Camadas da face', 'Compartimentos de gordura', 'Ligamentos de retenção', 'Vascularização e zonas de perigo', 'Nervos e pontos de risco', 'Músculos da expressão: alvos'] },
        { nome: 'Envelhecimento e análise facial', paginas: ['Envelhecimento facial: mecanismos', 'Proporções e visagismo', 'Fotografia padronizada', 'Planejamento e expectativas', 'Dismorfia corporal: reconhecer'] },
        { nome: 'Ética, legislação e segurança', paginas: ['Resolução CFO 198/2019: escopo original', 'Situação regulatória em 2026: decisão do TRF1 (agosto), recursos do CFO e o que continua permitido', 'Fronteira com a Cirurgia Estética Orofacial (Resolução CFO 286/2026)', 'Consentimento e documentação', 'Publicidade', 'Biossegurança em procedimentos injetáveis', 'Kit de emergência', 'Farmacologia dos produtos'] },
      ] },
      { nome: 'Toxina botulínica', temas: [
        { nome: 'Fundamentos', paginas: ['Farmacologia e tipos', 'Reconstituição e diluição', 'Doses por região', 'Contraindicações'] },
        { nome: 'Aplicações', paginas: ['Terço superior: frontal, glabela e periorbital', 'Terço médio e inferior', 'Sorriso gengival', 'Bruxismo e hipertrofia de masseter', 'Sialorreia e hiperidrose', 'Assimetrias e paralisia facial'] },
        { nome: 'Complicações', paginas: ['Ptose e assimetrias', 'Prevenção e manejo', 'Resistência à toxina'] },
      ] },
      { nome: 'Preenchedores', temas: [
        { nome: 'Ácido hialurônico', paginas: ['Reologia e escolha do produto', 'Técnicas: agulha e cânula', 'Planos de aplicação', 'Volumes e sequência'] },
        { nome: 'Regiões', paginas: ['Lábios', 'Sulco nasogeniano', 'Mento e mandíbula', 'Malar e olheiras', 'Têmporas', 'Rinomodelação: riscos'] },
        { nome: 'Intercorrências', paginas: ['Oclusão vascular: reconhecer e agir', 'Hialuronidase: protocolo', 'Nódulos e infecção', 'Cegueira: prevenção', 'Edema e reações tardias'] },
      ] },
      { nome: 'Outros procedimentos', temas: [
        { nome: 'Bioestimuladores e fios', paginas: ['Bioestimuladores de colágeno', 'Fios de sustentação', 'Indicações e limites'] },
        { nome: 'Tecnologias e adjuvantes', paginas: ['Peelings e microagulhamento', 'Laser e luz intensa pulsada', 'Lipoplastia de papada', 'Plasma rico em plaquetas', 'Skinbooster'] },
      ] },
      { nome: 'Integração', temas: [
        { nome: 'Harmonização e odontologia', paginas: ['Planejamento com prótese e ortodontia', 'Sorriso e face: análise integrada', 'Gestão e precificação'] },
      ] },
    ],
  },
  {
    nome: 'Cirurgia estética orofacial', ciclo: 'pós', cfo: true,
    descricao: 'A especialidade cirúrgica da estética da face reconhecida pelo CFO em março de 2026: escopo, formação e segurança.',
    nota: 'Reconhecida pela Resolução CFO-SEC-286/2026 (20/03/2026), com formação mínima de 3.000 horas em 36 meses. Escopo em disputa judicial com o CFM na data desta árvore: toda página deve trazer a data da última revisão regulatória.',
    modulos: [
      { nome: 'Bases e regulação', temas: [
        { nome: 'A especialidade', paginas: ['Resolução CFO-SEC-286/2026: competências e requisitos', 'Formação: 3.000 horas em 36 meses', 'Fronteira com a harmonização orofacial e com a cirurgia bucomaxilofacial', 'Disputa com o CFM e o ato médico: o que está em julgamento', 'Responsabilidade civil e consentimento em cirurgia estética'] },
        { nome: 'Anatomia cirúrgica da face', paginas: ['Camadas, compartimentos e ligamentos', 'Nervo facial: ramos em risco', 'Vascularização e zonas de perigo', 'Gordura de Bichat e espaço bucal'] },
        { nome: 'Avaliação e planejamento', paginas: ['Análise facial e fotografia padronizada', 'Seleção do paciente e dismorfia corporal', 'Exames pré-operatórios', 'Planejamento digital'] },
      ] },
      { nome: 'Procedimentos', temas: [
        { nome: 'Bichectomia', paginas: ['Indicações e contraindicações', 'Técnica', 'Complicações: ducto parotídeo, nervo facial e assimetria'] },
        { nome: 'Lipoaspiração facial e de papada', paginas: ['Indicações', 'Técnica e cânulas', 'Complicações'] },
        { nome: 'Cirurgias de contorno', paginas: ['Mentoplastia e implantes de mento', 'Contorno mandibular', 'Lifting labial e lip lift'] },
        { nome: 'Rinoplastia e outros procedimentos', paginas: ['Rinoplastia: escopo e limites', 'Blefaroplastia e lifting: o que a resolução prevê', 'Enxertos de gordura'] },
      ] },
      { nome: 'Segurança', temas: [
        { nome: 'Ambiente e anestesia', paginas: ['Consultório × hospital: onde cada procedimento pode ser feito', 'Sedação e anestesia geral', 'Kit de emergência e equipe'] },
        { nome: 'Complicações e pós-operatório', paginas: ['Hematoma, infecção e necrose', 'Lesão nervosa', 'Cicatrização e manejo de cicatrizes', 'Revisão e insatisfação'] },
      ] },
    ],
  },
  {
    nome: 'Acupuntura', ciclo: 'pós', cfo: true,
    descricao: 'Acupuntura aplicada à dor orofacial e à ansiedade no consultório.',
    nota: 'Especialidade reconhecida pelo CFO. Separar, em cada página, os fundamentos da prática, os mecanismos propostos e a evidência clínica de cada indicação.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['História e legislação', 'Mecanismos neurofisiológicos', 'Medicina tradicional chinesa: noções', 'Evidência científica', 'Contraindicações'] },
        { nome: 'Técnica', paginas: ['Pontos e meridianos de interesse orofacial', 'Agulhamento: técnica e segurança', 'Auriculoterapia', 'Eletroacupuntura e laser', 'Moxabustão e ventosas: noções'] },
      ] },
      { nome: 'Aplicações', temas: [
        { nome: 'Dor', paginas: ['Dor orofacial e DTM', 'Dor pós-operatória', 'Neuralgias e cefaleias'] },
        { nome: 'Outras aplicações', paginas: ['Ansiedade e reflexo de vômito', 'Xerostomia', 'Paralisia facial', 'Bruxismo'] },
        { nome: 'Evidência por indicação', paginas: ['O que as revisões sistemáticas mostram para cada indicação', 'Placebo, expectativa e desenho dos estudos', 'Como apresentar limites ao paciente'] },
      ] },
    ],
  },
  {
    nome: 'Homeopatia', ciclo: 'pós', cfo: true,
    descricao: 'Homeopatia no escopo do dentista.',
    nota: 'Especialidade reconhecida pelo CFO. Toda página desta área deve declarar o nível de evidência da indicação e nunca apresentar a abordagem como substituta de tratamento convencional eficaz.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['Princípios e história', 'Legislação e farmácia homeopática', 'Semiologia homeopática', 'Evidência e limites'] },
        { nome: 'Farmácia', paginas: ['Preparo e dinamizações', 'Formas farmacêuticas', 'Prescrição'] },
      ] },
      { nome: 'Aplicações', temas: [
        { nome: 'Clínica', paginas: ['Matéria médica de interesse odontológico', 'Ansiedade e dor', 'Pós-operatório e inflamação', 'Aftas e herpes', 'Bruxismo e DTM'] },
        { nome: 'Nível de evidência por indicação', paginas: ['Ser especialidade reconhecida não equivale a eficácia demonstrada', 'O que as revisões sistemáticas mostram', 'Nunca substituir tratamento convencional eficaz', 'Como registrar e informar o paciente'] },
      ] },
    ],
  },
];
