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
    especialidade: (f.especialidade && f.especialidade.stringValue) || '',
    temas: (f.temas && f.temas.stringValue) || '',
    verificado: f.verificado && f.verificado.booleanValue === true,
    verifyToken: (f.verifyToken && f.verifyToken.stringValue) || null
  };
}

// Firestore: update user document fields
async function updateUser(projectId, apiKey, docId, fields) {
  const firestoreFields = {};
  const masks = [];
  for (const [k, v] of Object.entries(fields)) {
    masks.push(k);
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
    else if (v === null) firestoreFields[k] = { nullValue: null };
    else firestoreFields[k] = { stringValue: String(v) };
  }
  const body = JSON.stringify({ fields: firestoreFields });
  const buf = Buffer.from(body, 'utf8');
  const maskQuery = masks.map(m => 'updateMask.fieldPaths=' + m).join('&');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + maskQuery + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status === 200;
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
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/html; charset=utf-8' };
  const { email, token } = event.queryStringParameters || {};
  if (!email || !token) {
    return { statusCode: 400, headers, body: errorPage('Link invalido', 'O link de verificacao esta incompleto.') };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: errorPage('Email nao encontrado', 'Este email nao esta cadastrado.') };
    if (user.verificado) return { statusCode: 200, headers, body: alreadyVerifiedPage(user.nome) };
    if (user.verifyToken !== token) return { statusCode: 400, headers, body: errorPage('Link invalido', 'Este link e invalido ou expirou.') };
    await updateUser(projectId, apiKey, user.docId, { verificado: true, ativo: true, verificadoEm: new Date().toISOString(), verifyToken: null });
    console.log('Email verified:', email);
    const welcomeHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;font-family:Arial,sans-serif;padding:40px 16px;"><div style="max-width:600px;margin:0 auto;background:#0d1a2e;border-radius:20px;overflow:hidden;"><div style="background:#001a2e;padding:32px 40px;text-align:center;"><div style="font-size:28px;font-weight:900;color:#00d4ff;">OdontoFeed</div></div><div style="padding:40px;"><h1 style="color:#fff;font-size:22px;text-align:center;">Bem-vindo ao OdontoFeed!</h1><p style="color:rgba(255,255,255,0.6);text-align:center;">Ola, Dr(a). <strong style="color:#fff;">' + user.nome + '</strong>! Sua conta foi ativada. A partir de amanha recebera seu primeiro artigo cientifico.</p></div></div></body></html>';
    await sendEmail(resendKey, email, 'Conta ativada! Seu primeiro artigo chega amanha', welcomeHtml);
    return { statusCode: 200, headers, body: successPage(user.nome, user.especialidade) };
  } catch (err) {
    console.error('Verify error:', err);
    return { statusCode: 500, headers, body: errorPage('Erro interno', 'Nao foi possivel verificar seu email.') };
  }
};

function successPage(nome, especialidade) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;color:#fff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;margin:0;"><div style="background:#0d1a2e;border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center;"><h1 style="color:#fff;">Conta ativada!</h1><p style="color:rgba(255,255,255,0.6);line-height:1.6;">Bem-vindo, Dr(a). <strong style="color:#fff;">' + nome + '</strong>! Voce recebera artigos de <strong style="color:#00d4ff;">' + especialidade + '</strong> todos os dias.</p><a href="https://odontofeed.com" style="display:block;background:#00d4ff;color:#000;font-weight:800;font-size:16px;padding:16px 32px;border-radius:100px;text-decoration:none;margin-top:28px;text-align:center;">Ir para o OdontoFeed</a></div></body></html>';
}

function alreadyVerifiedPage(nome) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;color:#fff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;margin:0;"><div style="background:#0d1a2e;border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center;"><h1 style="color:#fff;">Email ja verificado</h1><p style="color:rgba(255,255,255,0.6);">Ola, Dr(a). ' + nome + '! Sua conta ja esta ativa.</p><a href="https://odontofeed.com" style="display:inline-block;background:#00d4ff;color:#000;padding:14px 32px;border-radius:100px;font-weight:700;text-decoration:none;margin-top:24px;">Ir para o OdontoFeed</a></div></body></html>';
}

function errorPage(titulo, mensagem) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="background:#0a0a1a;color:#fff;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;margin:0;"><div style="background:#0d1a2e;border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center;"><h1 style="color:#fff;">' + titulo + '</h1><p style="color:rgba(255,255,255,0.6);">' + mensagem + '</p><a href="https://odontofeed.com" style="display:inline-block;background:#00d4ff;color:#000;padding:14px 32px;border-radius:100px;font-weight:700;text-decoration:none;margin-top:24px;">Voltar ao site</a></div></body></html>';
}
