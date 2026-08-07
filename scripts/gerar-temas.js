// MIGRAÇÃO RETROATIVA DE TEMAS (fundador, 08/08) — DETERMINÍSTICA, SEM IA.
//
// Classifica TODOS os artigos do acervo na taxonomia de temas por
// especialidade (_lib/temas-taxonomia) usando o classificador por
// palavras-chave (_lib/temas-classificador). Zero chamadas de API, zero
// custo, sem falhas de rede — decisão do fundador após descartar a
// classificação via modelo ("os requests vão falhar / outra alternativa").
//
// Regras:
//   • reclassifica também os temas ANTIGOS (rótulos de busca da ingestão,
//     ex. "CAD/CAM em prótese") — só sobrevive tema da taxonomia oficial;
//   • artigo sem match fica com tema '' (o dropdown nunca mente);
//   • relatório final por especialidade: classificados / sem match / total.
//
// Uso: node scripts/gerar-temas.js          (workflow dispatch-only)
//      DRY_RUN=true …                        → só o relatório, sem gravar

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { classificarTema } = require('../netlify/functions/_lib/temas-classificador');
const { temaValido } = require('../netlify/functions/_lib/temas-taxonomia');

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const dryRun = String(process.env.DRY_RUN || '') === 'true';
  const db = new Firestore(projectId, apiKey);

  const porEsp = {}; // esp → { total, jaOk, classificados, semMatch, falhas }
  const stat = (esp) => (porEsp[esp] = porEsp[esp] || { total: 0, jaOk: 0, classificados: 0, semMatch: 0, falhas: 0 });

  let pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('artigos', { pageSize: 300, pageToken });
    for (const a of docs) {
      const esp = a.especialidade || '—';
      const s = stat(esp);
      s.total++;
      // Tema já na taxonomia oficial → nada a fazer.
      if (temaValido(a.tema, esp)) { s.jaOk++; continue; }
      const tema = classificarTema(a);
      if (!tema) {
        s.semMatch++;
        // Tema antigo fora da taxonomia e sem match novo → limpa (não mente).
        if (a.tema && !dryRun) await db.updateDoc('artigos', a.id, { tema: '' }).catch(() => { s.falhas++; });
        continue;
      }
      if (dryRun) { s.classificados++; continue; }
      try {
        await db.updateDoc('artigos', a.id, { tema });
        s.classificados++;
      } catch (e) {
        s.falhas++;
        console.error(`  ERRO em artigos/${a.id}: ${e.message}`);
      }
    }
    pageToken = nextPageToken;
  } while (pageToken);

  // ── Relatório por especialidade ──
  console.log(`\n=== RELATÓRIO DA MIGRAÇÃO DE TEMAS${dryRun ? ' (DRY RUN — nada gravado)' : ''} ===`);
  let tot = { total: 0, jaOk: 0, classificados: 0, semMatch: 0, falhas: 0 };
  for (const esp of Object.keys(porEsp).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    const s = porEsp[esp];
    console.log(`${esp}: ${s.total} artigos → ${s.classificados} classificados agora, ${s.jaOk} já ok, ${s.semMatch} sem match, ${s.falhas} falhas`);
    for (const k of Object.keys(tot)) tot[k] += s[k];
  }
  console.log(`TOTAL: ${tot.total} artigos → ${tot.classificados} classificados agora, ${tot.jaOk} já ok, ${tot.semMatch} sem match, ${tot.falhas} falhas`);
  if (tot.falhas) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
