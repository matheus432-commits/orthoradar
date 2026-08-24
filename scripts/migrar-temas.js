// MIGRAÇÃO DE TEMAS — Fase 3 (spec 24/08). Roda pelo workflow "Migrar Temas".
//
// ENV:
//   DRY_RUN        padrão true (parser tolerante — lição do run #2 de 12/08);
//   MODO           'mapear' (padrão, ZERO IA) | 'completo' (IA p/ sem-mapa +
//                  assistiva; custo ~US$0,001/artigo com Haiku);
//   LIMIT          teto de artigos processados no run (padrão 500);
//   ESPECIALIDADE  opcional, migra só uma.
//
// Idempotente: artigos já na versao_taxonomia corrente são pulados; rodar de
// novo continua de onde parou. Lotes de 10 com 1s entre lotes.
// PRIVACIDADE: log só com metadados de artigos (pmid/tema) — nunca dados de
// dentistas (log de Actions é público).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { migrarAcervo } = require('../netlify/functions/_lib/migracao-temas');

const DRY_RUN = !/^(false|0|n[aã]o|no)$/i.test(String(process.env.DRY_RUN ?? 'true').trim());
const MODO = String(process.env.MODO || 'mapear').trim().toLowerCase() === 'completo' ? 'completo' : 'mapear';
const LIMIT = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 500;
const ESPECIALIDADE = String(process.env.ESPECIALIDADE || '').trim() || undefined;

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

(async () => {
  console.log(`MIGRAÇÃO DE TEMAS — DRY_RUN=${DRY_RUN} (input recebido: ${JSON.stringify(process.env.DRY_RUN)}) · MODO=${MODO} · LIMIT=${LIMIT}${ESPECIALIDADE ? ' · ESP=' + ESPECIALIDADE : ''}`);
  if (MODO === 'completo' && !process.env.ANTHROPIC_API_KEY) {
    console.error('MODO=completo exige ANTHROPIC_API_KEY'); process.exit(1);
  }

  let classificarIA;
  if (MODO === 'completo') {
    const { callClaude } = require('../netlify/functions/_lib/claude');
    const { DEFAULT_MODEL } = require('../netlify/functions/_lib/ai-config');
    classificarIA = async (prompt) => (await callClaude(prompt, 0, process.env.TEMAS_MODEL || DEFAULT_MODEL, 200, 'temas')).text;
  }

  const rel = await migrarAcervo(new Firestore(projectId, apiKey), {
    dryRun: DRY_RUN, modo: MODO, limit: LIMIT, especialidade: ESPECIALIDADE, classificarIA,
  });

  console.log('\n══════════ RELATÓRIO ══════════');
  console.log(`dry-run: ${rel.dryRun} · modo: ${rel.modo} · gravando versao_taxonomia=${rel.versaoTaxonomia}`);
  const t = rel.total;
  console.log(`processados ${t.processados} · pulados (já na versão) ${t.pulados} · restantes p/ próximo run ${rel.restantes}`);
  console.log(`mapeados por sinônimo (custo zero): ${t.mapeadosPorSinonimo}`);
  console.log(`reclassificados via IA: ${t.reclassificadosIA} · assistiva complementou: ${t.assistivaComplementou} · falhas de IA (re-tentam no próximo run): ${t.falhasIA}`);
  console.log(`sem tema atribuído: ${t.semTema} · ids inválidos DESCARTADOS: ${t.idsDescartados}`);
  if (rel.exemplosIdsDescartados.length) console.log('  exemplos descartados:', rel.exemplosIdsDescartados.join(', '));
  console.log('\nPOR ESPECIALIDADE:');
  for (const [esp, r] of Object.entries(rel.porEspecialidade)) {
    console.log(`  ${esp}: processados ${r.processados} · sinônimo ${r.mapeadosPorSinonimo} · IA ${r.reclassificadosIA} · assistiva ${r.assistivaComplementou} · sem tema ${r.semTema} · pulados ${r.pulados}`);
  }
  if (rel.dryRun) console.log('\nDRY-RUN: NADA foi gravado. Rode com DRY_RUN=false para aplicar.');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
