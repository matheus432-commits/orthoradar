// Programa "Indique um colega" — dados do link e do progresso do usuário.
//
// GET /.netlify/functions/get-referral?email=...  (Authorization: Bearer <token>)
// Retorna o refCode, o link pronto para compartilhar, o total de indicações
// válidas e o progresso rumo ao próximo mês grátis de Premium.
//
// Auto-cura: se o usuário ainda não tem refCode (cadastro antigo), gera e grava
// um agora. O total de indicações é contado pela query referredBy==refCode
// (fonte de verdade), então o número é sempre correto mesmo que o contador
// gravado tenha divergido.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { gerarRefCode, calcularBonus, linkDe } = require('./_lib/referral');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const email = event.queryStringParameters && event.queryStringParameters.email;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  if (!email || !token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email e token obrigatorios' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const db = new Firestore(projectId, apiKey);

  try {
    const found = await db.query('cadastros', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1,
    });
    const user = found[0];
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };

    // Sessão válida (mesmo esquema do get-user-data).
    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida. Faca login novamente.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada. Faca login novamente.' }) };
    }

    // Backfill do refCode para cadastros antigos.
    let refCode = user.refCode;
    if (!refCode) {
      refCode = gerarRefCode();
      await db.updateDoc('cadastros', user.id, { refCode }).catch(e => console.warn('[get-referral] backfill refCode falhou:', e.message));
    }

    // Fonte de verdade: conta quem se cadastrou com referredBy == refCode.
    let indicacoes = Number(user.indicacoes) || 0;
    try {
      const filhos = await db.query('cadastros', {
        where: { fieldFilter: { field: { fieldPath: 'referredBy' }, op: 'EQUAL', value: { stringValue: refCode } } },
        select: { fields: [{ fieldPath: 'email' }] },
        limit: 500,
      });
      indicacoes = filhos.length;
      // Mantém o contador gravado em sincronia (sem bloquear a resposta).
      if (indicacoes !== (Number(user.indicacoes) || 0)) {
        db.updateDoc('cadastros', user.id, { indicacoes }).catch(() => {});
      }
    } catch (e) {
      console.warn('[get-referral] contagem por query falhou, usando contador gravado:', e.message);
    }

    const bonus = calcularBonus(indicacoes);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        refCode,
        link: linkDe(refCode),
        ...bonus,
      }),
    };
  } catch (err) {
    console.error('get-referral error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno. Tente novamente.' }) };
  }
};
