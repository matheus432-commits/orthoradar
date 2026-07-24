// Gera as OPÇÕES DE RETRATO FOTORREALISTA da apresentadora do OdontoFeed
// (a identidade fixa do avatar realista — modo AVATAR_MODE=realista).
//
// Roda 1x (ou até o fundador aprovar um retrato): gera 3 candidatas via
// Vertex (Gemini Image, mesma conta do pipeline), sobe ao Storage e imprime
// as URLs. O fundador escolhe uma; a escolhida vira avatar_config/retrato
// (campo fotoPath/fotoToken) e o talking_photo_id do HeyGen é cacheado na
// primeira geração de vídeo.
//
// A MESMA pessoa em todos os vídeos = reconhecimento de marca. Por isso o
// retrato é fixo e versionado no Firestore, não gerado por vídeo.
//
// Envs: FIREBASE_*, GCP_SERVICE_ACCOUNT_JSON, GCS_BUCKET.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { generateImage } = require('../netlify/functions/_lib/imagen');
const { uploadImage } = require('../netlify/functions/_lib/storage');

// Retrato pensado para animação por talking-photo: frontal, ombros para cima,
// boca fechada (o modelo anima melhor a partir de lábios em repouso), fundo
// limpo escuro, iluminação de estúdio — e identidade OdontoFeed no figurino.
const PROMPT_BASE =
  'Ultra realistic professional studio portrait photograph of a Brazilian woman dentist in her early 30s, ' +
  'warm medium skin tone, dark brown hair, friendly confident expression with a subtle closed-mouth smile, ' +
  'facing the camera directly, head and shoulders framing, wearing modern teal medical scrubs, ' +
  'clean dark navy studio background with soft gradient, professional softbox lighting, ' +
  'sharp focus on the face, high detail skin texture, 85mm lens look, vertical composition. ' +
  'No text, no watermark, no logo, no glasses, mouth closed, both eyes open looking at camera.';

const VARIACOES = [
  'Shoulder-length straight hair.',
  'Hair tied back in a neat low bun, small gold earrings.',
  'Slightly wavy hair, over-ear wireless headphones around the neck (podcast host look).',
];

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.log('FALTA FIREBASE_API_KEY'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  const opcoes = [];
  for (let i = 0; i < VARIACOES.length; i++) {
    const r = await generateImage(PROMPT_BASE + ' ' + VARIACOES[i]);
    if (!r.ok) { console.log(`opção ${i + 1}: FALHOU (${r.reason})`); continue; }
    const objectPath = `avatar/retrato-opcao-${i + 1}.png`;
    const up = await uploadImage(objectPath, r.buffer, r.mime || 'image/png');
    if (!up.ok) { console.log(`opção ${i + 1}: upload falhou (${up.reason})`); continue; }
    opcoes.push({ n: i + 1, objectPath, downloadToken: up.downloadToken || '', url: up.url });
    console.log(`opção ${i + 1}: ${up.url}`);
  }
  if (!opcoes.length) { console.log('NENHUMA opção gerada'); process.exit(1); }

  await db.setDoc('avatar_config', 'retrato_opcoes', {
    opcoes, geradoEm: new Date().toISOString(),
  }).catch(e => console.log('(falha gravando opções:', e.message, ')'));

  console.log('\nEscolha uma das URLs acima. A escolhida vira o doc avatar_config/retrato');
  console.log('(ou defina AVATAR_FOTO_URL no workflow para usar uma foto sua).');
  process.exit(0);
})().catch(e => { console.error('ERRO_FATAL', e.message); process.exit(1); });
