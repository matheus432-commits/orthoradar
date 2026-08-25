// ACADEMY — pacote de entrega (Etapa 8). GET ?email&id  (Bearer token).
//
// Devolve o ZIP (base64) com manuscrito DOCX+PDF, cover letter, checklist
// CARE preenchida, TCLE, declarações (com a declaração de IA do ICMJE) e o
// roteiro de submissão. Disponível a partir da escolha do periódico; antes
// disso devolve 409 com a pendência em linguagem clínica.

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { montarPacote } = require('./_lib/academy/pacote');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const _rl = rateLimited(event, 'academy-export', { max: 10, windowMs: 60000 }); if (_rl) return _rl;

  const qs = event.queryStringParameters || {};
  const email = String(qs.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };
    const p = await db.getDoc('academy_projetos', String(qs.id || '')).catch(() => null);
    if (!p || p.usuario_email !== email) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
    if (!p.periodico_alvo) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'pacote_indisponivel', message: 'O pacote fecha depois que você escolher o periódico — é ele que define formato e exigências.' }) };
    }

    // ── PAYWALL (diretriz 08/2026): o uso do Academy é gratuito; a EXPORTAÇÃO
    // é paga. O ZIP só sai com a exportação PAGA (fluxo: academy-exportacao.js
    // confirma com memória de cálculo → pagamento confirma → download).
    const exportacao = await db.getDoc('academy_exportacoes', String(qs.id || '')).catch(() => null);
    if (!exportacao || exportacao.status !== 'paga') {
      return {
        statusCode: 402, headers,
        body: JSON.stringify({
          error: 'exportacao_nao_paga',
          status: exportacao ? exportacao.status : 'nao_confirmada',
          message: 'A construção do trabalho é gratuita; o download do pacote final é pago. Confirme a exportação para ver a memória de cálculo (assinantes têm crédito das mensalidades).',
        }),
      };
    }

    const zip = montarPacote(p);
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="odontofeed-academy-pacote.zip"',
        'Cache-Control': 'private, no-store',
      },
      body: zip.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    log.error('[academy-export] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
