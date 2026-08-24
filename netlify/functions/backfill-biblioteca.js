// POST /api/admin/backfill-biblioteca — Fase 3 da spec 2 (24/08).
//
// Body JSON: { dry_run?: true, limit?: 3, especialidade?, data_de?, data_ate? }
//
// Numa invocação de Netlify Function (~26s) cabem só ~2-3 gerações de áudio
// (roteiro + TTS + upload) — o limit aqui é travado em 3; o backfill de
// verdade roda pelo workflow "Backfill Biblioteca" (GitHub Actions).
// DRY-RUN por padrão: lista candidatos + custo estimado, sem gerar nada.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { backfillBiblioteca } = require('./_lib/backfill-biblioteca');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autorizado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const dryRun = body.dry_run !== false;

  // Geração real dentro da function: reusa o MESMO caminho do script.
  let gerar;
  if (!dryRun) {
    const { generateScript } = require('./_lib/podcast-script');
    const { synthesizeLong } = require('./_lib/tts');
    const { uploadMp3 } = require('./_lib/storage');
    const { mp3DurationSecs } = require('./_lib/mp3');
    gerar = async (a) => {
      const pmid = String(a.pmid || a.id || '');
      const roteiro = await generateScript(a, a.especialidade, process.env.ANTHROPIC_API_KEY, { strict: true });
      if (!roteiro) throw new Error('roteiro sem fidelidade confirmada');
      const tts = await synthesizeLong(db, { text: roteiro });
      if (!tts.ok) throw new Error('TTS: ' + tts.reason);
      const audio = Buffer.from(tts.audioBase64, 'base64');
      const secs = mp3DurationSecs(audio);
      if (secs < 40) throw new Error('áudio curto (' + secs + 's)');
      const objectPath = `podcasts/backfill/${pmid}-${Date.now()}.mp3`;
      const up = await uploadMp3(objectPath, audio);
      if (!up.ok) throw new Error('upload: ' + up.reason);
      await db.setDoc('podcast_arquivo', `backfill-${pmid}`, {
        artigoId: pmid, objectPath, downloadToken: up.downloadToken, bytes: audio.length, secs,
        roteiro, titulo: a.titulo_pt || '', especialidade: a.especialidade || '',
        date: String(a.data || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        tipo: 'resumo', origem: 'backfill-biblioteca', criadoEm: new Date().toISOString(),
      });
    };
  }

  try {
    const rel = await backfillBiblioteca(db, {
      dryRun,
      limit: Math.min(Number(body.limit) > 0 ? Number(body.limit) : 3, 3), // teto da function
      especialidade: body.especialidade || undefined,
      dataDe: body.data_de || undefined,
      dataAte: body.data_ate || undefined,
      gerar,
      pausaMs: 0,
    });
    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify(rel) };
  } catch (err) {
    log.error('[backfill-biblioteca] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
