// CAMPUS — auditoria de CONTEÚDO das apostilas (pedido do fundador, 04/09):
// "faça várias rodadas de teste para detecção de possíveis erros de
// informações falsas, erradas ou mal interpretadas".
//
// Este teste não substitui o validador clínico: ele TRAVA fatos que já foram
// conferidos em rodada de auditoria (docs/campus/AUDITORIA-M1.md) para que
// uma edição futura não os desfaça, e caça padrões de erro conhecidos:
//   • espaços primatas invertidos (superior é MESIAL ao canino, inferior DISTAL);
//   • CS3 descrito como se exigisse corpo vertebral retangular (Baccetti 2005:
//     em CS3 os corpos de C3 e C4 podem ser trapezoides OU retangulares);
//   • número sem marcação [VERIFICAR] em afirmações que a auditoria não fechou;
//   • referência com PMID/DOI escrito à mão (só a Biblioteca traz referência
//     verificável);
//   • termo proibido "Distanciamento"; contradições internas entre o "Em um
//     minuto", o corpo e o autoteste.
//
// Run: node --test netlify/functions/_lib/__tests__/campus-conteudo.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { textosDoCorpo } = require('../campus/pagina');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const DIR = path.join(RAIZ, 'data', 'campus', 'paginas');
const paginas = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ f, p: JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
const m1 = paginas.filter(({ p }) => p.modulo === 'Crescimento e desenvolvimento');
const m2 = paginas.filter(({ p }) => p.modulo === 'Más oclusões');
const m3 = paginas.filter(({ p }) => p.modulo === 'Biologia do movimento');
const textoDe = (p) => JSON.stringify(p);
// Tudo o que a página diz, inclusive o que ela cita PARA NEGAR (erro do aluno,
// alternativa errada do autoteste, mito, rótulo de SVG). Serve às checagens
// positivas ("a página ensina X").
const prosaDe = (p) => [...(p.umMinuto.frases), p.umMinuto.porQueImporta, ...textosDoCorpo(p), ...p.macetes.map((m) => m.titulo + ' ' + m.texto), ...p.ondeErra.flatMap((e) => [e.erro, e.porque, e.certo]), ...p.infografico.itens.map((i) => i.texto), ...p.autoteste.flatMap((q) => [q.pergunta, ...q.alternativas, ...q.explicacoes])].join('\n');
// Só o que a página AFIRMA como verdade: sem "erro"/"porque" do Onde erra, sem
// alternativas erradas, sem o lado "mito" dos quadros e sem rótulos de SVG.
// Serve às checagens negativas ("a página nunca afirma o contrário de X").
function afirmativoDe(p) {
  const out = [...(p.umMinuto.frases), p.umMinuto.porQueImporta, p.abertura.situacao, p.abertura.pergunta];
  for (const s of p.secoes) {
    out.push(s.titulo);
    for (const b of s.blocos) {
      if (b.tipo === 'p') out.push(b.texto);
      else if (b.tipo === 'lista') out.push(...b.itens);
      else if (b.tipo === 'visual') out.push(b.titulo, b.descricao, b.legenda);
      else if (b.tipo === 'destaque') out.push(b.titulo, b.estilo === 'mito' ? b.verdade : b.texto);
      else if (b.tipo === 'pergunta') out.push(b.pergunta, b.resposta);
      else if (b.tipo === 'imagem') out.push(b.legenda);
    }
    if (s.checagem) out.push(s.checagem.pergunta, s.checagem.resposta);
  }
  out.push(p.fechamento.visual.legenda, ...p.fechamento.flashcards.flatMap((c) => [c.frente, c.verso]));
  out.push(...p.macetes.map((m) => m.titulo + ' ' + m.texto), ...p.ondeErra.map((e) => e.certo), ...p.infografico.itens.map((i) => i.texto));
  out.push(...p.autoteste.flatMap((q) => [q.pergunta, q.alternativas[q.correta], q.explicacoes[q.correta]]));
  return out.filter(Boolean).join('\n');
}
const acha = (p, re) => re.test(prosaDe(p));
const afirma = (p, re) => re.test(afirmativoDe(p));
const pagina = (slug) => m1.find(({ f }) => f.includes(slug));

describe('módulo 1: fatos travados pela auditoria (docs/campus/AUDITORIA-M1.md)', () => {
  test('o módulo inteiro está escrito (14 páginas) e todas no formato 2', () => {
    assert.equal(m1.length, 14);
    for (const { f, p } of m1) assert.equal(p.formato, 2, f);
  });

  test('espaços primatas: superior MESIAL ao canino, inferior DISTAL — nunca invertido', () => {
    const { p } = pagina('denticao-decidua');
    assert.ok(acha(p, /mesia(l|is) ao canino superior/i) || acha(p, /superior[^.]{0,40}mesial ao canino/i));
    assert.ok(acha(p, /dista(l|is) ao canino inferior/i) || acha(p, /inferior[^.]{0,40}distal ao canino/i));
    for (const { f, p } of m1) {
      assert.ok(!afirma(p, /primata[^.]{0,60}distal ao canino superior/i), f + ': primata superior descrito como distal');
      assert.ok(!afirma(p, /primata[^.]{0,60}mesial ao canino inferior/i), f + ': primata inferior descrito como mesial');
    }
  });

  test('plano terminal: degrau mesial → Classe I; degrau distal → Classe II; reto → topo a topo', () => {
    const { p } = pagina('denticao-decidua');
    const t = prosaDe(p);
    assert.ok(/degrau mesial[^.]{0,80}Classe I\b/i.test(t) && !afirma(p, /degrau mesial[^.]{0,60}Classe II/i));
    assert.ok(/degrau distal[^.]{0,80}Classe II/i.test(t));
    assert.ok(/plano (terminal )?reto[^.]{0,120}topo a topo/i.test(t));
  });

  test('CVM (Baccetti 2005): CS3 é concavidade em C2 e C3 com C4 plana; a forma do corpo NÃO define o CS3', () => {
    const { p } = pagina('vertebras');
    const t = prosaDe(p);
    assert.ok(/CS3[^.]{0,160}(trapezoides? ou (já )?retangulares?|trapezoide ou retangular)/i.test(t), 'CS3 admite corpos trapezoides ou retangulares');
    assert.ok(!afirma(p, /CS3[^.]{0,120}(ao menos um|um corpo) retangular/i), 'CS3 não pode exigir corpo retangular');
    assert.ok(!afirma(p, /CS3[^.]{0,80}C4[^.]{0,20}(côncav|com concavidade)/i), 'em CS3 a C4 ainda é plana');
    assert.ok(/CS2[^.]{0,80}(só|apenas|somente) (em )?C2/i.test(t), 'CS2: concavidade só em C2');
    assert.ok(/CS4[^.]{0,120}C2, C3 e C4/i.test(t), 'CS4: concavidades nas três');
    assert.ok(/CS6[^.]{0,120}(retângulo|retangular) (em pé|vertical)/i.test(t), 'CS6: retângulo vertical');
    assert.ok(/C2[^.]{0,80}(áxis|odontoide)/i.test(t), 'forma do corpo não se lê em C2 (áxis)');
  });

  test('mão e punho: sesamoide antes do pico, capeamento no pico, rádio no fim', () => {
    const { p } = pagina('mao-punho');
    const t = prosaDe(p);
    assert.ok(/sesamoide[^.]{0,120}(acelera|antes|perto do pico|próximo)/i.test(t));
    assert.ok(/capeamento[^.]{0,80}pico/i.test(t));
    assert.ok(/rádio[^.]{0,80}(fim|encerrad|terminou)/i.test(t));
    assert.ok(!afirma(p, /sesamoide[^.]{0,60}(marca|indica|sinaliza) o fim/i), 'sesamoide não marca fim');
    assert.ok(/mão e punho esquerd/i.test(t), 'padrão dos atlas é a mão esquerda');
  });

  test('surto puberal: pico médio ~12 meninas e ~14 meninos, sempre com [VERIFICAR]; menarca é pós-pico', () => {
    const { p } = pagina('surto-puberal');
    const t = prosaDe(p);
    assert.ok(/12 anos[^.]{0,80}menin[ao]s?|menin[ao]s[^.]{0,80}12 anos/i.test(t));
    assert.ok(/14[^.]{0,60}meninos|meninos[^.]{0,60}14/i.test(t));
    assert.ok(/menarca[^.]{0,120}(depois|após|pós-pico|passou)/i.test(t));
    assert.ok(!afirma(p, /menarca[^.]{0,60}(marca|é|sinaliza) o (início|começo) do surto/i), 'menarca não é início do surto');
    // as idades médias são afirmação numérica populacional: ficam marcadas até o validador assinar
    assert.ok(/(12 anos|dos 12)[^]{0,200}\[VERIFICAR\]/.test(t) || /\[VERIFICAR\][^]{0,200}(12 anos|dos 12)/.test(t), 'idade média do pico sem [VERIFICAR] por perto');
  });

  test('crescimento da mandíbula: côndilo cresce para cima e para trás; deslocamento para baixo e para a frente; Meckel deixa martelo, bigorna e ligamento', () => {
    const { p } = pagina('mandibula');
    const t = prosaDe(p);
    assert.ok(/côndilo[^.]{0,80}para cima e para trás/i.test(t));
    assert.ok(/(deslocad[ao]|deslocamento)[^.]{0,80}para baixo e para a frente/i.test(t));
    assert.ok(/martelo/i.test(t) && /bigorna/i.test(t) && /esfenomandibular/i.test(t));
    assert.ok(/borda posterior[^.]{0,60}(deposit|aposi)/i.test(t) || /(deposit|aposi)[^.]{0,60}borda posterior/i.test(t));
  });

  test('crescimento da maxila: superfície anterior REABSORTIVA (Enlow); palato desce por reabsorção nasal e aposição oral', () => {
    const { p } = pagina('maxila');
    const t = prosaDe(p);
    assert.ok(/(superfície|face) anterior[^.]{0,80}reabsor/i.test(t));
    assert.ok(/reabsor[^.]{0,60}nasal[^.]{0,80}(aposi|deposi)[^.]{0,40}oral/i.test(t) || /lado nasal[^.]{0,80}lado oral/i.test(t));
    // "[^.;]" para não atravessar "anterior reabsortiva; tuberosidade depositante", que está certo
    assert.ok(!afirma(p, /(superfície|face) anterior[^.;]{0,60}(depositante|aposi[^.]{0,20}que explica o avan)/i), 'superfície anterior descrita como depositante');
  });

  test('rotações (Björk): implantes medem a INTERNA; o plano mandibular mostra a TOTAL; anterior é a mais comum', () => {
    const { p } = pagina('rotacoes');
    const t = prosaDe(p);
    assert.ok(/interna[^.]{0,120}implantes|implantes[^.]{0,120}interna/i.test(t));
    assert.ok(!afirma(p, /total[^.]{0,40}(é o que os implantes|medida pelos implantes)/i), 'total não é a medida pelos implantes');
    assert.ok(/plano mandibular[^.]{0,80}total|total[^.]{0,80}plano mandibular/i.test(t));
    assert.ok(/anterior[^.]{0,80}mais (comum|frequente)/i.test(t));
  });

  test('teorias: Sicher = sutura (superada), Scott = cartilagem/septo, Moss = matriz funcional; Baume: centro x sítio', () => {
    const { p } = pagina('teorias');
    const t = prosaDe(p);
    assert.ok(/Sicher[^.]{0,80}sutur/i.test(t) && /Scott[^.]{0,120}(cartilag|septo)/i.test(t) && /Moss[^.]{0,80}matriz funcional/i.test(t));
    assert.ok(/centro de crescimento[^.]{0,200}(intrínseco|próprio|transplantad)/i.test(t));
    assert.ok(!afirma(p, /Moss[^.]{0,60}septo nasal empurra/i), 'não atribuir a Moss a tese de Scott');
  });

  test('Andrews: 120 oclusões normais não tratadas, 1972, seis chaves; chave I com o 7 inferior; angulação ≠ inclinação', () => {
    const { p } = pagina('andrews');
    const t = prosaDe(p);
    assert.ok(/120/.test(t) && /1972/.test(t) && /seis chaves/i.test(t));
    assert.ok(/Bennett e McLaughlin/.test(t), 'sétima chave atribuída a Bennett e McLaughlin, não a Andrews 1972');
    assert.ok(/distovestibular[^.]{0,160}(segundo|2º) molar inferior/i.test(t));
    assert.ok(/gengival[^.]{0,80}distal[^.]{0,40}oclusal/i.test(t), 'chave II: gengival distal à oclusal');
    assert.ok(/angulação[^.]{0,200}(de frente|vestibular)/i.test(t) && /inclinação[^.]{0,200}(de perfil|sagital)/i.test(t));
  });

  test('dentição mista: espaço livre de Nance MAIOR no inferior; patinho feio fecha com os caninos; passivo dos incisivos com 4 compensações', () => {
    const { p } = pagina('denticao-mista');
    const t = prosaDe(p);
    assert.ok(/(espaço livre|Nance)[^.]{0,160}maior no (arco )?inferior/i.test(t));
    assert.ok(!afirma(p, /(espaço livre|Nance)[^.]{0,120}maior no (arco )?superior/i));
    assert.ok(/patinho feio[^.]{0,200}canino/i.test(t));
    assert.ok(/intercaninos/i.test(t) && /primatas?/i.test(t) && /vestibular/i.test(t), 'mecanismos de compensação presentes');
    // "incisor liability" é de Mayne (1969), difundido pelo manual de Moyers
    assert.ok(/Mayne/.test(t), 'passivo dos incisivos atribuído a Mayne');
    assert.ok(!afirma(p, /Moyers (chamou|batizou|cunhou)/i), 'não atribuir a Moyers o termo de Mayne');
    // valores clássicos do espaço livre divergem entre fontes: a página precisa mostrar as duas
    assert.ok(/1,7 mm/.test(t) && /0,9 mm/.test(t) && /2,5/.test(t) && /1,5/.test(t), 'valores de Nance (1,7/0,9) e dos textos atuais (2,5/1,5) presentes');
  });

  test('dentição permanente: intercaninos inferior DIMINUI após a adolescência; apinhamento tardio também em não tratados; terceiro molar não é causa comprovada', () => {
    const { p } = pagina('denticao-permanente');
    const t = prosaDe(p);
    assert.ok(/intercaninos[^.]{0,160}diminu/i.test(t));
    assert.ok(/(nunca|não) tratad/i.test(t));
    assert.ok(/terceiro molar[^.]{0,200}(discutid|pequeno|não (se )?sustenta|não (é )?comprovad)/i.test(t));
  });

  test('tempo de tratamento: duas fases na Classe II sem vantagem final (Tulloch, Keeling, O\'Brien); Classe III maxilar cedo; cirurgia após o fim do crescimento', () => {
    const { p } = pagina('tempo-tratamento');
    const t = prosaDe(p);
    assert.ok(/duas fases[^.]{0,240}(não|semelhante|mais tempo)/i.test(t));
    assert.ok(/Tulloch/.test(t) && /Keeling/.test(t) && /O'Brien/.test(t));
    assert.ok(/tração reversa[^.]{0,120}(mista precoce|cedo)/i.test(t));
    assert.ok(/cirurgia[^.]{0,120}(fim do crescimento|crescimento encerrado|CS6|rádio)/i.test(t));
  });
});

describe('módulo 2: fatos travados pela auditoria (docs/campus/AUDITORIA-M2.md)', () => {
  const pg2 = (slug) => m2.find(({ f }) => f.includes(slug)).p;

  test('o módulo inteiro está escrito (16 páginas) e todas no formato 2', () => {
    assert.equal(m2.length, 16);
    for (const { f, p } of m2) assert.equal(p.formato, 2, f);
  });

  test('Angle: 1899, molar como critério, subdivisão nomeia o lado alterado, pseudo-Classe III pela manobra', () => {
    const p = pg2('maoclusao-angle'); const t = prosaDe(p);
    assert.ok(/1899/.test(t) && /primeiros molares/i.test(t));
    assert.ok(/subdivisão[^.]{0,160}lado alterado/i.test(t));
    assert.ok(/pseudo-Classe III[^.]{0,200}(primeiro contato|relação cêntrica)/i.test(t));
    assert.ok(!afirma(p, /Classe II\b[^.I]{0,40}molar inferior[^.]{0,20}mesial/i), 'Classe II não é inferior mesial');
    assert.ok(!afirma(p, /Classe III\b[^.]{0,40}molar inferior[^.]{0,20}distal/i), 'Classe III não é inferior distal');
  });

  test('esquelética: SNA 82, SNB 80, ANB 2; Wits no plano oclusal; ANB negativo é Classe III', () => {
    const p = pg2('maoclusao-esqueletica'); const t = prosaDe(p);
    assert.ok(/SNA 82/.test(t) && /SNB 80/.test(t) && /ANB 2/.test(t));
    assert.ok(/Wits[^.]{0,120}plano oclusal/i.test(t));
    assert.ok(!afirma(p, /ANB negativo[^.]{0,30}Classe II\b/i), 'ANB negativo não é Classe II');
    assert.ok(/retru[sí]d?[ao][^.]{0,60}(mais comum|mais frequente)|(mais comum|mais frequente)[^.]{0,80}retru/i.test(t), 'retrusão mandibular como componente mais comum');
  });

  test('outras classificações: Lischer 1912, Dewey 1915 com tipo 5 = migração, lei do canino de Simon, Ackerman e Proffit 1969', () => {
    const t = prosaDe(pg2('maoclusao-outras'));
    assert.ok(/Lischer[^.]{0,40}1912/.test(t) && /Dewey[^.]{0,40}1915/.test(t));
    assert.ok(/tipo 5[^.]{0,80}(migra|perda precoce)/i.test(t));
    assert.ok(/plano orbital[^.]{0,120}terço distal do canino/i.test(t));
    assert.ok(/Frankfurt[^.]{0,120}atração/i.test(t) && /orbital[^.]{0,120}protração/i.test(t) && /sagital mediano[^.]{0,120}contração/i.test(t));
    assert.ok(/Ackerman e Proffit[^.]{0,200}1969/.test(t) || /1969[^.]{0,80}Ackerman/.test(t));
  });

  test('índices: MOCDO e pior característica; faixas do DAI; PAR mede resultado', () => {
    const p = pg2('maoclusao-indices'); const t = prosaDe(p);
    assert.ok(/MOCDO/.test(t) && /pior característica/i.test(t));
    assert.ok(/26 a 30/.test(t) && /31 a 35/.test(t) && /36/.test(t));
    assert.ok(/PAR[^.]{0,80}resultado/i.test(t));
    assert.ok(!afirma(p, /PAR[^.]{0,40}mede (a )?necessidade/i), 'PAR não mede necessidade');
    assert.ok(/Brook e Shaw/.test(t) && /Cons, Jenny e Kohout/.test(t));
  });

  test('etiologia genética e ambiental: esqueleto herdado, alinhamento ambiental; equilíbrio = força leve e prolongada; Corruccini', () => {
    const t = prosaDe(pg2('maoclusao-etiologia-genetica'));
    assert.ok(/esquelétic[ao]s?[^.]{0,120}herdabilidade alta|herdabilidade alta[^.]{0,60}esquelét/i.test(t));
    assert.ok(/(apinhamento|alinhamento)[^.]{0,120}(herdabilidade baixa|baixa)/i.test(t));
    assert.ok(/leves? e prolongad/i.test(t) && /Corruccini/.test(t));
  });

  test('hábitos: tríade de Graber; deglutição atípica é consequência; respiração bucal encaminha ao otorrinolaringologista', () => {
    const p = pg2('maoclusao-etiologia-habitos'); const t = prosaDe(p);
    assert.ok(/Graber/.test(t) && /frequência/i.test(t) && /duração/i.test(t) && /intensidade/i.test(t));
    assert.ok(/(consequência|adaptação)[^.]{0,120}mordida aberta|mordida aberta[^.]{0,120}(consequência|adaptação)/i.test(t));
    assert.ok(!afirma(p, /deglutição atípica[^.]{0,40}causa (principal )?da mordida aberta/i), 'deglutição não é causa');
    assert.ok(/otorrinolaringolog/i.test(t));
  });

  test('perda precoce: E antes do 6 é a pior; sapata distal; superior inclina e roda, inferior migra de corpo; raiz curta atrasa', () => {
    const t = prosaDe(pg2('maoclusao-etiologia-perda-precoce'));
    assert.ok(/segundo molar decíduo[^.]{0,200}(maior perda|pior)/i.test(t) || /(maior perda|pior)[^.]{0,200}segundo molar decíduo/i.test(t));
    assert.ok(/sapata distal/i.test(t) && /banda e alça/i.test(t) && /arco lingual/i.test(t) && /Nance/.test(t));
    assert.ok(/inclina e roda/i.test(t) && /de corpo/i.test(t));
    assert.ok(/menos de metade da raiz[^.]{0,120}atras|atras[^.]{0,160}menos de metade/i.test(t) || /raiz curta[^.]{0,80}atrasa/i.test(t));
  });

  test('anomalias: mesiodens é o supranumerário mais comum; lateral conoide alerta para canino palatino; palpar aos 9 a 10 anos; Ericson e Kurol', () => {
    const p = pg2('maoclusao-etiologia-anomalias'); const t = prosaDe(p);
    assert.ok(/mesiodens/i.test(t) && /mais (comum|frequente)[^.]{0,40}mesiodens|mesiodens[^.]{0,60}mais (comum|frequente)/i.test(t));
    assert.ok(/conoide[^.]{0,200}(canino|palatin)/i.test(t));
    assert.ok(/9 a 10 anos/.test(t), 'palpação aos 9 a 10 anos');
    // a base bibliográfica da interceptação do canino (Ericson e Kurol) fica nas referências da página
    assert.ok(/Ericson/.test(textoDe(p)) && /Kurol/.test(textoDe(p)), 'Ericson e Kurol nas referências');
  });

  test('Moyers: equação de Dockrell (causa, tempo, tecido, resultado), sete grupos, equifinalidade', () => {
    const t = prosaDe(pg2('maoclusao-etiologia-moyers'));
    assert.ok(/Dockrell/.test(t) && /1952/.test(t));
    assert.ok(/causa[^.]{0,40}tempo[^.]{0,40}tecido[^.]{0,40}resultado/i.test(t));
    assert.ok(/sete grupos/i.test(t) && /desnutrição/i.test(t) && /agentes físicos/i.test(t));
    assert.ok(/equifinalidade/i.test(t));
  });

  test('Classe I com apinhamento: faixas 4 / 5 a 9 / 10; Tanaka e Johnston 10,5 e 11; seriada C, D, 4; mandíbula não expande', () => {
    const p = pg2('maoclusao-tipo-classe-i'); const t = prosaDe(p);
    assert.ok(/até 4 mm/.test(t) && /5 a 9 mm/.test(t) && /10 mm ou mais/.test(t));
    assert.ok(/10,5/.test(t) && /\b11 mm\b|\+ 11\b|mais 11\b/.test(t));
    assert.ok(/caninos decíduos[^.]{0,120}primeiros molares decíduos[^.]{0,120}primeiros pré-molares/i.test(t), 'sequência da extração seriada');
    assert.ok(/mandíbula[^.]{0,120}(só inclina|não tem sutura|pouco)/i.test(t), 'expansão inferior rende pouco');
    assert.ok(/Distalização/.test(t), 'Distalização com maiúscula presente');
  });

  test('Classe II: retrusão mandibular é o componente mais comum; lábio preso agrava; divisão 2 vira divisão 1 antes de avançar', () => {
    const p = pg2('maoclusao-tipo-classe-ii'); const t = prosaDe(p);
    assert.ok(/retru[sí]d?[ao][^.]{0,120}(mais (comum|frequente))|(mais (comum|frequente))[^.]{0,120}retru/i.test(t));
    assert.ok(/lábio inferior[^.]{0,120}(preso|atrás dos)/i.test(t));
    assert.ok(/divisão 2[^.]{0,200}(virou|vira|transformando|transformada)[^.]{0,40}divisão 1/i.test(t));
    assert.ok(!afirma(p, /divisão 2[^.]{0,40}(mais leve|Classe II leve)/i), 'divisão 2 não é "mais leve"');
  });

  test('Classe III: piora com o crescimento; pseudo volta a Classe I em cêntrica; maxila deficiente e tração reversa cedo', () => {
    const p = pg2('maoclusao-tipo-classe-iii'); const t = prosaDe(p);
    assert.ok(/mandíbula cresce mais e por mais tempo/i.test(t));
    assert.ok(/pseudo-Classe III[^.]{0,200}Classe I/i.test(t));
    assert.ok(/tração reversa[^.]{0,160}(7 a 9|criança|mista precoce)/i.test(t));
    assert.ok(!afirma(p, /Classe III[^.]{0,60}melhora com o crescimento/i), 'Classe III não melhora com o crescimento');
  });

  test('mordida aberta: dentária x esquelética; esquelética se fecha pelos molares (alavanca), não pelos incisivos', () => {
    const p = pg2('maoclusao-tipo-mordida-aberta'); const t = prosaDe(p);
    assert.ok(/face longa/i.test(t) && /plano mandibular[^.]{0,40}inclinad/i.test(t));
    assert.ok(/intru[isí]r?[^.]{0,80}(posteriores|molares)/i.test(t) && /alavanca/i.test(t));
    assert.ok(!afirma(p, /esquelética[^.]{0,80}(fecha|corrige)[^.]{0,40}(elástico|extru)[^.]{0,30}incisivo/i), 'esquelética não se fecha pelos incisivos');
  });

  test('mordida profunda: completa toca a mucosa; gengiva demais intrui, dente de menos extrui; Spee consome espaço; ângulo interincisal', () => {
    const t = prosaDe(pg2('maoclusao-tipo-mordida-profunda'));
    assert.ok(/completa[^.]{0,120}(mucosa|gengiva)/i.test(t));
    assert.ok(/gengiva[^.]{0,120}intru|intru[^.]{0,120}gengiva/i.test(t) && /(pouco dente|dente de menos)[^.]{0,120}extru|extru[^.]{0,120}(pouco dente|dente de menos)/i.test(t));
    assert.ok(/Spee[^.]{0,160}(consome|perímetro|espaço)/i.test(t) && /ângulo interincisal/i.test(t));
  });

  test('cruzada: constrição bilateral com deslize parece unilateral; linha média centra em cêntrica; não se corrige sozinha; adulto: ancoragem esquelética ou cirurgia', () => {
    const p = pg2('maoclusao-tipo-mordida-cruzada'); const t = prosaDe(p);
    assert.ok(/bilateral[^.]{0,160}(desvio funcional|deslize|desliza)/i.test(t));
    assert.ok(/linha média[^.]{0,160}(centra|centrada)/i.test(t));
    assert.ok(/(raramente|não|quase nunca) se corrige sozinha/i.test(t));
    assert.ok(/(ancoragem esquelética|mini-implantes)/i.test(t) && /cirurgicamente assistida/i.test(t));
    assert.ok(!afirma(p, /cruzada posterior[^.]{0,80}(corrige-se|se corrige) (sozinha|espontaneamente) (com|na) (a )?(troca|dentição permanente)/i));
  });

  test('assimetrias: mento para o lado curto na deficiência e para o lado oposto no alongamento; cintilografia avalia atividade; Obwegeser e Makek', () => {
    const t = prosaDe(pg2('maoclusao-tipo-assimetrias'));
    assert.ok(/deficiência[^.]{0,200}lado afetado|lado afetado[^.]{0,200}(curto|cresceu menos)/i.test(t));
    assert.ok(/alongamento hemimandibular[^.]{0,240}lado oposto/i.test(t));
    assert.ok(/cintilografia[^.]{0,200}(atividade|ativo|captação)/i.test(t));
    assert.ok(/Obwegeser/.test(t) && /Makek/.test(t));
  });

  test('padrões de erro no módulo 2: sem PMID/DOI/URL, sem termo proibido, sem emoji, Distalização com maiúscula, idades com [VERIFICAR]', () => {
    for (const { f, p } of m2) {
      const s = textoDe(p);
      assert.ok(!/\bPMID\b/i.test(s) && !/\bdoi\s*:|10\.\d{4,}\//i.test(s) && !/https?:\/\//i.test(s), f + ': referência à mão');
      assert.ok(!/distanciamento/i.test(s), f + ': termo proibido');
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), f + ': emoji');
      assert.ok(!/\bdistalização\b/.test(s), f + ': Distalização com inicial maiúscula');
      const t = prosaDe(p);
      if (/por volta d[oe]s? \d+ anos|~\s?\d+ anos|\d+ a \d+ anos/i.test(t)) assert.ok(/\[VERIFICAR\]/.test(s), f + ': idades sem [VERIFICAR]');
    }
  });
});

describe('módulo 3: fatos travados pela auditoria (docs/campus/AUDITORIA-M3.md)', () => {
  const pg3 = (slug) => m3.find(({ f }) => f.includes(slug)).p;

  test('as 12 páginas do módulo estão no formato 2 com tema válido', () => {
    assert.equal(m3.length, 12);
    for (const { f, p } of m3) {
      assert.equal(p.formato, 2, f);
      assert.ok(['Reações teciduais', 'Forças', 'Efeitos colaterais'].includes(p.tema), f + ': tema');
    }
  });

  test('ligamento: eixo RANKL, RANK e osteoprotegerina; reabsorção frontal; largura do ligamento com marcação', () => {
    const p = pg3('biomov-ligamento');
    assert.ok(acha(p, /RANKL/) && acha(p, /osteoprotegerina/i) && acha(p, /reabsorção frontal/i));
    assert.ok(/0,25\s?mm/.test(textoDe(p)) && /\[VERIFICAR\]/.test(textoDe(p)), 'largura do ligamento com [VERIFICAR]');
    assert.ok(!afirma(p, /osteoprotegerina[^.]{0,40}ativa os osteoclastos/i), 'OPG não ativa osteoclastos');
  });

  test('pressão e tensão: Schwarz e pressão capilar; contínua, interrompida e intermitente', () => {
    const p = pg3('biomov-pressao-tensao');
    assert.ok(acha(p, /Schwarz/) && acha(p, /capilar/i));
    assert.ok(acha(p, /contínua/i) && acha(p, /interrompida/i) && acha(p, /intermitente/i));
  });

  test('hialinização: Reitan, reabsorção solapante, latência e prazo com marcação', () => {
    const p = pg3('biomov-hialinizacao');
    assert.ok(acha(p, /solapante/i) && acha(p, /latência/i) && /Reitan/.test(textoDe(p)));
    assert.ok(/quatro semanas[^\]]{0,80}\[VERIFICAR\]/.test(textoDe(p)), 'prazo de remoção da zona com [VERIFICAR]');
    assert.ok(!afirma(p, /hialiniza[^.]{0,60}acelera o movimento/i));
  });

  test('remodelação: ciclo ativação, reabsorção, reversão, formação; Frost; bisfosfonatos freiam; anquilose', () => {
    const p = pg3('biomov-remodelacao');
    assert.ok(acha(p, /ativação[^.]{0,40}reabsorção[^.]{0,40}reversão[^.]{0,40}formação/i), 'ordem do ciclo');
    assert.ok(acha(p, /Frost/) && acha(p, /regional acelerado/i) && acha(p, /bisfosfonat/i) && acha(p, /anquilos/i));
    assert.ok(!afirma(p, /bisfosfonatos?[^.]{0,60}aceleram? o movimento/i));
  });

  test('magnitude, duração e direção: Storey e Smith, Schwarz, três durações, Burstone e momento', () => {
    const p = pg3('biomov-forca-magnitude');
    assert.ok(acha(p, /Storey/) && acha(p, /150 a 200/) && acha(p, /400 a 600/));
    assert.ok(/(20 a 26|vinte a vinte e seis)[^\]]{0,160}\[VERIFICAR\]/.test(textoDe(p)), 'pressão capilar de Schwarz com [VERIFICAR]');
    assert.ok(acha(p, /quatro a oito horas/i) && /quatro a oito horas[^\]]{0,120}\[VERIFICAR\]/.test(textoDe(p)));
    assert.ok(acha(p, /7:1/) && acha(p, /10:1/) && acha(p, /12:1/) && acha(p, /Burstone/));
    assert.ok(acha(p, /força vezes a distância/i) && acha(p, /centro de resistência/i));
    assert.ok(acha(p, /Quinn/) && acha(p, /Ren/) && acha(p, /platô/i));
    assert.ok(!afirma(p, /relação[^.]{0,30}linear entre força e velocidade/i));
    assert.ok(/von Böhl/.test(textoDe(p)), 'referência de von Böhl');
  });

  test('forças ideais: faixas didáticas na ordem correta, intrusão a menor, sem "cemento mais fino" no ápice', () => {
    const p = pg3('biomov-forca-ideais');
    assert.ok(acha(p, /35 a 60/) && acha(p, /70 a 120/) && acha(p, /50 a 100/) && acha(p, /10 a 20/));
    assert.ok(acha(p, /intrusão[^.]{0,80}(menor|mínim|10 a 20)/i), 'intrusão com a menor força');
    assert.ok(/10 a 20[^\]]{0,200}\[VERIFICAR\]/.test(textoDe(p)), 'faixas com [VERIFICAR]');
    assert.ok(!afirma(p, /cemento (é |está )?mais fino/i), 'ápice não descrito como cemento mais fino');
    assert.ok(!afirma(p, /intrusão[^.]{0,60}(exige|pede) (a )?maior força/i));
  });

  test('forças excessivas: cinco ramos, ancoragem cede pela janela, nunca acelera', () => {
    const p = pg3('biomov-forca-excessiva');
    assert.ok(acha(p, /hialiniza/i) && acha(p, /reabsorção radicular/i) && acha(p, /ancoragem/i) && acha(p, /mobilidade/i) && acha(p, /recessão/i));
    assert.ok(acha(p, /Storey/) && acha(p, /não acelera/i));
    assert.ok(/von Böhl/.test(textoDe(p)));
    assert.ok(!afirma(p, /força pesada[^.]{0,40}(acelera|mais rápid)/i));
  });

  test('reabsorção radicular: cemento repara, dentina não; Levander e Malmgren; 6 a 9 meses; pausa de 2 a 3 meses; incisivos superiores', () => {
    const p = pg3('biomov-reabsorcao');
    assert.ok(acha(p, /cemento[^.]{0,60}repara/i) && acha(p, /dentina[^.]{0,60}não/i));
    assert.ok(acha(p, /Levander/) && acha(p, /Malmgren/) && acha(p, /seis (e|a) nove meses/i) && acha(p, /dois a três meses/i));
    assert.ok(acha(p, /Brezniak/) && acha(p, /lateral/i) && acha(p, /pipeta/i));
    assert.ok(/Al-Qawasmi/.test(textoDe(p)) && /Killiany/.test(textoDe(p)));
    assert.ok(!afirma(p, /reabsorção[^.]{0,60}continua depois (de remover|do fim)/i));
    assert.ok(!afirma(p, /tratados endodonticamente[^.]{0,40}reabsorvem (muito )?mais/i));
  });

  test('lesões brancas: subsuperficial, gengival do braquete, quatro semanas, laterais superiores, cautela com flúor concentrado e evidência', () => {
    const p = pg3('biomov-lesoes-brancas');
    assert.ok(acha(p, /subsuperficial/i) && acha(p, /gengival do braquete/i) && acha(p, /laterais superiores/i));
    assert.ok(/quatro semanas[^\]]{0,120}\[VERIFICAR\]/.test(textoDe(p)));
    assert.ok(acha(p, /flúor[^.]{0,80}(alta concentração|concentrado)/i) && acha(p, /cavita/i));
    assert.ok(/Gorelick/.test(textoDe(p)) && /gaard/.test(textoDe(p)) && /Sonesson/.test(textoDe(p)));
    assert.ok(acha(p, /evidência[^.]{0,60}limitada/i), 'ressalva de evidência sobre a escada conservadora');
    assert.ok(!afirma(p, /restaura(r|ção)[^.]{0,40}no dia da remoção/i) || afirma(p, /não restaurar/i));
  });

  test('recessão e deiscências: definições, envelope, tríade de risco, periapical não mostra', () => {
    const p = pg3('biomov-recessao');
    assert.ok(acha(p, /deiscência/i) && acha(p, /fenestração/i) && acha(p, /envelope/i));
    assert.ok(acha(p, /fenótipo/i) && acha(p, /sínfise/i) && acha(p, /vestibulariza/i));
    assert.ok(acha(p, /periapical não (mostra|vê)/i) || acha(p, /não aparecem na (radiografia )?periapical/i));
    assert.ok(/Wennström/.test(textoDe(p)) && /Renkema/.test(textoDe(p)));
    assert.ok(!afirma(p, /movimento[^.]{0,40}dentro do (osso|envelope)[^.]{0,40}(?<!não )causa recessão/i));
  });

  test('dor e mobilidade: curva de 24 horas e sete dias, prostaglandinas, paracetamol antes do anti-inflamatório', () => {
    const p = pg3('biomov-dor');
    assert.ok(acha(p, /24 horas/) && acha(p, /(sete dias|uma semana)/i) && acha(p, /prostaglandin/i));
    assert.ok(acha(p, /paracetamol/i) && acha(p, /anti-inflamatóri/i) && acha(p, /separadores/i));
    assert.ok(/Ngan/.test(textoDe(p)) && /Arias/.test(textoDe(p)));
    assert.ok(!afirma(p, /anti-inflamatório[^.]{0,40}(de rotina|por sete dias|por vários dias)/i) || afirma(p, /paracetamol é a (rotina|primeira escolha)/i));
  });

  test('aceleração: Frost, corticotomia, vibração sem efeito, força não acelera, não amplia o envelope', () => {
    const p = pg3('biomov-aceleracao');
    assert.ok(acha(p, /Frost/) && acha(p, /regional acelerado/i) && acha(p, /corticotomia/i) && acha(p, /micro-osteoperfura/i));
    assert.ok(acha(p, /vibração[^.]{0,120}(sem|não)/i) && acha(p, /fotobiomodulação/i));
    assert.ok(acha(p, /não amplia o envelope/i) && acha(p, /força não acelera/i));
    assert.ok(/Woodhouse/.test(textoDe(p)) && /Cochrane/.test(textoDe(p)) && /Fleming/.test(textoDe(p)));
    assert.ok(!afirma(p, /corticotomia[^.]{0,60}reduz o tempo[^.]{0,20}pela metade/i));
    assert.ok(!afirma(p, /vibração[^.]{0,60}reduz (o tempo|a duração)/i));
  });

  test('padrões de erro no módulo 3: sem PMID, DOI, URL, termo proibido ou emoji; prazos e faixas com [VERIFICAR]', () => {
    for (const { f, p } of m3) {
      const s = textoDe(p);
      assert.ok(!/\bPMID\b/i.test(s) && !/\bdoi\s*:|10\.\d{4,}\//i.test(s) && !/https?:\/\//i.test(s), f + ': PMID, DOI ou URL à mão');
      assert.ok(!/distanciamento/i.test(s), f + ': termo proibido');
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), f + ': emoji');
      assert.ok(!/\bdistalização\b/.test(s), f + ': Distalização com inicial maiúscula');
      const t = prosaDe(p);
      if (/por volta d[oe]s? \d+ anos|\d+ a \d+ anos|\d+ a \d+ (g|gramas)\b|\d+ a \d+ (meses|semanas|horas)/i.test(t)) assert.ok(/\[VERIFICAR\]/.test(s), f + ': faixa numérica sem nenhum [VERIFICAR]');
    }
  });

  test('registro da auditoria do módulo 3 existe, cobre as 12 páginas e registra as rodadas', () => {
    const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'campus', 'AUDITORIA-M3.md'), 'utf8');
    for (const { f } of m3) assert.ok(doc.includes('`' + f.replace(/^ortodontia--/, '').replace(/\.json$/, '') + '`'), 'auditoria M3 sem a página ' + f);
    assert.ok(/Storey/.test(doc) && /Levander/.test(doc) && /Woodhouse/.test(doc) && /cemento mais fino/.test(doc) && /Sonesson/.test(doc), 'as correções e confirmações do módulo 3 estão registradas');
    assert.ok(/Rodada 3/.test(doc), 'a rodada de releitura final está registrada');
  });
});

describe('módulo 1: padrões de erro e honestidade sobre incerteza', () => {
  test('nenhum PMID, DOI ou URL escrito à mão nas referências ou no texto', () => {
    for (const { f, p } of m1) {
      const s = textoDe(p);
      assert.ok(!/\bPMID\b/i.test(s), f);
      assert.ok(!/\bdoi\s*:|10\.\d{4,}\//i.test(s), f + ': DOI à mão');
      assert.ok(!/https?:\/\//i.test(s), f + ': URL à mão');
    }
  });

  test('termo proibido e emoji ausentes; "Distalização" grafada com maiúscula quando aparece', () => {
    for (const { f, p } of m1) {
      const s = textoDe(p);
      assert.ok(!/distanciamento/i.test(s), f);
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s), f);
      assert.ok(!/\bdistalização\b/.test(s), f + ': Distalização com inicial maiúscula (termo da casa)');
    }
  });

  test('todo número populacional de idade ou percentual sem fonte fechada carrega [VERIFICAR] na mesma página', () => {
    // Regra pragmática: páginas que afirmam idade média de evento biológico
    // (pico, fusão, fechamento) precisam ter ao menos uma marcação [VERIFICAR];
    // a auditoria decide quais saem quando o validador assinar.
    for (const { f, p } of m1) {
      const t = prosaDe(p);
      if (/por volta d[oe]s? \d+ anos|~\s?\d+ anos|\d+ a \d+ anos/i.test(t)) assert.ok(/\[VERIFICAR\]/.test(textoDe(p)), f + ': idades médias sem nenhuma marcação [VERIFICAR]');
    }
  });

  test('o autoteste não contradiz o corpo: a explicação da alternativa correta não afirma o oposto dos fatos travados', () => {
    const { p } = pagina('vertebras');
    for (const q of p.autoteste) {
      const c = q.explicacoes[q.correta];
      assert.ok(!/CS3[^.]{0,80}(ao menos um|um corpo) retangular/i.test(c), 'gabarito com CS3 exigindo retângulo');
    }
    const d = pagina('denticao-decidua').p;
    for (const q of d.autoteste) {
      const c = q.explicacoes[q.correta];
      assert.ok(!/superior[^.]{0,40}distal ao canino|inferior[^.]{0,40}mesial ao canino/i.test(c), 'gabarito com primata invertido');
    }
  });

  test('proporção face:crânio e sincondrose esfeno-occipital não trazem número único como se fosse consenso', () => {
    const c = prosaDe(pagina('crescimento-conceitos').p);
    assert.ok(/1:8/.test(c) && /1:2/.test(c), 'proporção clássica 1:8 → 1:2 presente');
    assert.ok(!afirma(pagina('crescimento-conceitos').p, /1:8[^.]{0,60}1:2,5 no adulto \[VERIFICAR\]\./), 'adulto não pode aparecer só como 1:2,5');
    const m = prosaDe(pagina('crescimento-mecanismos').p);
    assert.ok(!/esfeno-occipital[^.]{0,200}\. Ela fecha na adolescência/i.test(m), 'fechamento da esfeno-occipital sem faixa etária');
    assert.ok(/esfeno-occipital[^]{0,400}(16 a 20|fim da adolescência)/i.test(m), 'fusão da esfeno-occipital com faixa etária');
  });

  test('registro da auditoria do módulo 2 existe e cobre as 16 páginas', () => {
    const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'campus', 'AUDITORIA-M2.md'), 'utf8');
    for (const { f } of m2) assert.ok(doc.includes('`' + f.replace(/^ortodontia--/, '').replace(/\.json$/, '') + '`'), 'auditoria M2 sem a página ' + f);
    assert.ok(/Ellis/.test(doc) && /Kutin/.test(doc) && /Obwegeser/.test(doc) && /Rodada 3/.test(doc), 'as correções e rodadas do módulo 2 estão registradas');
  });

  test('registro da auditoria existe, cobre as 14 páginas e registra as correções das rodadas', () => {
    const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'campus', 'AUDITORIA-M1.md'), 'utf8');
    for (const { f } of m1) assert.ok(doc.includes('`' + f.replace(/^ortodontia--/, '').replace(/\.json$/, '') + '`'), 'auditoria sem a página ' + f);
    assert.ok(/CS3/.test(doc) && /Petrovic/.test(doc), 'as correções da rodada 1 estão registradas');
    assert.ok(/Mayne/.test(doc) && /1:2/.test(doc) && /esfeno-occipital/i.test(doc), 'as correções da rodada 2 estão registradas');
    assert.ok(/Rodada 3/.test(doc), 'a rodada de releitura final está registrada');
  });
});
