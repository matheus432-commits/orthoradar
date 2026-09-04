'use strict';
// Taxonomia de ENSINO — parte 3: demais especialidades reconhecidas pelo CFO
// (a maioria só aparece na graduação como tópico; aqui ganham escopo completo
// para especialização, mestrado e residência).

module.exports = [
  {
    nome: 'Disfunção temporomandibular e dor orofacial', ciclo: 'pós', cfo: true,
    descricao: 'Dor na face que não é dente: diagnosticar, tratar e saber quando não é com o dentista.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Anatomia e fisiologia da dor', paginas: ['ATM e músculos revisados para a clínica', 'Mecanismos da dor aguda e crônica', 'Sensibilização central', 'Dor referida'] },
        { nome: 'Classificação', paginas: ['Critérios diagnósticos para DTM', 'DTM muscular, articular e mista', 'Classificação das dores orofaciais'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Exame', paginas: ['Anamnese da dor', 'Palpação muscular e articular', 'Movimentos mandibulares: medidas', 'Questionários e escalas'] },
        { nome: 'Imagem e exames', paginas: ['Quando pedir tomografia e ressonância', 'Achados normais e patológicos'] },
        { nome: 'Diagnóstico diferencial', paginas: ['Dor odontogênica × não odontogênica', 'Neuralgias: trigêmeo e outras', 'Cefaleias primárias', 'Dor neuropática e síndrome da ardência bucal'] },
      ] },
      { nome: 'Tratamento', temas: [
        { nome: 'Conservador', paginas: ['Educação e autocuidado', 'Placas oclusais: tipos e ajuste', 'Fisioterapia e exercícios', 'Termoterapia e laser'] },
        { nome: 'Farmacológico e infiltrativo', paginas: ['Relaxantes, antidepressivos e anticonvulsivantes', 'Infiltrações e agulhamento', 'Toxina botulínica na DTM'] },
        { nome: 'Bruxismo e sono', paginas: ['Bruxismo do sono e em vigília', 'Apneia do sono: papel do dentista', 'Aparelhos de avanço mandibular'] },
        { nome: 'Cirúrgico', paginas: ['Artrocentese', 'Artroscopia e cirurgia aberta: indicações'] },
      ] },
    ],
  },
  {
    nome: 'Odontogeriatria', ciclo: 'pós', cfo: true,
    descricao: 'O paciente idoso: polifarmácia, fragilidade e reabilitação possível.',
    modulos: [
      { nome: 'Envelhecimento', temas: [
        { nome: 'Alterações do envelhecimento', paginas: ['Boca e dente no idoso', 'Xerostomia e medicamentos', 'Fragilidade e avaliação geriátrica'] },
        { nome: 'Doenças sistêmicas frequentes', paginas: ['Hipertensão, diabetes e cardiopatias', 'Demências e comunicação', 'Osteoporose e bifosfonatos', 'Polifarmácia e interações'] },
      ] },
      { nome: 'Clínica', temas: [
        { nome: 'Cárie radicular e periodonto no idoso', paginas: ['Prevenção e diamino fluoreto de prata', 'Manutenção periodontal adaptada'] },
        { nome: 'Reabilitação', paginas: ['Prótese total no idoso', 'Overdentures', 'Implantes na terceira idade'] },
        { nome: 'Atendimento domiciliar e institucional', paginas: ['Instituições de longa permanência', 'Higiene bucal do dependente', 'Pneumonia aspirativa e boca'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia para pacientes com necessidades especiais', ciclo: 'pós', cfo: true,
    descricao: 'Atender quem precisa de adaptação: deficiências, síndromes, doenças sistêmicas graves.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Quem é o paciente especial', paginas: ['Classificação das necessidades', 'Acessibilidade e adaptação do consultório', 'Comunicação com paciente e cuidador'] },
        { nome: 'Manejo', paginas: ['Manejo comportamental', 'Estabilização protetora', 'Sedação e anestesia geral: indicações'] },
      ] },
      { nome: 'Condições', temas: [
        { nome: 'Deficiência intelectual e autismo', paginas: ['Transtorno do espectro autista: abordagem', 'Síndrome de Down: características bucais', 'Paralisia cerebral'] },
        { nome: 'Doenças sistêmicas', paginas: ['Cardiopatias e profilaxia', 'Nefropatas e transplantados', 'Distúrbios da coagulação', 'Pacientes oncológicos'] },
        { nome: 'Transtornos e outras condições', paginas: ['Epilepsia', 'Transtornos psiquiátricos', 'Deficiência visual e auditiva', 'Doenças raras'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia hospitalar', ciclo: 'pós', cfo: true,
    descricao: 'O dentista na equipe do hospital: UTI, oncologia e cuidados paliativos.',
    modulos: [
      { nome: 'Ambiente hospitalar', temas: [
        { nome: 'Rotina e equipe', paginas: ['Estrutura e normas do hospital', 'Prontuário e evolução', 'Equipe multiprofissional', 'Interpretação de exames laboratoriais'] },
        { nome: 'Paciente crítico', paginas: ['Higiene bucal na UTI e pneumonia associada à ventilação', 'Paciente intubado: protocolo', 'Suporte básico e avançado de vida'] },
      ] },
      { nome: 'Condições clínicas', temas: [
        { nome: 'Oncologia', paginas: ['Adequação bucal antes de quimio e radioterapia', 'Mucosite: prevenção e laser', 'Osteorradionecrose e osteonecrose'] },
        { nome: 'Comprometidos sistemicamente', paginas: ['Anticoagulados e cardiopatas', 'Transplante de medula', 'Diálise e transplante renal'] },
        { nome: 'Cuidados paliativos e sedação', paginas: ['Conforto bucal no fim da vida', 'Sedação e anestesia geral em odontologia'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia legal', ciclo: 'pós', cfo: true,
    descricao: 'Ética, direito e perícia: o que protege o dentista e o paciente.',
    modulos: [
      { nome: 'Ética e legislação', temas: [
        { nome: 'Código de ética odontológica', paginas: ['Deveres e direitos', 'Publicidade e redes sociais', 'Relação com colegas e pacientes', 'Infrações e penas'] },
        { nome: 'Legislação profissional', paginas: ['Lei 5.081 e exercício da profissão', 'Conselhos: CFO e CROs', 'Auxiliares e técnicos'] },
        { nome: 'Responsabilidade civil e penal', paginas: ['Obrigação de meio e resultado', 'Código de Defesa do Consumidor', 'Documentação que protege', 'Processos: como se defender'] },
      ] },
      { nome: 'Perícia e identificação', temas: [
        { nome: 'Identificação humana', paginas: ['Métodos de identificação pelos dentes', 'Estimativa de idade e sexo', 'Marcas de mordida', 'Desastres em massa'] },
        { nome: 'Perícia odontolegal', paginas: ['Laudos e pareceres', 'Avaliação de dano corporal', 'Perícia em processos'] },
      ] },
      { nome: 'Documentação', temas: [
        { nome: 'Prontuário e consentimento', paginas: ['Prontuário completo', 'Termo de consentimento livre e esclarecido', 'Contrato de prestação de serviços', 'Guarda de documentos e LGPD'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia do trabalho', ciclo: 'pós', cfo: true,
    descricao: 'Saúde bucal do trabalhador e doenças ocupacionais da boca.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Saúde do trabalhador', paginas: ['Legislação trabalhista e normas regulamentadoras', 'Programas de saúde ocupacional', 'Exames admissional e periódico'] },
        { nome: 'Doenças ocupacionais', paginas: ['Erosão por ácidos e exposição química', 'Trauma e ruído', 'Riscos biológicos'] },
        { nome: 'Programas na empresa', paginas: ['Promoção de saúde bucal na empresa', 'Epidemiologia ocupacional', 'Perícia e nexo causal'] },
      ] },
    ],
  },
  {
    nome: 'Odontologia do esporte', ciclo: 'pós', cfo: true,
    descricao: 'Atleta: proteção, trauma e desempenho.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Trauma no esporte', paginas: ['Epidemiologia por modalidade', 'Protetores bucais: tipos e confecção', 'Atendimento do trauma em campo'] },
        { nome: 'Saúde bucal e desempenho', paginas: ['Erosão e bebidas esportivas', 'Foco infeccioso e desempenho', 'Exame pré-participação'] },
        { nome: 'Doping e legislação', paginas: ['Medicamentos e doping', 'Ética no esporte'] },
      ] },
    ],
  },
  {
    nome: 'Prótese bucomaxilofacial', ciclo: 'pós', cfo: true,
    descricao: 'Reabilitar faces mutiladas: obturadores, próteses oculares e faciais.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Defeitos e classificação', paginas: ['Defeitos maxilares e mandibulares', 'Sequelas de câncer, trauma e malformação', 'Planejamento com a equipe'] },
        { nome: 'Próteses', paginas: ['Obturadores palatinos', 'Prótese ocular', 'Prótese auricular e nasal', 'Materiais: silicones e resinas', 'Retenção por implantes'] },
      ] },
    ],
  },
  {
    nome: 'Ortopedia funcional dos maxilares', ciclo: 'pós', cfo: true,
    descricao: 'Corrigir a má oclusão pela função: aparelhos removíveis que estimulam o crescimento.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['Filosofia e diferenças em relação à ortodontia', 'Crescimento e estímulo funcional', 'Diagnóstico funcional e postural'] },
        { nome: 'Aparelhos', paginas: ['Bionator e Planas', 'Pistas diretas e indiretas', 'Simões Network', 'Confecção e ativação'] },
        { nome: 'Clínica', paginas: ['Classe II e III na ortopedia funcional', 'Mordida cruzada e aberta', 'Respiração bucal e postura'] },
      ] },
    ],
  },
  {
    nome: 'Harmonização orofacial', ciclo: 'pós', cfo: true,
    descricao: 'Toxina, preenchedores e bioestimuladores com anatomia e segurança.',
    modulos: [
      { nome: 'Bases', temas: [
        { nome: 'Anatomia aplicada', paginas: ['Camadas da face', 'Zonas de perigo vascular', 'Músculos da expressão: alvos', 'Envelhecimento facial'] },
        { nome: 'Análise facial', paginas: ['Proporções e visagismo', 'Fotografia padronizada', 'Planejamento e expectativas'] },
        { nome: 'Ética e legislação', paginas: ['Resolução do CFO e escopo', 'Consentimento e documentação', 'Publicidade'] },
      ] },
      { nome: 'Procedimentos', temas: [
        { nome: 'Toxina botulínica', paginas: ['Farmacologia e diluição', 'Pontos: terço superior', 'Sorriso gengival e bruxismo', 'Complicações'] },
        { nome: 'Preenchedores', paginas: ['Ácido hialurônico: reologia', 'Lábios', 'Sulco nasogeniano e mento', 'Intercorrências vasculares e hialuronidase'] },
        { nome: 'Outros', paginas: ['Bioestimuladores de colágeno', 'Fios de sustentação', 'Peelings e laser', 'Lipoplastia de papada'] },
      ] },
    ],
  },
  {
    nome: 'Acupuntura', ciclo: 'pós', cfo: true,
    descricao: 'Acupuntura aplicada à dor orofacial e à ansiedade no consultório.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['Princípios e mecanismos', 'Pontos e meridianos de interesse orofacial', 'Auriculoterapia'] },
        { nome: 'Aplicações', paginas: ['Dor orofacial e DTM', 'Ansiedade e reflexo de vômito', 'Xerostomia e paralisia facial'] },
      ] },
    ],
  },
  {
    nome: 'Homeopatia', ciclo: 'pós', cfo: true,
    descricao: 'Homeopatia no escopo do dentista.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Bases', paginas: ['Princípios e legislação', 'Matéria médica de interesse odontológico', 'Aplicações clínicas descritas na literatura'] },
      ] },
    ],
  },
];
