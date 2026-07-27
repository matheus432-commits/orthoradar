// Enriquece guias gerados com painel "o que é/orienta" + seção de cuidados (nível atlas).
const fs = require('fs');
const DIR = '/home/user/orthoradar/docs/prototipos/';

const CSS = `
.painel-i{border:1px solid var(--linha);border-radius:var(--raio);border-left:2px solid var(--acento);padding:17px 19px;margin:18px 0}
.pi-rot{font-size:10.5px;font-weight:600;letter-spacing:1.3px;text-transform:uppercase;color:var(--acento);margin-bottom:7px}
.pi-txt{font-size:13.6px;color:var(--texto)}.pi-txt b{color:var(--grafite);font-weight:600}
.h-cuidados{font-family:var(--serif);font-size:20px;font-weight:400;color:var(--grafite);margin:28px 0 4px}
.cuidado{display:flex;gap:14px;padding:15px 2px;border-bottom:1px solid var(--linha)}
.c-num{font-family:var(--serif);font-size:20px;color:var(--acento);flex:0 0 auto;width:26px;line-height:1.3}
.c-tit{font-size:14.5px;font-weight:600;color:var(--grafite)}
.c-txt2{font-size:13.3px;color:var(--texto);margin-top:2px}.c-txt2 b{color:var(--grafite);font-weight:600}
`;

const D = {
  'guia-recessoes.html': {
    rot:'O que a classificação orienta',
    txt:'A classificação de Cairo (RT1–RT3) baseia-se na <b>perda de inserção interproximal</b> — que funciona como o teto do recobrimento radicular possível. Quanto mais preservada a papila, mais previsível o recobrimento.',
    cuidados:[
      ['A papila é o teto','O nível ósseo interproximal limita o quanto se recobre. Prometer recobrimento total em RT3 gera frustração — alinhar expectativa.'],
      ['Tratar a causa','Escovação traumática, freios e má posição dentária mantêm a recessão. Sem remover a causa, a cirurgia recidiva.'],
      ['Biotipo gengival','Gengiva fina responde pior e exige enxerto de conjuntivo; avaliar a espessura antes de indicar a técnica.']],
  },
  'guia-qualidade-ossea.html': {
    rot:'O que a densidade muda',
    txt:'A qualidade óssea (Lekholm & Zarb, tipos I–IV) define <b>estabilidade primária</b> e estratégia de fresagem. A densidade percebida na cirurgia orienta, em tempo real, a decisão de carga.',
    cuidados:[
      ['Tipo I aquece','Osso cortical denso dá ótima estabilidade, mas vasculariza menos — irrigar bem e não sobreinstrumentar para evitar necrose térmica.'],
      ['Tipo IV pede cautela','Osso frouxo (maxila posterior) tem baixa estabilidade — subinstrumentar, usar osteótomos e preferir carga tardia.'],
      ['Densidade em tempo real','A sensação de fresagem informa mais que a imagem pré-operatória; ajuste o protocolo pelo que encontrar na cirurgia.']],
  },
  'guia-periimplantite.html': {
    rot:'Como diferenciar',
    txt:'A chave entre mucosite (reversível) e peri-implantite (perda óssea progressiva) é a <b>comparação com registros anteriores</b>: sangramento existe nas duas; o que separa é a perda óssea além da remodelação inicial.',
    cuidados:[
      ['Sondar implante é seguro','A sondagem é necessária — o medo de "machucar" leva a diagnósticos tardios. Registre para comparar no futuro.'],
      ['Excesso de cimento','Cimento subgengival é causa frequente de peri-implantite — preferir cimentação controlada ou parafusada.'],
      ['Descontaminar a superfície','O sucesso do tratamento cirúrgico depende de limpar a superfície do implante, não só de acessar o defeito.']],
  },
  'guia-irrigacao.html': {
    rot:'Por que a irrigação decide',
    txt:'A instrumentação toca apenas uma <b>fração das paredes</b> do sistema de canais. É a irrigação — volume, renovação e ativação — que desinfeta istmos, ramificações e a dentina infectada.',
    cuidados:[
      ['Extrusão apical','Hipoclorito além do ápice causa o "acidente do hipoclorito" (dor e edema intensos). Controlar profundidade e pressão da agulha.'],
      ['Não misturar soluções','Clorexidina + hipoclorito formam precipitado (PCA). Irrigar com soro entre as soluções.'],
      ['Ativar sempre','Sem ativação (ultrassônica/sônica) o irrigante não alcança istmos — a agitação final é parte do protocolo, não opcional.']],
  },
  'guia-coroa-onlay-faceta.html': {
    rot:'O que guia a escolha',
    txt:'A decisão parte da <b>estrutura remanescente</b> e da exigência do caso, no princípio da máxima preservação: escolher a solução mais conservadora que o remanescente permita suportar com segurança.',
    cuidados:[
      ['Preservar é a regra','Quanto mais estrutura sadia se remove, mais frágil o dente fica. Preferir onlay/faceta à coroa total quando possível.'],
      ['Adesão precisa de esmalte','Facetas e restaurações adesivas dependem de esmalte na margem — em margens totalmente em dentina, a previsibilidade cai.'],
      ['Endodontia + pouca estrutura','Dente tratado com paredes finas: coroa com recobrimento de cúspides protege contra fratura; avaliar núcleo/pino.']],
  },
  'guia-trauma-deciduos.html': {
    rot:'O que orienta a conduta',
    txt:'No decíduo, a prioridade é <b>proteger o germe do permanente</b>. É a relação do ápice decíduo com o germe que define quando acompanhar e quando remover.',
    cuidados:[
      ['Não reimplantar avulsão','Reimplantar decíduo avulsionado arrisca o germe do sucessor — não é indicado.'],
      ['Escurecimento não é sentença','Dente decíduo escurecido pode permanecer assintomático; só extrair com sinal de infecção (fístula, mobilidade, dor).'],
      ['Explicar sequelas ao permanente','Trauma no decíduo pode deixar mancha ou alteração de forma no permanente — informar os pais desde o início.']],
  },
  'guia-rastreio-cancer.html': {
    rot:'O que o exame busca',
    txt:'Um exame sistemático de 2 minutos da mucosa em toda consulta é a <b>ferramenta de detecção precoce</b> mais eficaz. Bordo lateral de língua e assoalho concentram a maioria dos carcinomas.',
    cuidados:[
      ['Duas semanas é o limite','Úlcera ou lesão que não cicatriza em 2 semanas após remover a causa exige biópsia ou encaminhamento — não "observar mais um mês".'],
      ['Eritroplasia é mais perigosa','Placa vermelha tem maior potencial de malignidade que a branca — nunca subestimar.'],
      ['Palpar, não só olhar','Induração e fixação aos planos profundos são sinais de alerta que só a palpação revela.']],
  },
  'guia-diagnostico-dor.html': {
    rot:'O que separa as origens',
    txt:'A dor orofacial tem origens que se confundem. O erro mais custoso é fazer procedimento irreversível (endodontia/exodontia) numa dor que é <b>muscular ou neuropática</b>.',
    cuidados:[
      ['Testar o dente antes','Dor pulpar responde a teste térmico localizado. Sem confirmação no dente, não indicar endodontia/exodontia.'],
      ['Choque = neuropática','Dor em choque com gatilho cutâneo (neuralgia do trigêmeo) não melhora com tratamento dentário — encaminhar.'],
      ['Descartar causas médicas','Dor atípica na mandíbula pode ser referida (sinusite, até cardíaca). Reavaliar a resposta ao tratamento antes de escalar.']],
  },
};

let n=0;
for (const [file, d] of Object.entries(D)) {
  const path = DIR + file;
  let s = fs.readFileSync(path, 'utf8');
  if (s.includes('painel-i')) { console.log('já enriquecido, pulando', file); continue; }
  s = s.replace('</style>', CSS + '</style>');
  const intro = `\n  <div class="painel-i"><div class="pi-rot">${d.rot}</div><p class="pi-txt">${d.txt}</p></div>\n`;
  s = s.replace('<div class="filete"></div>', '<div class="filete"></div>' + intro);
  const cuidados = `\n  <div class="h-cuidados">Cuidados</div>\n` +
    d.cuidados.map((c,i)=>`  <div class="cuidado"><div class="c-num">0${i+1}</div><div><div class="c-tit">${c[0]}</div><div class="c-txt2">${c[1]}</div></div></div>\n`).join('') + '\n';
  s = s.replace('  <div class="evid">', cuidados + '  <div class="evid">');
  fs.writeFileSync(path, s);
  console.log('enriquecido', file); n++;
}
console.log('\nTotal:', n);
