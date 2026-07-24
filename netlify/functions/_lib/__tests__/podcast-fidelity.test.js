// Verificador de fidelidade do roteiro do podcast — incidente real 07/2026:
// um protocolo de RCT (sem resultados) foi narrado como "avaliou se o laceback
// funciona". Estas garantias NÃO podem regredir:
//   1. Roteiro aprovado pelo verificador → vai ao ar.
//   2. Reprovado → 1 regeneração com o feedback; aprovada → vai ao ar.
//   3. Reprovado 2x → fallback determinístico (só narra o material próprio).
//   4. Verificador indisponível → FAIL-CLOSED (fallback), nunca roteiro sem checagem.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const PS = path.join(__dirname, '..', 'podcast-script.js');

// Carrega podcast-script.js com _lib.request mockado. O responder recebe o
// payload já parseado e decide a resposta; distingue GERAÇÃO de VERIFICAÇÃO
// pelo modelo usado (roteiro = sonnet; verificador = haiku).
function loadPS(responder) {
  const libPath = require.resolve('../_lib', { paths: [path.dirname(PS)] });
  require.cache[libPath] = {
    id: libPath, filename: libPath, loaded: true,
    exports: { request: async (opts, buf) => responder(JSON.parse(buf.toString('utf8'))) },
  };
  const budgetPath = require.resolve('./tts-budget', { paths: [path.dirname(PS)] });
  require.cache[budgetPath] = {
    id: budgetPath, filename: budgetPath, loaded: true,
    exports: { MAX_REQUEST_BYTES: 5000, byteLength: (s) => Buffer.byteLength(s, 'utf8') },
  };
  delete require.cache[require.resolve(PS)];
  return require(PS);
}

const msg = (text) => ({ status: 200, body: JSON.stringify({ content: [{ type: 'text', text }] }) });
const isVerify = (p) => String(p.model).includes('haiku');

const ART = {
  pmid: '123',
  titulo_pt: 'Ligadura laceback em Ortodontia: protocolo de RCT',
  // ≥200 chars: precisa passar na trava de material narratável (hasNarratableMaterial)
  resumo_pt: 'Protocolo de ensaio clínico randomizado que medirá acúmulo de placa, dor relatada pelo paciente e intercorrências clínicas em pacientes ortodônticos tratados com ligadura laceback, acompanhados ao longo do alinhamento inicial. O estudo ainda não tem resultados; os desfechos serão avaliados durante o seguimento.',
  abstract: 'Protocol for an RCT measuring plaque, pain and adverse events with laceback ligatures.',
  achados_principais: [],
  nivel_evidencia: 'RCT',
};

describe('generateScript — fluxo de fidelidade', () => {
  test('aprovado de primeira → roteiro gerado vai ao ar', async () => {
    const calls = [];
    const ps = loadPS((p) => {
      calls.push(p.model);
      if (isVerify(p)) return msg('{"aprovado": true, "problemas": []}');
      return msg('Roteiro fiel sobre o protocolo do laceback.');
    });
    const r = await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.match(r, /Roteiro fiel/);
    assert.equal(calls.filter(m => !String(m).includes('haiku')).length, 1, 'uma geração');
    assert.equal(calls.filter(m => String(m).includes('haiku')).length, 1, 'uma verificação');
  });

  test('reprovado 1x → regenera com feedback e aprova a 2ª', async () => {
    let gen = 0, sawFixNote = false;
    const ps = loadPS((p) => {
      if (isVerify(p)) {
        return gen === 1
          ? msg('{"aprovado": false, "problemas": ["apresentou protocolo como estudo com resultados"]}')
          : msg('{"aprovado": true, "problemas": []}');
      }
      gen++;
      if (gen === 2 && String(p.system).includes('apresentou protocolo como estudo')) sawFixNote = true;
      return msg(gen === 1 ? 'Roteiro que INVENTA resultado.' : 'Roteiro corrigido, fiel ao protocolo.');
    });
    const r = await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.match(r, /Roteiro corrigido/);
    assert.equal(gen, 2, 'duas gerações');
    assert.ok(sawFixNote, 'a 2ª geração recebe os problemas apontados');
  });

  test('reprovado 2x → fallback determinístico, nunca o roteiro inventivo', async () => {
    const ps = loadPS((p) => {
      if (isVerify(p)) return msg('{"aprovado": false, "problemas": ["distorce o objetivo do estudo"]}');
      return msg('Roteiro que continua INVENTANDO resultado.');
    });
    const r = await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.ok(!r.includes('INVENTANDO'), 'roteiro reprovado não pode ir ao ar');
    assert.match(r, /Em resumo:/, 'fallback narra o resumo próprio');
    assert.match(r, /acúmulo de placa[\s\S]*intercorrências/, 'fallback fica no conteúdo real do estudo');
  });

  test('verificador fora do ar → FAIL-CLOSED (fallback)', async () => {
    const ps = loadPS((p) => {
      if (isVerify(p)) return { status: 500, body: 'boom' };
      return msg('Roteiro criativo sem checagem.');
    });
    const r = await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.ok(!r.includes('sem checagem'), 'sem verificação confiável, roteiro criativo não vai ao ar');
    assert.match(r, /Em resumo:/);
  });

  test('prompt de geração exige fidelidade e trata protocolos', async () => {
    let system = null;
    const ps = loadPS((p) => {
      if (isVerify(p)) return msg('{"aprovado": true, "problemas": []}');
      system = p.system; return msg('ok');
    });
    await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.match(system, /FIDELIDADE \(regra MÁXIMA/);
    assert.match(system, /PROTOCOLO/);
    assert.match(system, /NUNCA invente/);
  });

  test('verificador recebe o abstract original como fonte primária', async () => {
    let verifyUser = null;
    const ps = loadPS((p) => {
      if (isVerify(p)) { verifyUser = p.messages[0].content; return msg('{"aprovado": true, "problemas": []}'); }
      return msg('ok');
    });
    await ps.generateScript(ART, 'Ortodontia', 'key');
    assert.match(verifyUser, /Abstract original \(fonte primária\): Protocol for an RCT/);
  });
});
