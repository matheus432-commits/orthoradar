// DIAGNÓSTICO DO PIPELINE BIBLIOTECA/ÁUDIO — Fase 1 (spec 2, 24/08).
// SÓ LEITURA; verifica TODAS as URLs de áudio no storage (HEAD).
// Sai no log do workflow (sem PII) + JSON/CSV como artifacts.

const fs = require('fs');
const { Firestore } = require('../netlify/functions/_lib/firestore');
const { construirDiagnosticoPipeline, pipelineCSV } = require('../netlify/functions/_lib/diagnostico-pipeline');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

(async () => {
  const d = await construirDiagnosticoPipeline(new Firestore(projectId, apiKey), {
    bucket: process.env.GCS_BUCKET || (projectId + '.appspot.com'),
    max: 5000, // workflow verifica TODAS as URLs persistidas
  });

  console.log('══════════ DIAGNÓSTICO DO PIPELINE — SÓ LEITURA ══════════');
  console.log(`Gerado em: ${d.geradoEm}\n`);

  console.log('── ARQUITETURA REAL (≠ premissas da spec) ──');
  for (const [k, v] of Object.entries(d.arquitetura)) console.log(`  ${k}: ${v}`);

  console.log('\n── 1. RECONCILIAÇÃO TEMPORAL (edições por especialidade) ──');
  for (const [esp, s] of Object.entries(d.reconciliacaoTemporal.porEspecialidade)) {
    console.log(`  ${esp}: ${s.primeiraEdicao} → ${s.ultimaEdicao} (${s.diasCorridos} dias corridos, ${s.diasComEdicao} com edição)`);
    console.log(`    artigos enviados nas edições: ${s.artigosEnviadosNasEdicoes} · esperado na cadência 3/dia: ${s.esperadoNaCadencia3PorDia}`);
    if (s.diasSemEdicao.length) console.log(`    DIAS SEM EDIÇÃO (${s.diasSemEdicao.length}): ${s.diasSemEdicao.join(', ')}`);
  }

  console.log('\n── 2. FUNIL POR ETAPA ──');
  for (const [esp, f] of Object.entries(d.funilPorEspecialidade)) {
    console.log(`  ${esp}: total ${f.total} · ativos ${f.ativos} · resumo ${f.comResumo} · impacto ${f.comImpacto} · nível ${f.comNivel} · tema ${f.comTema} · resumoCompleto ${f.comResumoCompleto} · ÁUDIO ${f.comAudio} · NA BIBLIOTECA ${f.naBiblioteca} · em edição ${f.enviadoEmEdicao}`);
  }

  console.log('\n── 3. CRUZAMENTO E-MAIL × BIBLIOTECA ──');
  console.log(`  enviados em edição e FORA da biblioteca: ${d.cruzamento.enviadosSemBiblioteca.total}`);
  for (const x of d.cruzamento.enviadosSemBiblioteca.primeiros50) console.log(`    ${x.pmid} — ${x.motivo}`);
  console.log(`  na biblioteca sem constar em edição: ${d.cruzamento.bibliotecaSemEnvio.total}`);
  console.log(`    ${d.cruzamento.bibliotecaSemEnvio.primeiros50.join(', ')}`);

  console.log('\n── 4. COBERTURA DE ÁUDIO ──');
  console.log(`  episódios: ${d.audio.totalEpisodios} · artigos com áudio: ${d.audio.artigosComAudio}`);
  console.log(`  janela dos episódios: ${d.audio.primeiroEpisodio} → ${d.audio.ultimoEpisodio}`);
  if (d.audio.diasSemEpisodio.length) console.log(`  dias SEM episódio (${d.audio.diasSemEpisodio.length}): ${d.audio.diasSemEpisodio.join(', ')}`);
  console.log('  posição no lote (H1 — se só as primeiras posições tivessem áudio):');
  for (const p of d.audio.posicaoNoLote) console.log(`    posição ${p.posicao}: com áudio ${p.comAudio} · sem ${p.semAudio}`);
  console.log(`  storage: ${d.audio.storage.verificadas} URLs verificadas (HEAD) · QUEBRADAS: ${d.audio.storage.quebradas}`);

  console.log('\n── 5. EXECUÇÕES ──');
  console.log(`  base: ${d.execucoes.base}`);
  console.log(`  ${d.execucoes.primeiro} → ${d.execucoes.ultimo} (${d.execucoes.diasCorridos} dias)`);
  if (d.execucoes.diasSemNenhumaEdicao.length) console.log(`  dias sem NENHUMA edição: ${d.execucoes.diasSemNenhumaEdicao.join(', ')}`);

  fs.writeFileSync('diagnostico-pipeline.json', JSON.stringify(d, null, 2));
  fs.writeFileSync('diagnostico-pipeline.csv', pipelineCSV(d));
  console.log('\nArtifacts: diagnostico-pipeline.json / diagnostico-pipeline.csv');
  console.log('NADA foi alterado (relatório de leitura).');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
