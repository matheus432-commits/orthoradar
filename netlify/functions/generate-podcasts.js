// Geração diária dos podcasts Pro — 1 áudio por especialidade que tenha ao menos
// um assinante Pro. Roda no pipeline (GitHub Actions) após o digest.
//
// Fluxo por especialidade (SEQUENCIAL — obrigatório para o orçamento de TTS):
//   artigo do dia → roteiro (Claude) → TTS Standard (com guardrail) →
//   upload/rotação no Storage → metadados em `podcasts/{slug}`.
//
// Se faltar GOOGLE_TTS_API_KEY ou credenciais do Storage, cada etapa é pulada
// sem quebrar o pipeline.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { isPro } = require('./_lib/plans');
const { generateScript } = require('./_lib/podcast-script');
const { synthesize } = require('./_lib/tts');
const { uploadMp3 } = require('./_lib/storage');
const { billableChars } = require('./_lib/tts-budget');
const log = require('./_lib/logger');

// Normaliza a especialidade para um id seguro (path do Storage / doc id).
// "DTM e Dor Orofacial" → "DTM_e_Dor_Orofacial"; "Prótese" → "Protese".
function slug(esp) {
  return String(esp || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Especialidades distintas entre os assinantes Pro ativos.
async function proSpecialties(db) {
  const users = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'plano' }, op: 'EQUAL', value: { stringValue: 'pro' } } },
    limit: 500,
  }).catch(() => []);
  const set = new Set();
  for (const u of users) {
    if (u.ativo === false || !isPro(u)) continue;
    const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
    for (const s of specs) if (s) set.add(s);
  }
  return [...set];
}

// Artigo do dia da especialidade: mais recente enriquecido (fallback sem orderBy).
async function latestArticle(db, especialidade) {
  const where = { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } };
  let rows = await db.query('artigos', { where, orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }], limit: 5 }).catch(() => null);
  if (!rows) rows = await db.query('artigos', { where, limit: 20 }).catch(() => []);
  rows.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
  return rows.find(a => a.status === 'active') || rows[0] || null;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) { log.error('[podcasts] FIREBASE_API_KEY ausente'); return { error: 'no_firebase_key' }; }

  const db = new Firestore(projectId, apiKey);
  const specialties = await proSpecialties(db);
  log.info('[podcasts] especialidades com Pro', { count: specialties.length, specialties });

  let generated = 0, skipped = 0;
  // SEQUENCIAL — o contador de orçamento do TTS depende disso.
  for (const esp of specialties) {
    try {
      const art = await latestArticle(db, esp);
      if (!art) { log.warn('[podcasts] sem artigo para especialidade', { esp }); skipped++; continue; }

      const script = await generateScript(art, esp, anthropicKey);
      const chars  = billableChars(script);

      const tts = await synthesize(db, { text: script });
      if (!tts.ok) { log.warn('[podcasts] TTS pulado', { esp, reason: tts.reason }); skipped++; continue; }

      const audio = Buffer.from(tts.audioBase64, 'base64');
      const path  = `podcasts/${slug(esp)}/latest.mp3`;
      const up = await uploadMp3(path, audio);
      if (!up.ok) { log.warn('[podcasts] upload pulado', { esp, reason: up.reason }); skipped++; continue; }

      await db.setDoc('podcasts', slug(esp), {
        especialidade: esp,
        artigoId: art.id || art.pmid || '',
        titulo: art.titulo_pt || art.titulo || '',
        objectPath: path,
        downloadToken: up.token,
        chars,
        geradoEm: new Date().toISOString(),
      }).catch(e => log.warn('[podcasts] setDoc falhou', { esp, err: e.message }));

      generated++;
      log.info('[podcasts] gerado', { esp, chars, titulo: (art.titulo_pt || art.titulo || '').slice(0, 60) });
    } catch (err) {
      log.error('[podcasts] erro na especialidade', { esp, err: err.message });
      skipped++;
    }
  }

  log.info('[podcasts] concluído', { generated, skipped });
  return { generated, skipped, total: specialties.length };
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
