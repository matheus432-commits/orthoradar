const { request } = require('./_lib');


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
  return { exists: true };
}

async function sendWelcomeEmail(resendKey, nome, email, especialidade) {
  const firstName = nome.split(' ')[0];
  const esp = Array.isArray(especialidade) ? especialidade.join(', ') : especialidade;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">
<div style="background:#0b1120;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
<span style="font-size:1.4rem;font-weight:800;color:#0ea5e9;">OdontoFeed</span>
<p style="color:#94a3b8;font-size:0.78rem;margin:6px 0 0;letter-spacing:1px;text-transform:uppercase;">Bem-vindo(a)!</p>
</div>
<div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
<p style="color:#0f172a;font-size:1rem;">Olá, <strong>${firstName}</strong>! 🦷</p>
<p style="color:#334155;line-height:1.7;">Seu cadastro no <strong style="color:#0ea5e9;">OdontoFeed</strong> foi realizado com sucesso. A partir de amanhã às <strong>7h</strong>, você receberá um artigo científico de <strong style="color:#0ea5e9;">${esp}</strong> diretamente no seu email.</p>
<p style="color:#334155;line-height:1.7;">Os artigos são selecionados do PubMed e resumidos para facilitar a leitura — ciência odontológica atualizada, todos os dias, sem esforço.</p>
<div style="text-align:center;margin:28px 0;">
<a href="https://odontofeed.com/dashboard" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#06b6d4);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:0.95rem;">Acessar minha conta →</a>
</div>
</div>
<div style="background:#0b1120;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
<p style="color:#475569;font-size:0.78rem;margin:0;">OdontoFeed — Ciência odontológica direto para você</p>
</div>
</div>
</body></html>`;
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to: [email], subject: 'Bem-vindo(a) ao OdontoFeed! Seu primeiro artigo chega amanhã 🦷', html });
  const buf = Buffer.from(payload, 'utf8');
  return request({
    hostname: 'api.resend.com', path: '/emails', method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { nome, email, especialidade, temas, senhaHash } = body;

  if (!nome || !email || !especialidade || !temas || !temas.length || !senhaHash) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  const nomeTrimmed = nome.trim();
  if (nomeTrimmed.length < 3 || !nomeTrimmed.includes(' ')) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Informe seu nome completo (nome e sobrenome)' }) };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email invalido' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  try {
    const existing = await getUserByEmail(projectId, apiKey, email);
    if (existing) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'duplicado', message: 'Este email ja esta cadastrado!' }) };
    }

    const docId = await createUser(projectId, apiKey, {
      nome: nomeTrimmed,
      email,
      especialidade: Array.isArray(especialidade) ? especialidade : [especialidade],
      temas: Array.isArray(temas) ? temas : [temas],
      senhaHash,
      ativo: true,
      criadoEm: new Date().toISOString(),
      curtidos: [],
      lidos: []
    });

    console.log('Cadastro criado:', docId, email);
    if (resendKey) {
      sendWelcomeEmail(resendKey, nome, email, especialidade)
        .then(r => { if (r.status !== 200 && r.status !== 201) console.error('[Register] Welcome email failed:', r.status, r.body.substring(0, 100)); })
        .catch(e => console.error('[Register] Welcome email error:', e.message));
    }
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Cadastro realizado com sucesso!', id: docId }) };
  } catch (err) {
    console.error('Register error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
