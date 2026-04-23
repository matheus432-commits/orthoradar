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

// Firestore: check if email exists
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
  return { ativo: f.ativo && f.ativo.booleanValue === true };
}

// Firestore: create new user document
async function createUser(projectId, apiKey, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (v === null) fields[k] = { nullValue: null };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: i })) } };
    else fields[k] = { stringValue: String(v) };
  }
  const body = JSON.stringify({ fields });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros?key=' + apiKey,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) throw new Error('Firestore create failed: ' + res.body);
  const doc = JSON.parse(res.body);
  return doc.name.split('/').pop();
}

// Send email via Resend
async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to: [to], subject, html });
  const buf = Buffer.from(payload, 'utf8');
  return request({
    hostname: 'api.resend.com',
    path: '/emails',
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) };
  }
  const { nome, email, especialidade, temas } = body;
  if (!nome || !email || !especialidade || !temas || !temas.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email invalido' }) };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  try {
    const existing = await getUserByEmail(projectId, apiKey, email);
    if (existing) {
      if (existing.ativo === false) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'reativacao', message: 'Este email estava cancelado. Entre em contato para reativar.' }) };
      }
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'duplicado', message: 'Este email ja esta cadastrado!' }) };
    }
    const verifyToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const docId = await createUser(projectId, apiKey, {
      nome, email, especialidade,
      temas: temas.join(','),
      ativo: false,
      verificado: false,
      verifyToken,
      criadoEm: new Date().toISOString(),
      ultimoArtigo: null
    });
    console.log('Cadastro criado:', docId, email);
    const verifyUrl = 'https://odontofeed.com/.netlify/functions/verify?email=' + encodeURIComponent(email) + '&token=' + verifyToken;
    const temasLista = temas.slice(0, 5).map(t => '<li>' + t + '</li>').join('');
    const emailHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;font-family:Arial,sans-serif;padding:40px 16px;"><div style="max-width:600px;margin:0 auto;background:#0d1a2e;border-radius:20px;overflow:hidden;"><div style="background:#001a2e;padding:32px 40px;text-align:center;"><div style="font-size:28px;font-weight:900;color:#00d4ff;">OdontoFeed</div></div><div style="padding:40px;"><h1 style="color:#fff;font-size:22px;text-align:center;">Confirme seu email</h1><p style="color:rgba(255,255,255,0.6);text-align:center;">Ola, <strong style="color:#fff;">' + nome + '</strong>! Clique abaixo para ativar sua conta.</p><div style="text-align:center;margin:32px 0;"><a href="' + verifyUrl + '" style="display:inline-block;background:#00d4ff;color:#000;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;">Confirmar meu email</a></div><div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:20px;"><div style="color:#00d4ff;font-size:14px;">Especialidade: <strong style="color:#fff;">' + especialidade + '</strong></div><ul style="color:rgba(255,255,255,0.8);font-size:14px;margin:8px 0 0;padding-left:16px;">' + temasLista + '</ul></div></div></div></body></html>';
    await sendEmail(resendKey, email, 'Confirme seu email para ativar o OdontoFeed', emailHtml);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Cadastro realizado! Verifique seu email para ativar a conta.', id: docId }) };
  } catch (err) {
    console.error('Register error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
