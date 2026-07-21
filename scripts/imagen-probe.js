// Sondagem: descobre QUAL modelo/endpoint de geração de imagem funciona no
// projeto (o Imagen 3 e os nomes 4.0 testados deram 404 em 21/07/2026).
//
// Testa em sequência: (a) família Imagen via :predict em us-central1 e global;
// (b) família Gemini Image via :generateContent (caminho novo do Vertex).
// Imprime uma linha por tentativa: PROBE <endpoint> <modelo> → status.
// Sai com código 0 se algum funcionou (e imprime VENCEDOR), 1 se nenhum.
//
// Roda no workflow imagen-test.yml (dispara em push) — iteração sem depender
// de cliques manuais no Actions.

const { request } = require('../netlify/functions/_lib');
const { getAccessToken, loadServiceAccount } = require('../netlify/functions/_lib/gcp-auth');

const PROMPT = 'Flat vector illustration of a single tooth, dark navy background, cyan accents, minimalist, no text.';

async function probePredict(location, model, sa, token) {
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const body = Buffer.from(JSON.stringify({
    instances: [{ prompt: PROMPT }],
    parameters: { sampleCount: 1, aspectRatio: '1:1' },
  }), 'utf8');
  const res = await request({
    hostname: host,
    path: `/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${model}:predict`,
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': body.length },
  }, body);
  const hasImage = res.status === 200 && /bytesBase64Encoded/.test(res.body || '');
  return { status: res.status, hasImage, snippet: String(res.body || '').replace(/\s+/g, ' ').slice(0, 160) };
}

async function probeGenerateContent(location, model, sa, token) {
  const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
  const body = Buffer.from(JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }), 'utf8');
  const res = await request({
    hostname: host,
    path: `/v1/projects/${sa.project_id}/locations/${location}/publishers/google/models/${model}:generateContent`,
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': body.length },
  }, body);
  const hasImage = res.status === 200 && /inlineData|bytesBase64Encoded/.test(res.body || '');
  return { status: res.status, hasImage, snippet: String(res.body || '').replace(/\s+/g, ' ').slice(0, 160) };
}

(async () => {
  const sa = loadServiceAccount();
  if (!sa?.project_id) { console.log('SEM_CREDENCIAL'); process.exit(1); }
  const token = await getAccessToken('https://www.googleapis.com/auth/cloud-platform');
  if (!token) { console.log('SEM_TOKEN'); process.exit(1); }
  console.log('conta:', sa.client_email, '| projeto:', sa.project_id);

  const imagenModels = [
    'imagen-4.0-generate-001', 'imagen-4.0-fast-generate-001', 'imagen-4.0-ultra-generate-001',
    'imagen-4.0-generate-preview-06-06', 'imagen-3.0-generate-002', 'imagen-3.0-fast-generate-001',
    'imagegeneration@006',
  ];
  const geminiModels = [
    'gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview',
    'gemini-2.0-flash-preview-image-generation',
  ];
  const locations = ['us-central1', 'global'];

  let winner = null;
  for (const loc of locations) {
    for (const m of imagenModels) {
      try {
        const r = await probePredict(loc, m, sa, token);
        console.log(`PROBE predict ${loc} ${m} -> ${r.status}${r.hasImage ? ' IMAGEM_OK' : ''} | ${r.snippet}`);
        if (r.hasImage && !winner) winner = { api: 'predict', loc, model: m };
      } catch (e) { console.log(`PROBE predict ${loc} ${m} -> ERRO ${e.message}`); }
    }
    for (const m of geminiModels) {
      try {
        const r = await probeGenerateContent(loc, m, sa, token);
        console.log(`PROBE generateContent ${loc} ${m} -> ${r.status}${r.hasImage ? ' IMAGEM_OK' : ''} | ${r.snippet}`);
        if (r.hasImage && !winner) winner = { api: 'generateContent', loc, model: m };
      } catch (e) { console.log(`PROBE generateContent ${loc} ${m} -> ERRO ${e.message}`); }
    }
    if (winner) break; // achou na 1ª região — não precisa varrer a outra
  }

  if (winner) { console.log('VENCEDOR:', JSON.stringify(winner)); process.exit(0); }
  console.log('NENHUM_MODELO_FUNCIONOU');
  process.exit(1);
})().catch(e => { console.error('ERRO_GERAL', e.message); process.exit(1); });
