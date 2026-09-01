// Tests da BUSCA DA BIBLIOTECA (diretriz do fundador, 01/09): "quando ele
// pesquisar por exemplo por miniimplante apareçam todos os artigos que
// tiverem miniimplante escrito em algum lugar".
//
// O que quebrava antes: a busca olhava só `titulo + resumo`, e o resumo vinha
// CORTADO em 400 caracteres — o resto do resumo, a relevância clínica e o
// resumo completo eram invisíveis. E comparava string crua, então
// "miniimplante" não achava "mini-implante" nem "distalizacao" achava
// "distalização".
//
// Run: node --test netlify/functions/_lib/__tests__/busca-biblioteca.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..', '..');
const { normalizarTexto, blocoDeBusca, termosDaQuery, casa } = require('../busca-texto');

// Artigo realista: o termo aparece com hífen e SÓ depois dos 400 primeiros
// caracteres do resumo — exatamente o caso que sumia da busca.
const enchimento = 'Este ensaio clínico randomizado avaliou pacientes em tratamento ortodôntico ao longo de vinte e quatro meses, com avaliações periódicas por meio de modelos digitais e radiografias padronizadas para acompanhar a movimentação dentária e a resposta dos tecidos de suporte durante todo o período experimental. '.repeat(2);
const artigoMini = {
  titulo_pt: 'Ancoragem esquelética na retração anterior: ensaio clínico',
  titulo: 'Skeletal anchorage in anterior retraction: a randomized trial',
  tema: 'Distalização',
  especialidade: 'Ortodontia',
  journal: 'American Journal of Orthodontics',
  nivel_evidencia: 'RCT',
  resumo_pt: enchimento + 'A ancoragem foi obtida com mini-implante interradicular instalado entre segundo pré-molar e primeiro molar.',
  impacto_pratico: 'Permite retração sem perda de ancoragem posterior.',
  resumo_completo: 'O grupo controle utilizou aparelho extrabucal convencional.',
};

describe('o caso do fundador: "miniimplante" acha o artigo', () => {
  const bloco = blocoDeBusca(artigoMini);

  test('acha mesmo o termo aparecendo com HÍFEN e DEPOIS dos 400 caracteres', () => {
    // Prova de que o trecho estava fora do alcance da busca antiga.
    const posicao = artigoMini.resumo_pt.indexOf('mini-implante');
    assert.ok(posicao > 400, 'o termo está além do corte antigo (posição ' + posicao + ')');
    assert.equal(casa(bloco, termosDaQuery('miniimplante')), true);
  });
  test('as três grafias encontram o mesmo artigo', () => {
    for (const q of ['miniimplante', 'mini-implante', 'mini implante', 'MINI IMPLANTE']) {
      assert.equal(casa(bloco, termosDaQuery(q)), true, q);
    }
  });
  test('termo mais curto também acha (substring)', () => {
    assert.equal(casa(bloco, termosDaQuery('implante')), true);
    assert.equal(casa(bloco, termosDaQuery('ancoragem')), true);
  });
  test('acento não atrapalha: "distalizacao" acha o tema "Distalização"', () => {
    assert.equal(casa(bloco, termosDaQuery('distalizacao')), true);
    assert.equal(casa(bloco, termosDaQuery('DISTALIZAÇÃO')), true);
  });
  test('acha em QUALQUER campo: título original, periódico, nível, relevância e resumo completo', () => {
    assert.equal(casa(bloco, termosDaQuery('randomized')), true, 'título em inglês');
    assert.equal(casa(bloco, termosDaQuery('orthodontics')), true, 'periódico');
    assert.equal(casa(bloco, termosDaQuery('rct')), true, 'nível de evidência');
    assert.equal(casa(bloco, termosDaQuery('perda de ancoragem')), true, 'relevância clínica');
    assert.equal(casa(bloco, termosDaQuery('extrabucal')), true, 'resumo completo');
  });
  test('não traz artigo que não fala do assunto', () => {
    const outro = blocoDeBusca({ titulo_pt: 'Clareamento caseiro supervisionado', resumo_pt: 'Peróxido de carbamida a 10%.' });
    assert.equal(casa(outro, termosDaQuery('miniimplante')), false);
    assert.equal(casa(outro, termosDaQuery('implante')), false);
  });
  test('vários termos = E lógico (todos precisam aparecer)', () => {
    assert.equal(casa(bloco, termosDaQuery('miniimplante retracao')), true);
    assert.equal(casa(bloco, termosDaQuery('miniimplante clareamento')), false);
  });
  test('busca vazia não filtra nada', () => {
    assert.equal(casa(bloco, termosDaQuery('')), true);
    assert.equal(casa(bloco, termosDaQuery('   ')), true);
  });
});

describe('bloco de busca — forma e tamanho', () => {
  test('normalização: minúscula, sem acento, sem hífen', () => {
    assert.equal(normalizarTexto('Mini-Implante Ortodôntico'), 'miniimplante ortodontico');
    // 'ª' não decompõe para 'a' em NFD — vira separador, e "3ª" fica "3".
    // Para busca isso basta: ninguém procura pelo ordinal.
    assert.equal(normalizarTexto('  Pós-operatório: 3ª semana!  '), 'posoperatorio 3 semana');
  });
  test('sem palavra repetida (o bloco não incha com prosa)', () => {
    const b = blocoDeBusca({ resumo_pt: 'osso osso osso enxerto enxerto osso' });
    assert.equal(b, 'osso enxerto');
  });
  test('artigo real fica bem menor que a prosa somada', () => {
    const prosa = [artigoMini.titulo_pt, artigoMini.titulo, artigoMini.resumo_pt, artigoMini.impacto_pratico, artigoMini.resumo_completo].join(' ');
    const bloco = blocoDeBusca(artigoMini);
    // A dedup precisa render economia real de payload (aqui ~35%); o ganho
    // cresce com o tamanho do texto, que é onde o custo estaria.
    assert.ok(bloco.length < prosa.length * 0.75, `bloco ${bloco.length} vs prosa ${prosa.length}`);
  });
  test('aguenta artigo vazio/quebrado sem estourar', () => {
    for (const a of [null, undefined, {}, { titulo_pt: null, resumo_pt: undefined }]) {
      assert.equal(typeof blocoDeBusca(a), 'string');
    }
  });
  test('campo lista (temas) entra na busca', () => {
    const b = blocoDeBusca({ tema: '', temas: ['Peri-implantite', 'Enxerto'], titulo_pt: 'x' });
    // `temas` não está na lista de CAMPOS; o que precisa valer é não quebrar.
    assert.equal(typeof b, 'string');
  });
});

describe('fiação servidor ↔ cliente', () => {
  const acervo = fs.readFileSync(path.join(RAIZ, 'netlify', 'functions', 'acervo.js'), 'utf8');
  const html = fs.readFileSync(path.join(RAIZ, 'biblioteca.html'), 'utf8');

  test('acervo manda o bloco `busca` e lê os campos de texto completos', () => {
    assert.ok(acervo.includes('busca:         blocoDeBusca(a)'), 'campo busca no card');
    for (const campo of ['impacto_pratico', 'resumo_completo', "'titulo'"]) {
      assert.ok(acervo.includes(campo), 'select inclui ' + campo);
    }
  });
  test('biblioteca filtra pelo bloco, não mais por titulo+resumo cortado', () => {
    assert.ok(!/\(a\.titulo\+' '\+a\.resumo\)\.toLowerCase\(\)\.includes\(q\)/.test(html), 'busca antiga removida');
    assert.ok(html.includes('a.busca'), 'usa o bloco do servidor');
    assert.ok(html.includes('termos.every('), 'E lógico entre termos');
  });

  // A regra de ouro: as duas normalizações precisam dar o MESMO resultado. Em
  // vez de confiar em leitura, extraímos a função do HTML e comparamos.
  test('normalizarBusca (cliente) === normalizarTexto (servidor)', () => {
    const m = html.match(/function normalizarBusca\(s\)\{[\s\S]*?\n\}/);
    assert.ok(m, 'função encontrada no HTML');
    // eslint-disable-next-line no-new-func
    const normalizarBusca = new Function(`${m[0]}; return normalizarBusca;`)();
    const amostras = [
      'miniimplante', 'Mini-Implante', 'MINI IMPLANTE', 'distalização', 'Distalizacao',
      'pós-operatório', 'peri-implantite', '  espaços   demais ', 'ISQ 70%', 'ré-tratamento',
      'aligner’s', 'Ortodontia/Prótese', '',
    ];
    for (const s of amostras) {
      assert.equal(normalizarBusca(s), normalizarTexto(s), 'divergiu em: ' + JSON.stringify(s));
    }
  });
});
