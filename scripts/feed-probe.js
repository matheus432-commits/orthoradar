// Diagnóstico do feed mestre do podcast (o que o Spotify enxerga AGORA).
// Chama o handler real do podcast-rss (sem ?esp) e lista os <item>: quantos,
// de quais dias e especialidades. Roda no CI (secrets FIREBASE_*). Não publica.

const { handler } = require('../netlify/functions/podcast-rss');

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
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });

// re-run 22:04:18
