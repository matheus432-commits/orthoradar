// Divide o ROTEIRO narrado de um episódio em CENAS visuais e calcula QUANDO
// cada cena entra no áudio (sincronia narração ↔ imagem).
//
// Segmentação: Claude lê o roteiro e devolve segmentos contíguos — saudação
// (vira a CAPA), 3-5 cenas do meio (cada uma com conceito p/ cache e descrição
// visual p/ o Imagen) e encerramento (vira o OUTRO).
//
// Sincronia v1: proporcional ao texto — cada segmento dura
// (chars do segmento / chars totais) × duração real do áudio. Erro típico de
// ±1-2s, invisível em cena estática. (v2 futura: timepoints exatos do TTS.)

const { request } = require('../_lib');
const log = require('./logger');

const SCENES_MODEL = process.env.REEL_SCENES_MODEL || 'claude-sonnet-5';

// ── Sincronia (puro, testável) ───────────────────────────────────────────────

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Localiza o início de cada segmento no roteiro (busca normalizada, em ordem).
// Retorna array de índices (no texto NORMALIZADO) ou null se algum não casar.
function findBoundaries(roteiro, inicios) {
  const R = norm(roteiro);
  const out = [];
  let from = 0;
  for (const inicio of inicios) {
    const alvo = norm(inicio).split(' ').slice(0, 6).join(' ');
    if (!alvo) return null;
    const idx = R.indexOf(alvo, from);
    if (idx < 0) return null;
    out.push(idx);
    from = idx + alvo.length;
  }
  if (out[0] !== 0) out[0] = 0; // 1º segmento sempre começa no início
  return out;
}

// Duração de cada segmento em segundos, proporcional ao texto, com mínimo de
// 2s por cena e soma exatamente igual a audioSecs. Fallback: divisão igual.
function computeTimings(roteiro, inicios, audioSecs) {
  const total = Math.max(1, Number(audioSecs) || 0);
  const n = inicios.length;
  if (!n) return [];
  const R = norm(roteiro);

  let lens = null;
  const bounds = findBoundaries(roteiro, inicios);
  if (bounds) {
    lens = bounds.map((b, i) => (i + 1 < bounds.length ? bounds[i + 1] : R.length) - b);
    if (lens.some(l => l <= 0)) lens = null;
  }
  if (!lens) lens = inicios.map(() => 1); // fallback: divide igual

  const sum = lens.reduce((a, b) => a + b, 0);
  let secs = lens.map(l => (l / sum) * total);
  // Mínimo de 2s por segmento (redistribui dos maiores), depois renormaliza.
  const MIN = Math.min(2, total / n);
  secs = secs.map(s => Math.max(MIN, s));
  const f = total / secs.reduce((a, b) => a + b, 0);
  return secs.map(s => Math.round(s * f * 10) / 10);
}

// Slug de cache do conceito visual ("Profilaxia da faceta" → "profilaxia-da-faceta")
function conceptSlug(conceito) {
  return norm(conceito).replace(/ /g, '-').slice(0, 60) || 'cena-generica';
}

// ── Segmentação via Claude ───────────────────────────────────────────────────

function buildSegmentPrompt(roteiro, article) {
  return `Divida o roteiro de podcast odontológico abaixo em SEGMENTOS CONTÍGUOS para um vídeo com imagens sincronizadas.

REGRAS:
- O 1º segmento é a SAUDAÇÃO (tipo "capa"); o último é o ENCERRAMENTO (tipo "outro"); entre eles, 3 a 5 CENAS (tipo "cena").
- Os segmentos devem cobrir o roteiro INTEIRO, na ordem, sem sobreposição e sem pular texto.
- Para cada segmento, "inicio" = as 6 A 8 PRIMEIRAS PALAVRAS EXATAS do segmento, copiadas literalmente do roteiro (é assim que localizo o ponto no áudio).
- Cada CENA tem: "rotulo" (2-4 palavras, ex.: "Métodos do estudo"), "frase" (frase-chave de ATÉ 12 palavras com a informação daquele trecho — se houver veredito de comparação, ele entra aqui), "conceito" (2-4 palavras genéricas do assunto visual, reutilizável entre episódios, ex.: "profilaxia dental", "implante osseointegração"), e "visual" (descrição em inglês, 1 frase, do que DESENHAR numa ilustração flat — objetos e instrumentos, sem texto, sem pessoas).
- FIDELIDADE: frases APENAS com informação presente no roteiro; nunca invente.

Responda APENAS com JSON válido:
{"segmentos":[{"tipo":"capa|cena|outro","inicio":"...","rotulo":"...","frase":"...","conceito":"...","visual":"..."}]}

TÍTULO DO ESTUDO: ${article?.titulo || ''}
ROTEIRO:
${String(roteiro || '').slice(0, 6000)}`;
}

async function segmentScript(roteiro, article, anthropicKey) {
  if (!anthropicKey) return null;
  const body = Buffer.from(JSON.stringify({
    model: SCENES_MODEL,
    max_tokens: 1200,
    messages: [{ role: 'user', content: buildSegmentPrompt(roteiro, article) }],
  }), 'utf8');

  const res = await request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'Content-Length': body.length,
      'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01',
    },
  }, body);
  if (res.status !== 200) {
    log.warn('[reel-scenes] segmentação falhou', { status: res.status });
    return null;
  }
  try {
    const json = JSON.parse(res.body);
    const text = (json.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const parsed = JSON.parse(text.replace(/^```json?\s*|\s*```$/g, ''));
    const segs = Array.isArray(parsed.segmentos) ? parsed.segmentos : null;
    if (!segs || segs.length < 3) return null;
    // Sanidade: 1º capa, último outro, meio só cenas.
    if (segs[0].tipo !== 'capa') segs[0].tipo = 'capa';
    if (segs[segs.length - 1].tipo !== 'outro') segs[segs.length - 1].tipo = 'outro';
    return segs;
  } catch (e) {
    log.warn('[reel-scenes] JSON inválido da segmentação', { err: e.message });
    return null;
  }
}

module.exports = { segmentScript, computeTimings, findBoundaries, conceptSlug, _norm: norm, _buildSegmentPrompt: buildSegmentPrompt };
