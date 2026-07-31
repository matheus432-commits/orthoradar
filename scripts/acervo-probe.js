// Sondagem do ACERVO (diagnóstico): quantos artigos/resumos/áudios temos.
// Usa runAggregationQuery (COUNT no servidor) — não lista documentos, então é
// rápido e barato mesmo com o acervo grande. Imprime SOMENTE números agregados
// (repositório e log são públicos).

const { request } = require('../netlify/functions/_lib');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;

async function count(collection, where = null) {
  const structuredQuery = { from: [{ collectionId: collection }] };
  if (where) structuredQuery.where = where;
  const body = Buffer.from(JSON.stringify({
    structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: 'n', count: {} }] },
  }), 'utf8');
  const res = await request({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${projectId}/databases/(default)/documents:runAggregationQuery?key=${apiKey}`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
  }, body);
  if (res.status !== 200) return `ERRO ${res.status}`;
  try {
    const rows = JSON.parse(res.body);
    return Number(rows[0]?.result?.aggregateFields?.n?.integerValue ?? NaN);
  } catch { return 'ERRO parse'; }
}

const eq = (campo, valor) => ({
  fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: { stringValue: valor } },
});

(async () => {
  if (!apiKey) { console.log('SEM_FIREBASE_API_KEY'); process.exit(1); }
  console.log('=== ACERVO ODONTOFEED ===');
  console.log('artigos (total):            ', await count('artigos'));
  console.log('  ├─ ativos (no funil):     ', await count('artigos', eq('status', 'active')));
  console.log('  ├─ aguardando enriquec.:  ', await count('artigos', eq('status', 'pending_enrichment')));
  console.log('  └─ rejeitados/failed:     ', await count('artigos', eq('status', 'rejected_unfinished')));
  console.log('edições publicadas (digests):', await count('digests_especialidade'));
  console.log('episódios de áudio (quente): ', await count('podcast_episodios'));
  console.log('episódios de áudio (arquivo):', await count('podcast_arquivo'));
  console.log('itens salvos em bibliotecas: ', await count('biblioteca_itens'));
})().catch(e => { console.error('ERRO_PROBE', e.message); process.exit(1); });
