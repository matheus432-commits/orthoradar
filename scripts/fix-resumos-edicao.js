// Gera o resumo_completo FALTANTE dos artigos das edições recentes (incidente
// 24/07: madrugada de API lenta; incidentes 22-25/08: validador numérico
// reprovava número fiel com formatação de milhar pt-BR — corrigido em
// numeric-check.js — e o artigo saía no e-mail com o "Ler resumo completo"
// vazio PARA SEMPRE, porque nada re-tentava depois).
//
// Agora com LOOKBACK: um run varre as edições dos últimos N dias (padrão 7) e
// completa só o que falta — idempotente e barato (re-gera apenas as falhas,
// normalmente 0-3 artigos). Também roda TODO DIA como passo de auto-cura do
// pipeline (daily-pipeline.yml, antes da auditoria): a falha de ontem se
// corrige na madrugada seguinte, com outro sorteio da API e o strictNote.
//
// Grava no doc `artigos` E atualiza o snapshot do digest (é dele que o site
// lê a edição). NÃO mexe em áudio — o generate-podcasts cuida disso.
//
// Envs: FIREBASE_* (+ SERVICE_ACCOUNT p/ escrita), ANTHROPIC_API_KEY.
//   FIX_DATE (YYYY-MM-DD)  — corrige SÓ aquele dia (modo antigo, via input);
//   FIX_LOOKBACK (número)  — sem FIX_DATE: dias cobertos até hoje (padrão 7).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { generateResumoCompleto } = require('../netlify/functions/_lib/claude');

const MIN_RC = 200; // mesmo piso da auditoria

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !process.env.ANTHROPIC_API_KEY) { console.log('FALTAM_SECRETS'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  // Datas cobertas: FIX_DATE exato, ou a janela de lookback terminando hoje.
  const datas = new Set();
  if (process.env.FIX_DATE) {
    datas.add(String(process.env.FIX_DATE).slice(0, 10));
  } else {
    const n = Number(process.env.FIX_LOOKBACK) > 0 ? Number(process.env.FIX_LOOKBACK) : 7;
    for (let i = 0; i < n; i++) {
      datas.add(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    }
  }
  console.log('datas cobertas:', [...datas].sort().join(', '));

  const digests = (await db.query('digests_especialidade', { limit: 300 }).catch(() => []))
    .filter(d => [...datas].some(dt => String(d.id || '').endsWith('_' + dt)));
  console.log(`digests na janela: ${digests.length}`);

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

// rerun 2026-08-25T11:45Z: nova tentativa dos 4 restantes com o extenso composto (385079e).
