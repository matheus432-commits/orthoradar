// DIAGNÓSTICO DE TEMAS — Fase 1 (spec 24/08). SÓ LEITURA, custo zero de IA.
//
// Roda no workflow dispatch-only "Diagnóstico de Temas" (o site não pode ser
// redeployado agora — "não suba para o Netlify" — então o relatório sai por
// aqui). Imprime o relatório no log (sem PII: só metadados de artigos) e
// grava JSON + CSV como artifacts do run.

const fs = require('fs');
const { Firestore } = require('../netlify/functions/_lib/firestore');
const { construirDiagnostico, distribuicaoCSV } = require('../netlify/functions/_lib/diagnostico-temas');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

(async () => {
  const d = await construirDiagnostico(new Firestore(projectId, apiKey));

  console.log('══════════ DIAGNÓSTICO DE TEMAS — SÓ LEITURA ══════════');
  console.log(`Gerado em: ${d.geradoEm} · taxonomia corrente: v${d.versaoTaxonomiaCorrente}`);
  console.log(`Total de artigos no acervo: ${d.totalArtigos}\n`);

  for (const [esp, g] of Object.entries(d.especialidades)) {
    console.log(`── ${esp} ─────────────────────────────`);
    console.log(`  total ${g.total} (ativos ${g.ativos}) · tema preenchido ${g.temaPreenchido} · vazio ${g.temaVazio}`);
    console.log(`  formato: string ${g.formato.string} · array ${g.formato.array} · já com temas v2: ${g.jaComTemasV2} · na versão corrente: ${g.naVersaoCorrente}`);
    console.log(`  prévia da migração: mapeia por sinônimo (custo zero) ${g.previaMigracao.mapeariaPorSinonimo} · precisaria de IA ${g.previaMigracao.precisariaIA}`);
    console.log(`  strings distintas de tema: ${g.distribuicaoBruta.length}`);
    for (const { tema, contagem } of g.distribuicaoBruta.slice(0, 15)) {
      console.log(`    ${String(contagem).padStart(4)} × "${tema}"`);
    }
    if (g.distribuicaoBruta.length > 15) console.log(`    … +${g.distribuicaoBruta.length - 15} strings (CSV completo no artifact)`);
    if (g.variantes.grupos.length) {
      console.log('  VARIANTES (colidem após normalização):');
      for (const v of g.variantes.grupos) console.log(`    "${v.variantes.join('" ≈ "')}"`);
    }
    if (g.variantes.paresProximos.length) {
      console.log('  PARES PRÓXIMOS (Levenshtein ≤ 3):');
      for (const p of g.variantes.paresProximos.slice(0, 10)) console.log(`    "${p.a}" ~ "${p.b}" (d=${p.distancia})`);
    }
    console.log('');
  }

  const c = d.casoAlinhadores;
  console.log('── CASO ALINHADORES (Ortodontia) ──────');
  console.log(`  artigos que FALAM de alinhador/aligner/invisalign no texto: ${c.artigosDeOrtodontiaComAlinhadorNoTexto}`);
  console.log(`  artigos cujo tema gravado mapeia para alinhadores-invisiveis: ${c.artigosCujoTemaMapeiaParaAlinhadores}`);
  console.log('  amostra de 20 (pmid · tema gravado · mapearia para):');
  for (const a of c.amostra20) {
    console.log(`    ${a.pmid} · tema=${JSON.stringify(a.temaGravado)} · mapa=${a.mapeariaPara || '(nenhum)'} · "${a.titulo}"`);
  }

  fs.writeFileSync('diagnostico-temas.json', JSON.stringify(d, null, 2));
  fs.writeFileSync('diagnostico-temas.csv', distribuicaoCSV(d));
  console.log('\nArtifacts gravados: diagnostico-temas.json / diagnostico-temas.csv');
  console.log('NADA foi alterado (relatório de leitura).');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
