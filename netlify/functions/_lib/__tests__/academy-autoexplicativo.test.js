// Tests da interface AUTOEXPLICATIVA do Academy (diretriz do fundador, 01/09:
// "facilitar ao máximo a publicação por cirurgiões-dentistas que não têm
// expertise (...) tudo baseado no formato já do OdontoFeed, cores, layout (...)
// da forma mais autoexplicativa possível").
//
// O que fica travado aqui:
//   • identidade DA CASA (tokens da Biblioteca), zero emojis (diretriz 10/08);
//   • cada etapa do motor tem tradução em linguagem comum + "o que acontece",
//     "por quê" e "o que você faz" — sem sigla antes da palavra comum;
//   • a faixa "onde estou" e o "como funciona" em 3 passos existem;
//   • a ética é explicada (TCLE/CEP) e diz o que trava e o que libera;
//   • aprovar seção diz o que se está aprovando; o pacote lista cada peça;
//   • a fiação com o backend e a monetização NÃO mudou.
//
// Run: node --test netlify/functions/_lib/__tests__/academy-autoexplicativo.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const html = fs.readFileSync(path.join(RAIZ, 'academy.html'), 'utf8');
const biblioteca = fs.readFileSync(path.join(RAIZ, 'biblioteca.html'), 'utf8');
const { ETAPAS } = require('../academy/estado');

// Extrai a trilha declarada no HTML para testar como dado, não como texto.
function trilhaDoHtml() {
  const m = html.match(/const ETAPAS_INFO=(\[[\s\S]*?\n\]);/);
  assert.ok(m, 'ETAPAS_INFO encontrado no HTML');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + m[1])();
}

describe('identidade da casa (padrão OdontoFeed, não identidade própria)', () => {
  test('usa os MESMOS tokens da Biblioteca: creme, borda, dourado, texto', () => {
    for (const tok of ['--bg:#FBF7EF', '--border:#EDE6D8', '--gold:#B08968', '--text:#1A1A18', '--muted:#8A8478']) {
      assert.ok(html.includes(tok), tok);
      assert.ok(biblioteca.includes(tok), 'a Biblioteca define ' + tok + ' (fonte do padrão)');
    }
    assert.ok(html.includes("Georgia,'Times New Roman',serif"), 'títulos serifados como no resto do site');
    assert.ok(html.includes('OdontoFeed<em>.</em> Academy'), 'marca com o ponto dourado da casa');
    assert.ok(html.includes('← voltar à área de membro'), 'mesmo link de retorno da Biblioteca');
  });
  test('o verde da identidade antiga saiu', () => {
    assert.ok(!html.includes('#2D6A4F') && !html.includes('--verde'), 'sem paleta própria');
  });
  test('zero emojis na interface (diretriz 10/08)', () => {
    const semScript = html.replace(/<script>[\s\S]*<\/script>/, '');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(semScript.replace(/✓/g, '')), 'nenhum emoji no HTML');
  });
});

describe('trilha autoexplicativa — uma explicação por etapa do motor', () => {
  const trilha = trilhaDoHtml();
  test('cobre exatamente as etapas do motor, na mesma ordem', () => {
    assert.deepEqual(trilha.map(e => e.id), ETAPAS, 'ids e ordem iguais a _lib/academy/estado.js');
  });
  test('cada etapa tem nome comum, o que acontece, por quê, o que você faz e tempo', () => {
    for (const e of trilha) {
      for (const campo of ['nome', 'agora', 'oque', 'porque', 'voce']) {
        assert.ok(typeof e[campo] === 'string' && e[campo].trim().length > 8, `${e.id}.${campo}`);
      }
      assert.match(e.tempo, /^\d+(–\d+)? min$/, `${e.id}.tempo é uma estimativa em minutos`);
    }
  });
  test('nomes em linguagem comum — sem jargão de método como nome de etapa', () => {
    const nomes = trilha.map(e => e.nome.toLowerCase());
    for (const jargao of ['conformidade', 'pico', 'triagem', 'manuscrito', 'periódico']) {
      assert.ok(!nomes.some(n => n === jargao), `"${jargao}" não pode ser o nome da etapa`);
    }
    assert.ok(nomes.includes('ética e consentimento'));
    assert.ok(nomes.includes('escolher a revista'));
  });
  test('sigla só DEPOIS da palavra comum (TCLE, CEP, PMID, ICMJE)', () => {
    const etica = trilha.find(e => e.id === 'conformidade');
    assert.match(etica.entenda, /Termo de Consentimento Livre e Esclarecido/);
    assert.match(etica.entenda, /Comitê de Ética em Pesquisa/);
    const busca = trilha.find(e => e.id === 'busca');
    assert.match(busca.oque, /número no PubMed/);
    assert.ok(html.includes('declaração de uso de IA que as revistas exigem (ICMJE)'));
  });
  test('ética como TRILHO: diz o que trava e o que libera, e cita a lei', () => {
    const etica = trilha.find(e => e.id === 'conformidade');
    assert.match(etica.trava, /^O que trava:/);
    assert.match(etica.libera, /^O que libera:/);
    assert.match(etica.porque, /Lei 14\.874\/2024/);
    assert.ok(html.includes('Entenda em 30 segundos'), 'ajuda dobrável na etapa de ética');
  });
  test('honestidade: só relato de caso por enquanto, dito na triagem', () => {
    assert.match(trilha.find(e => e.id === 'triagem').voce, /outros formatos chegam em breve/);
  });
});

describe('sempre saber onde estou, o que vem e por quê', () => {
  test('faixa "onde estou" com etapa X de N, o que fazemos agora e o que vem depois', () => {
    for (const id of ['onde-num', 'onde-titulo', 'onde-agora', 'onde-depois', 'onde-barra']) {
      assert.ok(html.includes('id="' + id + '"'), id);
    }
    assert.ok(html.includes("'Etapa '+(i+1)+' de '+ETAPAS_INFO.length"), 'contador vem da trilha, não é fixo');
    assert.ok(html.includes("'Depois: <b>'"), 'diz o próximo passo');
  });
  test('etapa atual abre a explicação; as outras ficam dobradas (um passo por vez)', () => {
    assert.ok(html.includes('.etp .exp{display:none;'));
    assert.ok(html.includes('.etp.atual .exp{display:block;'));
    assert.ok(html.includes('O que acontece agora') && html.includes('Por que este passo existe') && html.includes('O que você faz'));
  });
  test('lista de trabalhos mostra em que etapa cada um parou e chama para continuar', () => {
    assert.ok(html.includes("Etapa '+(i+1)+' de '+ETAPAS_INFO.length+' · '+esc(info.nome)"));
    assert.ok(html.includes('continuar →'));
  });
});

describe('estado vazio ensina; aprovar explica; pacote explica', () => {
  test('"como funciona" em 3 passos na entrada E na lista vazia', () => {
    const ocorrencias = (html.match(/Você conta o caso/g) || []).length;
    assert.ok(ocorrencias >= 2, 'entrada (HTML) + lista vazia (comoFuncionaHtml)');
    assert.ok(html.includes('function comoFuncionaHtml'));
    assert.ok(html.includes('O que você precisa ter em mãos'));
  });
  test('a conversa diz como falar: como a um colega, sem linguagem científica', () => {
    assert.ok(html.includes('Converse como se estivesse contando o caso a um colega'));
  });
  test('aprovar seção vem com o que se está confirmando + dica do que conferir', () => {
    assert.ok(html.includes('Ao aprovar, você confirma que o texto descreve o que de fato aconteceu'));
    assert.ok(html.includes('const SECAO_DICA='));
    for (const s of ['metodos', 'resultados', 'discussao', 'introducao', 'conclusao', 'resumo', 'titulo']) {
      assert.ok(new RegExp(s + ":'[^']{15,}'").test(html), 'dica de revisão para ' + s);
    }
  });
  test('cada peça do pacote tem sua função explicada', () => {
    for (const peca of ['Manuscrito (DOCX + PDF)', 'Carta de apresentação', 'Checklist da revista preenchida', 'Termo de consentimento (TCLE)', 'Declarações', 'Roteiro de submissão']) {
      assert.ok(html.includes('<span class="n">' + peca + '</span><span class="f">'), peca);
    }
  });
});

describe('a fiação não mudou: backend e monetização intactos', () => {
  test('mesmos endpoints e ações do MVP', () => {
    for (const s of ["api('academy-projeto", "api('academy-chat'", "api('academy-busca'", "api('academy-upload'", "api('academy-export", "acao:'aprovar_secao'", "acao:'editar_secao'", "acao:'legenda_figura'"]) {
      assert.ok(html.includes(s), s);
    }
  });
  test('monetização: landing pública, widget, 402 → memória → confirmar, cancelamento com prévia', () => {
    assert.ok(html.includes('/.netlify/functions/academy-precos'));
    assert.ok(html.includes('id="widget-credito"') && html.includes('Crédito acumulado'));
    assert.ok(html.includes('r.status===402') && html.includes('mostrarMemoria(') && html.includes('confirmar:true'));
    assert.ok(html.indexOf("acao:'cancelar'}") < html.indexOf("acao:'cancelar',confirmar:true"));
  });
  test('ids que o JavaScript usa existem no HTML', () => {
    for (const id of ['login', 'lista', 'lista-projetos', 'app', 'msgs', 'digitando', 'arq', 'txt', 'btn-enviar', 'etapas', 'bloco-busca', 'btn-busca', 'refs', 'secoes', 'figuras', 'bloco-pacote', 'btn-pacote', 'confirma-export', 'modelo-precos', 'mp-valores', 'titulo-projeto']) {
      assert.ok(html.includes('id="' + id + '"'), id);
    }
  });
});
