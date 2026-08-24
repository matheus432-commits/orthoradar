// VIGIA CONTÍNUO DO ÁUDIO (incidentes 04-10/08 — "funciona 1-2 dias e o bug
// volta"): a verificação pontual (geração 05:40, auditoria 05:46) provava o
// servidor saudável de madrugada, mas ninguém observava o RESTO do dia — se
// uma URL morresse às 09h, só o dentista descobria. Este vigia roda de 2 em 2
// horas (workflow), refaz o GET de 1 byte em TODAS as URLs persistidas dos
// ponteiros do dia e fica VERMELHO com timestamp na primeira falha — o
// culpado passa a ter hora marcada. Zero IA, zero TTS; ~35 requests de 1 byte.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { verifyUrl } = require('../netlify/functions/_lib/storage');

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);

  const ponteiros = await db.query('podcasts', { limit: 100 }).catch(() => []);
  let ok = 0, velhos = 0;
  const falhas = [];
  for (const doc of ponteiros) {
    if (!doc.id) continue;
    if (doc.date !== hoje) { velhos++; continue; } // ponteiro de ontem: cobrado pela auditoria da manhã
    const eps = Array.isArray(doc.episodios) ? doc.episodios : [];
    for (const e of eps) {
      if (!e.url) { falhas.push(`${doc.id} ep${e.n}: SEM url persistida`); continue; }
      const vu = await verifyUrl(e.url);
      if (vu.ok) { ok++; continue; }
      falhas.push(`${doc.id} ep${e.n}: HTTP ${vu.status}${vu.err ? ' ' + vu.err : ''}`);
    }
    if (doc.compilado?.url) {
      const vu = await verifyUrl(doc.compilado.url);
      if (vu.ok) ok++; else falhas.push(`${doc.id} compilado: HTTP ${vu.status}`);
    }
  }

  const agora = new Date().toISOString();
  console.log(`[vigia-audio] ${agora} — ${ok} URLs servindo, ${velhos} ponteiros de dias anteriores ignorados`);
  if (falhas.length) {
    console.error(`[vigia-audio] ✗ ${falhas.length} URL(s) NÃO servem NESTE MOMENTO (${agora}):`);
    falhas.forEach(f => console.error('  - ' + f));
    process.exit(1); // vermelho no Actions com hora exata — o assassino de tokens ganha timestamp
  }
  console.log('[vigia-audio] ✓ todos os áudios do dia servem agora');
}

main().catch(e => { console.error(e.message); process.exit(1); });
