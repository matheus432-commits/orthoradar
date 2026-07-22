// Diagnóstico do feed mestre do podcast (o que o Spotify enxerga AGORA).
// Chama o handler real do podcast-rss (sem ?esp) e lista os <item>: quantos,
// de quais dias e especialidades. Roda no CI (secrets FIREBASE_*). Não publica.
// Também imprime os artigos dos digests de HOJE (esp, pmid, título) — útil p/
// identificar com precisão qual artigo alimentar ao fix-artigo.

const { handler } = require('../netlify/functions/podcast-rss');
const { Firestore } = require('../netlify/functions/_lib/firestore');

(async () => {
  const res = await handler({ queryStringParameters: {} });
  const xml = res.body || '';
  const items = xml.split('<item>').slice(1);
  console.log('=== FEED MESTRE (podcast.xml) ===');
  console.log('total de itens:', items.length);
  const porDia = {};
  items.forEach((it, i) => {
    const t = (it.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const g = (it.match(/<guid[^>]*>([^<]*)<\/guid>/) || [])[1] || '';
    const diaM = g.match(/(\d{4}-\d{2}-\d{2})/);
    const dia = diaM ? diaM[1] : '????';
    porDia[dia] = (porDia[dia] || 0) + 1;
    console.log(`  ${String(i + 1).padStart(2)}. ${t}   [${g}]`);
  });
  console.log('--- itens por dia ---');
  Object.keys(porDia).sort().reverse().forEach(d => console.log(`  ${d}: ${porDia[d]}`));
  console.log('dias distintos:', Object.keys(porDia).length);

  // Digests de HOJE: lista artigo a artigo (para casar com o fix-artigo).
  const hoje = process.env.PROBE_DATE || new Date().toISOString().slice(0, 10);
  const apiKey = process.env.FIREBASE_API_KEY;
  if (apiKey) {
    const db = new Firestore(process.env.FIREBASE_PROJECT_ID || 'orthoradar', apiKey);
    const digests = (await db.query('digests_especialidade', { limit: 100 }).catch(() => []))
      .filter(d => String(d.id || '').endsWith('_' + hoje));
    console.log(`\n=== DIGESTS DE ${hoje} (${digests.length}) ===`);
    for (const d of digests) {
      console.log(`\n[${d.id}]`);
      (Array.isArray(d.artigos) ? d.artigos : []).forEach((a, i) => {
        console.log(`  ep${i + 1} pmid=${a.pmid || a.id} | PT: ${String(a.titulo_pt || '(sem)').slice(0, 80)}`);
        console.log(`         EN: ${String(a.titulo || a.title || '').slice(0, 90)}`);
      });
    }
  }
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });

// re-run 22:31 — dump digests de hoje p/ identificar Prótese ep3
