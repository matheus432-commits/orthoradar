'use strict';
// Taxonomia de ENSINO — parte 1: ciclo básico e pré-clínico da graduação.
//
// Fonte única dos temas que viram apostilas/guias para o aluno e aulas/
// provas para o professor. Estrutura: área → módulos → temas → páginas.
// "Páginas" são as unidades de apostila (cada uma vira um guia ilustrado).
// A granularidade segue a de um plano de ensino real: um módulo é um bloco
// de aulas, um tema é uma aula, uma página é um assunto dentro da aula.
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
      { nome: 'Osteologia do crânio', temas: [
        { nome: 'Visão geral do crânio', paginas: ['Neurocrânio e viscerocrânio', 'Normas: frontal, lateral, basal e superior', 'Suturas, fontanelas e crescimento', 'Pontos craniométricos usados na cefalometria'] },
        { nome: 'Osso frontal, parietal e occipital', paginas: ['Frontal e seio frontal', 'Parietais e sagital', 'Occipital, forame magno e côndilos'] },
        { nome: 'Osso temporal', paginas: ['Porções escamosa, timpânica e petrosa', 'Fossa mandibular e tubérculo articular', 'Processo estiloide e mastoide', 'Meato acústico e relações com a ATM'] },
        { nome: 'Esfenoide e etmoide', paginas: ['Corpo, asas e processos pterigóideos', 'Lâmina lateral e medial: inserções', 'Etmoide e lâmina crivosa', 'Fissura orbital e forames'] },
        { nome: 'Maxila', paginas: ['Corpo e seio maxilar', 'Processos frontal, zigomático, palatino e alveolar', 'Forame infraorbital e canal', 'Tuberosidade e relações com o pterigóideo', 'Espinha nasal e abertura piriforme'] },
        { nome: 'Mandíbula', paginas: ['Corpo, base e sínfise', 'Ramo, côndilo e processo coronoide', 'Forame mandibular, língula e canal', 'Forame mentual: posição e variações', 'Linha milo-hióidea e fossas', 'Alterações com a idade e o edentulismo'] },
        { nome: 'Ossos da face', paginas: ['Zigomático e arco', 'Nasais, lacrimais e conchas', 'Palatino: lâminas e forames', 'Vômer e septo', 'Osso hioide'] },
        { nome: 'Fossas e canais', paginas: ['Fossa temporal', 'Fossa infratemporal: limites e conteúdo', 'Fossa pterigopalatina: comunicações', 'Órbita: paredes e forames', 'Cavidade nasal e seios paranasais', 'Forames da base: o que passa por cada um'] },
      ] },
      { nome: 'Articulação temporomandibular', temas: [
        { nome: 'Componentes da ATM', paginas: ['Côndilo e fossa', 'Disco articular: zonas', 'Cápsula e membrana sinovial', 'Ligamentos: temporomandibular, esfenomandibular e estilomandibular'] },
        { nome: 'Biomecânica', paginas: ['Rotação e translação', 'Abertura, fechamento, protrusão e lateralidade', 'Relação com a oclusão', 'Vascularização e inervação'] },
      ] },
      { nome: 'Miologia', temas: [
        { nome: 'Músculos da mastigação', paginas: ['Masseter', 'Temporal', 'Pterigóideo medial', 'Pterigóideo lateral', 'Ações combinadas e palpação clínica'] },
        { nome: 'Músculos supra e infra-hióideos', paginas: ['Digástrico, milo-hióideo, gênio-hióideo e estilo-hióideo', 'Grupo infra-hióideo', 'Papel na abertura e na deglutição'] },
        { nome: 'Músculos da expressão facial', paginas: ['Grupo orbicular da boca', 'Elevadores do lábio e da asa do nariz', 'Depressores e mentual', 'Bucinador e risório', 'Platisma', 'Aplicação em anestesia, prótese e harmonização'] },
        { nome: 'Músculos do pescoço', paginas: ['Esternocleidomastóideo e trapézio', 'Trígonos do pescoço', 'Fáscias cervicais'] },
        { nome: 'Músculos da língua, palato e faringe', paginas: ['Intrínsecos e extrínsecos da língua', 'Músculos do palato mole', 'Constritores da faringe'] },
      ] },
      { nome: 'Neuroanatomia aplicada', temas: [
        { nome: 'Nervo trigêmeo', paginas: ['Origem, gânglio e divisões', 'Nervo oftálmico', 'Nervo maxilar: ramos', 'Alveolares superiores posterior, médio e anterior', 'Nervo mandibular: ramos', 'Alveolar inferior, lingual e bucal', 'Mentual e incisivo', 'Auriculotemporal', 'Mapa de inervação dente a dente e do periodonto'] },
        { nome: 'Nervo facial', paginas: ['Trajeto intrapetroso e extracraniano', 'Ramos terminais na parótida', 'Corda do tímpano e paladar', 'Paralisia facial: sinais'] },
        { nome: 'Outros pares cranianos', paginas: ['Glossofaríngeo e reflexo de vômito', 'Vago e hipoglosso', 'Olfatório e óptico: noções', 'Exame rápido dos pares na clínica'] },
        { nome: 'Sistema autônomo da cabeça', paginas: ['Gânglios parassimpáticos: ciliar, pterigopalatino, ótico e submandibular', 'Inervação das glândulas salivares', 'Simpático cervical'] },
      ] },
      { nome: 'Angiologia e linfáticos', temas: [
        { nome: 'Artérias', paginas: ['Carótida comum, interna e externa', 'Ramos da carótida externa', 'Artéria maxilar: três porções e ramos', 'Artéria facial e lingual', 'Sangramento cirúrgico: onde e por quê'] },
        { nome: 'Veias', paginas: ['Veia jugular interna e externa', 'Plexo pterigóideo', 'Veia facial e comunicações com o seio cavernoso', 'Risco de disseminação de infecção'] },
        { nome: 'Linfáticos', paginas: ['Cadeias cervicais: níveis I a VI', 'Drenagem de cada região da boca', 'Palpação de linfonodos no exame'] },
      ] },
      { nome: 'Cavidade oral e anexos', temas: [
        { nome: 'Vestíbulo e cavidade própria', paginas: ['Limites e regiões', 'Freios e bridas', 'Palato duro e mole: relevos', 'Assoalho e carúnculas'] },
        { nome: 'Glândulas salivares', paginas: ['Parótida e ducto', 'Submandibular e ducto', 'Sublingual', 'Glândulas menores: distribuição'] },
        { nome: 'Língua', paginas: ['Papilas e regiões', 'Inervação sensitiva, gustativa e motora', 'Vascularização'] },
        { nome: 'Seio maxilar e vias aéreas', paginas: ['Seio maxilar: paredes e relações com raízes', 'Óstio e drenagem', 'Faringe e laringe: noções para o dentista', 'Espaços fasciais e vias de disseminação de infecções'] },
      ] },
    ],
  },
  {
    nome: 'Anatomia dental e escultura', ciclo: 'básico', cfo: false,
    descricao: 'Reconhecer cada dente, decíduo e permanente, e reproduzir sua forma em cera.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Nomenclatura', paginas: ['Faces, terços, bordas e ângulos', 'Coroa, raiz e colo: anatômico e clínico', 'Cúspides, cristas, sulcos, fossas e cíngulo', 'Notação FDI, universal e Palmer'] },
        { nome: 'Dentições', paginas: ['Dentição decídua, mista e permanente', 'Fórmulas dentárias', 'Grupos: incisivos, caninos, pré-molares e molares'] },
        { nome: 'Cronologia', paginas: ['Calcificação e erupção dos decíduos', 'Calcificação e erupção dos permanentes', 'Tabela de bolso', 'Sequência de erupção e variações', 'Estimativa de idade pelos dentes'] },
        { nome: 'Características gerais', paginas: ['Sinais de lado: como distinguir direito de esquerdo', 'Curvaturas e convexidades', 'Área de contato e ameias', 'Simetria e proporções'] },
      ] },
      { nome: 'Incisivos e caninos permanentes', temas: [
        { nome: 'Incisivo central superior', paginas: ['Face vestibular e lingual', 'Faces proximais e incisal', 'Raiz e câmara pulpar', 'Variações'] },
        { nome: 'Incisivo lateral superior', paginas: ['Morfologia e diferenças do central', 'Conoide e agenesia', 'Sulco palatogengival'] },
        { nome: 'Incisivos inferiores', paginas: ['Central inferior', 'Lateral inferior', 'Como distinguir os dois'] },
        { nome: 'Canino superior', paginas: ['Coroa: cristas e cúspide', 'Raiz mais longa da boca', 'Função de guia'] },
        { nome: 'Canino inferior', paginas: ['Morfologia e diferenças do superior', 'Bifurcação radicular'] },
      ] },
      { nome: 'Pré-molares e molares permanentes', temas: [
        { nome: 'Pré-molares superiores', paginas: ['Primeiro pré-molar: duas raízes', 'Segundo pré-molar', 'Diferenças entre os dois', 'Anatomia interna'] },
        { nome: 'Pré-molares inferiores', paginas: ['Primeiro pré-molar', 'Segundo pré-molar: dois ou três cúspides', 'Anatomia interna'] },
        { nome: 'Primeiro molar superior', paginas: ['Coroa: quatro cúspides e ponte de esmalte', 'Tubérculo de Carabelli', 'Três raízes e o canal MV2'] },
        { nome: 'Segundo e terceiro molar superior', paginas: ['Segundo molar: variações', 'Terceiro molar: formas'] },
        { nome: 'Primeiro molar inferior', paginas: ['Cinco cúspides e sulcos', 'Duas raízes e três ou quatro canais'] },
        { nome: 'Segundo e terceiro molar inferior', paginas: ['Segundo molar: quatro cúspides', 'Terceiro molar: variações e inclusão', 'Raízes fusionadas e canal em C'] },
      ] },
      { nome: 'Dentes decíduos', temas: [
        { nome: 'Características gerais', paginas: ['Diferenças decíduo × permanente', 'Câmara pulpar ampla e cornos altos', 'Esmalte fino e constrição cervical', 'Raízes divergentes e rizólise'] },
        { nome: 'Incisivos e caninos decíduos', paginas: ['Incisivos superiores', 'Incisivos inferiores', 'Caninos'] },
        { nome: 'Molares decíduos', paginas: ['Primeiro molar superior', 'Segundo molar superior', 'Primeiro molar inferior', 'Segundo molar inferior', 'Relação com os pré-molares sucessores'] },
      ] },
      { nome: 'Anatomia interna', temas: [
        { nome: 'Câmara e canais', paginas: ['Câmara pulpar: cornos e assoalho', 'Número e forma dos canais por dente', 'Forame apical e delta', 'Alterações com a idade'] },
      ] },
      { nome: 'Escultura', temas: [
        { nome: 'Técnica', paginas: ['Instrumental e materiais', 'Método das faces e das proporções', 'Escultura em bloco de cera e sobre modelo', 'Acabamento e polimento'] },
        { nome: 'Escultura dente a dente', paginas: ['Incisivo central superior', 'Canino superior', 'Pré-molar superior', 'Primeiro molar superior', 'Primeiro molar inferior', 'Erros comuns e como corrigir'] },
        { nome: 'Enceramento funcional', paginas: ['Cúspides de trabalho e de balanceio', 'Contatos e ameias', 'Preparo para prótese e dentística'] },
      ] },
      { nome: 'Anomalias', temas: [
        { nome: 'Anomalias de número, tamanho e forma', paginas: ['Agenesia e supranumerários', 'Micro e macrodontia', 'Geminação, fusão e concrescência', 'Dens in dente e dens evaginatus', 'Taurodontia e dilaceração', 'Pérolas de esmalte'] },
      ] },
    ],
  },
  {
    nome: 'Histologia e embriologia bucal', ciclo: 'básico', cfo: false,
    descricao: 'Como os tecidos da boca se formam e como são por dentro. Uma das disciplinas com mais reprovação.',
    modulos: [
      { nome: 'Histologia geral revisada', temas: [
        { nome: 'Tecidos básicos', paginas: ['Epitélios: tipos e queratinização', 'Conjuntivo: células e fibras', 'Osso: células e matriz', 'Cartilagem', 'Músculo e nervo: noções'] },
        { nome: 'Técnica histológica', paginas: ['Fixação, inclusão e corte', 'Colorações: HE e especiais', 'Descalcificação e desgaste', 'Como olhar uma lâmina'] },
      ] },
      { nome: 'Embriologia', temas: [
        { nome: 'Desenvolvimento inicial', paginas: ['Folhetos embrionários', 'Crista neural e ectomesênquima', 'Arcos faríngeos: derivados de cada um', 'Bolsas e sulcos faríngeos'] },
        { nome: 'Face', paginas: ['Processos frontonasal, maxilar e mandibular', 'Formação da face semana a semana', 'Fusão dos processos', 'Fissuras labiais: origem'] },
        { nome: 'Palato', paginas: ['Palato primário e secundário', 'Elevação das lâminas palatinas', 'Fissuras palatinas: tipos e origem'] },
        { nome: 'Língua, glândulas e ATM', paginas: ['Desenvolvimento da língua', 'Glândulas salivares', 'Articulação temporomandibular e mandíbula', 'Cartilagem de Meckel'] },
      ] },
      { nome: 'Odontogênese', temas: [
        { nome: 'Fases', paginas: ['Lâmina dental', 'Botão, capuz e campânula', 'Órgão do esmalte: camadas', 'Papila e folículo dental', 'Coroa e raiz: sequência'] },
        { nome: 'Amelogênese', paginas: ['Ameloblastos: ciclo de vida', 'Fase secretora e de maturação', 'Prismas: formação', 'Defeitos: hipoplasia e hipomineralização'] },
        { nome: 'Dentinogênese', paginas: ['Odontoblastos e pré-dentina', 'Dentina do manto e circumpulpar', 'Mineralização: glóbulos', 'Defeitos de formação'] },
        { nome: 'Formação da raiz', paginas: ['Bainha epitelial de Hertwig', 'Restos de Malassez', 'Cementogênese', 'Dentes multirradiculares: diafragma'] },
        { nome: 'Erupção e esfoliação', paginas: ['Fases da erupção', 'Teorias', 'Rizólise dos decíduos', 'Alterações e retardos'] },
      ] },
      { nome: 'Esmalte', temas: [
        { nome: 'Estrutura', paginas: ['Composição química', 'Prismas e esmalte interprismático', 'Bandas de Hunter-Schreger', 'Estrias de Retzius e periquimáceas', 'Lamelas, tufos e fusos', 'Junção amelodentinária'] },
        { nome: 'Esmalte na clínica', paginas: ['Permeabilidade e trocas iônicas', 'Condicionamento ácido: o que acontece', 'Esmalte aprismático e do decíduo', 'Envelhecimento'] },
      ] },
      { nome: 'Complexo dentino-pulpar', temas: [
        { nome: 'Dentina', paginas: ['Composição e túbulos', 'Dentina peritubular e intertubular', 'Primária, secundária e terciária', 'Dentina esclerótica e tratos mortos', 'Linhas incrementais', 'Sensibilidade: teoria hidrodinâmica'] },
        { nome: 'Polpa', paginas: ['Zonas: odontoblástica, pobre e rica em células', 'Células e fibras', 'Vascularização e inervação', 'Funções', 'Alterações com a idade e calcificações'] },
      ] },
      { nome: 'Periodonto', temas: [
        { nome: 'Cemento', paginas: ['Acelular e celular', 'Fibras extrínsecas e intrínsecas', 'Junção cemento-esmalte: tipos', 'Hipercementose e reabsorção'] },
        { nome: 'Ligamento periodontal', paginas: ['Grupos de fibras', 'Células: fibroblastos, cementoblastos e restos epiteliais', 'Vascularização e inervação', 'Funções e adaptação'] },
        { nome: 'Osso alveolar', paginas: ['Osso alveolar propriamente dito e lâmina dura', 'Osso de suporte', 'Remodelação e movimento ortodôntico', 'Reparo alveolar'] },
      ] },
      { nome: 'Mucosa oral e glândulas', temas: [
        { nome: 'Mucosa', paginas: ['Mastigatória, de revestimento e especializada', 'Epitélio: camadas e queratinização', 'Lâmina própria e submucosa', 'Diferenças regionais'] },
        { nome: 'Gengiva', paginas: ['Gengiva livre, inserida e interdental', 'Epitélio do sulco e juncional', 'Fluido gengival', 'Espaço biológico'] },
        { nome: 'Língua', paginas: ['Papilas filiformes, fungiformes, foliadas e valadas', 'Botões gustativos', 'Glândulas de von Ebner'] },
        { nome: 'Glândulas salivares', paginas: ['Ácinos serosos, mucosos e mistos', 'Células mioepiteliais', 'Ductos intercalares, estriados e excretores', 'Saliva: formação e composição'] },
      ] },
    ],
  },
  {
    nome: 'Fisiologia e bioquímica aplicadas', ciclo: 'básico', cfo: false,
    descricao: 'O funcionamento do corpo que muda a conduta na cadeira: saliva, dor, coagulação, sistema cardiovascular.',
    modulos: [
      { nome: 'Fisiologia oral', temas: [
        { nome: 'Saliva', paginas: ['Formação: ácino e ducto', 'Controle nervoso da secreção', 'Composição e funções', 'Capacidade tampão e pH', 'Fluxo: medida e valores de referência', 'Xerostomia e hipossalivação: causas'] },
        { nome: 'Mastigação', paginas: ['Ciclo mastigatório', 'Controle neural e reflexos', 'Eficiência mastigatória'] },
        { nome: 'Deglutição', paginas: ['Fases oral, faríngea e esofágica', 'Deglutição atípica e infantil', 'Disfagia: noções'] },
        { nome: 'Fonação e respiração', paginas: ['Papel da língua e do palato', 'Respiração bucal: consequências'] },
        { nome: 'Paladar e olfato', paginas: ['Fisiologia do gosto', 'Disgeusia'] },
        { nome: 'Dor', paginas: ['Nociceptores e vias', 'Dor pulpar e dentinária', 'Dor referida', 'Modulação central', 'Dor crônica: sensibilização'] },
      ] },
      { nome: 'Fisiologia sistêmica para o dentista', temas: [
        { nome: 'Cardiovascular', paginas: ['Pressão arterial: fisiologia e medida', 'Débito e frequência', 'Efeitos do vasoconstritor', 'Síncope vasovagal: mecanismo'] },
        { nome: 'Respiratório', paginas: ['Ventilação e trocas', 'Asma e DPOC: implicações', 'Oximetria'] },
        { nome: 'Sangue e hemostasia', paginas: ['Hemostasia primária e secundária', 'Cascata da coagulação', 'Fibrinólise', 'Exames: hemograma, TP, INR, TTPA', 'Anticoagulantes e antiagregantes'] },
        { nome: 'Endócrino', paginas: ['Insulina e diabetes', 'Tireoide', 'Cortisol e estresse', 'Hormônios sexuais e gengiva'] },
        { nome: 'Renal e hepático', paginas: ['Filtração e excreção de fármacos', 'Metabolismo hepático', 'Ajuste de dose'] },
        { nome: 'Osso e cálcio', paginas: ['Remodelação óssea', 'Paratormônio, calcitonina e vitamina D', 'Osteoporose'] },
        { nome: 'Sistema nervoso', paginas: ['Neurônio e sinapse', 'Sistema autônomo: efeitos na boca', 'Reflexos orofaciais', 'Ansiedade e resposta ao estresse'] },
        { nome: 'Crescimento e envelhecimento', paginas: ['Fisiologia do crescimento', 'Hormônios e maturação', 'Envelhecimento fisiológico'] },
      ] },
      { nome: 'Bioquímica', temas: [
        { nome: 'Macromoléculas', paginas: ['Proteínas e enzimas', 'Carboidratos e açúcares da dieta', 'Lipídios', 'Colágeno: síntese e tipos'] },
        { nome: 'Metabolismo energético', paginas: ['Glicólise e fermentação', 'Ciclo de Krebs e respiração', 'Metabolismo bacteriano do biofilme'] },
        { nome: 'Mineralização', paginas: ['Hidroxiapatita: estrutura', 'Nucleação e crescimento de cristais', 'Proteínas não colágenas', 'Desmineralização e remineralização', 'Flúor: mecanismo bioquímico'] },
        { nome: 'Placa e cárie', paginas: ['Curva de Stephan', 'Ácidos e pH crítico', 'Polissacarídeos extracelulares'] },
        { nome: 'Nutrição', paginas: ['Vitaminas e saúde bucal', 'Deficiências: manifestações orais', 'Dieta cariogênica e erosiva'] },
      ] },
      { nome: 'Genética e biologia molecular', temas: [
        { nome: 'Bases moleculares', paginas: ['DNA, genes e expressão', 'Mutações e polimorfismos', 'Genética das doenças bucais', 'Testes genéticos e salivares'] },
        { nome: 'Biologia celular aplicada', paginas: ['Sinalização celular', 'Células-tronco de origem dental', 'Engenharia tecidual: noções'] },
      ] },
    ],
  },
  {
    nome: 'Microbiologia e imunologia oral', ciclo: 'básico', cfo: false,
    descricao: 'Quem vive na boca, como adoece e como o corpo responde.',
    modulos: [
      { nome: 'Microbiologia geral', temas: [
        { nome: 'Bactérias', paginas: ['Estrutura e Gram', 'Crescimento e metabolismo', 'Genética e resistência', 'Esporos e biofilmes'] },
        { nome: 'Fungos, vírus e outros', paginas: ['Fungos: estrutura e Candida', 'Vírus: replicação', 'Príons e protozoários: noções'] },
        { nome: 'Métodos', paginas: ['Coleta e cultura', 'Identificação molecular', 'Antibiograma'] },
      ] },
      { nome: 'Ecologia oral', temas: [
        { nome: 'Microbiota', paginas: ['Aquisição e sucessão', 'Nichos: dente, mucosa, língua e saliva', 'Principais gêneros', 'Eubiose e disbiose'] },
        { nome: 'Biofilme', paginas: ['Película adquirida', 'Adesão e coagregação', 'Maturação e matriz', 'Biofilme supra e subgengival', 'Por que o biofilme resiste a antimicrobianos'] },
      ] },
      { nome: 'Microbiologia das doenças', temas: [
        { nome: 'Cárie', paginas: ['Streptococcus mutans e sobrinus', 'Lactobacilos e Actinomyces', 'Hipóteses: específica, inespecífica e ecológica', 'Candida na cárie infantil'] },
        { nome: 'Doença periodontal', paginas: ['Complexos de Socransky', 'Porphyromonas gingivalis: fatores de virulência', 'Aggregatibacter e periodontite agressiva', 'Modelo de disbiose polimicrobiana'] },
        { nome: 'Infecções endodônticas', paginas: ['Flora primária e secundária', 'Enterococcus faecalis', 'Infecção persistente e extrarradicular'] },
        { nome: 'Infecções da mucosa e sistêmicas', paginas: ['Candidíase', 'Herpes simples e zóster', 'HPV e papilomas', 'Sífilis e tuberculose', 'HIV: manifestações orais', 'Hepatites: risco ocupacional', 'Endocardite e bacteremia'] },
        { nome: 'Halitose', paginas: ['Compostos sulfurados', 'Saburra lingual', 'Diagnóstico e tratamento'] },
      ] },
      { nome: 'Imunologia', temas: [
        { nome: 'Fundamentos', paginas: ['Imunidade inata: barreiras e células', 'Imunidade adaptativa: linfócitos T e B', 'Anticorpos: classes', 'Complemento', 'Citocinas'] },
        { nome: 'Imunidade oral', paginas: ['IgA secretora', 'Peptídeos antimicrobianos da saliva', 'Fluido gengival e neutrófilos', 'Tecido linfoide da boca'] },
        { nome: 'Inflamação', paginas: ['Sinais cardinais', 'Mediadores', 'Aguda e crônica', 'Resolução'] },
        { nome: 'Hipersensibilidade e autoimunidade', paginas: ['Tipos I a IV', 'Alergia a látex, anestésico e metais', 'Anafilaxia', 'Doenças autoimunes com manifestação oral'] },
        { nome: 'Vacinas e imunodeficiências', paginas: ['Vacinação do profissional', 'Imunossupressão e atendimento'] },
      ] },
      { nome: 'Microbiologia aplicada', temas: [
        { nome: 'Antimicrobianos e resistência', paginas: ['Mecanismos de ação', 'Mecanismos de resistência', 'Uso racional na odontologia'] },
        { nome: 'Microbiologia por especialidade', paginas: ['Microbiologia dos implantes', 'Microbiologia das próteses e biofilme de acrílico', 'Microbiologia em ortodontia', 'Microbiologia da odontopediatria'] },
        { nome: 'Controle microbiológico', paginas: ['Esterilização: base microbiológica', 'Água do equipo', 'Aerossóis e infecção cruzada'] },
      ] },
    ],
  },
  {
    nome: 'Patologia geral', ciclo: 'básico', cfo: false,
    descricao: 'Os mecanismos gerais da doença que depois aparecem em toda lesão da boca.',
    modulos: [
      { nome: 'Lesão celular', temas: [
        { nome: 'Adaptação e lesão', paginas: ['Atrofia, hipertrofia, hiperplasia e metaplasia', 'Lesão reversível e irreversível', 'Necrose: tipos', 'Apoptose', 'Acúmulos intracelulares e calcificações'] },
      ] },
      { nome: 'Inflamação e reparo', temas: [
        { nome: 'Inflamação aguda', paginas: ['Alterações vasculares', 'Migração leucocitária', 'Mediadores químicos', 'Padrões morfológicos: serosa, fibrinosa, purulenta'] },
        { nome: 'Inflamação crônica', paginas: ['Células e mecanismos', 'Granulomas', 'Efeitos sistêmicos'] },
        { nome: 'Reparo', paginas: ['Regeneração e cicatrização', 'Primeira e segunda intenção', 'Tecido de granulação', 'Fatores que atrapalham', 'Reparo alveolar e ósseo'] },
      ] },
      { nome: 'Distúrbios circulatórios', temas: [
        { nome: 'Edema, hiperemia e hemorragia', paginas: ['Edema: mecanismos', 'Hiperemia e congestão', 'Hemorragia, petéquias e hematoma'] },
        { nome: 'Trombose, embolia e infarto', paginas: ['Tríade de Virchow', 'Embolia', 'Isquemia e infarto', 'Choque'] },
      ] },
      { nome: 'Neoplasias', temas: [
        { nome: 'Bases', paginas: ['Nomenclatura', 'Benigno × maligno', 'Diferenciação e anaplasia', 'Invasão e metástase'] },
        { nome: 'Carcinogênese', paginas: ['Oncogenes e supressores', 'Agentes químicos, físicos e virais', 'Lesões potencialmente malignas'] },
        { nome: 'Clínica', paginas: ['Estadiamento TNM', 'Graduação histológica', 'Efeitos locais e sistêmicos'] },
      ] },
      { nome: 'Distúrbios do crescimento e genética', temas: [
        { nome: 'Malformações e genética', paginas: ['Bases da hereditariedade', 'Padrões de herança', 'Síndromes com manifestação oral', 'Displasias'] },
        { nome: 'Envelhecimento', paginas: ['Alterações celulares', 'Envelhecimento dos tecidos bucais'] },
      ] },
      { nome: 'Patologia das infecções e do sistema imune', temas: [
        { nome: 'Infecções', paginas: ['Mecanismos de agressão microbiana', 'Padrões de resposta: supurativa, granulomatosa e citopática', 'Sepse'] },
        { nome: 'Imunopatologia', paginas: ['Hipersensibilidades', 'Autoimunidade', 'Imunodeficiências', 'Rejeição e transplante'] },
      ] },
      { nome: 'Patologia sistêmica de interesse', temas: [
        { nome: 'Sangue e vasos', paginas: ['Anemias', 'Leucemias e linfomas', 'Distúrbios hemorrágicos', 'Aterosclerose e hipertensão'] },
        { nome: 'Endócrino e metabólico', paginas: ['Diabetes: fisiopatologia', 'Doenças da tireoide e paratireoide', 'Osteoporose e doenças ósseas metabólicas'] },
      ] },
    ],
  },
  {
    nome: 'Farmacologia e terapêutica', ciclo: 'básico', cfo: false,
    descricao: 'O que prescrever, quanto, por quanto tempo, e o que nunca combinar.',
    modulos: [
      { nome: 'Farmacologia geral', temas: [
        { nome: 'Farmacocinética', paginas: ['Absorção e vias', 'Distribuição e ligação proteica', 'Metabolismo hepático e citocromo P450', 'Excreção', 'Meia-vida, estado de equilíbrio e posologia'] },
        { nome: 'Farmacodinâmica', paginas: ['Receptores', 'Agonistas e antagonistas', 'Dose-resposta e janela terapêutica', 'Tolerância e dependência'] },
        { nome: 'Interações e reações adversas', paginas: ['Tipos de interação', 'Interações que importam no consultório', 'Reações adversas e farmacovigilância'] },
        { nome: 'Sistema nervoso autônomo', paginas: ['Colinérgicos e anticolinérgicos', 'Adrenérgicos: vasoconstritores', 'Implicações para o dentista'] },
      ] },
      { nome: 'Prescrição', temas: [
        { nome: 'A receita', paginas: ['Partes e regras legais', 'Receituário comum e de controle especial', 'Nome genérico e apresentações', 'Erros de prescrição'] },
        { nome: 'Cálculo de dose', paginas: ['Dose por peso na criança', 'Conversões e gotas', 'Ajuste renal e hepático'] },
      ] },
      { nome: 'Controle da dor e da inflamação', temas: [
        { nome: 'Analgésicos não opioides', paginas: ['Dipirona', 'Paracetamol', 'Combinações e doses'] },
        { nome: 'Anti-inflamatórios não esteroides', paginas: ['Mecanismo: COX-1 e COX-2', 'Ibuprofeno, nimesulida, cetorolaco e diclofenaco', 'Contraindicações: renal, gástrica e cardiovascular', 'Protocolos por procedimento'] },
        { nome: 'Corticoides', paginas: ['Dexametasona e betametasona', 'Dose única pré-operatória', 'Efeitos adversos'] },
        { nome: 'Opioides', paginas: ['Codeína e tramadol', 'Quando indicar', 'Riscos e legislação'] },
        { nome: 'Analgesia preemptiva e escada analgésica', paginas: ['Conceito e protocolos', 'Dor pós-operatória: planejamento'] },
      ] },
      { nome: 'Antimicrobianos', temas: [
        { nome: 'Princípios', paginas: ['Bactericida e bacteriostático', 'Espectro', 'Resistência e uso racional', 'Quando o antibiótico não é indicado'] },
        { nome: 'Betalactâmicos', paginas: ['Amoxicilina: doses e duração', 'Amoxicilina com clavulanato', 'Penicilina benzatina e cefalosporinas', 'Alergia à penicilina'] },
        { nome: 'Outros antibióticos', paginas: ['Clindamicina', 'Azitromicina e claritromicina', 'Metronidazol', 'Tetraciclinas e doxiciclina', 'Ciprofloxacino'] },
        { nome: 'Profilaxia antibiótica', paginas: ['Endocardite: quem e como', 'Próteses articulares', 'Cirurgia e implantes'] },
        { nome: 'Antifúngicos e antivirais', paginas: ['Nistatina, miconazol e fluconazol', 'Aciclovir e valaciclovir', 'Interações do fluconazol'] },
        { nome: 'Antissépticos', paginas: ['Clorexidina: concentrações e efeitos', 'Óleos essenciais e cetilpiridínio', 'Triclosan e fluoretos'] },
      ] },
      { nome: 'Ansiedade e sedação', temas: [
        { nome: 'Ansiolíticos', paginas: ['Benzodiazepínicos: midazolam, diazepam e alprazolam', 'Protocolos de sedação oral', 'Cuidados e contraindicações'] },
        { nome: 'Sedação inalatória', paginas: ['Óxido nitroso: mecanismo', 'Técnica e monitoramento', 'Legislação'] },
      ] },
      { nome: 'Pacientes especiais na prescrição', temas: [
        { nome: 'Gestante e lactante', paginas: ['Categorias de risco', 'O que pode e o que não pode', 'Anestésico na gestante'] },
        { nome: 'Criança e idoso', paginas: ['Particularidades farmacocinéticas', 'Polifarmácia no idoso'] },
        { nome: 'Doenças sistêmicas', paginas: ['Anticoagulados', 'Diabetes e corticoide', 'Renal e hepático', 'Bifosfonatos, denosumabe e osteonecrose', 'Imunossuprimidos'] },
        { nome: 'Fitoterápicos e suplementos', paginas: ['Interações relevantes', 'O que perguntar na anamnese'] },
      ] },
    ],
  },
  {
    nome: 'Anestesiologia', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Técnicas de anestesia local, do cálculo de dose ao que fazer quando falha.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Neurofisiologia', paginas: ['Potencial de ação e canais de sódio', 'Fibras nervosas e sequência de bloqueio', 'Anatomia dos nervos revisada'] },
        { nome: 'Anestésicos locais', paginas: ['Estrutura: ésteres e amidas', 'Mecanismo de ação e pKa', 'Lidocaína', 'Articaína', 'Mepivacaína e prilocaína', 'Bupivacaína', 'Metabolismo e toxicidade'] },
        { nome: 'Vasoconstritores', paginas: ['Epinefrina: doses e cardiopatas', 'Norepinefrina e felipressina', 'Quando não usar'] },
        { nome: 'Dose', paginas: ['Dose máxima por peso', 'Cálculo por tubete', 'Tabela de bolso', 'Escolha do anestésico por paciente'] },
        { nome: 'Instrumental', paginas: ['Seringa carpule e tipos', 'Agulhas: calibre e comprimento', 'Tubetes: componentes', 'Aspiração e prevenção de injeção intravascular', 'Descarte e acidentes'] },
      ] },
      { nome: 'Técnicas na maxila', temas: [
        { nome: 'Infiltrativas', paginas: ['Supraperiosteal', 'Intraligamentar', 'Intrasseptal e intrapulpar'] },
        { nome: 'Bloqueios', paginas: ['Alveolar superior posterior', 'Alveolar superior médio', 'Alveolar superior anterior e infraorbital', 'Nasopalatino', 'Palatino maior', 'Bloqueio do nervo maxilar'] },
      ] },
      { nome: 'Técnicas na mandíbula', temas: [
        { nome: 'Alveolar inferior', paginas: ['Reparos anatômicos', 'Técnica direta passo a passo', 'Técnica indireta', 'Sinais de sucesso e falha'] },
        { nome: 'Técnicas alternativas', paginas: ['Gow-Gates', 'Vazirani-Akinosi', 'Anestesia intraóssea'] },
        { nome: 'Outros bloqueios', paginas: ['Bucal', 'Mentual e incisivo', 'Lingual', 'Infiltrativa mandibular com articaína'] },
      ] },
      { nome: 'Situações especiais', temas: [
        { nome: 'Criança', paginas: ['Particularidades anatômicas', 'Doses por peso', 'Manejo comportamental durante a injeção', 'Prevenção de mordida do lábio'] },
        { nome: 'Pacientes de risco', paginas: ['Cardiopata e hipertenso', 'Gestante', 'Diabético e tireoidopata', 'Alérgicos e metemoglobinemia'] },
        { nome: 'Anestesia sem dor', paginas: ['Anestésico tópico', 'Velocidade de injeção e temperatura', 'Dispositivos computadorizados', 'Reversão com fentolamina'] },
      ] },
      { nome: 'Falhas e complicações', temas: [
        { nome: 'Falha anestésica', paginas: ['Inflamação e pH', 'Variações anatômicas', 'Erro de técnica', 'Técnicas complementares'] },
        { nome: 'Complicações locais', paginas: ['Hematoma', 'Trismo', 'Parestesia', 'Paralisia facial transitória', 'Lesão de tecidos moles', 'Fratura de agulha'] },
        { nome: 'Complicações sistêmicas', paginas: ['Lipotimia', 'Toxicidade e overdose', 'Reação ao vasoconstritor', 'Alergia'] },
      ] },
      { nome: 'Sedação e anestesia geral', temas: [
        { nome: 'Sedação em odontologia', paginas: ['Níveis de sedação', 'Sedação oral com benzodiazepínicos', 'Sedação inalatória com óxido nitroso', 'Sedação venosa: quem pode e onde', 'Monitoramento e alta'] },
        { nome: 'Anestesia geral', paginas: ['Indicações em odontologia', 'Avaliação pré-anestésica', 'Trabalho com o anestesiologista', 'Recuperação e cuidados'] },
        { nome: 'Legislação', paginas: ['Resoluções do CFO sobre sedação', 'Estrutura mínima e responsabilidade'] },
      ] },
    ],
  },
  {
    nome: 'Biossegurança e ergonomia', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Não contaminar, não se contaminar e não se lesionar.',
    modulos: [
      { nome: 'Controle de infecção', temas: [
        { nome: 'Fundamentos', paginas: ['Cadeia de infecção', 'Vias de transmissão no consultório', 'Precauções padrão', 'Vacinação do profissional', 'Legislação e normas'] },
        { nome: 'Equipamentos de proteção', paginas: ['Luvas: tipos e troca', 'Máscaras e respiradores', 'Óculos, gorro e avental', 'Paramentação e desparamentação'] },
        { nome: 'Higiene das mãos', paginas: ['Técnica', 'Álcool e sabão', 'Antissepsia cirúrgica'] },
      ] },
      { nome: 'Processamento de artigos', temas: [
        { nome: 'Classificação e fluxo', paginas: ['Classificação de Spaulding', 'Área suja e área limpa', 'Fluxo unidirecional'] },
        { nome: 'Limpeza e desinfecção', paginas: ['Limpeza manual e ultrassônica', 'Desinfetantes: níveis', 'Secagem e inspeção'] },
        { nome: 'Esterilização', paginas: ['Autoclave: ciclos e parâmetros', 'Embalagem e validade', 'Indicadores químicos e biológicos', 'Estufa: por que não', 'Peças de mão e canetas'] },
      ] },
      { nome: 'Ambiente', temas: [
        { nome: 'Superfícies e água', paginas: ['Barreiras', 'Desinfecção de superfícies', 'Linhas de água do equipo e biofilme', 'Aerossóis e ventilação'] },
        { nome: 'Resíduos', paginas: ['Classificação', 'Descarte de perfurocortantes', 'Amálgama e mercúrio', 'Plano de gerenciamento'] },
        { nome: 'Acidentes ocupacionais', paginas: ['Conduta após perfurocortante', 'Profilaxia pós-exposição', 'Notificação'] },
      ] },
      { nome: 'Ergonomia', temas: [
        { nome: 'Posição de trabalho', paginas: ['Posições do relógio', 'Postura do operador e do paciente', 'Trabalho a quatro mãos', 'Visão direta e indireta'] },
        { nome: 'Prevenção de lesões', paginas: ['Lesões por esforço repetitivo', 'Alongamentos e pausas', 'Iluminação e magnificação', 'Organização da bandeja'] },
      ] },
      { nome: 'Situações especiais e legislação', temas: [
        { nome: 'Biossegurança por procedimento', paginas: ['Cirurgia e implantes: campo estéril', 'Endodontia e isolamento', 'Prótese: desinfecção de moldes e trabalhos', 'Radiologia: sensores e posicionadores'] },
        { nome: 'Vigilância e normas', paginas: ['Resoluções da Anvisa para serviços odontológicos', 'Programa de gerenciamento de riscos', 'Inspeção sanitária: o que é conferido', 'Pandemias e protocolos respiratórios'] },
      ] },
    ],
  },
  {
    nome: 'Materiais dentários', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Composição, manipulação e por que cada material falha quando falha.',
    modulos: [
      { nome: 'Ciência dos materiais', temas: [
        { nome: 'Estrutura da matéria', paginas: ['Ligações e estrutura cristalina', 'Metais, cerâmicas, polímeros e compósitos'] },
        { nome: 'Propriedades mecânicas', paginas: ['Tensão e deformação', 'Resistência, módulo e tenacidade', 'Dureza e fadiga', 'Fluência e escoamento'] },
        { nome: 'Propriedades físicas e químicas', paginas: ['Térmicas: condutividade e expansão', 'Ópticas: cor, translucidez e fluorescência', 'Sorção, solubilidade e corrosão', 'Molhamento e ângulo de contato'] },
        { nome: 'Biocompatibilidade e adesão', paginas: ['Testes de biocompatibilidade', 'Adesão: mecanismos', 'Normas e certificação'] },
      ] },
      { nome: 'Materiais de moldagem', temas: [
        { nome: 'Fundamentos', paginas: ['Classificação: rígidos e elásticos', 'Moldeiras e adesivos', 'Fidelidade e estabilidade dimensional'] },
        { nome: 'Hidrocoloides', paginas: ['Alginato: composição e manipulação', 'Sinérese e embebição', 'Ágar'] },
        { nome: 'Elastômeros', paginas: ['Silicone de condensação', 'Silicone de adição', 'Poliéter', 'Polissulfeto', 'Técnicas: dupla e simultânea', 'Erros de moldagem e como identificar'] },
        { nome: 'Rígidos', paginas: ['Godiva', 'Pasta zincoenólica', 'Ceras de moldagem'] },
      ] },
      { nome: 'Gessos, ceras e revestimentos', temas: [
        { nome: 'Gessos', paginas: ['Tipos I a V', 'Reação de presa e expansão', 'Proporção água/pó e manipulação', 'Vazamento e erros'] },
        { nome: 'Ceras', paginas: ['Classificação e propriedades', 'Cera para escultura e para registro'] },
        { nome: 'Revestimentos e fundição', paginas: ['Revestimentos aglutinados por gesso e fosfato', 'Expansão de presa e térmica', 'Fundição: etapas e defeitos'] },
        { nome: 'Resinas acrílicas', paginas: ['Termo e autopolimerizáveis', 'Ciclo de polimerização', 'Porosidades e monômero residual', 'Resinas para provisórios e reembasamento'] },
      ] },
      { nome: 'Materiais restauradores diretos', temas: [
        { nome: 'Amálgama', paginas: ['Composição e ligas', 'Reação de presa e fases', 'Manipulação e condensação', 'Corrosão e creep', 'Mercúrio: segurança'] },
        { nome: 'Resinas compostas', paginas: ['Matriz orgânica', 'Carga inorgânica e silano', 'Classificação por partícula', 'Contração de polimerização e fator C', 'Grau de conversão', 'Bulk fill e resinas fluidas', 'Propriedades ópticas e cor'] },
        { nome: 'Fotopolimerização', paginas: ['Fotoiniciadores', 'Aparelhos: LED e halógena', 'Irradiância e tempo', 'Manutenção e teste'] },
        { nome: 'Sistemas adesivos', paginas: ['Smear layer', 'Condicionamento ácido e camada híbrida', 'Convencionais de 3 e 2 passos', 'Autocondicionantes', 'Universais', 'Degradação da interface e MMPs', 'Adesão ao esmalte × à dentina'] },
        { nome: 'Cimentos de ionômero de vidro', paginas: ['Composição e reação', 'Convencional e modificado por resina', 'Liberação de flúor', 'Indicações e técnica'] },
      ] },
      { nome: 'Cimentos e bases', temas: [
        { nome: 'Materiais para proteção pulpar', paginas: ['Hidróxido de cálcio', 'MTA e biocerâmicos', 'Óxido de zinco e eugenol'] },
        { nome: 'Cimentos de fixação', paginas: ['Fosfato de zinco', 'Ionômero de vidro', 'Resinosos convencionais e autoadesivos', 'Escolha por tipo de restauração'] },
      ] },
      { nome: 'Materiais restauradores indiretos', temas: [
        { nome: 'Cerâmicas', paginas: ['Classificação', 'Feldspática', 'Dissilicato de lítio', 'Zircônia: gerações', 'Processamento: prensada, CAD/CAM e estratificada', 'Condicionamento e cimentação de cada cerâmica'] },
        { nome: 'Ligas metálicas', paginas: ['Nobres e não nobres', 'Cobalto-cromo e níquel-cromo', 'Titânio', 'Metalocerâmica: união'] },
        { nome: 'Resinas e híbridos', paginas: ['Resinas de laboratório', 'Cerâmicas híbridas e PICN', 'Materiais para impressão 3D'] },
      ] },
      { nome: 'Outros materiais', temas: [
        { nome: 'Materiais endodônticos e de implante', paginas: ['Guta-percha e cimentos endodônticos', 'Titânio e superfícies', 'Biomateriais para enxerto'] },
        { nome: 'Materiais preventivos e ortodônticos', paginas: ['Selantes', 'Vernizes e géis', 'Fios ortodônticos: ligas'] },
      ] },
    ],
  },
  {
    nome: 'Oclusão', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Como os dentes se encontram e por que isso decide restaurações, próteses e dor.',
    modulos: [
      { nome: 'Fundamentos', temas: [
        { nome: 'Sistema estomatognático', paginas: ['Componentes e funções', 'ATM e músculos revisados', 'Neurofisiologia do controle mandibular'] },
        { nome: 'Determinantes da oclusão', paginas: ['Determinantes posteriores: ATM', 'Determinantes anteriores: guia incisal e canina', 'Curvas de Spee e Wilson', 'Plano oclusal e dimensão vertical'] },
        { nome: 'Posições mandibulares', paginas: ['Relação cêntrica: conceito e obtenção', 'Máxima intercuspidação', 'Oclusão cêntrica e deslize', 'Posição de repouso e espaço funcional livre'] },
        { nome: 'Movimentos mandibulares', paginas: ['Bordejantes e funcionais', 'Movimento de Bennett e ângulo', 'Lateralidade: trabalho e balanceio', 'Protrusão e guia anterior', 'Diagrama de Posselt'] },
      ] },
      { nome: 'Oclusão dentária', temas: [
        { nome: 'Contatos oclusais', paginas: ['Cúspides de suporte e de corte', 'Contatos em cêntrica: tripodismo', 'Contatos excursivos', 'Interferências e contatos prematuros'] },
        { nome: 'Esquemas oclusais', paginas: ['Oclusão mutuamente protegida', 'Função em grupo', 'Oclusão balanceada bilateral', 'Qual esquema para qual reabilitação'] },
        { nome: 'Oclusão ideal e normal', paginas: ['Chaves de Andrews', 'Classificação de Angle', 'Oclusão fisiológica × patológica'] },
      ] },
      { nome: 'Instrumentação', temas: [
        { nome: 'Articuladores', paginas: ['Classificação', 'Não ajustável e semi-ajustável', 'Totalmente ajustável e virtual', 'Arco facial e montagem do modelo superior', 'Montagem do inferior com registro'] },
        { nome: 'Registros', paginas: ['Registro de relação cêntrica: técnicas', 'Registros excursivos', 'Materiais de registro', 'Escaneamento e articulador virtual'] },
      ] },
      { nome: 'Prática', temas: [
        { nome: 'Análise oclusal', paginas: ['Exame clínico da oclusão', 'Análise em articulador', 'Papel articular e outros métodos', 'Análise digital'] },
        { nome: 'Enceramento diagnóstico', paginas: ['Técnica de enceramento progressivo', 'Cúspides, cristas e sulcos', 'Enceramento por adição'] },
        { nome: 'Ajuste oclusal', paginas: ['Indicações e limites', 'Regras de desgaste seletivo', 'Sequência'] },
        { nome: 'Placas oclusais', paginas: ['Tipos e indicações', 'Placa de Michigan: confecção', 'Ajuste e acompanhamento'] },
        { nome: 'Oclusão nas especialidades', paginas: ['Em dentística e prótese', 'Em implantes', 'Em ortodontia', 'Oclusão e DTM: o que a evidência diz'] },
      ] },
      { nome: 'Reabilitação oclusal', temas: [
        { nome: 'Desgaste e perda de dimensão vertical', paginas: ['Diagnóstico do desgaste', 'Aumento de dimensão vertical: quando e quanto', 'Provisórios de reabilitação e teste'] },
        { nome: 'Reabilitação extensa', paginas: ['Sequência da reabilitação oclusal', 'Guia anterior: reconstrução', 'Oclusão em reabilitação sobre implantes'] },
        { nome: 'Oclusão digital', paginas: ['Análise oclusal computadorizada', 'Articulador virtual e registro de movimentos', 'Desenho de oclusão em software'] },
      ] },
    ],
  },
  {
    nome: 'Cariologia e prevenção', ciclo: 'pré-clínico', cfo: false,
    descricao: 'A doença mais comum do mundo: entender, detectar, parar e prevenir.',
    modulos: [
      { nome: 'A doença', temas: [
        { nome: 'Conceito e epidemiologia', paginas: ['Cárie como doença biofilme-açúcar dependente', 'Prevalência no Brasil e no mundo', 'Polarização e grupos de risco'] },
        { nome: 'Etiologia', paginas: ['Biofilme', 'Dieta e frequência de açúcar', 'Hospedeiro: dente e saliva', 'Tempo e fatores sociais'] },
        { nome: 'Dinâmica', paginas: ['Desmineralização e remineralização', 'pH crítico do esmalte e da dentina', 'Papel do flúor na dinâmica'] },
        { nome: 'Histopatologia', paginas: ['Lesão de esmalte: zonas', 'Lesão de dentina: zonas', 'Dentina afetada × infectada', 'Cárie radicular', 'Lesão ativa × inativa'] },
      ] },
      { nome: 'Diagnóstico', temas: [
        { nome: 'Detecção', paginas: ['Exame visual: condições e critérios', 'Sistema ICDAS', 'Radiografia interproximal', 'Sonda: quando e como', 'Métodos auxiliares: fluorescência e transiluminação'] },
        { nome: 'Avaliação de atividade e risco', paginas: ['Sinais de atividade', 'Avaliação de risco individual', 'Testes salivares e microbiológicos', 'Registro e acompanhamento'] },
      ] },
      { nome: 'Flúor', temas: [
        { nome: 'Mecanismo e fontes', paginas: ['Mecanismo de ação', 'Água de abastecimento', 'Dentifrício: concentração e quantidade por idade', 'Bochechos'] },
        { nome: 'Uso profissional', paginas: ['Verniz', 'Gel e espuma', 'Diamino fluoreto de prata', 'Protocolos por risco'] },
        { nome: 'Fluorose e toxicidade', paginas: ['Fluorose: mecanismo e idade de risco', 'Dose tóxica e conduta na ingestão', 'Orientação aos pais'] },
      ] },
      { nome: 'Controle de biofilme e dieta', temas: [
        { nome: 'Higiene bucal', paginas: ['Escovas e técnicas', 'Fio dental e escovas interdentais', 'Escova elétrica', 'Dentifrícios: componentes', 'Evidenciação e índices de placa'] },
        { nome: 'Dieta', paginas: ['Açúcares e frequência', 'Diário alimentar', 'Aconselhamento', 'Adoçantes e xilitol'] },
      ] },
      { nome: 'Tratamento não restaurador', temas: [
        { nome: 'Selantes', paginas: ['Indicações', 'Resinoso e ionomérico', 'Técnica e controle'] },
        { nome: 'Lesões iniciais', paginas: ['Remineralização de mancha branca', 'Infiltrante resinoso', 'Microabrasão'] },
        { nome: 'Cárie em dentina', paginas: ['Remoção seletiva de tecido cariado', 'Tratamento restaurador atraumático', 'Técnica de Hall', 'Mínima intervenção: princípios'] },
        { nome: 'Manutenção', paginas: ['Intervalo de retorno por risco', 'Programas para grupos de risco', 'Cárie no idoso e radicular'] },
      ] },
      { nome: 'Cárie em grupos e situações especiais', temas: [
        { nome: 'Por faixa etária', paginas: ['Cárie precoce da infância', 'Adolescente e ortodontia', 'Adulto e cárie secundária', 'Idoso e cárie radicular'] },
        { nome: 'Condições de risco', paginas: ['Xerostomia e radioterapia', 'Pacientes com necessidades especiais', 'Refluxo e transtornos alimentares'] },
        { nome: 'Erosão dental', paginas: ['Etiologia intrínseca e extrínseca', 'Diagnóstico e índices', 'Prevenção e controle'] },
      ] },
      { nome: 'Cariologia baseada em evidências', temas: [
        { nome: 'Leitura crítica', paginas: ['Ensaios clínicos em prevenção', 'Revisões Cochrane sobre flúor e selantes', 'Do estudo à conduta'] },
      ] },
    ],
  },
  {
    nome: 'Propedêutica e clínica integrada', ciclo: 'pré-clínico', cfo: false,
    descricao: 'Anamnese, exame, prontuário e plano de tratamento: o que vem antes de qualquer procedimento.',
    modulos: [
      { nome: 'Relação com o paciente', temas: [
        { nome: 'Comunicação', paginas: ['Primeira consulta', 'Escuta e perguntas abertas', 'Explicar diagnóstico e plano', 'Paciente ansioso e difícil', 'Comunicação de más notícias'] },
        { nome: 'Ética na clínica', paginas: ['Sigilo', 'Consentimento', 'Limites de competência e encaminhamento'] },
      ] },
      { nome: 'Anamnese', temas: [
        { nome: 'Roteiro', paginas: ['Identificação e queixa principal', 'História da doença atual', 'História médica e medicamentos', 'História odontológica e hábitos', 'História familiar e social'] },
        { nome: 'Perguntas que mudam a conduta', paginas: ['Alergias', 'Sangramento e anticoagulantes', 'Cardiopatia e pressão', 'Diabetes', 'Gestação', 'Bifosfonatos e radioterapia'] },
        { nome: 'Sinais vitais e risco', paginas: ['Pressão, pulso, respiração e temperatura', 'Oximetria e glicemia', 'Classificação ASA'] },
      ] },
      { nome: 'Exame clínico', temas: [
        { nome: 'Exame extraoral', paginas: ['Inspeção da face e simetria', 'Palpação de linfonodos', 'ATM e músculos', 'Pele e lábios'] },
        { nome: 'Exame intraoral', paginas: ['Sequência sistemática', 'Tecidos moles: lábio, mucosa, língua, assoalho e palato', 'Gengiva e periodonto', 'Dentes e oclusão', 'Saliva'] },
        { nome: 'Exames complementares', paginas: ['Radiografias: quais pedir', 'Hemograma, glicemia e coagulograma: quando e como ler', 'Cultura e biópsia', 'Encaminhamento ao médico'] },
      ] },
      { nome: 'Documentação', temas: [
        { nome: 'Prontuário', paginas: ['Documentos obrigatórios', 'Odontograma e periograma', 'Evolução e assinatura', 'Guarda, sigilo e LGPD', 'Prontuário eletrônico'] },
        { nome: 'Fotografia clínica', paginas: ['Equipamento básico', 'Protocolo de fotos', 'Uso ético e consentimento'] },
        { nome: 'Termos e contratos', paginas: ['Consentimento livre e esclarecido', 'Contrato de prestação de serviço', 'Orçamento'] },
      ] },
      { nome: 'Diagnóstico e plano', temas: [
        { nome: 'Raciocínio diagnóstico', paginas: ['Do sinal ao diagnóstico', 'Diagnóstico diferencial', 'Hipóteses e confirmação'] },
        { nome: 'Plano de tratamento', paginas: ['Fases: urgência, adequação, reabilitação e manutenção', 'Adequação do meio bucal', 'Sequenciamento entre especialidades', 'Priorização e prognóstico', 'Apresentação ao paciente'] },
        { nome: 'Clínica integrada', paginas: ['Casos multidisciplinares', 'Paciente com comprometimento sistêmico', 'Encaminhamento e contrarreferência'] },
      ] },
      { nome: 'Semiologia por sistema', temas: [
        { nome: 'Sinais e sintomas que o dentista vê', paginas: ['Cardiovascular: dispneia, edema e cianose', 'Endócrino: sinais de diabetes e tireoide', 'Hematológico: palidez, petéquias e sangramento', 'Neurológico: paralisias e parestesias', 'Pele e mucosas: sinais sistêmicos'] },
        { nome: 'Dor como sintoma', paginas: ['Caracterização da dor', 'Dor odontogênica × não odontogênica: triagem', 'Escalas de dor'] },
        { nome: 'Exame da criança e do idoso', paginas: ['Particularidades do exame pediátrico', 'Particularidades do exame geriátrico'] },
      ] },
    ],
  },
  {
    nome: 'Urgências e emergências', ciclo: 'pré-clínico', cfo: false,
    descricao: 'O que fazer nos primeiros minutos: dor, trauma, sangramento e emergência médica na cadeira.',
    modulos: [
      { nome: 'Emergências médicas', temas: [
        { nome: 'Preparo', paginas: ['Kit de emergência: o que ter', 'Oxigênio e equipamentos', 'Treinamento da equipe', 'Prevenção pela anamnese'] },
        { nome: 'Suporte básico de vida', paginas: ['Reconhecimento da parada', 'Compressões e ventilação', 'Desfibrilador externo automático', 'Obstrução de via aérea'] },
        { nome: 'Alterações de consciência', paginas: ['Síncope vasovagal', 'Hipotensão postural', 'Hipoglicemia', 'Crise convulsiva', 'Acidente vascular cerebral'] },
        { nome: 'Respiratórias', paginas: ['Hiperventilação', 'Crise asmática', 'Aspiração de corpo estranho'] },
        { nome: 'Cardiovasculares', paginas: ['Crise hipertensiva', 'Angina e infarto', 'Arritmias'] },
        { nome: 'Alérgicas e outras', paginas: ['Urticária e angioedema', 'Anafilaxia e adrenalina', 'Crise adrenal', 'Overdose de anestésico'] },
      ] },
      { nome: 'Urgências odontológicas', temas: [
        { nome: 'Dor de origem dental', paginas: ['Diagnóstico diferencial pulpar e periapical', 'Abertura de urgência', 'Medicação de urgência', 'Dor pós-operatória'] },
        { nome: 'Infecções', paginas: ['Abscesso: drenagem', 'Pericoronarite', 'Celulite e espaços fasciais', 'Angina de Ludwig: quando é hospital', 'Antibiótico na urgência'] },
        { nome: 'Sangramento', paginas: ['Hemorragia pós-exodontia', 'Medidas locais', 'Paciente anticoagulado', 'Quando encaminhar'] },
        { nome: 'Alveolite e outras dores pós-operatórias', paginas: ['Alveolite seca e purulenta', 'Trismo', 'Dor por prótese'] },
      ] },
      { nome: 'Trauma', temas: [
        { nome: 'Trauma dentoalveolar', paginas: ['Classificação das lesões', 'Fraturas de coroa e raiz', 'Concussão, subluxação e luxações', 'Avulsão: minuto a minuto', 'Contenção: tipos e tempo', 'Acompanhamento'] },
        { nome: 'Trauma em decíduos', paginas: ['Conduta por tipo', 'Sequelas no permanente'] },
        { nome: 'Trauma de tecidos moles e ósseo', paginas: ['Lacerações e sutura', 'Fratura alveolar', 'Suspeita de fratura de face: o que fazer'] },
      ] },
      { nome: 'Urgências por especialidade', temas: [
        { nome: 'Prótese e dentística', paginas: ['Coroa ou provisório que soltou', 'Fratura de prótese', 'Dor após restauração'] },
        { nome: 'Ortodontia', paginas: ['Fio machucando', 'Bráquete solto', 'Aparelho quebrado'] },
        { nome: 'Periodontia e implantes', paginas: ['Abscesso periodontal', 'Gengivite necrosante', 'Dor e mobilidade de implante'] },
        { nome: 'Mucosa e glândulas', paginas: ['Aftas e herpes com dor intensa', 'Sialolitíase aguda', 'Reação alérgica na boca'] },
      ] },
      { nome: 'Organização e ética', temas: [
        { nome: 'Serviço de urgência', paginas: ['Triagem e classificação de risco', 'Registro e documentação', 'Encaminhamento e contrarreferência', 'Urgência no SUS'] },
      ] },
    ],
  },
  {
    nome: 'Metodologia científica e bioestatística', ciclo: 'básico', cfo: false,
    descricao: 'Ler um artigo sem medo, montar um TCC e entender um valor de p.',
    modulos: [
      { nome: 'Pesquisa científica', temas: [
        { nome: 'Fundamentos', paginas: ['Ciência e método', 'Pergunta de pesquisa e hipótese', 'Variáveis', 'Ética em pesquisa: comitê e consentimento'] },
        { nome: 'Tipos de estudo', paginas: ['Relato de caso e série', 'Transversal', 'Caso-controle', 'Coorte', 'Ensaio clínico randomizado', 'Revisão sistemática e metanálise', 'Estudos in vitro e em animais', 'Pirâmide da evidência'] },
        { nome: 'Busca e leitura', paginas: ['Bases: PubMed, Scopus, SciELO e Cochrane', 'Estratégia de busca e descritores', 'Estrutura de um artigo', 'Vieses mais comuns', 'Leitura crítica: roteiro'] },
        { nome: 'Odontologia baseada em evidências', paginas: ['Os passos', 'Níveis de evidência e graus de recomendação', 'Aplicar ao paciente'] },
      ] },
      { nome: 'Trabalho de conclusão', temas: [
        { nome: 'Projeto', paginas: ['Escolha do tema e orientador', 'Estrutura do projeto', 'Cronograma e orçamento', 'Submissão ao comitê de ética'] },
        { nome: 'Coleta e análise', paginas: ['Instrumentos e questionários', 'Coleta de dados clínicos', 'Planilha e organização dos dados', 'Software estatístico: noções'] },
        { nome: 'Redação', paginas: ['Introdução, métodos, resultados e discussão', 'Normas ABNT e Vancouver', 'Citação e plágio', 'Uso ético de inteligência artificial', 'Apresentação e defesa'] },
        { nome: 'Publicação', paginas: ['Escolher a revista', 'Submissão e revisão por pares', 'Revistas predatórias', 'Do TCC ao artigo'] },
      ] },
      { nome: 'Bioestatística', temas: [
        { nome: 'Descritiva', paginas: ['Tipos de variáveis', 'Média, mediana e moda', 'Desvio padrão e intervalo interquartil', 'Tabelas e gráficos'] },
        { nome: 'Probabilidade e amostragem', paginas: ['Distribuição normal', 'Amostra e população', 'Tamanho de amostra'] },
        { nome: 'Inferência', paginas: ['Hipótese nula e valor de p', 'Intervalo de confiança', 'Erro tipo I e II e poder', 'Testes: t, qui-quadrado, ANOVA e não paramétricos', 'Correlação e regressão'] },
        { nome: 'Epidemiologia clínica', paginas: ['Prevalência e incidência', 'Risco relativo e odds ratio', 'Sensibilidade, especificidade e valores preditivos', 'Número necessário para tratar'] },
      ] },
    ],
  },
  {
    nome: 'Psicologia, ética e gestão', ciclo: 'básico', cfo: false,
    descricao: 'O lado humano e profissional: paciente, equipe, consultório e carreira.',
    modulos: [
      { nome: 'Psicologia aplicada', temas: [
        { nome: 'O paciente', paginas: ['Medo e ansiedade odontológica', 'Desenvolvimento e comportamento por idade', 'Adesão ao tratamento', 'Dor e emoção'] },
        { nome: 'O profissional', paginas: ['Estresse e burnout', 'Trabalho em equipe', 'Comunicação não violenta'] },
      ] },
      { nome: 'Ética e deontologia', temas: [
        { nome: 'Fundamentos', paginas: ['Bioética: princípios', 'Código de ética odontológica: pontos-chave', 'Publicidade e redes sociais', 'Relação com colegas'] },
      ] },
      { nome: 'Gestão do consultório', temas: [
        { nome: 'Administração', paginas: ['Abertura de consultório e legislação', 'Custos fixos e variáveis', 'Precificação de procedimentos', 'Agenda e produtividade', 'Estoque e fornecedores', 'Indicadores de gestão'] },
        { nome: 'Pessoas e atendimento', paginas: ['Equipe: contratação e treinamento', 'Recepção e experiência do paciente', 'Fidelização e retorno'] },
        { nome: 'Finanças e tributos', paginas: ['Fluxo de caixa', 'Pessoa física × jurídica', 'Impostos do dentista', 'Planejamento financeiro pessoal'] },
        { nome: 'Marketing e carreira', paginas: ['Marketing ético e redes sociais', 'Convênios e planos', 'Carreira: clínica, serviço público, academia', 'Educação continuada e especialização', 'Concursos e residências'] },
      ] },
      { nome: 'Odontologia digital e inovação', temas: [
        { nome: 'Tecnologias', paginas: ['Prontuário e gestão digitais', 'Fluxo digital: onde começar', 'Inteligência artificial na odontologia', 'Teleodontologia: limites legais'] },
      ] },
    ],
  },
];
