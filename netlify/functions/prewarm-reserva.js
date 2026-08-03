// Pré-aquecimento da reserva — GARANTE um banco profundo de candidatos VIVOS
// (enriquecidos, curados e ainda não enviados) por especialidade ANTES do e-mail.
//
// Motivação (incidentes 27-29/07): a reserva do PubMed era buscada só na hora do
// e-mail, dentro do orçamento de 180s do buildEspDigest. Especialidades finas
// (DTM, Prótese, Dentística, Ortodontia) chegavam à meia-noite com poucos
// candidatos e, quando a curadoria + a trava de veredito derrubavam alguns, a
// edição bloqueava. Este script move o ENCHIMENTO da reserva para o job de
// INGESTÃO — que roda ANTES, tem 25 min próprios e NÃO pressiona o tempo do
// e-mail. Assim o banco pode ser grande (dezenas por especialidade) sem risco de
// timeout, e o fallback na hora do e-mail vira apenas rede de segurança.
//
// Ordem no workflow: roda DEPOIS do process-article (para contar já o que foi
// enriquecido hoje) e ANTES do e-mail. Enriquece SÓ com Haiku (titulo_pt +
// resumo_pt), pulando o resumo_completo (Sonnet) — este é gerado sob demanda no
// e-mail apenas para os selecionados, então aqui seria desperdício.
//
// É best-effort e IDEMPOTENTE: uma especialidade que já tem banco cheio é pulada
// (custo zero); uma falha numa especialidade não afeta as outras nem o pipeline.
//
// Run: node netlify/functions/prewarm-reserva.js

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const log = require('./_lib/logger');
const { logCusto } = require('./_lib/ai-meter');

const { SPECIALTY_QUERIES, searchPmids, fetchArticles, saveArticle } = require('./ingest-pubmed');
const { processOne } = require('./process-article');
const { getEspHistory, getCandidates, passaCuradoria, isRepeated } = require('./daily-digest');

// Alvo de candidatos VIVOS por especialidade. Fora do orçamento do e-mail, então
// pode ser generoso. O acervo enriquecido PERSISTE, então a cada noite o banco
// só cresce até o alvo e depois se mantém (custo cai com o tempo).
const PREWARM_ALVO = parseInt(process.env.PREWARM_ALVO || '25', 10);
// Teto de artigos NOVOS ingeridos/enriquecidos por especialidade POR EXECUÇÃO —
// limita o custo/tempo de uma noite; o resto completa nas noites seguintes.
const PREWARM_MAX_INGEST = parseInt(process.env.PREWARM_MAX_INGEST || '18', 10);
// Varredura profunda limitada (cada página = 25 PMIDs).
const PREWARM_PAGE = 25;
const PREWARM_MAX_PAGINAS = 10;
// Orçamento global de tempo: nunca estoura o job de ingestão (25 min).
const PREWARM_BUDGET_MS = parseInt(process.env.PREWARM_BUDGET_MS || '1080000', 10); // 18 min
// Concorrência do enriquecimento (Haiku) — amigável ao rate limit.
const ENRIQ_LOTE = 5;

// Decide quantos artigos NOVOS buscar para uma especialidade. Pura → testável.
function planejarIngestao(liveCount, alvo = PREWARM_ALVO, capIngest = PREWARM_MAX_INGEST) {
  if (liveCount >= alvo) return 0;
  const deficit = alvo - liveCount;
  // +4 de folga: parte do que ingerir será barrada pela curadoria/veredito.
  return Math.min(capIngest, deficit + 4);
}

// Conta os candidatos VIVOS atuais (mesma definição do e-mail).
async function contarVivos(db, especialidade) {
  const [hist, cands] = await Promise.all([
    getEspHistory(db, especialidade).catch(() => new Set()),
    getCandidates(db, [especialidade]).catch(() => []),
  ]);
  const vivos = cands.filter(a => passaCuradoria(a) && !isRepeated(a, hist));
  return vivos.length;
}

// ── CURSOR do pré-aquecimento (incidente 03/08 — Prótese secou): sem cursor, a
// varredura recomeçava TODA noite da página 0 e batia sempre nos mesmos 250
// artigos; quando todos já estavam no banco, achava 0 novos para sempre —
// mesmo com milhares além da página 10 no acervo do PubMed. Agora cada
// especialidade guarda onde a varredura parou (ingest_cursor/prewarm_{slug})
// e a próxima noite CONTINUA dali; no fim do acervo, volta ao início.
function cursorIdPrewarm(specialty) {
  return 'prewarm_' + specialty.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_');
}
async function lerCursorPrewarm(db, specialty) {
  const doc = await db.getDoc('ingest_cursor', cursorIdPrewarm(specialty)).catch(() => null);
  return Number(doc?.retstart) || 0;
}
async function gravarCursorPrewarm(db, specialty, retstart) {
  await db.setDoc('ingest_cursor', cursorIdPrewarm(specialty), {
    especialidade: specialty, retstart, tipo: 'prewarm', atualizadoEm: new Date().toISOString(),
  }).catch(e => log.warn('[prewarm] cursor não gravado', { specialty, err: e.message }));
}

// Decide o próximo cursor após varrer `paginас` páginas a partir de `atual`.
// Pura → testável. Passou do fim do acervo → recomeça do zero.
function proximoCursor(atual, paginasVarridas, total, pageSize = PREWARM_PAGE) {
  const prox = atual + paginasVarridas * pageSize;
  return (total && prox >= total) ? 0 : prox;
}

// Busca PMIDs NOVOS (não no Firestore) varrendo o acervo A PARTIR DO CURSOR.
async function coletarNovosPmids(db, query, quantos, specialty) {
  const novos = [];
  const vistos = new Set();
  const base = specialty ? await lerCursorPrewarm(db, specialty) : 0;
  let paginasVarridas = 0;
  let totalAcervo = 0;
  for (let pagina = 0; pagina < PREWARM_MAX_PAGINAS && novos.length < quantos; pagina++) {
    const retstart = base + pagina * PREWARM_PAGE;
    let res;
    try {
      res = await searchPmids(query, PREWARM_PAGE, retstart);
    } catch (err) {
      log.warn('[prewarm] searchPmids falhou', { retstart, err: err.message });
      break;
    }
    paginasVarridas++;
    totalAcervo = res.total || totalAcervo;
    const pmids = (res.pmids || []).filter(p => !vistos.has(p));
    pmids.forEach(p => vistos.add(p));
    if (!pmids.length) break; // fim do acervo
    let existentes = new Set();
    try { existentes = await db.existingPmids(pmids); } catch { /* segue sem dedup */ }
    for (const p of pmids) {
      if (!existentes.has(p)) novos.push(p);
      if (novos.length >= quantos) break;
    }
    if (totalAcervo && retstart + PREWARM_PAGE >= totalAcervo) break; // varreu tudo
  }
  // AVANÇA o cursor mesmo quando tudo era repetido — página varrida não se
  // repete; a próxima noite continua de onde esta parou.
  if (specialty && paginasVarridas > 0) {
    await gravarCursorPrewarm(db, specialty, proximoCursor(base, paginasVarridas, totalAcervo));
  }
  return novos;
}

// Enriquece (Haiku, sem Sonnet) os artigos recém-salvos, em lotes paralelos.
async function enriquecerLote(db, artigos, especialidade) {
  let ativados = 0;
  for (let i = 0; i < artigos.length; i += ENRIQ_LOTE) {
    const lote = artigos.slice(i, i + ENRIQ_LOTE);
    const res = await Promise.allSettled(lote.map(a =>
      processOne(db, {
        id: a.pmid, titulo: a.title, abstract: a.abstract,
        journal: a.journal, year: a.year, especialidade,
      }, { skipResumoCompleto: true })
    ));
    for (const r of res) if (r.status === 'fulfilled' && r.value) ativados++;
  }
  return ativados;
}

async function aquecerEspecialidade(db, specialty, query) {
  const live = await contarVivos(db, specialty);
  const aIngerir = planejarIngestao(live);
  if (aIngerir === 0) {
    log.info('[prewarm] banco já cheio — pulando', { specialty, vivos: live, alvo: PREWARM_ALVO });
    return { specialty, vivos: live, ingeridos: 0, ativados: 0 };
  }
  log.info('[prewarm] banco fino — completando', { specialty, vivos: live, aIngerir });

  // Até 3 saltos de cursor NA MESMA NOITE: uma faixa 100% repetida não pode
  // custar um dia inteiro de espera (incidente 03/08 — a Prótese ficaria seca
  // mais uma noite só esperando o cursor passar do território já varrido).
  let novos = [];
  for (let salto = 0; salto < 3 && !novos.length; salto++) {
    novos = await coletarNovosPmids(db, query, aIngerir, specialty);
    if (!novos.length) log.info('[prewarm] faixa toda repetida — saltando o cursor adiante', { specialty, salto: salto + 1 });
  }
  if (!novos.length) {
    log.info('[prewarm] nenhum PMID novo na reserva', { specialty });
    return { specialty, vivos: live, ingeridos: 0, ativados: 0 };
  }

  let artigos = [];
  try { artigos = await fetchArticles(novos); } catch (err) {
    log.warn('[prewarm] fetchArticles falhou', { specialty, err: err.message });
    return { specialty, vivos: live, ingeridos: 0, ativados: 0 };
  }

  // Salva os crus (pending_enrichment); mantém só os efetivamente novos.
  const salvos = [];
  for (const art of artigos) {
    try {
      const ok = await saveArticle(db, art, specialty);
      if (ok) salvos.push(art);
    } catch (err) {
      // 409 = dedup por campo falhou mas o doc EXISTE (id igual) — duplicado
      // esperado, não erro; o cursor já avançou, amanhã varre além.
      if (/ALREADY_EXISTS|409/.test(err.message)) log.info('[prewarm] duplicado (doc já existe) — pulando', { pmid: art.pmid });
      else log.warn('[prewarm] saveArticle falhou', { pmid: art.pmid, err: err.message });
    }
  }

  const ativados = await enriquecerLote(db, salvos, specialty);
  log.info('[prewarm] especialidade aquecida', {
    specialty, vivosAntes: live, ingeridos: salvos.length, ativados,
  });
  return { specialty, vivos: live, ingeridos: salvos.length, ativados };
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { log.error('[prewarm] FIREBASE_API_KEY not set'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn('[prewarm] ANTHROPIC_API_KEY não definido — enriquecimento ficaria básico; abortando para não sujar o acervo');
    return { skipped: 'no_anthropic_key' };
  }

  const db = new Firestore(projectId, apiKey);
  const started = Date.now();
  const relatorio = [];

  for (const { specialty, query } of SPECIALTY_QUERIES) {
    if (Date.now() - started > PREWARM_BUDGET_MS) {
      log.warn('[prewarm] orçamento de tempo esgotado — parando (as restantes completam amanhã)', {
        feitas: relatorio.length, restantes: SPECIALTY_QUERIES.length - relatorio.length,
      });
      break;
    }
    try {
      relatorio.push(await aquecerEspecialidade(db, specialty, query));
    } catch (err) {
      log.error('[prewarm] especialidade falhou (seguindo)', { specialty, err: err.message });
      relatorio.push({ specialty, erro: err.message });
    }
  }

  const totalAtivados = relatorio.reduce((s, r) => s + (r.ativados || 0), 0);
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  log.info('[prewarm] pré-aquecimento completo', { especialidades: relatorio.length, ativados: totalAtivados, elapsed_s: elapsed });
  console.log('[prewarm] resumo:', JSON.stringify(relatorio));
  logCusto('pre-aquecimento');
  return { especialidades: relatorio.length, ativados: totalAtivados, elapsed_s: Number(elapsed) };
}

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try {
    const result = await main();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[prewarm] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Expostos para teste.
exports.planejarIngestao = planejarIngestao;
exports.proximoCursor = proximoCursor;
exports._internals = { PREWARM_ALVO, PREWARM_MAX_INGEST };

if (require.main === module) {
  main()
    .then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
