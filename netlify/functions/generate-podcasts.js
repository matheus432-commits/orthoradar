// Geração diária dos podcasts Pro — 1 áudio por especialidade que tenha ao menos
// um assinante Pro ativo. Roda no pipeline (GitHub Actions) após o digest.
//
// Fluxo por especialidade (SEQUENCIAL — exigência do orçamento de TTS):
//   artigo do dia → roteiro (Claude) → TTS Standard (com guardrail) →
//   upload/rotação no Storage → metadados em `podcasts/{slug}`.
//
// Protegido por lock (podcast_lock) contra execuções concorrentes — o contador
// de orçamento é read-modify-write, então dois runs simultâneos poderiam gastar
// em dobro. Se faltar GOOGLE_TTS_API_KEY / credenciais do Storage, cada etapa é
// pulada sem quebrar o pipeline.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { isPro } = require('./_lib/plans');
const { generateScript } = require('./_lib/podcast-script');
const { synthesize } = require('./_lib/tts');
const { uploadMp3, deleteObject } = require('./_lib/storage');
const { billableChars } = require('./_lib/tts-budget');
const { specialtySlug: slug } = require('./_lib/slug');
const { acquireLock, releaseLock } = require('./_lib/pipeline-lock');
const log = require('./_lib/logger');

const LOCK = 'podcast_lock';

// Especialidades distintas entre os assinantes Pro ATIVOS. Pagina todos os
// cadastros e usa o MESMO isPro do gate (normaliza plano) — evita divergência
// entre "quem gera" e "quem acessa" (ex.: plano gravado como 'Pro'/'PRO').
async function proSpecialties(db) {
  let users = [], pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users = users.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);

  const set = new Set();
  for (const u of users) {
    if (u.ativo === false || !isPro(u)) continue;
    const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
    for (const s of specs) if (s) set.add(s);
  }
  return [...set];
}

// Remove podcasts de especialidades que não têm mais Pro ativo — invalida o
// token de download órfão que, de outra forma, ficaria válido para sempre.
async function cleanupStale(db, activeSlugs) {
  let existing = [];
  try { existing = await db.query('podcasts', { limit: 200 }); } catch { return; }
  for (const doc of existing) {
    if (!doc.id || activeSlugs.has(doc.id)) continue;
    if (doc.objectPath) await deleteObject(doc.objectPath).catch(() => {});
    await db.deleteDoc('podcasts', doc.id).catch(() => {});
    log.info('[podcasts] limpeza — especialidade sem Pro ativo', { slug: doc.id });
  }
}

// Artigo do dia da especialidade: mais recente enriquecido (fallback sem orderBy).
async function latestArticle(db, especialidade) {
  const where = { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } };
  let rows = await db.query('artigos', { where, orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }], limit: 5 }).catch(() => null);
  if (!rows) rows = await db.query('artigos', { where, limit: 20 }).catch(() => []);
  rows.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : (b.data || '') < (a.data || '') ? -1 : 0);
  return rows.find(a => a.status === 'active') || rows[0] || null;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) { log.error('[podcasts] FIREBASE_API_KEY ausente'); return { error: 'no_firebase_key' }; }

  const db = new Firestore(projectId, apiKey);
  const runId = crypto.randomUUID();

  const locked = await acquireLock(db, runId, LOCK);
  if (!locked) { log.warn('[podcasts] outro run em andamento — abortando'); return { aborted: true }; }

  let generated = 0, skipped = 0, total = 0;
  try {
    const specialties = await proSpecialties(db);
    total = specialties.length;
    const activeSlugs = new Set(specialties.map(slug).filter(Boolean));
    await cleanupStale(db, activeSlugs);
    log.info('[podcasts] especialidades com Pro', { count: total, specialties });

    // SEQUENCIAL — o contador de orçamento do TTS depende disso.
    for (const esp of specialties) {
      const s = slug(esp);
      if (!s) { log.warn('[podcasts] slug vazio — pulando', { esp }); skipped++; continue; }
      try {
        const art = await latestArticle(db, esp);
        if (!art) { log.warn('[podcasts] sem artigo', { esp }); skipped++; continue; }

        const script = await generateScript(art, esp, anthropicKey);

        const tts = await synthesize(db, { text: script });
        if (!tts.ok) { log.warn('[podcasts] TTS pulado', { esp, reason: tts.reason }); skipped++; continue; }

        const audio = Buffer.from(tts.audioBase64, 'base64');
        const path  = `podcasts/${s}/latest.mp3`;
        const up = await uploadMp3(path, audio);
        if (!up.ok) { log.warn('[podcasts] upload pulado', { esp, reason: up.reason }); skipped++; continue; }

        await db.setDoc('podcasts', s, {
          especialidade: esp,
          artigoId: art.id || art.pmid || '',
          titulo: art.titulo_pt || art.titulo || '',
          objectPath: path,
          downloadToken: up.token,
          chars: billableChars(script),
          geradoEm: new Date().toISOString(),
        }).catch(e => log.warn('[podcasts] setDoc falhou', { esp, err: e.message }));

        generated++;
        log.info('[podcasts] gerado', { esp, chars: tts.chars, titulo: (art.titulo_pt || art.titulo || '').slice(0, 60) });
      } catch (err) {
        log.error('[podcasts] erro na especialidade', { esp, err: err.message });
        skipped++;
      }
    }
  } finally {
    await releaseLock(db, runId, LOCK);
  }

  log.info('[podcasts] concluído', { generated, skipped, total });
  return { generated, skipped, total };
}

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try { return { statusCode: 200, body: JSON.stringify(await main()) }; }
  catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};

if (require.main === module) {
  main().then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
        .catch(e => { console.error(e.message); process.exit(1); });
}
