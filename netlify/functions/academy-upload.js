// ACADEMY — upload de figuras com ANONIMIZAÇÃO POR PADRÃO (metadados EXIF/COM
// removidos antes de gravar; a interface avisa que anonimização VISUAL —
// tarjar rosto — é responsabilidade do autor e será conferida no pacote).
//
// POST { email, id, nome, base64 }  (Authorization: Bearer <token>)
// Limite 4 MB por figura; armazenamento no Firebase Storage do projeto,
// em academy/{projetoId}/figura-NN.

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { limparMetadadosJpeg } = require('./_lib/academy/imagem');
const { uploadImage } = require('./_lib/storage');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const _rl = rateLimited(event, 'academy-upload', { max: 20, windowMs: 60000 }); if (_rl) return _rl;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const email = String(body.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };
    const p = await db.getDoc('academy_projetos', String(body.id || '')).catch(() => null);
    if (!p || p.usuario_email !== email) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };

    const bruto = Buffer.from(String(body.base64 || ''), 'base64');
    if (!bruto.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'arquivo vazio' }) };
    if (bruto.length > 4 * 1024 * 1024) return { statusCode: 413, headers, body: JSON.stringify({ error: 'figura acima de 4 MB' }) };

    const limpa = limparMetadadosJpeg(bruto);
    const imagens = Array.isArray(p.imagens) ? p.imagens : [];
    const n = imagens.length + 1;
    const ehJpeg = limpa.tipo === 'jpeg';
    const objectPath = `academy/${p.id}/figura-${String(n).padStart(2, '0')}.${ehJpeg ? 'jpg' : 'png'}`;
    const up = await uploadImage(objectPath, limpa.buf, ehJpeg ? 'image/jpeg' : 'image/png');
    if (!up.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'upload_falhou' }) };

    imagens.push({ objectPath, downloadToken: up.downloadToken, legenda: '', anonimizada: true, metadadosRemovidos: limpa.removidos, em: new Date().toISOString() });
    await db.updateDoc('academy_projetos', String(p.id), { imagens, atualizado_em: new Date().toISOString() });

    return { statusCode: 200, headers, body: JSON.stringify({
      ok: true, indice: imagens.length - 1, objectPath,
      metadadosRemovidos: limpa.removidos,
      aviso: 'Metadados do arquivo removidos. Confira também a anonimização VISUAL (rosto, tatuagens, nome em radiografia) — isso é responsabilidade do autor.',
    }) };
  } catch (err) {
    log.error('[academy-upload] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
