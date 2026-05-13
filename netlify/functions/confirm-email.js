const { request } = require('./_lib');
const crypto = require('crypto');

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

function htmlPage(title, body, isError) {
  const color = isError ? '#ef4444' : '#10b981';
  const icon = isError ? '✗' : '✓';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} — OdontoFeed</title>
<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Inter,Helvetica,Arial,sans-serif;background:#0b1120;color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.card{background:#131f35;border:1px solid #2a3f5f;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center;}
.icon{width:64px;height:64px;border-radius:50%;background:${color}22;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 24px;}
h1{font-size:1.4rem;font-weight:800;margin-bottom:12px;}p{color:#94a3b8;line-height:1.7;margin-bottom:24px;}
a{display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:0.95rem;}
</style></head><body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1>${body}</div></body></html>`;
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
    emailConfirmToken: f.emailConfirmToken?.stringValue || '',
    emailVerificado: f.emailVerificado?.booleanValue
  };
}

async function patchUser(projectId, apiKey, docId, fields) {
  const firestoreFields = {};
  const masks = [];
  for (const [k, v] of Object.entries(fields)) {
    masks.push('updateMask.fieldPaths=' + k);
    if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else firestoreFields[k] = { stringValue: String(v) };
  }
  const body = JSON.stringify({ fields: firestoreFields });
  const buf = Buffer.from(body, 'utf8');
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks.join('&') + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const { token, email } = event.queryStringParameters || {};
  const siteUrl = process.env.SITE_URL || 'https://odontofeed.com';

  if (!token || !email) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage('Link inválido', '<p>O link de confirmação é inválido ou está incompleto.</p><a href="' + siteUrl + '">Voltar ao site</a>', true)
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);

    if (!user) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: htmlPage('Link inválido', '<p>O link de confirmação é inválido ou já expirou.</p><a href="' + siteUrl + '">Voltar ao site</a>', true)
      };
    }

    if (user.emailVerificado === true) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: htmlPage('Email já confirmado', '<p>Seu email já foi confirmado anteriormente. Você já pode acessar sua conta normalmente.</p><a href="' + siteUrl + '/dashboard">Acessar minha conta</a>', false)
      };
    }

    if (!tokenEqual(user.emailConfirmToken, token)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: htmlPage('Link expirado ou inválido', '<p>Este link de confirmação é inválido ou já expirou. Acesse sua conta e solicite um novo link.</p><a href="' + siteUrl + '/dashboard">Acessar minha conta</a>', true)
      };
    }

    await patchUser(projectId, apiKey, user.docId, { emailVerificado: true, emailConfirmToken: '' });
    console.log('[ConfirmEmail] Verified:', email);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage('Email confirmado!', '<p>Sua conta está ativa. A partir de agora você receberá artigos científicos conforme seu plano.</p><a href="' + siteUrl + '/dashboard">Acessar minha conta →</a>', false)
    };
  } catch (err) {
    console.error('[ConfirmEmail] Error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: htmlPage('Erro interno', '<p>Ocorreu um erro. Tente novamente ou entre em contato com o suporte.</p><a href="' + siteUrl + '">Voltar ao site</a>', true)
    };
  }
};
