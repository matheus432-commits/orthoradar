// AI Enrichment Processor — picks up articles with status "pending_enrichment",
// enriches each with Claude Haiku, then sets status to "active".
//
// Runs after all ingest functions complete (GitHub Actions: sequential steps).
// Hard limit: MAX_ARTICLES_PER_RUN to control Claude API cost.
//
// Run: node netlify/functions/process-article.js

const { Firestore }           = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { enrichArticle, generateResumoCompleto, currentCost, resetCost } = require('./_lib/claude');
const { scoreRelevance, estimateQualityScore, especialidadeOverride, isUnfinishedStudy } = require('./_lib/scoring');
const log                     = require('./_lib/logger');

const MAX_ARTICLES_PER_RUN = parseInt(process.env.AI_BATCH_SIZE || '20', 10);

// ── Fetch articles awaiting enrichment ────────────────────────────────────────

async function getPendingArticles(db, limit) {
  // No orderBy — combining where+orderBy on different fields needs a composite index.
  // Fetch a larger batch and sort client-side (FIFO by criadoEm).
  const docs = await db.query('artigos', {
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'pending_enrichment' } } },
    limit: Math.min(limit * 3, 60), // fetch extra to sort, then trim
  });
  docs.sort((a, b) => (a.criadoEm || '') < (b.criadoEm || '') ? -1 : 1);
  return docs.slice(0, limit);
}

// ── Process one article ────────────────────────────────────────────────────────

// Marca o artigo como rejeitado (fora do digest) sem gastar mais IA/Sonnet.
async function rejectUnfinished(db, pmid, motivo, detalhe) {
  log.info('[process] REJEITADO — estudo não concluído', { id: pmid, motivo, detalhe: (detalhe || '').slice(0, 80) });
  await db.updateDoc('artigos', pmid, {
    status:        'rejected_unfinished',
    rejectReason:  motivo,
    enrichedAt:    new Date().toISOString(),
  }).catch(err => log.warn('[process] updateDoc reject failed', { id: pmid, err: err.message }));
  return false;
}

async function processOne(db, article) {
  const pmid = article.id; // document ID = PMID (or doi_... fallback)
  const rawTitulo = article.titulo || article.title || '';

  // ── GATE 1 (determinístico, antes de gastar IA): protocolos/estudos em
  // andamento NUNCA entram no OdontoFeed — só publicamos estudos com resultados.
  if (isUnfinishedStudy(rawTitulo, article.abstract || '', article.journal || '')) {
    return rejectUnfinished(db, pmid, 'protocolo_ou_em_andamento', rawTitulo);
  }

  log.info('[process] enriching', { id: pmid, title: rawTitulo.slice(0, 60) });

  const enriched = await enrichArticle({
    pmid:         pmid,
    titulo:       article.titulo   || article.title || '',
    abstract:     article.abstract || '',
    journal:      article.journal  || '',
    year:         article.year     || '',
    especialidade: article.especialidade || '',
  });

  if (!enriched) {
    // Enrichment unavailable — activate with basic scoring so digest can still run
    const basicScore = scoreRelevance({ ...article, nivel_evidencia: null, qualidadeIA: 0.5 });
    await db.updateDoc('artigos', pmid, {
      status:         'active',
      qualidadeIA:    0.5,
      relevanceScore: basicScore,
      enrichedAt:     new Date().toISOString(),
      enrichErrors:   (article.enrichErrors || 0) + 1,
      enrichSkipped:  true,
    }).catch(err => log.warn('[process] updateDoc fallback-active failed', { id: pmid, err: err.message }));
    return false;
  }

  // ── GATE 2 (IA): a classificação de conteúdo detectou protocolo/sem
  // resultados que o gate determinístico não pegou → rejeita antes de ativar.
  if (enriched.concluido === false) {
    return rejectUnfinished(db, pmid, 'ia_sem_resultados', rawTitulo);
  }

  const qualidadeIA    = estimateQualityScore(enriched);
  const updatedArticle = {
    ...article,
    ...enriched,
    qualidadeIA,
    // Recompute relevance score with new quality signal
    relevanceScore: scoreRelevance({
      ...article,
      nivel_evidencia: enriched.nivel_evidencia,
      qualidadeIA,
    }),
  };
  const scoreNow = updatedArticle.relevanceScore;

  const updateFields = {
    titulo_pt:          enriched.titulo_pt,
    resumo_pt:          enriched.resumo_pt,
    impacto_pratico:    enriched.impacto_pratico,
    achados_principais: enriched.achados_principais,
    nivel_evidencia:    enriched.nivel_evidencia,
    limitacoes:         enriched.limitacoes,
    tempo_leitura:      enriched.tempo_leitura,
    qualidadeIA,
    relevanceScore:     scoreNow,
    status:             'active',
    enrichedAt:         new Date().toISOString(),
  };

  // O rótulo da ingestão vem da QUERY de busca e pode estar errado (ex.: artigo
  // de odontopediatria achado pela busca de Prótese). A classificação da IA pelo
  // conteúdo real prevalece; o rótulo antigo fica em especialidadeOriginal.
  // Por cima da IA, o override determinístico dá a palavra FINAL nos casos que
  // não podem errar (dentição decídua → Odontopediatria; restauração direta
  // rotulada Prótese → Dentística).
  let especialidadeFinal = enriched.especialidade || article.especialidade || '';
  const forced = especialidadeOverride(
    article.titulo || article.title || '', article.abstract || '', especialidadeFinal
  );
  if (forced && forced !== especialidadeFinal) {
    log.info('[process] override determinístico de especialidade', {
      id: pmid, ia: especialidadeFinal, forcada: forced,
    });
    especialidadeFinal = forced;
  }
  if (especialidadeFinal && especialidadeFinal !== article.especialidade) {
    updateFields.especialidade         = especialidadeFinal;
    updateFields.especialidadeOriginal = article.especialidade || '';
    log.info('[process] especialidade reclassificada', {
      id: pmid, de: article.especialidade || '(vazia)', para: especialidadeFinal,
    });
  }

  // Resumo completo para o site (Sonnet + validador numérico) — best-effort:
  // se reprovar/falhar, a página usa o resumo curto; nunca bloqueia a ativação.
  const resumoCompleto = await generateResumoCompleto({
    pmid, titulo: article.titulo || article.title || '',
    abstract: article.abstract || '', journal: article.journal || '', year: article.year || '',
  }).catch(() => null);
  if (resumoCompleto) updateFields.resumo_completo = resumoCompleto;

  await db.updateDoc('artigos', pmid, updateFields);

  log.info('[process] enriched', {
    id:         pmid,
    quality:    qualidadeIA.toFixed(2),
    relevance:  scoreNow,
    cost_usd:   currentCost().toFixed(4),
  });
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[process] FIREBASE_API_KEY not set'); process.exit(1); }

  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('[process] ANTHROPIC_API_KEY not set — will activate articles with basic scoring only');
  }

  resetCost();

  const db = new Firestore(projectId, apiKey);

  let pending;
  try {
    pending = await getPendingArticles(db, MAX_ARTICLES_PER_RUN);
  } catch (err) {
    log.error('[process] getPendingArticles failed', { err: err.message });
    return { processed: 0, errors: 0, cost_usd: 0, skipped_reason: 'firestore_query_failed' };
  }

  if (!pending.length) {
    log.info('[process] no pending articles');
    return { processed: 0, errors: 0, cost_usd: 0 };
  }

  log.info('[process] starting', { count: pending.length, limit: MAX_ARTICLES_PER_RUN });

  let success = 0, errors = 0;

  for (const article of pending) {
    const ok = await processOne(db, article);
    if (ok) success++;
    else errors++;

    // 500ms pause between articles: stays well within Claude's rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  const costUsd = currentCost();
  log.info('[process] complete', {
    processed:  success,
    errors,
    remaining:  pending.length - success - errors,
    cost_usd:   costUsd.toFixed(4),
  });

  return { processed: success, errors, cost_usd: parseFloat(costUsd.toFixed(4)) };
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[process] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
