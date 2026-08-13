// REGENERAR RESUMOS CORTADOS (12/08 — "Fios de níquel-titânio" salvo com o
// resumo completo terminando em "— molares,").
//
// Duas facas cortavam no meio da frase sem detecção: o slice(0,4000) seco e o
// teto de 2500 tokens do modelo. A geração foi corrigida (nunca mais persiste
// meio-frase); este script CURA o acervo já gravado:
//   DRY_RUN=true  (padrão) → só lista, por especialidade, os resumos cortados
//   DRY_RUN=false          → REGENERA via generateResumoCompleto (Sonnet —
//                            tem custo! ~US$0,03/artigo) e grava no doc.
//   REGEN_LIMIT (padrão 40) → teto de regenerações por execução (controla o
//                            custo; o resto fica para a próxima rodada).
//
// A detecção usa o MESMO terminaFraseCompleta da geração/auditoria — uma
// definição só para as três pontas. Se a regeneração falhar, o texto antigo é
// APARADO na última frase completa (fica menor, mas nunca meio-frase).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const {
  generateResumoCompleto, terminaFraseCompleta, apararNaUltimaFrase,
} = require('../netlify/functions/_lib/claude');
const { logCusto } = require('../netlify/functions/_lib/ai-meter');

const DRY_RUN = !/^(false|0|n[aã]o|no)$/i.test(String(process.env.DRY_RUN ?? 'true').trim());
const LIMITE = Math.max(1, parseInt(process.env.REGEN_LIMIT || '40', 10) || 40);

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  if (!DRY_RUN && !process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY ausente para regenerar'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  console.log(`[regen-resumos] modo: ${DRY_RUN ? 'DRY-RUN (nada será gravado)' : `REGENERANDO (teto ${LIMITE} por execução)`} — input recebido: "${process.env.DRY_RUN ?? '(vazio, padrão true)'}"`);
  const artigos = await db.query('artigos', { limit: 5000 });
  const cortados = artigos.filter(a =>
    a.status === 'active'
    && String(a.resumo_completo || '').trim().length >= 200
    && !terminaFraseCompleta(a.resumo_completo));

  const porEsp = new Map();
  for (const a of cortados) {
    const e = a.especialidade || '(sem especialidade)';
    porEsp.set(e, (porEsp.get(e) || 0) + 1);
  }
  console.log(`[regen-resumos] ${cortados.length} resumo(s) cortado(s) em ${artigos.length} artigos`);
  for (const [e, n] of [...porEsp.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${e}: ${n}`);
  cortados.slice(0, 10).forEach(a =>
    console.log(`  · ${a.id}: "${String(a.titulo_pt || a.titulo).slice(0, 60)}" — cauda: "…${String(a.resumo_completo).trim().slice(-40)}"`));

  if (DRY_RUN) {
    console.log('[regen-resumos] DRY-RUN — rode com dry_run=false para regenerar (custo Sonnet ~US$0,03/artigo).');
    return;
  }

  let regenerados = 0, aparados = 0, falhas = 0;
  for (const a of cortados.slice(0, LIMITE)) {
    try {
      const novo = await generateResumoCompleto(a);
      if (novo && terminaFraseCompleta(novo)) {
        await db.updateDoc('artigos', a.id, { resumo_completo: novo });
        regenerados++;
        console.log(`  REGENERADO ${a.id} (${novo.length} chars)`);
      } else {
        // Regeneração indisponível: apara o texto atual na última frase —
        // menor, porém nunca meio-frase na tela do dentista.
        const aparado = apararNaUltimaFrase(a.resumo_completo);
        if (aparado.length >= 200) {
          await db.updateDoc('artigos', a.id, { resumo_completo: aparado });
          aparados++;
          console.log(`  APARADO ${a.id} (${String(a.resumo_completo).length} → ${aparado.length} chars)`);
        } else {
          falhas++;
          console.error(`  FALHA ${a.id}: regeneração nula e apara ficaria curta demais`);
        }
      }
    } catch (err) {
      falhas++;
      console.error(`  FALHA ${a.id}: ${err.message}`);
    }
  }
  const restantes = Math.max(0, cortados.length - LIMITE);
  console.log(`[regen-resumos] concluído — regenerados: ${regenerados}, aparados: ${aparados}, falhas: ${falhas}${restantes ? `, restantes p/ próxima rodada: ${restantes}` : ''}`);
  logCusto('regen-resumos-cortados');
  if (falhas) process.exit(1);
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
