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

  test('registro da auditoria existe, cobre as 14 páginas e registra as correções das rodadas', () => {
    const doc = fs.readFileSync(path.join(RAIZ, 'docs', 'campus', 'AUDITORIA-M1.md'), 'utf8');
    for (const { f } of m1) assert.ok(doc.includes('`' + f.replace(/^ortodontia--/, '').replace(/\.json$/, '') + '`'), 'auditoria sem a página ' + f);
    assert.ok(/CS3/.test(doc) && /Petrovic/.test(doc), 'as correções da rodada 1 estão registradas');
    assert.ok(/Mayne/.test(doc) && /1:2/.test(doc) && /esfeno-occipital/i.test(doc), 'as correções da rodada 2 estão registradas');
    assert.ok(/Rodada 3/.test(doc), 'a rodada de releitura final está registrada');
  });
});
