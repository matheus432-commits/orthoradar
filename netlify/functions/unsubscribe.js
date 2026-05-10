const { request } = require('./_lib');
const crypto = require('crypto');

// HTTP helper

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
  return { docId: docs[0].document.name.split('/').pop() };
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

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'text/html; charset=utf-8' };
  const { email, t } = event.queryStringParameters || {};
  if (!email || !t) {
    return { statusCode: 400, headers, body: errorPage('Link invalido', 'O link de cancelamento esta incompleto ou expirado.') };
  }
  const expectedToken = crypto.createHmac('sha256', process.env.UNSUBSCRIBE_SECRET || 'unsub').update(email).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(t, 'hex'), Buffer.from(expectedToken, 'hex'))) {
    return { statusCode: 403, headers, body: errorPage('Link invalido', 'Este link de cancelamento e invalido.') };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) {
      return { statusCode: 404, headers, body: errorPage('Email nao encontrado', 'Este email nao esta cadastrado.') };
    }
    await updateUser(projectId, apiKey, user.docId, {
      ativo: false,
      canceladoEm: new Date().toISOString(),
      motivoCancelamento: 'unsubscribe_link'
    });
    console.log('Unsubscribed:', email);
    return { statusCode: 200, headers, body: successPage(email) };
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return { statusCode: 500, headers, body: errorPage('Erro interno', 'Nao foi possivel processar seu cancelamento.') };
  }
};

function successPage(email) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Cancelamento confirmado</title><style>body{font-family:Arial,sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;margin:0}.card{background:#0d1a2e;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center}h1{font-size:24px;margin-bottom:12px}p{color:rgba(255,255,255,0.6);line-height:1.6}.email{color:rgba(255,255,255,0.4);font-size:14px;margin:16px 0;padding:10px 16px;background:rgba(255,255,255,0.05);border-radius:8px}.btn{display:inline-block;margin-top:28px;padding:14px 32px;background:#00d4ff;color:#000;font-weight:700;border-radius:100px;text-decoration:none}</style></head><body><div class="card"><div style="font-size:48px;margin-bottom:20px">Cancelamento confirmado</div><h1>Feito!</h1><p>Voce foi removido da lista de envios do OdontoFeed.</p><div class="email">' + email + '</div><a href="https://odontofeed.com" class="btn">Voltar ao site</a></div></body></html>';
}

function errorPage(titulo, mensagem) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Erro</title><style>body{font-family:Arial,sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;margin:0}.card{background:#0d1a2e;border-radius:20px;padding:48px 40px;max-width:480px;width:100%;text-align:center}h1{font-size:24px;margin-bottom:12px}p{color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:24px}.btn{display:inline-block;padding:14px 32px;background:#00d4ff;color:#000;font-weight:700;border-radius:100px;text-decoration:none}</style></head><body><div class="card"><h1>' + titulo + '</h1><p>' + mensagem + '</p><a href="https://odontofeed.com" class="btn">Voltar ao site</a></div></body></html>';
}
