// VALIDADOR NUMÉRICO — incidentes 22-25/08: 4 edições seguidas saíram com
// card sem resumo completo porque o validador reprovava NÚMEROS FIÉIS:
//   • "4.765" no resumo (milhar pt-BR) vs "4765"/"4,765" na origem;
//   • "0.782" no resumo vs "0·782" (ponto médio, estilo Lancet) na origem.
// E o vazamento estrutural: reprovou 2× → artigo saía no e-mail SEM resumo e
// nada re-tentava depois. Correções: formas equivalentes + ponto médio no
// numeric-check, e AUTO-CURA diária (lookback 7d) no pipeline.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..', '..', '..');

const { numbersConsistent, numberVariants, extractNumbers } = require('../numeric-check');

describe('numeric-check — formas equivalentes do MESMO número', () => {
  test('caso 30049978 (25/08): "4.765" no resumo com "4765" na origem PASSA', () => {
    assert.ok(numbersConsistent('The survey included 4765 participants', 'Foram avaliados 4.765 participantes.').ok);
  });
  test('milhar en na origem ("4,765") também casa a forma pt-BR', () => {
    assert.ok(numbersConsistent('A total of 4,765 subjects', 'Total de 4.765 indivíduos, sendo 4765 elegíveis.').ok);
  });
  test('ponto médio estilo Lancet na origem ("0·782") casa "0.782" no resumo', () => {
    assert.ok(numbersConsistent('sensitivity of 0·782 and specificity of 0·714', 'Sensibilidade de 0.782 e especificidade de 0,714.').ok);
  });
  test('número INVENTADO continua reprovando (anti-alucinação intacta)', () => {
    const r = numbersConsistent('The study enrolled 24 patients', 'Foram acompanhados 23 pacientes.');
    assert.ok(!r.ok);
    assert.deepEqual(r.offending, ['23']);
  });
  test('offending lista a forma BRUTA, sem variantes sintéticas poluindo o log', () => {
    const r = numbersConsistent('sem numeros na origem', 'AUC de 0.782 e 0.714.');
    assert.ok(!r.ok);
    assert.deepEqual(r.offending.sort(), ['0.714', '0.782'], 'antes: ["0.782","0782","0.714","0714"]');
  });
  test('decimais e percentuais comuns seguem exigindo presença literal', () => {
    assert.ok(numbersConsistent('reduction of 12.5% at 6 months', 'Redução de 12,5% em 6 meses.').ok);
    assert.ok(!numbersConsistent('reduction of 12.5% at 6 months', 'Redução de 13% em 6 meses.').ok);
  });
  test('numberVariants: milhar ↔ sem separador nos dois sentidos', () => {
    assert.ok(numberVariants('4.765').has('4765'));
    assert.ok(numberVariants('4765').has('4.765'));
    assert.ok(!numberVariants('12.5').has('125'), 'decimal comum não vira milhar');
  });
  test('extractNumbers normaliza ponto médio', () => {
    assert.ok(extractNumbers('OR de 0·78').has('0.78'));
  });
});

describe('auto-cura de resumos faltantes (fecha o vazamento)', () => {
  const script = fs.readFileSync(path.join(RAIZ, 'scripts', 'fix-resumos-edicao.js'), 'utf8');
  const pipeline = fs.readFileSync(path.join(RAIZ, '.github', 'workflows', 'daily-pipeline.yml'), 'utf8');
  test('script cobre janela de lookback (padrão 7 dias), não só o dia corrente', () => {
    assert.ok(script.includes('FIX_LOOKBACK'));
    assert.match(script, /Number\(process\.env\.FIX_LOOKBACK\) > 0 \? Number\(process\.env\.FIX_LOOKBACK\) : 7/);
    assert.ok(script.includes('FIX_DATE'), 'modo de um dia continua disponível para o dispatch');
  });
  test('idempotente: quem já tem resumo (>= piso da auditoria) é pulado', () => {
    assert.match(script, /length >= MIN_RC\) \{ jaTinha\+\+; continue; \}/);
    assert.ok(script.includes('MIN_RC = 200'));
  });
  test('grava no artigo E no snapshot do digest (o site lê o snapshot)', () => {
    assert.ok(script.includes("updateDoc('artigos'"));
    assert.ok(script.includes("setDoc('digests_especialidade'"));
  });
  test('pipeline diário roda a auto-cura ANTES da auditoria, sem derrubá-la', () => {
    assert.ok(pipeline.includes('Auto-cura de resumos faltantes'));
    assert.ok(pipeline.indexOf('Auto-cura de resumos faltantes') < pipeline.indexOf('Auditar qualidade da edição'));
    const bloco = pipeline.slice(pipeline.indexOf('Auto-cura'), pipeline.indexOf('Auditar qualidade'));
    assert.ok(bloco.includes('continue-on-error: true'), 'falha da cura não silencia a auditoria');
    assert.ok(bloco.includes("FIX_LOOKBACK:        '7'"));
  });
});
