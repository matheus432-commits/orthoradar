const crypto = require('crypto');
const { request, corsHeaders } = require('./_lib');

// ONE-TIME MIGRATION: sets horarioEnvio = '10' (UTC = 7h BRT) for all users
// Call once via: GET /.netlify/functions/migrate-horario?secret=<ADMIN_SECRET>
// Delete this file after running.

async function listAllUsers(projectId, apiKey) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = `pageSize=300&key=${apiKey}&mask.fieldPaths=horarioEnvio&mask.fieldPaths=email` + (pageToken ? `&pageToken=${pageToken}` : '');
    const res = await request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/cadastros?${qs}`,
      method: 'GET'
    });
    if (res.status !== 200) throw new Error('Firestore list failed: ' + res.status);
    const json = JSON.parse(res.body);
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);
  return docs;
}

async function patchHorario(projectId, apiKey, docId) {
  const body = JSON.stringify({ fields: { horarioEnvio: { stringValue: '10' } } });
  const buf = Buffer.from(body, 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents/cadastros/${docId}?updateMask.fieldPaths=horarioEnvio&key=${apiKey}`,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
  }, buf);
  return res.status;
}

exports.handler = async (event) => {
  const headers = corsHeaders();
  const secret = (event.queryStringParameters || {}).secret || '';
  const adminSecret = process.env.ADMIN_SECRET || '';
  let authorized = false;
  if (secret.length > 0 && secret.length === adminSecret.length) {
    try { authorized = crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret)); } catch {}
  }
  if (!authorized) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    const dry = (event.queryStringParameters || {}).dry === '1';
    const docs = await listAllUsers(projectId, apiKey);
    let updated = 0, skipped = 0, errors = 0;
    const log = [];

    for (const doc of docs) {
      const f = doc.fields || {};
      const docId = doc.name.split('/').pop();
      const email = f.email?.stringValue || docId;
      const currentHorario = f.horarioEnvio?.stringValue || f.horarioEnvio?.integerValue || null;
      const utcVal = currentHorario != null ? parseInt(currentHorario, 10) : null;
      const brtVal = utcVal != null ? ((utcVal - 3 + 24) % 24) + 'h Brasília' : '(padrão 7h)';

      if (!dry && (currentHorario === '10' || currentHorario === 10)) {
        skipped++;
        log.push({ email, horario: '7h Brasília (já correto)' });
        continue;
      }

      if (dry) {
        log.push({ email, horario_atual: brtVal, utc_atual: utcVal ?? 10 });
        continue;
      }

      const status = await patchHorario(projectId, apiKey, docId);
      if (status === 200) {
        updated++;
        log.push({ email, de: brtVal, para: '7h Brasília' });
      } else {
        errors++;
        log.push({ email, erro: 'status ' + status });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ modo: dry ? 'consulta (sem alterações)' : 'migração', total: docs.length, updated, skipped, errors, log }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
