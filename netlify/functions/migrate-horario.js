const crypto = require('crypto');
const { request, corsHeaders } = require('./_lib');

// ONE-TIME MIGRATION + DIAGNOSTIC: sets horarioEnvio = '10' (UTC = 7h BRT) for all users
// ?secret=<ADMIN_SECRET>&dry=1  → só consulta (sem alterações)
// ?secret=<ADMIN_SECRET>        → aplica migração
// Delete this file after running.

async function listAllUsers(projectId, apiKey) {
  const docs = [];
  let pageToken = null;
  do {
    const fields = ['horarioEnvio','email','plano','ultimoEnvio','emailVerificado','nome'].map(f => `mask.fieldPaths=${f}`).join('&');
    const qs = `pageSize=300&key=${apiKey}&${fields}` + (pageToken ? `&pageToken=${pageToken}` : '');
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

function shouldSendToday(plano, ultimoEnvio) {
  if (plano === 'premium') return true;
  const daysSinceLast = ultimoEnvio
    ? (Date.now() - new Date(ultimoEnvio).getTime()) / 86400000
    : Infinity;
  if (plano === 'convencional') return daysSinceLast >= 7;
  return daysSinceLast >= 30;
}

function proximoEnvio(plano, ultimoEnvio) {
  if (plano === 'premium') return 'todo dia';
  const threshold = plano === 'convencional' ? 7 : 30;
  if (!ultimoEnvio) return 'hoje (nunca enviado)';
  const lastMs = new Date(ultimoEnvio).getTime();
  const nextMs = lastMs + threshold * 86400000;
  const diffDays = Math.ceil((nextMs - Date.now()) / 86400000);
  if (diffDays <= 0) return 'hoje (prazo atingido)';
  return `em ${diffDays} dia(s)`;
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
    const usuarios = [];

    for (const doc of docs) {
      const f = doc.fields || {};
      const docId = doc.name.split('/').pop();
      const email = f.email?.stringValue || docId;
      const nome = f.nome?.stringValue || '(sem nome)';
      const plano = f.plano?.stringValue || 'free';
      const ultimoEnvio = f.ultimoEnvio?.stringValue || '';
      const emailVerificado = f.emailVerificado?.booleanValue !== false;
      const currentHorario = f.horarioEnvio?.stringValue || f.horarioEnvio?.integerValue || null;
      const utcVal = currentHorario != null ? parseInt(currentHorario, 10) : 10;
      const brtVal = ((utcVal - 3 + 24) % 24) + 'h Brasília';

      const apto = emailVerificado && shouldSendToday(plano, ultimoEnvio);
      const proximo = proximoEnvio(plano, ultimoEnvio);

      if (dry) {
        usuarios.push({
          nome, email,
          plano,
          horario_envio: brtVal,
          email_verificado: emailVerificado,
          ultimo_envio: ultimoEnvio || '(nunca)',
          proximo_envio: proximo,
          apto_para_envio_agora: apto
        });
        continue;
      }

      if (currentHorario === '10' || currentHorario === 10) {
        skipped++;
        usuarios.push({ nome, email, horario: brtVal, acao: 'já correto (ignorado)' });
        continue;
      }

      const status = await patchHorario(projectId, apiKey, docId);
      if (status === 200) {
        updated++;
        usuarios.push({ nome, email, de: brtVal, para: '7h Brasília', acao: 'atualizado' });
      } else {
        errors++;
        usuarios.push({ nome, email, erro: 'status ' + status });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        modo: dry ? 'diagnóstico (sem alterações)' : 'migração aplicada',
        total: docs.length,
        ...(dry ? {} : { updated, skipped, errors }),
        usuarios
      }, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

