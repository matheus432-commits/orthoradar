const crypto = require('crypto');
const { request, corsHeaders } = require('./_lib');

// Admin utility: set plano + clear ultimoEnvio for a user by email
// GET /.netlify/functions/admin-set-plan?secret=<ADMIN_SECRET>&email=<EMAIL>&plano=premium

const ALLOWED_PLANOS = new Set(['free', 'convencional', 'premium']);

async function getUserDoc(projectId, apiKey, email) {
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
    path: `/v1/projects/${projectId}/databases/(default)/documents:runQuery?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  if (res.status !== 200) throw new Error('Firestore query failed: ' + res.status);
  const docs = JSON.parse(res.body);
  if (!docs[0]?.document) return null;
  const doc = docs[0].document;
  const f = doc.fields || {};
  return {
    docId: doc.name.split('/').pop(),
    nome: f.nome?.stringValue || '',
    planoAtual: f.plano?.stringValue || 'free'
  };
}

async function patchUser(projectId, apiKey, docId, fields, masks) {
  const firestoreFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'string') firestoreFields[k] = { stringValue: v };
    else if (typeof v === 'boolean') firestoreFields[k] = { booleanValue: v };
  }
  const body = JSON.stringify({ fields: firestoreFields });
  const buf = Buffer.from(body, 'utf8');
  const maskQs = masks.map(m => `updateMask.fieldPaths=${m}`).join('&');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents/cadastros/${docId}?${maskQs}&key=${apiKey}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status;
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  const params = event.queryStringParameters || {};

  const secret = params.secret || '';
  const adminSecret = process.env.ADMIN_SECRET || '';
  let authorized = false;
  if (secret.length > 0 && secret.length === adminSecret.length) {
    try { authorized = crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret)); } catch {}
  }
  if (!authorized) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };

  const email = (params.email || '').trim().toLowerCase();
  const plano = (params.plano || '').trim().toLowerCase();

  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parâmetro email obrigatório' }) };
  if (!plano || !ALLOWED_PLANOS.has(plano)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Parâmetro plano inválido. Use: free, convencional ou premium' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserDoc(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado: ' + email }) };

    // Set plano and clear ultimoEnvio so they receive today
    const status = await patchUser(projectId, apiKey, user.docId,
      { plano, ultimoEnvio: '' },
      ['plano', 'ultimoEnvio']
    );

    if (status !== 200) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Firestore PATCH failed: ' + status }) };

    console.log(`[AdminSetPlan] ${email} | ${user.planoAtual} → ${plano}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        sucesso: true,
        usuario: user.nome || email,
        email,
        de: user.planoAtual,
        para: plano,
        obs: plano === 'premium' ? 'Receberá um artigo por dia sem cobrança.' : `Plano ${plano} ativado.`
      })
    };
  } catch (err) {
    console.error('[AdminSetPlan] Error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
