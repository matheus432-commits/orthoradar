// Gera o resumo_completo FALTANTE dos artigos da edição de HOJE (incidente
// 24/07: madrugada de API Claude lenta deixou vários artigos sem o resumo
// completo). Grava no doc `artigos` E atualiza o snapshot do digest (é dele que
// o site lê a edição). NÃO mexe em áudio — o generate-podcasts cuida disso.
//
// Envs: FIREBASE_* (+ SERVICE_ACCOUNT p/ escrita), ANTHROPIC_API_KEY.
// FIX_DATE opcional (YYYY-MM-DD; default hoje).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { generateResumoCompleto } = require('../netlify/functions/_lib/claude');

const MIN_RC = 200; // mesmo piso da auditoria

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !process.env.ANTHROPIC_API_KEY) { console.log('FALTAM_SECRETS'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);
  const HOJE = process.env.FIX_DATE || new Date().toISOString().slice(0, 10);

  const digests = (await db.query('digests_especialidade', { limit: 100 }).catch(() => []))
    .filter(d => String(d.id || '').endsWith('_' + HOJE));
  console.log(`digests de ${HOJE}: ${digests.length}`);

  let gerados = 0, jaTinha = 0, falhou = 0;
  for (const d of digests) {
    let tocado = false;
    for (const a of (Array.isArray(d.artigos) ? d.artigos : [])) {
      if (String(a.resumo_completo || '').trim().length >= MIN_RC) { jaTinha++; continue; }
      const id = String(a.pmid || a.id || '');
      // O prompt do resumo usa o ABSTRACT — que fica no doc completo, não no
      // snapshot enxuto do digest. Busca o doc e mescla os campos já traduzidos.
      const full = (await db.getDoc('artigos', id).catch(() => null)) || {};
      const artigo = { ...full, ...a };
      let texto = null;
      try { texto = await generateResumoCompleto(artigo); }
      catch (e) { console.log('ERRO', d.id, id, e.message); }
      if (texto && texto.length >= MIN_RC) {
        a.resumo_completo = texto; tocado = true; gerados++;
        await db.updateDoc('artigos', id, { resumo_completo: texto })
          .catch(e => console.log('  (cache save falhou p/', id, ':', e.message, ')'));
        console.log('OK', d.id, id, '—', texto.length, 'chars');
      } else { falhou++; console.log('FALHOU (sem resumo)', d.id, id); }
    }
    if (tocado) {
      await db.setDoc('digests_especialidade', d.id, d);
      console.log('SNAPSHOT do digest atualizado:', d.id);
    }
  }
  console.log(`\nFIM: gerados=${gerados} jaTinha=${jaTinha} falhou=${falhou}`);
  process.exit(falhou ? 1 : 0);
})().catch(e => { console.error('ERRO_FATAL', e.message); process.exit(1); });

// rerun 2026-07-24T10:55Z: reprocessa a edição de hoje com o teto de 180s (34aaa1a).

// rerun 2026-07-24T11:08Z: teto 180s + extração robusta de content[] (ccdd8d1).
