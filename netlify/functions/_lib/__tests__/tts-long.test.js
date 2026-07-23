// Áudio longo NUNCA truncado (incidente 23/07: revisão sistemática cortou em
// 2:27). O roteiro é FATIADO no limite de bytes e o MP3 concatenado — nada de
// conteúdo é perdido. Run: node --test .../tts-long.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const TTS = path.join(__dirname, '..', 'tts.js');

// Carrega tts.js com _lib.request e tts-budget mockados. maxBytes controla o
// fatiamento; responder decide a resposta da API por chamada.
function loadTts(maxBytes, responder) {
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
      MAX_REQUEST_BYTES: maxBytes,
      MAX_CHARS_PER_AUDIO: 5000,
      loadUsage: async () => ({ chars: 0 }),
      checkBudget: () => ({ ok: true }),
      recordUsage: async () => {},
    },
  };
  delete require.cache[require.resolve(TTS)];
  return require(TTS);
}

// Áudio "ABC" (base64 QUJD) por chamada; concatenar N chamadas = "ABC"×N.
const OK = { status: 200, body: JSON.stringify({ audioContent: 'QUJD' }) };

describe('splitForTts — fatiamento sem perda', () => {
  const { splitForTts } = loadTts(60, () => OK);

  test('texto curto → 1 pedaço só', () => {
    const t = 'Uma frase curta.';
    assert.deepEqual(splitForTts(t), [t]);
  });

  test('texto longo → vários pedaços, cada um <= limite de bytes', () => {
    const t = 'Primeira frase do roteiro cientifico. Segunda frase com mais conteudo aqui. Terceira frase fecha o raciocinio. Quarta frase e a conclusao final.';
    const parts = splitForTts(t, 60);
    assert.ok(parts.length >= 2, 'deveria fatiar em 2+');
    for (const p of parts) assert.ok(Buffer.byteLength(p, 'utf8') <= 60, 'pedaço acima do limite: ' + p);
  });

  test('juntar os pedaços reconstrói o texto (NADA perdido)', () => {
    const t = 'Objetivo do estudo aqui. Metodos com grupos A e B comparados. Resultados: o grupo A foi melhor. Relevancia clinica no consultorio. Ate o proximo episodio.';
    const parts = splitForTts(t, 50);
    const juntado = parts.join(' ').replace(/\s+/g, ' ').trim();
    const orig = t.replace(/\s+/g, ' ').trim();
    assert.equal(juntado, orig);
  });

  test('não corta no meio de palavra (sem espaço/frase, corta em espaço)', () => {
    const t = 'palavraum palavradois palavratres palavraquatro palavracinco palavraseis';
    const parts = splitForTts(t, 25);
    for (const p of parts) assert.ok(!/\S$/.test(p) || t.includes(p), 'pedaço quebrou palavra: ' + p);
    // reconstrói
    assert.equal(parts.join(' ').replace(/\s+/g,' ').trim(), t);
  });

  test('vazio → []', () => {
    assert.deepEqual(splitForTts(''), []);
    assert.deepEqual(splitForTts('   '), []);
  });
});

describe('synthesizeLong — concatena e não trunca', () => {
  test('roteiro longo vira N chamadas e MP3 concatenado', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    let calls = 0;
    const tts = loadTts(60, () => { calls++; return OK; });
    const t = 'Frase um do roteiro completo. Frase dois com bastante conteudo cientifico. Frase tres explica o resultado. Frase quatro traz a conclusao clinica final.';
    const r = await tts.synthesizeLong({}, { text: t });
    assert.equal(r.ok, true);
    assert.ok(r.partes >= 2, 'esperava 2+ partes');
    assert.equal(calls, r.partes, 'uma chamada por parte');
    // Áudio = "ABC" repetido uma vez por parte (nada truncado).
    const audio = Buffer.from(r.audioBase64, 'base64').toString();
    assert.equal(audio, 'ABC'.repeat(r.partes));
  });

  test('texto curto → 1 chamada (comporta-se como synthesize)', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    let calls = 0;
    const tts = loadTts(5000, () => { calls++; return OK; });
    const r = await tts.synthesizeLong({}, { text: 'Curto e direto.' });
    assert.equal(r.ok, true);
    assert.equal(calls, 1);
  });

  test('ALL-OR-NOTHING: se uma parte falhar, retorna skip (não publica parcial)', async () => {
    process.env.GOOGLE_TTS_API_KEY = 'k';
    let calls = 0;
    // 2ª chamada falha na API (e no fallback), simulando erro.
    const tts = loadTts(40, () => { calls++; return calls >= 2 ? { status: 500, body: 'err' } : OK; });
    const t = 'Primeira frase do roteiro aqui. Segunda frase que vai falhar na sintese.';
    const r = await tts.synthesizeLong({}, { text: t });
    assert.notEqual(r.ok, true);      // não ok
    assert.ok(r.skipped);             // skip propagado
  });
});
