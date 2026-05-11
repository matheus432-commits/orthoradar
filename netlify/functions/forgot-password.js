const { request, corsHeaders, preflight } = require('./_lib');
const crypto = require('crypto');


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
  const f = docs[0].document.fields || {};
  return {
    docId: docs[0].document.name.split('/').pop(),
    nome: f.nome?.stringValue || ''
  };
}

async function saveResetToken(projectId, apiKey, docId, token, expiry) {
  const body = JSON.stringify({
    fields: { resetToken: { stringValue: token }, resetTokenExpiry: { stringValue: expiry } }
  });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
      '?updateMask.fieldPaths=resetToken&updateMask.fieldPaths=resetTokenExpiry&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

async function sendResetEmail(resendKey, nome, email, token) {
  const firstName = nome.split(' ')[0] || 'Dentista';
  const resetUrl = 'https://odontofeed.com/dashboard?reset=' + token + '&resetEmail=' + encodeURIComponent(email);
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
<span style="font-size:1.4rem;font-weight:800;color:#0ea5e9;">OdontoFeed</span>
<p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Recuperação de senha</p>
</div>
<div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
<p style="color:#0f172a;font-size:1rem;">Olá, <strong>${firstName}</strong>!</p>
<p style="color:#334155;line-height:1.7;margin:16px 0;">Recebemos uma solicitação para redefinir a senha da sua conta no OdontoFeed. Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
<div style="text-align:center;margin:28px 0;">
<a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;">Redefinir minha senha →</a>
</div>
<p style="color:#94a3b8;font-size:0.82rem;text-align:center;">Se você não solicitou a redefinição, ignore este e-mail. Sua senha permanece a mesma.</p>
</div>
<div style="background:#0b1120;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
<p style="color:#475569;font-size:0.78rem;margin:0;">OdontoFeed — Ciência odontológica direto para você</p>
</div>
</div>
</body></html>`;
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to: [email], subject: 'Redefinição de senha — OdontoFeed', html });
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
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email obrigatorio' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  // Always return 200 to avoid leaking whether the email is registered
  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000).toISOString();
      await saveResetToken(projectId, apiKey, user.docId, token, expiry);
      if (resendKey) {
        const emailRes = await sendResetEmail(resendKey, user.nome, email, token);
        if (emailRes.status === 200 || emailRes.status === 201) {
          console.log('[ForgotPw] Reset email sent to:', email);
        } else {
          console.error('[ForgotPw] Reset email failed:', emailRes.status, emailRes.body.substring(0, 100));
        }
      }
    }
  } catch (err) {
    console.error('Forgot password error:', err);
  }
  return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Se o e-mail estiver cadastrado, você receberá o link em instantes.' }) };
};
