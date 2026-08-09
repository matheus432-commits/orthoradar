// Incidente 09/08 — "novamente não vieram os estudos a mais de ortodontia":
// o pool RECENTE de extras esgota para o assinante veterano ("todos os
// candidatos do pool já foram enviados", pool de 24 → 0 extras) e o descarte
// da trava de veredito acontecia DEPOIS do resumo Sonnet caro, queimando fila
// e orçamento (Dentística inteira com 0 extras no mesmo dia).
//
// Correções testadas (estático — o fluxo depende do Firestore/Anthropic):
//   1. POÇO FUNDO: pool insuficiente → extras vêm do ACERVO da especialidade
//      (excluindo já recebidos, edições passadas, reprovados e crus);
//   2. TRAVA BARATA: veredito (Haiku) roda ANTES do resumo (Sonnet);
//   3. MEMÓRIA: reprovado marca o pool (dia) e PERSISTE flag no artigo (dias
//      seguintes) — o mesmo estudo nunca mais é re-checado por assinante.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'daily-digest.js'), 'utf8');

describe('extras premium — poço fundo do acervo', () => {
  test('pool insuficiente estende do acervo da especialidade (status active)', () => {
    assert.ok(src.includes('poço fundo — extras completados do acervo'), 'caminho do acervo existe');
    assert.match(src, /disponiveis\.length < quantos \+ 2/, 'gatilho quando o recente não basta');
    assert.match(src, /especialidade[\s\S]{0,120}status[\s\S]{0,60}active/, 'consulta por especialidade + ativo');
  });
  test('acervo exclui: já recebidos, edições passadas, reprovados e crus', () => {
    const bloco = src.slice(src.indexOf('POÇO FUNDO'), src.indexOf('const temas ='));
    assert.ok(bloco.includes('jaRecebidas.has(k)'), 'nunca repete o que o assinante já recebeu');
    assert.ok(bloco.includes('isRepeated(a, hist)'), 'nunca oferece edição passada da área');
    assert.ok(bloco.includes('veredito_extra_reprovado'), 'reprovado persistido não volta');
    assert.ok(bloco.includes('passaCuradoria(a)'), 'artigo cru não vira extra');
  });
  test('falha do poço fundo não derruba o envio (fail-open p/ o pool recente)', () => {
    assert.ok(src.includes('poço fundo indisponível — seguindo só com o pool recente'));
  });
});

describe('extras premium — trava barata antes do resumo caro', () => {
  const bloco = src.slice(src.indexOf('TRAVA BARATA ANTES DO RESUMO CARO'), src.indexOf('extras selected'));
  test('veredito (Haiku) roda ANTES de ensureResumoCompleto (Sonnet)', () => {
    assert.ok(bloco.indexOf('_travaBarata(cand)') < bloco.indexOf('_comCachePool(cand)'),
      'ordem: trava barata → resumo caro');
  });
  test('reprovado marca o pool (cross-assinante) e persiste a flag no artigo (cross-dia)', () => {
    assert.ok(bloco.includes("veredito_extra_reprovado: true"), 'flag persistida via updateDoc');
    assert.match(bloco, /orig\[flag\] = true/, 'pool em memória marcado para os próximos assinantes do run');
  });
  test('pós-resumo mantém só a checagem determinística de resultados', () => {
    assert.ok(bloco.includes('isResultadosIndisponiveis(cand)'));
    assert.ok(!bloco.includes('await faltaVereditoComparativo(cand'), 'sem 2ª chamada de veredito pós-resumo');
  });
  test('pool do dia também filtra a flag persistida', () => {
    assert.match(src, /passaCuradoria\(a\) && !isRepeated\(a, hist\) && !a\.veredito_extra_reprovado/);
  });
});
