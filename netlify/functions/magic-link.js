const https = require('https');

// HTTP helper
function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Firestore: query user by email
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
    nome: (f.nome && f.nome.stringValue) || '',
    email: (f.email && f.email.stringValue) || '',
    verificado: f.verificado && f.verificado.booleanValue === true
  };
}

// Firestore: update magic token
async function saveMagicToken(projectId, apiKey, docId, token, expiry) {
  const body = JSON.stringify({
    fields: { magicToken: { stringValue: token }, magicTokenExpiry: { stringValue: expiry } }
  });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId +
          '?updateMask.fieldPaths=magicToken&updateMask.fieldPaths=magicTokenExpiry&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status === 200;
}

// Send email via Resend
async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to, subject, html });
  const buf = Buffer.from(payload, 'utf8');
  return request({
    hostname: 'api.resend.com',
    path: '/emails',
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }
  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) };
  }
  const { email } = body;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email obrigatorio' }) };
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'E-mail nao encontrado. Cadastre-se primeiro.' }) };
    if (!user.verificado) return { statusCode: 403, headers, body: JSON.stringify({ error: 'E-mail ainda nao verificado.' }) };
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const tokenExpiry = new Date(Date.now() + 3600000).toISOString();
    await saveMagicToken(projectId, apiKey, user.docId, token, tokenExpiry);
    const loginUrl = 'https://odontofeed.com/dashboard?token=' + token + '&email=' + encodeURIComponent(email);
    const emailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;font-family:Arial,sans-serif;padding:40px 16px;"><div style="max-width:600px;margin:0 auto;background:#0d1a2e;border-radius:20px;overflow:hidden;"><div style="background:#001a2e;padding:32px 40px;text-align:center;"><div style="font-size:28px;font-weight:900;color:#00d4ff;">OdontoFeed</div></div><div style="padding:40px;"><h1 style="color:#fff;font-size:22px;text-align:center;">Seu link de acesso</h1><p style="color:rgba(255,255,255,0.6);text-align:center;">Ola, <strong style="color:#fff;">' + user.nome + '</strong>! Clique abaixo para entrar. O link expira em 1 hora.</p><div style="text-align:center;margin:32px 0;"><a href="' + loginUrl + '" style="display:inline-block;background:#00d4ff;color:#000;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;">Acessar minha conta</a></div><p style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">Se voce nao solicitou, ignore este e-mail.</p></div></div></body></html>';
    await sendEmail(resendKey, email, 'Seu link de acesso ao OdontoFeed', emailHtml);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Link de acesso enviado!' }) };
  } catch(err) {
    console.error('Magic link error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
