// TESTE DE INTEGRIDADE DOS TEMAS NO ACERVO — Fase 4 da spec 24/08.
//
// FALHA (exit 1) se algum artigo do banco tiver:
//   • id em `temas` fora da taxonomia da sua especialidade;
//   • `temas` gravado sem `versao_taxonomia`;
//   • (pós-migração) artigo ATIVO na versão corrente com `temas` não-array.
// Artigos ainda NÃO migrados (sem versao_taxonomia) não reprovam o run — a
// migração é gradual; eles saem no relatório como pendentes.
// SÓ LEITURA; sem chaves de IA.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { ehIdValido, TAXONOMIA_VERSAO, ESPECIALIDADES } = require('../netlify/functions/_lib/taxonomia');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

(async () => {
  const db = new Firestore(projectId, apiKey);
  const sel = { fields: ['pmid', 'especialidade', 'tema', 'temas', 'versao_taxonomia', 'status'].map(fieldPath => ({ fieldPath })) };
  const arts = await db.query('artigos', { select: sel, limit: 5000 });

  const violacoes = [];
  let migrados = 0, pendentes = 0;
  for (const a of arts) {
    const esp = a.especialidade || '';
    if (!ESPECIALIDADES.includes(esp)) continue;
    const temVersao = a.versao_taxonomia !== undefined && a.versao_taxonomia !== null;
    if (!temVersao && a.temas === undefined) { pendentes++; continue; }
    migrados++;
    if (a.temas !== undefined && !temVersao) {
      violacoes.push(`${a.pmid || a.id}: temas gravado SEM versao_taxonomia`);
      continue;
    }
    if (a.versao_taxonomia === TAXONOMIA_VERSAO) {
      if (!Array.isArray(a.temas)) {
        if (a.status === 'active') violacoes.push(`${a.pmid || a.id}: versão corrente com temas não-array (${typeof a.temas})`);
        continue;
      }
      for (const id of a.temas) {
        if (!ehIdValido(id, esp)) violacoes.push(`${a.pmid || a.id} (${esp}): id fora da taxonomia: "${id}"`);
      }
    }
  }

  console.log(`VALIDAÇÃO DE TEMAS — taxonomia v${TAXONOMIA_VERSAO}`);
  console.log(`artigos avaliados: ${arts.length} · migrados/gravando v2: ${migrados} · pendentes de migração: ${pendentes}`);
  if (violacoes.length) {
    console.error(`\n✗ ${violacoes.length} VIOLAÇÕES:`);
    for (const v of violacoes.slice(0, 100)) console.error('  ' + v);
    process.exit(1);
  }
  console.log('✓ Nenhum artigo com tema fora da taxonomia.');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
