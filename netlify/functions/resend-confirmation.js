const { request, corsHeaders, preflight } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function getUserByEmail(projectId, apiKey, email) {
  const body = JSON.stringify({
    structuredQuery: {
      from: [{ collectionId: 'cadastros' }],
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      limit: 1
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) return null;
  const docs = JSON.parse(res.body);
  if (!docs[0] || !docs[0].document) return null;
  const doc = docs[0].document;
  const f = doc.fields || {};
  return {
    docId: doc.name.split('/').pop(),
    nome: f.nome?.stringValue || '',
    sessionToken: f.sessionToken?.stringValue || '',
    sessionExpiry: f.sessionExpiry?.stringValue || '',
    emailVerificado: f.emailVerificado?.booleanValue,
    ultimoReenvio: f.ultimoReenvioConfirmacao?.stringValue || ''
  };
}

async function patchToken(projectId, apiKey, docId, token) {
  const now = new Date().toISOString();
  const body = JSON.stringify({ fields: {
    emailConfirmToken: { stringValue: token },
    ultimoReenvioConfirmacao: { stringValue: now }
  }});
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?updateMask.fieldPaths=emailConfirmToken&updateMask.fieldPaths=ultimoReenvioConfirmacao&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

async function sendConfirmationEmail(resendKey, nome, email, token) {
  const firstName = nome.split(' ')[0];
  const siteUrl = process.env.SITE_URL || 'https://odontofeed.com';
  const confirmUrl = siteUrl + '/.netlify/functions/confirm-email?token=' + token + '&email=' + encodeURIComponent(email);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
<span style="font-size:1.4rem;font-weight:800;color:#0ea5e9;">OdontoFeed</span>
<p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Confirme seu email</p>
</div>
<div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
<p style="color:#0f172a;font-size:1rem;">Olá, <strong>${firstName}</strong>! 🦷</p>
<p style="color:#334155;line-height:1.7;">Você solicitou um novo link de confirmação de email para sua conta no <strong style="color:#0ea5e9;">OdontoFeed</strong>.</p>
<div style="text-align:center;margin:28px 0;">
<a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;">Confirmar meu email →</a>
</div>
<p style="color:#94a3b8;font-size:12px;text-align:center;">Se você não solicitou isso, ignore este email.</p>
</div>
<div style="background:#0b1120;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
<p style="color:#475569;font-size:0.78rem;margin:0;">OdontoFeed — Ciência odontológica direto para você</p>
</div>
</div>
</body></html>`;
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to: [email], subject: 'Novo link de confirmação — OdontoFeed', html });
  const buf = Buffer.from(payload, 'utf8');
  return request({
    hostname: 'api.resend.com', path: '/emails', method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!email || !token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuario nao encontrado' }) };
    if (!tokenEqual(user.sessionToken, token)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao invalida' }) };
    if (user.sessionExpiry && new Date(user.sessionExpiry).getTime() < Date.now()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessao expirada' }) };
    }
    if (user.emailVerificado === true) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Email ja confirmado.' }) };
    }

    const COOLDOWN_MS = 2 * 60 * 1000;
    if (user.ultimoReenvio && (Date.now() - new Date(user.ultimoReenvio).getTime()) < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(user.ultimoReenvio).getTime())) / 1000);
      return { statusCode: 429, headers, body: JSON.stringify({ error: `Aguarde ${secsLeft}s antes de solicitar um novo email.` }) };
    }

    const newToken = crypto.randomBytes(32).toString('hex');
    await patchToken(projectId, apiKey, user.docId, newToken);

    if (resendKey) {
      sendConfirmationEmail(resendKey, user.nome, email, newToken)
        .then(r => { if (r.status !== 200 && r.status !== 201) console.error('[ResendConfirm] Email failed:', r.status); })
        .catch(e => console.error('[ResendConfirm] Email error:', e.message));
    }

    console.log('[ResendConfirm] New token sent to:', email);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Email de confirmacao reenviado.' }) };
  } catch (err) {
    console.error('[ResendConfirm] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno' }) };
  }
};
