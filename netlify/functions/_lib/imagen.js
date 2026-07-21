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
const MODEL    = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';

// Prompt de estilo fixo — o "visual" da cena entra por último.
const STYLE = 'Flat vector editorial illustration for a dental science brand. ' +
  'Dark navy background (#0A0E1A), cyan (#37D7E7) and warm gold (#EABF48) accents, ' +
  'off-white details, soft radial glow behind the subject, minimalist, clean geometric shapes, ' +
  'centered composition, generous margins. Strictly NO text, NO letters, NO numbers, NO watermark, ' +
  'NO photorealism, NO human faces. Subject: ';

// Gera 1 ilustração (PNG/JPEG Buffer) a partir da descrição visual da cena.
// Retorna { ok, buffer, mime } ou { skipped, reason }.
async function generateIllustration(visualDesc) {
  const sa = loadServiceAccount();
  if (!sa?.project_id) return { skipped: true, reason: 'no_service_account' };

  const token = await getAccessToken('https://www.googleapis.com/auth/cloud-platform');
  if (!token) return { skipped: true, reason: 'no_access_token' };

  const body = Buffer.from(JSON.stringify({
    instances: [{ prompt: STYLE + String(visualDesc || '').slice(0, 400) }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      // Sem pessoas identificáveis — reforça o estilo ilustrativo e evita bloqueios.
      personGeneration: 'dont_allow',
    },
  }), 'utf8');

  const res = await request({
    hostname: `${LOCATION}-aiplatform.googleapis.com`,
    path: `/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict`,
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': body.length,
    },
  }, body);

  if (res.status !== 200) {
    // Loga a conta de serviço em uso: o papel "Vertex AI User" precisa estar
    // NESTA conta (a do GCP_SERVICE_ACCOUNT_JSON), não em outra do projeto.
    log.warn('[imagen] geração falhou', { status: res.status, sa: sa.client_email, model: MODEL, body: String(res.body || '').slice(0, 300) });
    return { skipped: true, reason: 'api_error', status: res.status };
  }

  try {
    const json = JSON.parse(res.body);
    const pred = json.predictions?.[0];
    const b64  = pred?.bytesBase64Encoded;
    if (!b64) return { skipped: true, reason: 'empty_prediction' };
    return { ok: true, buffer: Buffer.from(b64, 'base64'), mime: pred.mimeType || 'image/png' };
  } catch (e) {
    return { skipped: true, reason: 'bad_json' };
  }
}

module.exports = { generateIllustration, _STYLE: STYLE };
