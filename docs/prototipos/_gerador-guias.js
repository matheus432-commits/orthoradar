// Gera guias de leitura estáticos no template compartilhado (odontofeed.css).
const fs = require('fs');
const OUT = '/home/user/orthoradar/docs/prototipos/';

function guia({ file, esp, acento, titulo, sub, secoes, evid }) {
  const blocos = secoes.map(s => {
    const itens = s.itens.map(i => `<li>${i}</li>`).join('');
    const sub2 = s.sub ? `<div class="b-sub">${s.sub}</div>` : '';
    return `  <div class="bloco"><div class="b-nome2">${s.h}</div>${sub2}<ul>${itens}</ul></div>`;
  }).join('\n');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} — OdontoFeed</title>
<link rel="stylesheet" href="odontofeed.css">
<style>:root{--acento:${acento}}
.b-nome2{font-family:var(--serif);font-size:18px;color:var(--acento);font-weight:400}
.b-sub{font-size:12.5px;color:var(--suave);margin:3px 0 2px}
.bloco li{font-size:13.6px;color:var(--texto);margin-left:16px;margin-top:4px}
.bloco b{color:var(--grafite);font-weight:600}
</style>
</head>
<body>
<div class="pagina">
  <a class="voltar" href="dashboard-com-ferramentas.html">‹ Ferramentas</a>
  <div class="selo">${esp} · Guia clínico</div>
  <h1>${titulo}</h1>
  <p class="sub">${sub}</p>
  <div class="filete"></div>

${blocos}

  <div class="evid">${evid}</div>

  <div class="marca"><b>Odonto<span class="p">Feed</span></b> · Guias Clínicos · protótipo (não publicado)</div>
</div>
</body>
</html>
`;
  fs.writeFileSync(OUT + file, html);
  console.log('gerado', file);
}

const G = [
  // ── Ortodontia ──
  { file:'guia-erupcao.html', esp:'Ortodontia', acento:'#5B6BA8', titulo:'Cronologia de Erupção e Interceptação',
    sub:'As janelas de irrupção dos permanentes e quando intervir versus acompanhar.',
    secoes:[
      { h:'Sequência de irrupção (permanentes)', itens:[
        '6–7 anos: primeiros molares e incisivos centrais inferiores',
        '7–8 anos: incisivos centrais superiores e laterais inferiores',
        '8–9 anos: incisivos laterais superiores',
        '9–12 anos: caninos e pré-molares (inferior costuma preceder o superior)',
        '11–13 anos: segundos molares'] },
      { h:'Sinais que pedem interceptação precoce', itens:[
        'Mordida cruzada posterior com desvio funcional — expandir cedo',
        'Mordida cruzada anterior (pseudo Classe III) — corrigir ao irromper os incisivos',
        'Perda precoce de decíduo — mantenedor de espaço',
        'Hábitos de sucção persistentes após os 3–4 anos'] },
      { h:'Quando acompanhar em vez de tratar', itens:[
        'Apinhamento leve transitório na fase de dentadura mista ("patinho feio")',
        'Diastema mediano superior antes da irrupção dos caninos',
        'Discrepâncias que tendem a se resolver com o crescimento'] },
    ],
    evid:'A idade dentária (sequência) informa mais que a cronológica. Assimetrias de mais de 6 meses entre homólogos merecem investigação radiográfica.' },

  { file:'guia-contencao.html', esp:'Ortodontia', acento:'#5B6BA8', titulo:'Contenção Ortodôntica',
    sub:'Qual contentor escolher, por quanto tempo e o que orientar ao paciente.',
    secoes:[
      { h:'Contenção fixa (barra colada 3-3)', sub:'Estabilidade prolongada, independe de colaboração',
        itens:['Indicada em diastemas fechados, rotações severas e apinhamento inferior corrigido',
          'Exige higiene rigorosa e controle periódico de descolagem',
          'Pode permanecer por anos / indefinidamente'] },
      { h:'Contenção removível (placa de Hawley / Essix)', sub:'Depende da colaboração',
        itens:['Hawley: ajustável, durável; Essix: estética, menos volumosa',
          'Uso integral nos primeiros meses, migrando para noturno',
          'Essix não permite assentamento oclusal completo — atenção em casos com necessidade de acomodação'] },
      { h:'Protocolo de tempo', itens:[
        'Uso integral 3–6 meses; depois noturno',
        'Recidiva é maior no primeiro ano — não abandonar cedo',
        'Contenção de longo prazo é a norma para incisivos inferiores e casos com risco de recidiva'] },
    ],
    evid:'Não há tempo "seguro" universal para suspender: a estabilidade a longo prazo favorece contenção prolongada, sobretudo no arco inferior.' },

  // ── Implantodontia ──
  { file:'guia-qualidade-ossea.html', esp:'Implantodontia', acento:'#3E8F86', titulo:'Qualidade Óssea (Lekholm & Zarb)',
    sub:'As quatro classes de densidade óssea e como cada uma muda a técnica.',
    secoes:[
      { h:'Tipo I — osso cortical denso', itens:['Mandíbula anterior típica',
        'Excelente estabilidade primária, mas vascularização menor',
        'Risco de superaquecimento — irrigação abundante e brocas afiadas','Evitar subinstrumentação excessiva'] },
      { h:'Tipo II e III — cortical + medular equilibrados', itens:[
        'Situação mais favorável (mandíbula posterior, maxila anterior)',
        'Boa estabilidade e cicatrização','Protocolo de fresagem padrão'] },
      { h:'Tipo IV — osso medular frouxo', itens:['Maxila posterior típica',
        'Baixa estabilidade primária — subinstrumentar, usar osteótomos',
        'Considerar carga tardia e implantes de maior diâmetro/comprimento','Técnica de condensação óssea ajuda'] },
    ],
    evid:'A densidade percebida na fresagem orienta em tempo real a decisão de carga (ver a ferramenta de Protocolo de Carga). Tipo IV é o principal fator de menor previsibilidade.' },

  { file:'guia-checklist-tomografia.html', esp:'Implantodontia', acento:'#3E8F86', titulo:'Checklist de Planejamento em Tomografia',
    sub:'O que medir e conferir na TCFC antes de instalar um implante.',
    secoes:[
      { h:'Medidas essenciais', itens:['Altura óssea disponível até estruturas nobres',
        'Espessura vestíbulo-lingual (mínimo ~1,5–2 mm de osso ao redor do implante)',
        'Distância ao canal mandibular (margem de segurança ≥ 2 mm)',
        'Assoalho do seio maxilar e septos'] },
      { h:'Estruturas a localizar', itens:['Canal mandibular e forame mentual (e alça anterior)',
        'Seio maxilar e fossa nasal','Forame incisivo na região anterior superior',
        'Concavidades linguais na mandíbula posterior (risco de perfuração)'] },
      { h:'Planejamento protético reverso', itens:[
        'Posicionar o implante a partir da coroa desejada, não só do osso disponível',
        'Guia cirúrgico quando a margem é estreita','Avaliar necessidade de enxerto (ver ferramenta de Enxertos)'] },
    ],
    evid:'A maioria das lesões neurossensoriais evitáveis vem de subestimar a distância ao canal. Meça sempre em corte perpendicular ao rebordo.' },

  { file:'guia-periimplantite.html', esp:'Implantodontia', acento:'#3E8F86', titulo:'Mucosite e Peri-implantite',
    sub:'Diagnóstico diferencial e manejo das doenças peri-implantares.',
    secoes:[
      { h:'Mucosite peri-implantar', sub:'Reversível — inflamação sem perda óssea', itens:[
        'Sangramento à sondagem, sem perda óssea radiográfica','Placa/biofilme como fator',
        'Manejo: desbridamento não cirúrgico + higiene + controle de placa','Reavaliar em 1–2 meses'] },
      { h:'Peri-implantite', sub:'Perda óssea progressiva ao redor do implante', itens:[
        'Sangramento/supuração + perda óssea radiográfica além da remodelação inicial',
        'Sondagem aumentada em relação a exames anteriores',
        'Manejo: descontaminação da superfície; cirúrgico (acesso, regeneração ou implantoplastia) conforme o defeito'] },
      { h:'Prevenção', itens:['Controle de placa e manutenção periódica individualizada',
        'Cimentação sem excessos subgengivais (usar cimento controlado)','Rastrear tabagismo e diabetes'] },
    ],
    evid:'Sondar implantes é seguro e necessário — a comparação com registros anteriores é o que diferencia remodelação fisiológica de peri-implantite ativa.' },

  // ── Periodontia ──
  { file:'guia-recessoes.html', esp:'Periodontia', acento:'#B05A6B', titulo:'Recessões Gengivais (Cairo) e Recobrimento',
    sub:'Classificação RT1–RT3 e a previsibilidade do recobrimento radicular.',
    secoes:[
      { h:'RT1 — sem perda interproximal', itens:['Recobrimento radicular completo é previsível',
        'Técnicas: retalho reposicionado coronário + enxerto de tecido conjuntivo',
        'Melhor prognóstico entre as classes'] },
      { h:'RT2 — perda interproximal ≤ recessão vestibular', itens:[
        'Recobrimento parcial a completo, menos previsível','Enxerto conjuntivo melhora o resultado',
        'Alinhar expectativa com o paciente'] },
      { h:'RT3 — perda interproximal > recessão vestibular', itens:[
        'Recobrimento completo improvável','Foco em controle e ganho de tecido queratinizado',
        'Avaliar causa (trauma de escovação, freio, posição dentária)'] },
    ],
    evid:'A altura das papilas interproximais (nível ósseo interdental) é o teto do recobrimento possível — daí a lógica da classificação de Cairo.' },

  { file:'guia-sondagem.html', esp:'Periodontia', acento:'#B05A6B', titulo:'Sondagem e Periograma',
    sub:'Como registrar o exame periodontal completo e o que cada parâmetro significa.',
    secoes:[
      { h:'Parâmetros por dente (6 sítios)', itens:[
        'Profundidade de sondagem (PS): fundo da bolsa à margem gengival',
        'Nível de inserção clínico (NIC): fundo da bolsa à junção cemento-esmalte — o parâmetro de perda real',
        'Sangramento à sondagem (SS): indicador de atividade inflamatória'] },
      { h:'Outros registros', itens:['Recessão, mobilidade e envolvimento de furca',
        'Supuração, placa visível','Largura de gengiva queratinizada'] },
      { h:'Leitura do conjunto', itens:[
        'PS profunda sem perda de inserção pode ser pseudobolsa (edema)',
        'NIC é o que define estágio (ver ferramenta de Estadiamento 2018)',
        'SS generalizado sinaliza necessidade de controle antes de qualquer cirurgia'] },
    ],
    evid:'Bolsa isolada não fecha diagnóstico: é a combinação PS + NIC + SS + imagem que classifica e monitora a doença.' },

  { file:'guia-raspagem-cirurgia.html', esp:'Periodontia', acento:'#B05A6B', titulo:'Raspagem ou Cirurgia',
    sub:'Quando a terapia não cirúrgica basta e quando escalar para acesso cirúrgico.',
    secoes:[
      { h:'Terapia não cirúrgica (RAR) primeiro', itens:[
        'Sempre a primeira etapa após controle de placa',
        'Reavaliar em 6–8 semanas','Bolsas rasas/moderadas costumam resolver'] },
      { h:'Indicação de cirurgia', itens:[
        'Bolsas residuais ≥ 6 mm com sangramento após a fase não cirúrgica',
        'Defeitos infraósseos com potencial regenerativo','Furcas de difícil acesso'] },
      { h:'Tipos de acesso', itens:['Retalho de acesso (desbridamento a campo aberto)',
        'Cirurgia regenerativa (membrana/enxerto/derivado da matriz do esmalte) em defeitos contidos',
        'Ressectiva em arquitetura óssea desfavorável'] },
    ],
    evid:'Cirurgia sem controle de placa e sem reavaliação da fase não cirúrgica tem prognóstico ruim — a sequência importa mais que a técnica.' },

  // ── Endodontia ──
  { file:'guia-irrigacao.html', esp:'Endodontia', acento:'#B0863A', titulo:'Protocolos de Irrigação',
    sub:'As soluções, as concentrações e a ativação que definem o sucesso da desinfecção.',
    secoes:[
      { h:'Hipoclorito de sódio (NaOCl)', sub:'Irrigante principal', itens:[
        'Concentrações de 1% a 5,25% — dissolve matéria orgânica e é antimicrobiano',
        'Volume e renovação constantes importam mais que a concentração isolada',
        'Cuidado com extrusão apical (acidente do hipoclorito)'] },
      { h:'EDTA 17%', sub:'Remoção da smear layer', itens:[
        'Quelante — remove a lama dentinária ao final do preparo',
        'Alternar com NaOCl; não misturar diretamente','Melhora a adaptação do material obturador'] },
      { h:'Clorexidina 2%', sub:'Coadjuvante / casos selecionados', itens:[
        'Substantividade e ação sobre E. faecalis','Não dissolve tecido orgânico — não substitui o NaOCl',
        'Nunca misturar com NaOCl (forma precipitado)'] },
      { h:'Ativação', itens:['Ativação ultrassônica passiva (PUI) melhora a limpeza de istmos e ramificações',
        'Agitação com o próprio cone / dispositivos sônicos','Patência apical mantém o irrigante circulando'] },
    ],
    evid:'A instrumentação toca uma fração das paredes do canal — é a irrigação ativada, com volume e tempo, que desinfeta o sistema de canais.' },

  { file:'guia-retratamento.html', esp:'Endodontia', acento:'#B0863A', titulo:'Retratamento ou Cirurgia Parendodôntica',
    sub:'Quando reintervir pelo canal e quando indicar a via cirúrgica.',
    secoes:[
      { h:'Retratamento não cirúrgico (preferência)', itens:[
        'Falha com causa identificável e coroa/retentor removíveis',
        'Canal subobturado, não localizado ou infiltrado',
        'Melhor acesso à origem da infecção (o próprio sistema de canais)'] },
      { h:'Cirurgia parendodôntica', itens:[
        'Retratamento inviável (pino longo, risco de fratura) ou já refeito sem sucesso',
        'Lesão persistente com necessidade de biópsia',
        'Apicetomia + obturação retrógrada (MTA/biocerâmico)'] },
      { h:'Fatores de decisão', itens:['Restaurabilidade e valor estratégico do dente',
        'Anatomia e proximidade de estruturas nobres','Preferência e condição do paciente'] },
    ],
    evid:'A regra geral é reintervir pela via que remove a causa: quando ela está no canal, o retratamento ortógrado tende a superar a cirurgia isolada.' },

  // ── Dentística ──
  { file:'guia-adesivos.html', esp:'Dentística', acento:'#3E7CA8', titulo:'Protocolos Adesivos',
    sub:'Condicionamento total versus autocondicionante, passo a passo, por substrato.',
    secoes:[
      { h:'Condicionamento total (etch-and-rinse)', itens:[
        'Ácido fosfórico 37% no esmalte (15–30 s) e dentina (não exceder ~15 s)',
        'Manter a dentina úmida (wet bonding) para o adesivo hidrófilo',
        'Melhor adesão em esmalte — preferência em facetas e margens em esmalte'] },
      { h:'Autocondicionante (self-etch)', itens:[
        'Menos sensibilidade pós-operatória em dentina','Condicionamento seletivo do esmalte com ácido fosfórico melhora a margem',
        'Bom para cavidades em dentina e pacientes com sensibilidade'] },
      { h:'Universal', itens:['Pode ser usado em qualquer modo (total, seletivo, self-etch)',
        'Contém MDP — adere também a zircônia e metais','Versátil para o dia a dia'] },
    ],
    evid:'Em margens de esmalte, o condicionamento com ácido fosfórico é o passo que mais protege contra infiltração e manchamento marginal a longo prazo.' },

  { file:'guia-clareamento.html', esp:'Dentística', acento:'#3E7CA8', titulo:'Clareamento e Sensibilidade',
    sub:'Concentrações, protocolos e como prevenir e manejar a sensibilidade.',
    secoes:[
      { h:'Caseiro supervisionado', itens:['Peróxido de carbamida 10–16% em moldeira individual',
        'Uso de 2–4 h/dia ou noturno, por 2–3 semanas','Melhor previsibilidade e menos sensibilidade que altas concentrações'] },
      { h:'Consultório', itens:['Peróxido de hidrogênio 35–40%, sessões de ~40 min',
        'Resultado mais rápido; maior pico de sensibilidade','Proteger tecidos moles (barreira gengival)'] },
      { h:'Sensibilidade — prevenir e tratar', itens:[
        'Nitrato de potássio e/ou flúor antes e durante o tratamento',
        'Espaçar as aplicações; reduzir tempo/concentração se intensa',
        'Sensibilidade é transitória — orientar o paciente antes de começar'] },
    ],
    evid:'Dentes com recessões, trincas ou restaurações infiltradas sensibilizam mais — examinar e tratar antes de clarear reduz queixas.' },

  { file:'guia-escala-cor.html', esp:'Dentística', acento:'#3E7CA8', titulo:'Seleção de Cor na Prática',
    sub:'Como registrar cor de forma confiável para restaurações e próteses.',
    secoes:[
      { h:'Condições da tomada de cor', itens:['Com o dente HIDRATADO, antes do isolamento (desidrata e clareia)',
        'Luz natural difusa ou lâmpada de luz do dia (5500 K)','Fundo neutro; remover batom e cores fortes do campo'] },
      { h:'Sequência com escala', itens:['Definir primeiro o croma/valor (quão claro/escuro), depois o matiz',
        'Comparar em segundos — o olho fadiga rápido','Registrar por terços (cervical, médio, incisal)'] },
      { h:'Recursos adicionais', itens:['Foto com escala ao lado do dente para comunicação com o laboratório',
        'Escalas 3D (valor→croma→matiz) ajudam na organização','Espectrofotômetro quando disponível reduz subjetividade'] },
    ],
    evid:'A maior fonte de erro é a desidratação: cor tomada após minutos de isolamento sai clara demais e a restauração fica opaca.' },

  // ── Prótese ──
  { file:'guia-coroa-onlay-faceta.html', esp:'Prótese', acento:'#8a6d9c', titulo:'Coroa, Onlay ou Faceta',
    sub:'A decisão pela quantidade de estrutura remanescente e a exigência do caso.',
    secoes:[
      { h:'Faceta', sub:'Preservadora, foco estético', itens:[
        'Face vestibular comprometida, esmalte suficiente para adesão',
        'Ideal para forma, cor e pequenos desalinhamentos',
        'Contraindicada com grande perda estrutural ou parafunção severa'] },
      { h:'Onlay / overlay', sub:'Restauração parcial que cobre cúspides', itens:[
        'Perda de uma ou mais cúspides, mas com parede remanescente',
        'Preserva mais estrutura que a coroa total','Cerâmica ou resina indireta adesiva'] },
      { h:'Coroa total', sub:'Máxima cobertura', itens:[
        'Grande destruição, dente tratado endodonticamente com pouca estrutura',
        'Necessidade de retenção circunferencial','Considerar núcleo/pino quando remanescente é mínimo'] },
    ],
    evid:'A tendência atual é a máxima preservação: preferir a solução mais conservadora que a estrutura remanescente permita suportar com segurança.' },

  { file:'guia-terminos.html', esp:'Prótese', acento:'#8a6d9c', titulo:'Términos e Preparos',
    sub:'Os tipos de término cervical e quando usar cada um.',
    secoes:[
      { h:'Chanfro (chamfer)', itens:['Término arredondado, definido',
        'Bom para coroas metalocerâmicas e monolíticas','Preservação razoável de estrutura'] },
      { h:'Ombro (shoulder)', itens:['Término em 90°, mais desgaste',
        'Espaço para cerâmica na região estética anterior','Ombro arredondado é uma variação comum'] },
      { h:'Término em lâmina / justagengival', itens:[
        'Mínimo desgaste, mas limite menos definido para o laboratório',
        'Preferir margens supragengivais ou justagengivais para saúde e moldagem',
        'Subgengival só quando estética/retenção exigem'] },
    ],
    evid:'Margem supragengival, sempre que possível, é a que melhor preserva o periodonto e facilita moldagem, cimentação e higiene.' },

  { file:'guia-ceramicas.html', esp:'Prótese', acento:'#8a6d9c', titulo:'Zircônia, Dissilicato ou Híbridas',
    sub:'Qual cerâmica para qual situação, entre resistência e estética.',
    secoes:[
      { h:'Dissilicato de lítio', itens:['Ótima estética, translucidez','Resistência média — coroas unitárias anteriores e posteriores, facetas',
        'Condicionável (adesão previsível)'] },
      { h:'Zircônia', itens:['Alta resistência — posteriores e próteses parciais fixas',
        'Versões mais translúcidas ampliaram o uso estético','NÃO condiciona com ácido — cimentação com MDP (ver ferramenta de Cimentação)'] },
      { h:'Cerâmicas/resinas híbridas', itens:['Módulo próximo ao da dentina, fresagem fácil',
        'Boas para casos com espaço reduzido','Resistência ao desgaste menor que a das cerâmicas vítreas'] },
    ],
    evid:'A escolha equilibra carga mastigatória e estética: quanto mais posterior e sob carga, mais peso para resistência (zircônia); quanto mais visível, mais peso para translucidez.' },

  // ── Bucomaxilofacial ──
  { file:'guia-mronj.html', esp:'Bucomaxilofacial', acento:'#7C5CD6', titulo:'Protocolo MRONJ',
    sub:'Osteonecrose associada a medicamentos: prevenção, diagnóstico e conduta.',
    secoes:[
      { h:'Quem está em risco', itens:['Uso de antirreabsortivos (bisfosfonatos, denosumabe) e antiangiogênicos',
        'Risco maior na via endovenosa oncológica que na oral para osteoporose',
        'Procedimentos com exposição óssea (exodontia) são o principal gatilho'] },
      { h:'Prevenção (antes de iniciar/durante a droga)', itens:[
        'Adequar a saúde bucal ANTES do início da medicação quando possível',
        'Priorizar tratamento conservador; evitar exodontias eletivas',
        'Reforçar higiene e acompanhamento; ajustar próteses que traumatizam'] },
      { h:'Diagnóstico e conduta', itens:[
        'Osso exposto por &gt; 8 semanas em paciente em risco, sem radioterapia prévia',
        'Estágios 0–3: de manejo conservador (bochechos, controle de infecção) a ressecção',
        'Alinhar suspensão da droga ("drug holiday") sempre com o médico'] },
    ],
    evid:'A melhor conduta é a prevenção: adequação bucal antes de iniciar o antirreabsortivo reduz drasticamente a incidência. Nunca suspender a medicação por conta própria.' },

  { file:'guia-fratura.html', esp:'Bucomaxilofacial', acento:'#7C5CD6', titulo:'Sinais Radiográficos de Fratura',
    sub:'Como reconhecer fraturas de mandíbula e face na imagem e o que fazer.',
    secoes:[
      { h:'Sinais na imagem', itens:['Linha radiolúcida atravessando a cortical / descontinuidade do contorno',
        'Degrau ósseo ou perda do alinhamento dos dentes','Aumento/assimetria de espaços articulares (côndilo)'] },
      { h:'Locais frequentes na mandíbula', itens:['Ângulo (associado a terceiro molar)',
        'Côndilo e sub-côndilo','Parassínfise','Corpo'] },
      { h:'Sinais clínicos que confirmam', itens:['Má-oclusão de início súbito, mobilidade de segmento',
        'Degrau na palpação, parestesia do lábio inferior','Trismo e desvio na abertura'] },
      { h:'Conduta inicial', itens:['Estabilizar, controlar dor e infecção',
        'TCFC/TC para planejar','Encaminhamento para tratamento definitivo (fixação)'] },
    ],
    evid:'Fratura de côndilo escapa facilmente na radiografia 2D — diante de má-oclusão súbita e dor pré-auricular após trauma, escalar para tomografia.' },

  // ── Odontopediatria ──
  { file:'guia-erupcao-ped.html', esp:'Odontopediatria', acento:'#B0863A', titulo:'Cronologia de Erupção (Decíduos e Permanentes)',
    sub:'As idades de irrupção e esfoliação para orientar pais e planejar.',
    secoes:[
      { h:'Decíduos — irrupção', itens:['6–10 meses: incisivos centrais inferiores',
        '8–12 meses: incisivos centrais superiores','9–16 meses: incisivos laterais',
        '16–23 meses: caninos','13–33 meses: molares decíduos (segundos molares por último)'] },
      { h:'Esfoliação e permanentes', itens:['~6 anos: irrompem os primeiros molares permanentes (atrás dos decíduos, sem troca)',
        '6–8 anos: troca dos incisivos','9–12 anos: caninos e pré-molares','Alertar os pais: o 1º molar permanente NÃO substitui decíduo'] },
      { h:'Variações e alertas', itens:['Atraso isolado costuma ser normal; ausência bilateral pede radiografia',
        'Dentes natais/neonatais: avaliar mobilidade e risco','Anquilose de molar decíduo ("submerso"): acompanhar'] },
    ],
    evid:'O primeiro molar permanente aos 6 anos é o mais negligenciado por ser confundido com decíduo — reforçar a escovação e o selante nessa fase.' },

  { file:'guia-trauma-deciduos.html', esp:'Odontopediatria', acento:'#B0863A', titulo:'Trauma em Dentes Decíduos',
    sub:'O que muda em relação ao permanente — a prioridade é o germe do sucessor.',
    secoes:[
      { h:'Princípio geral', itens:['A conduta prioriza proteger o germe do permanente',
        'Avulsão de decíduo NÃO se reimplanta (risco ao germe)',
        'Muitas intrusões são acompanhadas aguardando reirrupção'] },
      { h:'Por tipo', itens:['Subluxação: dieta macia, acompanhar',
        'Luxação lateral/extrusiva leve: reposicionar suave ou acompanhar; extrair se muito móvel/interferência',
        'Intrusão: acompanhar reirrupção; extrair se deslocada para o germe',
        'Fratura com exposição: pulpotomia ou exodontia conforme extensão'] },
      { h:'Orientação aos pais', itens:['Vigiar sinais de infecção (fístula, mobilidade, dor, escurecimento)',
        'Escurecimento isolado nem sempre exige exodontia','Controles clínicos e radiográficos periódicos',
        'Explicar possíveis sequelas no permanente (manchas, alteração de forma)'] },
    ],
    evid:'A decisão gira em torno da relação do ápice decíduo com o germe permanente: quando o trauma o ameaça, a remoção protege o sucessor.' },

  { file:'guia-fluor.html', esp:'Odontopediatria', acento:'#B0863A', titulo:'Flúor por Idade',
    sub:'Doses, veículos e o equilíbrio entre prevenção de cárie e risco de fluorose.',
    secoes:[
      { h:'Dentifrício fluoretado', itens:['&lt; 3 anos: quantidade tipo "grão de arroz" (1000 ppm), 2x/dia',
        '3–6 anos: quantidade tipo "grão de ervilha", supervisão dos pais',
        '&gt; 6 anos: faixa completa (1100–1450 ppm)','Cuspir, não enxaguar em excesso — potencializa o efeito'] },
      { h:'Verniz de flúor (5% NaF)', itens:['Aplicação profissional a cada 3–6 meses conforme risco',
        'Seguro desde a irrupção dos primeiros dentes','Alta concentração local, baixo risco sistêmico'] },
      { h:'Risco de fluorose', itens:['Preocupação apenas até ~6–8 anos (formação do esmalte anterior)',
        'Supervisionar a quantidade engolida em crianças pequenas','Ajustar conforme flúor da água de abastecimento'] },
    ],
    evid:'O benefício do flúor tópico na prevenção de cárie supera o risco de fluorose leve quando a quantidade de dentifrício é supervisionada por idade.' },

  // ── DTM ──
  { file:'guia-diagnostico-dor.html', esp:'DTM e Dor Orofacial', acento:'#C77B3A', titulo:'Diagnóstico Diferencial da Dor Orofacial',
    sub:'Uma árvore de raciocínio para não confundir origens da dor.',
    secoes:[
      { h:'Dor de origem dentária / pulpar', itens:['Provocada por frio/calor, localizada, relacionada a cárie/restauração',
        'Testa positivo no dente; melhora/piora com estímulo','Descartar antes de atribuir à ATM'] },
      { h:'Dor muscular / articular (DTM)', itens:['Piora à função (mastigar, abrir), palpação muscular dolorosa',
        'Estalido/limitação de abertura na articular','Padrão de bruxismo/parafunção'] },
      { h:'Dor neuropática', itens:['Neuralgia do trigêmeo: choques breves, gatilhos cutâneos',
        'Dor contínua em queimação, sem achado dentário','Não responde a tratamento odontológico — encaminhar'] },
      { h:'Dor referida / outras', itens:['Sinusite (dor em molares superiores que piora ao abaixar a cabeça)',
        'Cefaleias primárias, dor cardíaca referida à mandíbula (emergência)',
        'Sempre considerar causas médicas em dor atípica'] },
    ],
    evid:'O erro mais custoso é tratar endodontia/exodontia numa dor que é muscular ou neuropática — teste o dente e reavalie a resposta ao tratamento antes de irreversibilidades.' },

  { file:'guia-exame-dctmd.html', esp:'DTM e Dor Orofacial', acento:'#C77B3A', titulo:'Exame DC/TMD Guiado',
    sub:'Os passos do exame clínico padronizado para disfunção temporomandibular.',
    secoes:[
      { h:'Amplitude de abertura', itens:['Abertura máxima sem dor e com dor (medir em mm)',
        'Abertura assistida (limitação muscular vs. articular)','Desvios e deflexões no trajeto'] },
      { h:'Palpação', itens:['Masseter e temporal (dor familiar reproduzida?)',
        'Polo lateral do côndilo e região pré-auricular','Registrar se a dor reproduz a queixa do paciente'] },
      { h:'Ruídos e movimentos', itens:['Estalido recíproco (deslocamento de disco com redução)',
        'Crepitação (alteração degenerativa)','Movimentos de lateralidade e protrusão'] },
      { h:'Fechando o diagnóstico', itens:['Classificar: mialgia, artralgia, deslocamento de disco, doença articular degenerativa',
        'Rastrear fatores contribuintes (estresse, parafunção, sono)','Direcionar à ferramenta de Seleção de Placa e ao manejo'] },
    ],
    evid:'A reprodução da dor FAMILIAR à palpação/movimento é o achado-chave do DC/TMD — dor não familiar não confirma o diagnóstico.' },

  // ── Radiologia ──
  { file:'guia-radiolucidas.html', esp:'Radiologia', acento:'#3E8FA8', titulo:'Lesões Radiolúcidas × Radiopacas',
    sub:'Uma árvore diagnóstica por relação com o dente e características da imagem.',
    secoes:[
      { h:'Radiolúcidas periapicais', itens:['Relacionadas ao ápice de dente com necrose: granuloma/cisto/abscesso',
        'Testar vitalidade — dente vital afasta origem endodôntica','Cisto tende a ser bem delimitado e corticalizado'] },
      { h:'Radiolúcidas pericoronárias', itens:['Ao redor da coroa de dente incluso: cisto dentígero (típico)',
        'Avaliar tamanho e deslocamento do dente','Ceratocisto: pode ser extenso com pouca expansão'] },
      { h:'Radiopacas / mistas', itens:['Osteíte esclerosante (reação a inflamação de baixo grau)',
        'Odontoma (mista, com estruturas dentárias)','Displasia óssea (mista, comum na região periapical anterior inferior, dentes vitais)'] },
      { h:'Sinais de alerta', itens:['Bordos mal definidos, reabsorção radicular, expansão de corticais',
        'Crescimento rápido','Encaminhar/biopsiar diante de qualquer sinal agressivo'] },
    ],
    evid:'O primeiro filtro é sempre a vitalidade pulpar: separa a imensa maioria das lesões periapicais inflamatórias das lesões de origem não endodôntica.' },

  { file:'guia-anatomia-radiografica.html', esp:'Radiologia', acento:'#3E8FA8', titulo:'Anatomia Radiográfica que Engana',
    sub:'Estruturas normais que simulam patologia — para não tratar o que não existe.',
    secoes:[
      { h:'Radiolúcidas normais', itens:['Forame incisivo e mentual (podem simular lesão periapical)',
        'Fossa submandibular / fóvea (radiolucidez em molar inferior)','Espaço medular amplo, seio maxilar sobreposto a ápices'] },
      { h:'Radiopacas normais', itens:['Toro/exostoses, linha oblíqua, apófise geniana',
        'Osso cortical do canal e do assoalho do seio','Cartilagem calcificada, tonsilólitos sobre o ramo'] },
      { h:'Como diferenciar de patologia', itens:['Estrutura normal é bilateral/simétrica e não desloca dentes',
        'Relação anatômica constante entre exames','Na dúvida, correlacionar com clínica e considerar segunda incidência/TCFC'] },
    ],
    evid:'Muitas "lesões" periapicais em molares e região anterior são forames e fossas anatômicas — a simetria e a ausência de sintoma são as melhores pistas.' },

  // ── Estomatologia ──
  { file:'guia-rastreio-cancer.html', esp:'Estomatologia', acento:'#3E8F86', titulo:'Rastreio de Câncer Bucal',
    sub:'O exame sistemático da mucosa e os sinais que exigem encaminhamento.',
    secoes:[
      { h:'Exame sistemático (toda consulta)', itens:['Lábios, mucosa jugal, gengiva, palato duro e mole',
        'Dorso, ventre e bordas laterais da língua (local mais comum de CEC)','Assoalho de boca e orofaringe; palpar linfonodos cervicais'] },
      { h:'Fatores de risco', itens:['Tabaco e álcool (sinérgicos)','HPV (orofaringe)',
        'Exposição solar (lábio inferior)','Lesões potencialmente malignas prévias (leucoplasia, eritroplasia)'] },
      { h:'Sinais de alerta (encaminhar)', itens:['Úlcera que não cicatriza em 2 semanas',
        'Placa vermelha (eritroplasia) ou branca que não se destaca','Massa indurada, fixa; sangramento sem causa',
        'Dor/dormência persistente, dente com mobilidade sem causa periodontal'] },
    ],
    evid:'A bordo lateral de língua e o assoalho concentram a maioria dos carcinomas — o exame de rotina de 2 minutos é a ferramenta de detecção precoce mais eficaz.' },

  { file:'guia-biopsia.html', esp:'Estomatologia', acento:'#3E8F86', titulo:'Biópsia: Quando e Como',
    sub:'A indicação, o tipo e os cuidados para uma biópsia diagnóstica.',
    secoes:[
      { h:'Quando indicar', itens:['Lesão persistente &gt; 2 semanas após remover a causa',
        'Qualquer lesão com sinal de alerta (ver Rastreio de Câncer)','Lesão branca/vermelha sem diagnóstico clínico claro'] },
      { h:'Tipo de biópsia', itens:['Incisional: lesões grandes ou suspeitas de malignidade (amostra da borda + tecido normal)',
        'Excisional: lesões pequenas e provavelmente benignas (remove tudo)',
        'Nunca "excisar e descartar" uma lesão suspeita sem exame histopatológico'] },
      { h:'Cuidados', itens:['Amostra representativa, profunda o suficiente, sem esmagar o tecido',
        'Fixar em formol 10% imediatamente','Requisição com história clínica e hipóteses',
        'Encaminhar ao estomatologista/patologista quando houver suspeita de malignidade'] },
    ],
    evid:'O laudo histopatológico é o padrão-ouro — nenhuma característica clínica isolada substitui a biópsia diante de lesão persistente ou suspeita.' },
];

G.forEach(guia);
console.log('\nTotal:', G.length, 'guias gerados.');
