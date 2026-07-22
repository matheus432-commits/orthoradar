const { request } = require('./_lib');
const crypto = require('crypto');
const { validarEspecialidades } = require('./_lib/especialidades');

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
  const f = docs[0].document.fields || {};
  return {
    docId: docs[0].document.name.split('/').pop(),
    sessionToken: f.sessionToken?.stringValue || null,
    sessionExpiry: f.sessionExpiry?.stringValue || null,
    plano: f.plano?.stringValue || null
  };
}

async function updatePreferences(projectId, apiKey, docId, especialidade, temas) {
  const espValues = especialidade.map(e => ({ stringValue: e }));
  const temasValues = temas.map(t => ({ stringValue: t }));
  const body = JSON.stringify({
    fields: {
      especialidade: { arrayValue: { values: espValues } },
      temas: { arrayValue: { values: temasValues } }
    }
  });
  const buf = Buffer.from(body, 'utf8');
  const masks = 'updateMask.fieldPaths=especialidade&updateMask.fieldPaths=temas';
  return request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/' + projectId + '/databases/(default)/documents/cadastros/' + docId + '?' + masks + '&key=' + apiKey,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }

  const { email, token, especialidade } = body;
  if (!email || !token || !especialidade) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  }
  // Até 3 especialidades (diretriz 22/07/2026; recurso Premium — validado
  // adiante com o plano real do usuário). Temas são opcionais (curadoria por
  // tema é recurso Premium — lista vazia é válida).
  const temas = Array.isArray(body.temas) ? body.temas : [];
  const invalidTema = temas.find(t => typeof t !== 'string' || t.length < 3 || t.length > 120);
  if (invalidTema !== undefined) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tema inválido.' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const user = await getUserByEmail(projectId, apiKey, email);
    if (!user) return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado.' }) };
    if (!tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão inválida.' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão expirada.' }) };
    }
    // Teto pelo plano REAL do usuário (Premium: 3; Gratuito: 1) — validação no
    // servidor para o limite não depender do frontend.
    const valSpecs = validarEspecialidades(especialidade, user.plano);
    if (!valSpecs.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: valSpecs.error }) };
    }
    const res = await updatePreferences(projectId, apiKey, user.docId, valSpecs.especialidades, temas);
    if (res.status !== 200) throw new Error('Firestore update failed: ' + res.body);
    console.log('Preferences updated for:', email, '| specs:', valSpecs.especialidades.join(','), '| temas:', temas.length);
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Preferências atualizadas com sucesso!' }) };
  } catch (err) {
    console.error('Update preferences error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
