// BACKFILL DE TERMINOLOGIA no acervo (pedido do fundador 08/08):
// "Distanciamento" (tradução literal de distalization) → "Distalização" —
// SEMPRE — senão o dentista busca pelo termo correto e não encontra.
//
// A prevenção já está na geração (corrigirTermosBR roda em título, resumos,
// impacto, achados, limitações e roteiro do podcast). Este script corrige o
// que JÁ FOI publicado: campos de texto de `artigos` e titulo/roteiro de
// `podcast_episodios`/`podcast_arquivo`. Sem custo de IA/TTS — só leitura,
// replace determinístico e updateDoc dos docs afetados.
//
// NOTA HONESTA: o ÁUDIO já narrado não muda (regravar custa TTS) — a busca,
// os cards e os roteiros escritos passam a usar o termo correto.
//
// Uso: node scripts/corrigir-terminologia.js  (workflow dispatch-only)

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { corrigirTermosBR } = require('../netlify/functions/_lib/claude');

const CAMPOS_ARTIGO = ['titulo_pt', 'resumo_pt', 'resumo_completo', 'impacto_pratico', 'limitacoes', 'tema'];
const RX = /distanciamento/i; // pré-filtro barato antes do replace completo

async function corrigirColecao(db, coll, campos, extraArray) {
  let corrigidos = 0, examinados = 0, falhas = 0;
  let pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs(coll, { pageSize: 300, pageToken });
    for (const d of docs) {
      examinados++;
      const patch = {};
      for (const c of campos) {
        const v = d[c];
        if (typeof v === 'string' && RX.test(v)) patch[c] = corrigirTermosBR(v);
      }
      if (extraArray && Array.isArray(d[extraArray]) && d[extraArray].some(x => typeof x === 'string' && RX.test(x))) {
        patch[extraArray] = d[extraArray].map(x => (typeof x === 'string' ? corrigirTermosBR(x) : x));
      }
      if (Object.keys(patch).length) {
        try {
          await db.updateDoc(coll, d.id, patch);
          corrigidos++;
          console.log(`  corrigido ${coll}/${d.id} (${Object.keys(patch).join(', ')})`);
        } catch (e) {
          falhas++;
          console.error(`  ERRO em ${coll}/${d.id}: ${e.message}`);
        }
      }
    }
    pageToken = nextPageToken;
  } while (pageToken);
  console.log(`[terminologia] ${coll}: ${examinados} examinados, ${corrigidos} corrigidos, ${falhas} falhas`);
  return { corrigidos, examinados, falhas };
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  let falhas = 0;
  falhas += (await corrigirColecao(db, 'artigos', CAMPOS_ARTIGO, 'achados_principais')).falhas;
  for (const coll of ['podcast_episodios', 'podcast_arquivo']) {
    falhas += (await corrigirColecao(db, coll, ['titulo', 'roteiro'])).falhas;
  }
  // Digests do dia carregam cópias dos artigos — os cards da edição leem do
  // digest, então corrigimos os textos embutidos também.
  let pageToken = null, digestsCorrigidos = 0;
  do {
    const { docs, nextPageToken } = await db.listDocs('digests_especialidade', { pageSize: 200, pageToken });
    for (const d of docs) {
      if (!Array.isArray(d.artigos)) continue;
      const temTermo = JSON.stringify(d.artigos).match(RX);
      if (!temTermo) continue;
      const artigos = d.artigos.map(a => {
        const novo = { ...a };
        for (const c of CAMPOS_ARTIGO) if (typeof novo[c] === 'string') novo[c] = corrigirTermosBR(novo[c]);
        return novo;
      });
      try { await db.updateDoc('digests_especialidade', d.id, { artigos }); digestsCorrigidos++; }
      catch (e) { falhas++; console.error(`  ERRO em digests/${d.id}: ${e.message}`); }
    }
    pageToken = nextPageToken;
  } while (pageToken);
  console.log(`[terminologia] digests_especialidade: ${digestsCorrigidos} corrigidos`);

  if (falhas) { console.error(`[terminologia] concluído com ${falhas} falha(s)`); process.exit(1); }
  console.log('[terminologia] concluído sem falhas — "distanciamento" → "distalização" em todo o acervo escrito');
}

main().catch(e => { console.error(e.message); process.exit(1); });
