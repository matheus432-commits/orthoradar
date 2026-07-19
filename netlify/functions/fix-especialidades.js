// Correção em massa de especialidades erradas — reclassifica os artigos ativos
// pelo CONTEÚDO (via Claude) e corrige o campo `especialidade` no Firestore.
//
// Por que existe: a ingestão rotula o artigo pela QUERY que o encontrou, e as
// buscas MeSH retornam itens fracamente relacionados (ex.: estudo de
// odontopediatria rotulado Prótese). Este script repara a base existente; para
// artigos novos, o enriquecimento (process-article) já classifica na entrada.
//
// Run: node netlify/functions/fix-especialidades.js
//   FIX_LIMIT=300   máx. de artigos avaliados por execução (padrão 300)
//   PURGE_CACHES=true (padrão) apaga os caches do dia/semana (digests_especialidade
//   de hoje e achado_semana) para regenerarem com os rótulos corretos.

const { Firestore } = require('./_lib/firestore');
const { classifyEspecialidade, currentCost } = require('./_lib/claude');
const { especialidadeOverride } = require('./_lib/scoring');
const log = require('./_lib/logger');

const FIX_LIMIT = parseInt(process.env.FIX_LIMIT || '300', 10);

async function loadActiveArticles(db) {
  const docs = await db.query('artigos', {
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
    limit: FIX_LIMIT,
  });
  return docs;
}

async function purgeCaches(db) {
  const today = new Date().toISOString().slice(0, 10);
  let purged = 0;
  for (const col of ['digests_especialidade', 'achado_semana']) {
    try {
      const { docs } = await db.listDocs(col, { pageSize: 300 });
      for (const d of docs) {
        // digests_especialidade: só os de hoje; achado_semana: todos (regenera 1x por esp.)
        if (col === 'digests_especialidade' && d.date !== today) continue;
        await db.deleteDoc(col, d.id).catch(() => {});
        purged++;
      }
    } catch (err) {
      log.warn('[fix-esp] purge falhou', { col, err: err.message });
    }
  }
  return purged;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[fix-esp] FIREBASE_API_KEY not set'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { log.error('[fix-esp] ANTHROPIC_API_KEY not set — nada a fazer sem IA'); process.exit(1); }

  const db = new Firestore(projectId, apiKey);
  const articles = await loadActiveArticles(db);
  console.log(`[fix-esp] ${articles.length} artigos ativos carregados (limite ${FIX_LIMIT})`);

  let checked = 0, fixed = 0, failed = 0;
  const changes = [];

  for (const art of articles) {
    checked++;
    const atual = art.especialidade || '';
    let nova  = await classifyEspecialidade(art);
    if (!nova) { failed++; continue; }
    // Override determinístico tem a palavra final (decíduo→Odontopediatria;
    // restauração direta rotulada Prótese→Dentística) — mesmo por cima da IA.
    nova = especialidadeOverride(art.titulo || art.title || '', art.abstract || art.resumo_pt || '', nova) || nova;

    if (nova !== atual) {
      await db.updateDoc('artigos', art.id, {
        especialidade:            nova,
        especialidadeOriginal:    art.especialidadeOriginal || atual,
        especialidadeCorrigidaEm: new Date().toISOString(),
      }).catch(e => { failed++; log.warn('[fix-esp] update falhou', { id: art.id, err: e.message }); });
      fixed++;
      changes.push({ id: art.id, de: atual, para: nova, titulo: (art.titulo_pt || art.titulo || '').slice(0, 70) });
      console.log(`[FIX] ${art.id}: ${atual || '(vazia)'} → ${nova} — ${(art.titulo_pt || art.titulo || '').slice(0, 70)}`);
    }
  }

  let purged = 0;
  if (process.env.PURGE_CACHES !== 'false' && fixed > 0) {
    purged = await purgeCaches(db);
    console.log(`[fix-esp] ${purged} documentos de cache limpos (digest do dia + achado da semana)`);
  }

  const summary = { checked, fixed, failed, purgedCaches: purged, cost_usd: Number(currentCost().toFixed(4)) };
  log.info('[fix-esp] concluído', summary);
  console.log('\n[RESUMO]', JSON.stringify(summary));
  return { ...summary, changes };
}

exports.handler = async () => {
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[fix-esp] erro', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done.'); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
