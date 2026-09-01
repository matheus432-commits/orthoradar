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
    // 31/08: entrou !isEstudoMateriais(a) no meio da cadeia (bancada de
    // materiais não pode virar extra Premium) — a intenção do teste continua
    // sendo a flag persistida sair do pool do dia.
    assert.match(src, /passaCuradoria\(a\) &&[^\n]*!isRepeated\(a, hist\) && !a\.veredito_extra_reprovado/);
  });
});

// ── 12/08: fundador fechou com 0 extras — a reprovação PÓS-resumo ("material
// sem resultados") era só em memória; o mesmo candidato ruim voltava à fila
// todos os dias, comia as vagas (6 descartes seguidos → teto de 90s estourado)
// e queimava Sonnet. Agora ela persiste e sai de TODOS os pools. ─────────────
const { describe: descSR, test: testSR } = require('node:test');
const assertSR = require('node:assert');
const fsSR = require('fs');
const pathSR = require('path');
descSR('reprovação pós-resumo persistida (extra_sem_resultados)', () => {
  const srcSR = fsSR.readFileSync(pathSR.join(__dirname, '..', '..', 'daily-digest.js'), 'utf8');
  testSR('descarte pós-resumo grava extra_sem_resultados no artigo', () => {
    assertSR.ok(srcSR.includes("{ extra_sem_resultados: true }"), 'flag persistida via updateDoc');
    assertSR.match(srcSR, /_reprova\(cand, _poolDe\(cand\), '_resumoReprovado'\)/, 'descarte chama a reprovação persistente');
  });
  testSR('flag filtrada nas TRÊS pontas: pool, poço fundo e trava barata', () => {
    assertSR.match(srcSR, /!a\.veredito_extra_reprovado && !a\.extra_sem_resultados/, 'pool exclui');
    assertSR.match(srcSR, /a\.veredito_extra_reprovado \|\| a\.extra_sem_resultados\) continue/, 'poço fundo exclui');
    assertSR.match(srcSR, /c\.veredito_extra_reprovado \|\| c\.extra_sem_resultados/, 'trava barata pula sem custo');
  });
  testSR('causa do SEM extras traz números (fila, trava, pós-resumo), não suposição', () => {
    assertSR.ok(srcSR.includes('descartesTrava, descartesPosResumo'), 'contadores no log');
    assertSR.match(srcSR, /fila de \$\{candidatosExtras\.length\}/, 'mensagem quantificada');
  });
});

// Varredura retroativa (12/08, pedido do fundador: "para todas as
// especialidades"): antecipa a marcação no acervo INTEIRO com a MESMA função
// do e-mail, em dry-run por padrão, sem nenhum custo de IA/TTS.
descSR('varredura retroativa limpar-extras-sem-resultados', () => {
  const scriptSR = fsSR.readFileSync(pathSR.join(__dirname, '..', '..', '..', '..', 'scripts', 'limpar-extras-sem-resultados.js'), 'utf8');
  const wfSR = fsSR.readFileSync(pathSR.join(__dirname, '..', '..', '..', '..', '.github', 'workflows', 'limpar-extras-sem-resultados.yml'), 'utf8');
  testSR('usa a MESMA checagem do e-mail (não uma cópia divergente)', () => {
    assertSR.ok(scriptSR.includes("require('../netlify/functions/daily-digest')"), 'importa do digest');
    assertSR.ok(scriptSR.includes('isResultadosIndisponiveis(a)'), 'mesma função determinística');
  });
  testSR('dry-run por padrão; pulados os já reprovados; relatório por especialidade', () => {
    assertSR.match(scriptSR, /DRY_RUN = !\/\^\(false\|0\|n\[a\ã\]o\|no\)\$\/i/, 'padrão seguro com parser tolerante a caixa/espaços (run #2 de 12/08: "false" digitado não gravou)');
    assertSR.ok(scriptSR.includes('a.extra_sem_resultados || a.veredito_extra_reprovado'), 'idempotente');
    assertSR.ok(scriptSR.includes('POR ESPECIALIDADE'), 'relatório por especialidade');
  });
  testSR('workflow é SÓ dispatch manual e sem chaves de IA/TTS (custo zero)', () => {
    assertSR.ok(wfSR.includes('workflow_dispatch'), 'dispatch manual');
    assertSR.ok(!wfSR.includes('push:'), 'nunca roda em push');
    assertSR.ok(!wfSR.includes('ANTHROPIC_API_KEY') && !wfSR.includes('GOOGLE_TTS_API_KEY'), 'sem chaves de IA/TTS');
  });
});

// ── 14-15/08: "edição de Ortodontia sem resumos premium" — três causas ─────
// (1) FUSO: após 21h BRT o site servia a edição do dia via fallback, mas os
//     extras eram filtrados por "hoje UTC" → todo Premium via a edição sem os
//     estudos à noite; (2) POOL VAZIO pulava o bloco inteiro dos extras (o
//     poço fundo nunca rodava — Dentística 14/08 com pool 0 pós-varredura);
// (3) fallback do histórico era Array e isRepeated usa .has → poço fundo
//     "indisponível" em silêncio no caminho novo.
descSR('extras premium: fuso da edição + pool vazio + hist Set', () => {
  const digestSrc = fsSR.readFileSync(pathSR.join(__dirname, '..', '..', 'daily-digest.js'), 'utf8');
  const edicaoSrc = fsSR.readFileSync(pathSR.join(__dirname, '..', '..', 'get-edicao.js'), 'utf8');
  testSR('site: extras ancorados na DATA DA EDIÇÃO exibida, não no hoje-UTC', () => {
    assertSR.ok(edicaoSrc.includes('getPremiumExtrasHoje(db, email, edicao.date)'), 'data da edição passa para o filtro');
    assertSR.match(edicaoSrc, /String\(dataEdicao \|\| ''\)\.slice\(0, 10\) \|\| new Date\(\)/, 'edição manda; hoje é só fallback');
  });
  testSR('pool vazio ainda tenta os extras (poço fundo do acervo)', () => {
    assertSR.ok(!digestSrc.includes('if (!pool.length) return [];'), 'early-return do pool vazio removido');
    assertSR.ok(digestSrc.includes('Array.isArray(espDigest.premiumPool) ? espDigest.premiumPool : []'), 'chamador normaliza e SEMPRE tenta');
    assertSR.ok(!digestSrc.includes('pool vazio para a especialidade'), 'o antigo desvio silencioso morreu');
  });
  testSR('histórico do poço fundo é Set (isRepeated usa .has)', () => {
    assertSR.ok(digestSrc.includes('_histPorEsp.get(esp) || new Set()'), 'fallback correto');
    assertSR.ok(!digestSrc.includes('_histPorEsp.get(esp) || []'), 'fallback Array removido');
  });
  testSR('pickPremiumExtras exportada para o teste de runtime', () => {
    assertSR.ok(digestSrc.includes('exports.pickPremiumExtras = pickPremiumExtras'));
  });
});
