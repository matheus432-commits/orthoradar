// BACKFILL DE URLs DE ÁUDIO (incidente 05/08 — player 0:00 recorrente).
//
// Causa-raiz: o job de podcasts monta a URL de download com o bucket do
// AMBIENTE DO ACTIONS (GCS_BUCKET / service account) e cada leitor no Netlify
// REMONTAVA a URL com o próprio env — qualquer divergência de bucket entre os
// dois ambientes quebra o áudio no site sem nenhum job ficar vermelho.
// A correção definitiva persiste a URL verificada no doc e os leitores a
// preferem. Este script CURA os docs já gravados (sem regenerar nenhum áudio,
// sem custo de TTS/IA): para cada doc sem `url`, monta a URL com o bucket REAL
// (o mesmo do upload), VERIFICA o 1º byte e grava.
//
// Cobertura: ponteiros `podcasts/{slug}` (episodios[] + compilado + legado),
// histórico `podcast_episodios` e arquivo `podcast_arquivo`.
//
// Uso (workflow backfill-audio-urls.yml, dispatch manual):
//   node scripts/backfill-audio-urls.js            → tudo
//   BACKFILL_DATE=2026-08-05 …                     → só episódios daquela data
//                                                     (ponteiros são sempre todos — são ~11 docs)
//
// Saída: relatório PASS/FAIL por doc; exit 1 se alguma URL montada NÃO servir
// o áudio (prova de que o problema não era só a falta do campo `url`).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { firebaseDownloadUrl, verifyUrl, patchCacheControl, _bucketName } = require('../netlify/functions/_lib/storage');

const DATE = process.env.BACKFILL_DATE || '';
// 10/08: além das URLs, cura o Cache-Control dos MP3 antigos (gravados com
// no-store — hostil ao mobile). PATCH de metadados preserva o token; a URL
// persistida continua exatamente a mesma.
const PATCH_CACHE = String(process.env.PATCH_CACHE || 'true') === 'true';
// Run #2 (10/08): "0 objetos, 836 falhas" no VERDE — o motivo das falhas era
// engolido e o run passava. Agora: dedupe por objeto (ponteiro/histórico/arquivo
// apontam pro mesmo MP3), o 1º exemplo de cada motivo sai no log com status e
// corpo da resposta, e falha TOTAL da cura derruba o run (vermelho).
let cachePatch = 0, cachePatchFalha = 0;
const cacheVisitados = new Set();
const cacheFalhasPorMotivo = new Map(); // "HTTP 403" → quantas
async function curarCache(objectPath) {
  if (!PATCH_CACHE || !objectPath || cacheVisitados.has(objectPath)) return;
  cacheVisitados.add(objectPath);
  const r = await patchCacheControl(objectPath).catch(e => ({ ok: false, err: e.message }));
  if (r.ok) { cachePatch++; return; }
  cachePatchFalha++;
  const motivo = r.skipped ? `credenciais ausentes (${r.reason})`
    : r.err ? `erro de rede: ${r.err}`
    : `HTTP ${r.status}`;
  if (!cacheFalhasPorMotivo.has(motivo)) {
    cacheFalhasPorMotivo.set(motivo, 0);
    console.error(`  [cache] 1ª falha "${motivo}" em ${objectPath}${r.body ? ' — ' + String(r.body).replace(/\s+/g, ' ') : ''}`);
  }
  cacheFalhasPorMotivo.set(motivo, cacheFalhasPorMotivo.get(motivo) + 1);
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const bucket = _bucketName();
  if (!bucket) { console.error('bucket indisponível (GCS_BUCKET/GCP_SERVICE_ACCOUNT_JSON ausentes)'); process.exit(1); }
  console.log(`[backfill] bucket do upload: ${bucket}${DATE ? ` — data ${DATE}` : ' — todas as datas'}`);

  const db = new Firestore(projectId, apiKey);
  let ok = 0, falhas = 0, jaTinha = 0, semCampos = 0;

  // Monta e VERIFICA a URL de um objeto; devolve a URL ou null (com log).
  async function urlVerificada(rotulo, objectPath, token) {
    const url = firebaseDownloadUrl(bucket, objectPath, token);
    const vu = await verifyUrl(url);
    if (vu.ok) { console.log(`  PASS ${rotulo}`); return url; }
    console.error(`  FAIL ${rotulo} — HTTP ${vu.status}${vu.err ? ' ' + vu.err : ''} (${objectPath})`);
    falhas++;
    return null;
  }

  // ── 1. Ponteiros diários podcasts/{slug} ──────────────────────────────────
  const ponteiros = await db.query('podcasts', { limit: 200 }).catch(() => []);
  for (const doc of ponteiros) {
    if (!doc.id) continue;
    const eps = Array.isArray(doc.episodios) ? doc.episodios : [];
    let mudou = false;
    for (const e of eps) {
      await curarCache(e.objectPath);
      if (e.url) { jaTinha++; continue; }
      if (!e.objectPath || !e.downloadToken) { semCampos++; continue; }
      const url = await urlVerificada(`podcasts/${doc.id} ep${e.n}`, e.objectPath, e.downloadToken);
      if (url) { e.url = url; mudou = true; ok++; }
    }
    if (doc.compilado && !doc.compilado.url && doc.compilado.objectPath && doc.compilado.downloadToken) {
      const url = await urlVerificada(`podcasts/${doc.id} compilado`, doc.compilado.objectPath, doc.compilado.downloadToken);
      if (url) { doc.compilado.url = url; mudou = true; ok++; }
    }
    // Campos legados (1º episódio) no topo do doc.
    if (!doc.url && doc.objectPath && doc.downloadToken) {
      const epComUrl = eps.find(e => e.objectPath === doc.objectPath && e.url);
      const url = epComUrl ? epComUrl.url : await urlVerificada(`podcasts/${doc.id} legado`, doc.objectPath, doc.downloadToken);
      if (url) { doc.url = url; mudou = true; if (!epComUrl) ok++; }
    }
    if (mudou) {
      const { id, ...campos } = doc;
      await db.setDoc('podcasts', id, campos)
        .then(() => console.log(`  gravado podcasts/${id}`))
        .catch(e => { console.error(`  ERRO ao gravar podcasts/${id}: ${e.message}`); falhas++; });
    }
  }

  // ── 2. Histórico (podcast_episodios) e arquivo (podcast_arquivo) ─────────
  for (const coll of ['podcast_episodios', 'podcast_arquivo']) {
    const query = { limit: 2000 };
    if (DATE) {
      query.where = { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: DATE } } };
    }
    const docs = await db.query(coll, query).catch(() => []);
    console.log(`[backfill] ${coll}: ${docs.length} docs`);
    for (const e of docs) {
      if (!e.id) continue;
      await curarCache(e.objectPath);
      if (e.url) { jaTinha++; continue; }
      if (!e.objectPath || !e.downloadToken) { semCampos++; continue; }
      const url = await urlVerificada(`${coll}/${e.id}`, e.objectPath, e.downloadToken);
      if (url) {
        await db.updateDoc(coll, e.id, { url })
          .then(() => ok++)
          .catch(err => { console.error(`  ERRO ao gravar ${coll}/${e.id}: ${err.message}`); falhas++; });
      }
    }
  }

  console.log(`[backfill] concluído — gravadas: ${ok}, já tinham url: ${jaTinha}, sem path/token: ${semCampos}, falhas: ${falhas}`);
  if (PATCH_CACHE) {
    console.log(`[backfill] cache curado (no-store → public 1h, token preservado): ${cachePatch} objetos, ${cachePatchFalha} falhas`);
    for (const [motivo, n] of cacheFalhasPorMotivo) console.error(`  [cache] ${n}× ${motivo}`);
  }
  if (falhas) {
    console.error('[backfill] FALHAS: alguma URL montada com o bucket do upload NÃO serve o áudio — investigar o objeto no Storage.');
    process.exit(1);
  }
  if (PATCH_CACHE && cachePatchFalha && !cachePatch) {
    console.error('[backfill] CURA DE CACHE 100% FALHA — vermelho de propósito (as URLs seguem servindo; só o Cache-Control ficou como estava). O motivo exato está nas linhas [cache] acima.');
    process.exit(1);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
