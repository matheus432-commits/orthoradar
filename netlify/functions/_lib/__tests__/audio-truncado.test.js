// Incidente 08/08 — "áudio cortado no meio, ~2:10", recorrente entre
// especialidades (Ortodontia 'expansão × extração em Classe II' + outras).
// Duas causas blindadas:
//   1. Voz generativa (Chirp3-HD) devolvendo HTTP 200 com áudio que para
//      ANTES do fim do texto — detecção por duração esperada (~17 chars/s)
//      com resíntese na geração + alarme vermelho na auditoria.
//   2. capScript: roteiro truncado pelo teto de TOKENS ficava sem despedida
//      (o gate antigo só cobria o teto de CHARS) — fecho agora é garantido.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { capScript } = require('../podcast-script');

describe('capScript — fecho garantido em QUALQUER roteiro', () => {
  test('roteiro truncado no meio da frase (teto de tokens) → última frase completa + despedida', () => {
    const truncado = 'Hoje vamos falar do estudo. O grupo A teve melhores resultados que o grupo B. A análise mostrou que os pacien';
    const r = capScript(truncado);
    assert.ok(r.includes('grupo B.'), 'mantém a última frase completa');
    assert.ok(!r.includes('os pacien'), 'frase cortada não vai para o áudio');
    assert.match(r, /É isso por hoje\. Bons estudos e até o próximo episódio\.$/, 'despedida recolocada');
  });

  test('roteiro completo mas SEM fecho → ganha a despedida (nunca termina abrupto)', () => {
    const r = capScript('O estudo comparou A e B. O grupo A venceu em todos os desfechos.');
    assert.match(r, /É isso por hoje/, 'fecho padrão adicionado');
  });

  test('roteiro com fecho próprio → intocado (sem despedida duplicada)', () => {
    const comFecho = 'O estudo mostrou X. É isso por hoje. Bons estudos e até o próximo episódio.';
    assert.equal(capScript(comFecho), comFecho);
    const outroFecho = 'O estudo mostrou X. Até a próxima!';
    assert.equal(capScript(outroFecho), outroFecho);
  });
});

describe('cadeia anti-truncamento da voz', () => {
  const FUNCS = path.join(__dirname, '..', '..');
  const src = (p) => fs.readFileSync(p, 'utf8');

  test('geração: duração conferida contra o roteiro (~17 chars/s) com resíntese', () => {
    const gp = src(path.join(FUNCS, 'generate-podcasts.js'));
    assert.match(gp, /secsEsperado = tts\.chars \/ 17/, 'duração esperada derivada dos chars narrados');
    assert.match(gp, /secsCheck < secsEsperado \* 0\.82/, 'gatilho de truncamento');
    assert.ok(gp.includes('resintetizando'), 'resíntese automática (truncamento é estocástico)');
    assert.ok(gp.includes('AINDA curto após resíntese'), 'falha persistente nunca é silenciosa');
  });

  test('auditoria: episódio com áudio mais curto que o roteiro fica VERMELHO', () => {
    const audit = src(path.join(FUNCS, '..', '..', 'scripts', 'audit-edicao.js'));
    assert.ok(audit.includes('TRUNCADO pela voz'), 'alarme específico na auditoria');
    assert.match(audit, /billableChars\(String\(e\.roteiro/, 'esperado calculado do roteiro persistido');
  });
});
