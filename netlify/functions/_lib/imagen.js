// Geração de ilustrações via Vertex AI — usadas nas cenas dos Reels.
//
// MODELO (descoberto por sondagem em 21/07/2026 — scripts/imagen-probe.js):
// a família Imagen via :predict foi REMOVIDA do Vertex (todos os nomes dão
// 404). O caminho atual é o Gemini Image ("gemini-2.5-flash-image") via
// :generateContent, que devolve a imagem em candidates[].content.parts[]
// .inlineData (base64). Env IMAGEN_MODEL troca o modelo sem deploy.
//
// ESTILO TRAVADO DA MARCA: toda imagem é uma ilustração flat editorial (nunca
// foto realista) na paleta OdontoFeed. Decisão de produto 20/07/2026: público
// é dentista — foto clínica gerada por IA erra detalhe técnico visível e mina
// a credibilidade; ilustração estilizada comunica sem esse risco.
//
// Auth: MESMA service account do TTS/Storage (GCP_SERVICE_ACCOUNT_JSON), com
// papel "Vertex AI User" (roles/aiplatform.user) no projeto.

const { request } = require('../_lib');
const { getAccessToken, loadServiceAccount } = require('./gcp-auth');
const log = require('./logger');

const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const MODEL    = process.env.IMAGEN_MODEL || 'gemini-2.5-flash-image';

// Prompt de estilo fixo — o "visual" da cena entra por último.
const STYLE = 'Flat vector editorial illustration for a dental science brand. ' +
  'Dark navy background (#0A0E1A), cyan (#37D7E7) and warm gold (#EABF48) accents, ' +
  'off-white details, soft radial glow behind the subject, minimalist, clean geometric shapes, ' +
  'centered composition, generous margins, square 1:1 format. Strictly NO text, NO letters, NO numbers, NO watermark, ' +
  'NO photorealism, NO human faces. Subject: ';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Núcleo genérico: gera 1 imagem a partir de um PROMPT COMPLETO (o chamador
// controla o estilo). Usado pelas ilustrações (STYLE travado abaixo) e pelo
// retrato fotorrealista da apresentadora (scripts/gerar-avatar-retrato.js —
// única exceção autorizada ao "sem foto realista": é a IDENTIDADE do avatar,
// não conteúdo clínico). Retorna { ok, buffer, mime } ou { skipped, reason }.
async function generateImage(promptText) {
  const sa = loadServiceAccount();
  if (!sa?.project_id) return { skipped: true, reason: 'no_service_account' };

  const token = await getAccessToken('https://www.googleapis.com/auth/cloud-platform');
  if (!token) return { skipped: true, reason: 'no_access_token' };

  const body = Buffer.from(JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: String(promptText || '').slice(0, 1200) }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  }), 'utf8');

  let res = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    res = await request({
      hostname: `${LOCATION}-aiplatform.googleapis.com`,
      path: `/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models/${MODEL}:generateContent`,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': body.length,
      },
    }, body);
    if (res.status !== 429 || tentativa === 3) break;
    log.info('[imagen] 429 (quota/min) — aguardando para tentar de novo', { tentativa });
    await sleep(20000 * tentativa); // 20s, 40s
  }

  if (res.status !== 200) {
    // Loga a conta em uso: o papel Vertex AI precisa estar NESTA conta.
    log.warn('[imagen] geração falhou', { status: res.status, sa: sa.client_email, model: MODEL, body: String(res.body || '').slice(0, 300) });
    return { skipped: true, reason: 'api_error', status: res.status };
  }

  try {
    const json = JSON.parse(res.body);
    const parts = json.candidates?.[0]?.content?.parts || [];
    const img = parts.find(p => p.inlineData?.data);
    if (!img) {
      log.warn('[imagen] resposta sem imagem', { partes: parts.map(p => Object.keys(p)[0]).join(',') });
      return { skipped: true, reason: 'empty_prediction' };
    }
    return { ok: true, buffer: Buffer.from(img.inlineData.data, 'base64'), mime: img.inlineData.mimeType || 'image/png' };
  } catch (e) {
    return { skipped: true, reason: 'bad_json' };
  }
}

// Ilustração de cena: SEMPRE com o estilo travado da marca (nunca foto).
function generateIllustration(visualDesc) {
  return generateImage(STYLE + String(visualDesc || '').slice(0, 400));
}

module.exports = { generateIllustration, generateImage, _STYLE: STYLE, _MODEL: MODEL };
