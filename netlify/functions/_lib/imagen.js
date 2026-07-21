// Geração de ilustrações via Imagen (Vertex AI) — usadas nas cenas dos Reels.
//
// ESTILO TRAVADO DA MARCA: toda imagem é uma ilustração flat editorial (nunca
// foto realista) na paleta OdontoFeed. Decisão de produto 20/07/2026: público
// é dentista — foto clínica gerada por IA erra detalhe técnico visível e mina
// a credibilidade; ilustração estilizada comunica sem esse risco.
//
// Auth: MESMA service account do TTS/Storage (GCP_SERVICE_ACCOUNT_JSON), que
// precisa do papel "Vertex AI User" e da API Vertex AI ativada no projeto.

const { request } = require('../_lib');
const { getAccessToken, loadServiceAccount } = require('./gcp-auth');
const log = require('./logger');

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';

// Modelos em ordem de preferência. O Google APOSENTA versões (o Imagen 3 morreu
// em 2026 com 404 "model was not found") — por isso uma cadeia: tenta o
// primeiro; em 404, cai para o próximo. Env IMAGEN_MODEL antepõe um modelo.
const MODEL_CHAIN = [
  ...(process.env.IMAGEN_MODEL ? [process.env.IMAGEN_MODEL] : []),
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
  'imagen-3.0-generate-002',
];
let _modelOk = null; // cache do modelo que funcionou (por processo)

// Prompt de estilo fixo — o "visual" da cena entra por último.
const STYLE = 'Flat vector editorial illustration for a dental science brand. ' +
  'Dark navy background (#0A0E1A), cyan (#37D7E7) and warm gold (#EABF48) accents, ' +
  'off-white details, soft radial glow behind the subject, minimalist, clean geometric shapes, ' +
  'centered composition, generous margins. Strictly NO text, NO letters, NO numbers, NO watermark, ' +
  'NO photorealism, NO human faces. Subject: ';

// Chama :predict de UM modelo. Retorna { status, body }.
async function predictWith(model, sa, token, visualDesc) {
  const body = Buffer.from(JSON.stringify({
    instances: [{ prompt: STYLE + String(visualDesc || '').slice(0, 400) }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      // Sem pessoas identificáveis — reforça o estilo ilustrativo e evita bloqueios.
      personGeneration: 'dont_allow',
    },
  }), 'utf8');

  return request({
    hostname: `${LOCATION}-aiplatform.googleapis.com`,
    path: `/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models/${model}:predict`,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  }, body);
}

// Gera 1 ilustração (PNG/JPEG Buffer) a partir da descrição visual da cena.
// Percorre a cadeia de modelos: 404 (modelo aposentado/indisponível) → tenta o
// próximo; outros erros param (não são de modelo). Retorna { ok, buffer, mime }
// ou { skipped, reason }.
async function generateIllustration(visualDesc) {
  const sa = loadServiceAccount();
  if (!sa?.project_id) return { skipped: true, reason: 'no_service_account' };

  const token = await getAccessToken('https://www.googleapis.com/auth/cloud-platform');
  if (!token) return { skipped: true, reason: 'no_access_token' };

  const chain = _modelOk ? [_modelOk] : MODEL_CHAIN;
  let last = null;
  for (const model of chain) {
    const res = await predictWith(model, sa, token, visualDesc);
    last = { status: res.status, model };

    if (res.status === 200) {
      try {
        const json = JSON.parse(res.body);
        const pred = json.predictions?.[0];
        const b64  = pred?.bytesBase64Encoded;
        if (!b64) return { skipped: true, reason: 'empty_prediction' };
        if (_modelOk !== model) { _modelOk = model; log.info('[imagen] modelo em uso', { model }); }
        return { ok: true, buffer: Buffer.from(b64, 'base64'), mime: pred.mimeType || 'image/png' };
      } catch { return { skipped: true, reason: 'bad_json' }; }
    }

    // Loga a conta de serviço em uso: o papel "Vertex AI User" precisa estar
    // NESTA conta (a do GCP_SERVICE_ACCOUNT_JSON), não em outra do projeto.
    log.warn('[imagen] geração falhou', { status: res.status, sa: sa.client_email, model, body: String(res.body || '').slice(0, 300) });
    if (res.status !== 404) break; // erro real (permissão/quota/etc.) — não é questão de modelo
  }
  return { skipped: true, reason: 'api_error', status: last?.status, model: last?.model };
}

module.exports = { generateIllustration, _STYLE: STYLE, _MODEL_CHAIN: MODEL_CHAIN };
