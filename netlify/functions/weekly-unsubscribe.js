// Opt-out handler for the weekly "O Que Ficou" digest.
// Sets weeklyDigestOptOut: true in the user's cadastros document without
// cancelling the daily digest subscription.
//
// GET /.netlify/functions/weekly-unsubscribe?email={email}&token={hmac}
//
// Token: HMAC-SHA256('weekly:' + email, UNSUBSCRIBE_SECRET) — different prefix
// from the main unsubscribe token, so tokens are not interchangeable.

const crypto        = require('crypto');
const { Firestore } = require('./_lib/firestore');
const log           = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com.br';

function tokenValid(email, token) {
  if (!email || !token || !/^[a-f0-9]{64}$/i.test(token)) return false;
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) { console.error('[weekly-unsubscribe] UNSUBSCRIBE_SECRET nao configurado'); return false; }
  const expected = crypto.createHmac('sha256', secret).update('weekly:' + email).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token)); }
  catch { return false; }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function confirmHtml(email) {
  const e = esc(email);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Prefer&ecirc;ncia atualizada &mdash; OdontoFeed</title>
</head>
<body style="margin:0;padding:48px 16px;background:#EDE8DF;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:#FDFAF5;border:1px solid #E0D8CC;
              border-radius:4px;padding:40px 36px;">
    <div style="font-size:18px;font-weight:700;color:#1A1A18;
                font-family:Georgia,'Times New Roman',serif;">
      OdontoFeed<span style="color:#B08968;">.</span>
    </div>
    <p style="font-size:15px;color:#4A4540;margin:24px 0 8px;font-weight:600;">
      Prefer&ecirc;ncia salva.
    </p>
    <p style="font-size:13px;color:#6B665E;line-height:1.7;margin:0 0 24px;">
      Voc&ecirc; n&atilde;o receber&aacute; mais os resumos semanais em <strong>${e}</strong>.<br>
      Seu digest di&aacute;rio permanece ativo normalmente.
    </p>
    <a href="${BASE_URL}"
       style="background:#B08968;color:#FFFFFF;font-size:13px;font-weight:600;
              text-decoration:none;padding:10px 24px;border-radius:2px;display:inline-block;">
      Acessar OdontoFeed
    </a>
  </div>
</body>
</html>`;
}

function errorHtml(message) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Link inv&aacute;lido &mdash; OdontoFeed</title>
</head>
<body style="margin:0;padding:48px 16px;background:#EDE8DF;text-align:center;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FDFAF5;border:1px solid #E0D8CC;
              border-radius:4px;padding:40px 36px;">
    <div style="font-size:18px;font-weight:700;color:#1A1A18;
                font-family:Georgia,'Times New Roman',serif;">
      OdontoFeed<span style="color:#B08968;">.</span>
    </div>
    <p style="font-size:14px;color:#6B665E;margin:24px 0;">${esc(message)}</p>
  </div>
</body>
</html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const qs    = event.queryStringParameters || {};
  const email = (qs.email || '').trim().toLowerCase();
  const token = (qs.token || '').trim();

  if (!tokenValid(email, token)) {
    log.warn('[weekly-unsubscribe] invalid token', { email });
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body:    errorHtml('Link inválido ou expirado. Verifique o link no seu email.'),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' },
             body: errorHtml('Serviço temporariamente indisponível.') };
  }

  const db = new Firestore(projectId, apiKey);

  try {
    // Query cadastros by email to get the doc ID, then update it
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'email' }] },
      limit:  1,
    });

    if (users.length) {
      await db.updateDoc('cadastros', users[0].id, { weeklyDigestOptOut: true });
      log.info('[weekly-unsubscribe] opted out', { email });
    } else {
      log.warn('[weekly-unsubscribe] user not found in cadastros', { email });
    }
  } catch (err) {
    log.warn('[weekly-unsubscribe] update failed', { email, err: err.message });
    // Show success page anyway — the user's intent is clear and they should not retry
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    body:    confirmHtml(email),
  };
};
