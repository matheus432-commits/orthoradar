// Voz do TTS: Chirp3-HD por padrão, com fallback automático para Neural2 quando
// a voz primária é recusada pela API — a geração de áudio nunca pode quebrar
// por um nome de voz indisponível.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const TTS = path.join(__dirname, '..', 'tts.js');

// Carrega tts.js com _lib.request e tts-budget mockados. `responder(payload)`
// decide o status por chamada, permitindo simular "voz primária falha".
function loadTts(responder) {
  const libPath = require.resolve('../_lib', { paths: [path.dirname(TTS)] });
  require.cache[libPath] = {
    id: libPath, filename: libPath, loaded: true,
    exports: { request: async (opts, buf) => responder(JSON.parse(buf.toString('utf8'))) },
  };
  const budgetPath = require.resolve('./tts-budget', { paths: [path.dirname(TTS)] });
  require.cache[budgetPath] = {
    id: budgetPath, filename: budgetPath, loaded: true,
    exports: {
      billableChars: (s) => s.length,
      byteLength: (s) => Buffer.byteLength(s, 'utf8'),
      MAX_REQUEST_BYTES: 5000,
      loadUsage: async () => ({ chars: 0 }),
      checkBudget: () => ({ ok: true }),
      recordUsage: async () => {},
    },
  };
  delete require.cache[require.resolve(TTS)];
  return require(TTS);
}

const OK = { status: 200, body: JSON.stringify({ audioContent: 'QUJD' }) };

describe('synthesize — voz e fallback', () => {
  test('usa Chirp3-HD por padrão quando a API aceita', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    delete process.env.TTS_VOICE;
    const voicesTried = [];
    const tts = loadTts((p) => { voicesTried.push(p.voice.name); return OK; });
    const r = await tts.synthesize({}, { text: 'Olá, resultado do estudo.' });
    assert.equal(r.ok, true);
    assert.equal(voicesTried[0], 'pt-BR-Chirp3-HD-Aoede');
    assert.equal(r.voice, 'pt-BR-Chirp3-HD-Aoede');
    assert.equal(voicesTried.length, 1, 'não deve tentar fallback quando a 1ª deu certo');
  });

  test('cai para Neural2 quando a voz primária é recusada', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    delete process.env.TTS_VOICE;
    const voicesTried = [];
    const tts = loadTts((p) => {
      voicesTried.push(p.voice.name);
      return p.voice.name.includes('Chirp') ? { status: 400, body: '{"error":"voz indisponível"}' } : OK;
    });
    const r = await tts.synthesize({}, { text: 'Olá, resultado do estudo.' });
    assert.equal(r.ok, true, 'deve gerar áudio mesmo com a 1ª voz recusada');
    assert.deepEqual(voicesTried, ['pt-BR-Chirp3-HD-Aoede', 'pt-BR-Neural2-A']);
    assert.equal(r.voice, 'pt-BR-Neural2-A');
  });

  test('não envia speakingRate no padrão 1.0 (compatível com Chirp)', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    let sentPayload = null;
    const tts = loadTts((p) => { sentPayload = p; return OK; });
    await tts.synthesize({}, { text: 'teste' });
    assert.equal(sentPayload.audioConfig.speakingRate, undefined);
    assert.equal(sentPayload.audioConfig.audioEncoding, 'MP3');
  });

  test('envia speakingRate quando difere de 1.0', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    let sentPayload = null;
    const tts = loadTts((p) => { sentPayload = p; return OK; });
    await tts.synthesize({}, { text: 'teste', speakingRate: 0.9 });
    assert.equal(sentPayload.audioConfig.speakingRate, 0.9);
  });

  test('TTS_VOICE sobrepõe o padrão', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    process.env.TTS_VOICE = 'pt-BR-Chirp3-HD-Charon';
    let voice = null;
    const tts = loadTts((p) => { voice = p.voice.name; return OK; });
    const r = await tts.synthesize({}, { text: 'teste' });
    assert.equal(voice, 'pt-BR-Chirp3-HD-Charon');
    delete process.env.TTS_VOICE;
  });
});

describe('generateScript — resultado do estudo obrigatório (fallback offline)', () => {
  test('o roteiro fallback enuncia os achados do estudo', async () => {
    const { generateScript } = require('../podcast-script');
    const art = {
      titulo_pt: 'Alinhadores vs. aparelho fixo',
      resumo_pt: 'Estudo comparou alinhadores e aparelho fixo no tratamento de Classe II.',
      achados_principais: ['alinhadores foram tão eficazes quanto o aparelho fixo após 18 meses', 'menos emergências'],
      impacto_pratico: 'amplia as opções para casos selecionados',
    };
    // Sem anthropicKey → usa fallbackScript (determinístico, sem rede)
    const roteiro = await generateScript(art, 'Ortodontia', null);
    assert.match(roteiro, /encontrou/i);
    assert.match(roteiro, /tão eficazes quanto o aparelho fixo/);
  });
});
