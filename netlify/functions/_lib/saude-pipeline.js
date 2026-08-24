// HEALTH CHECK DO PIPELINE — Fase 4 da spec 2 (24/08). SÓ LEITURA.
//
// Avalia: (a) o job de HOJE rodou? quantas edições saíram e quantos artigos
// completaram TODAS as etapas (resumo, nível, especialidade, tema, resumo
// completo, ÁUDIO)? (b) integridade dos ÚLTIMOS 7 DIAS: artigo de edição sem
// áudio ou fora da biblioteca é violação (o "teste automatizado que falha").
//
// Quem decide alerta/exit code é o chamador (script do workflow): este módulo
// só mede e devolve { ok, problemas, ... } — testável sem rede.

const { audioUrlDe } = require('./storage');

const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });
const dia = (s) => String(s || '').slice(0, 10);

async function avaliarSaude(db, opts = {}) {
  const hoje = opts.hoje || new Date().toISOString().slice(0, 10);
  const bucket = opts.bucket || ((process.env.FIREBASE_PROJECT_ID || 'orthoradar') + '.appspot.com');
  const minEdicoesEsperadas = Number(opts.minEdicoesEsperadas) > 0 ? Number(opts.minEdicoesEsperadas) : 1;
  const corte7d = dia(new Date(new Date(hoje + 'T00:00:00Z') - 7 * 86400000).toISOString());

  const edicoes = await db.query('digests_especialidade', { select: sel('date', 'especialidade', 'pmids'), limit: 5000 }).catch(() => []);
  const recentes = edicoes.filter(e => dia(e.date) >= corte7d && dia(e.date) <= hoje);
  const deHoje = recentes.filter(e => dia(e.date) === hoje);

  // Mapa de áudio (mesma derivação da biblioteca).
  const comAudio = new Set();
  for (const coll of ['podcast_arquivo', 'podcast_episodios']) {
    const eps = await db.query(coll, { select: sel('artigoId', 'objectPath', 'downloadToken', 'url', 'tipo'), limit: 5000 }).catch(() => []);
    for (const e of eps) if (e.tipo !== 'completo' && e.artigoId && audioUrlDe(e, bucket)) comAudio.add(String(e.artigoId));
  }

  const pmidsRecentes = [...new Set(recentes.flatMap(e => (e.pmids || []).map(String)))];
  const porPmid = new Map();
  const arts = await db.query('artigos', {
    select: sel('pmid', 'titulo_pt', 'resumo_pt', 'nivel_evidencia', 'especialidade', 'tema', 'temas', 'resumo_completo', 'status'),
    limit: 5000,
  }).catch(() => []);
  for (const a of arts) porPmid.set(String(a.pmid || a.id || ''), a);

  const etapasCompletas = (a, pmid) =>
    !!a && a.status === 'active' &&
    String(a.titulo_pt || '').trim().length >= 10 &&
    String(a.resumo_pt || '').length > 50 &&
    !!a.nivel_evidencia && !!a.especialidade &&
    ((Array.isArray(a.temas) && a.temas.length > 0) || !!a.tema) &&
    String(a.resumo_completo || '').length > 100 &&
    comAudio.has(pmid);

  // (a) Hoje.
  const artigosHoje = [...new Set(deHoje.flatMap(e => (e.pmids || []).map(String)))];
  const completosHoje = artigosHoje.filter(p => etapasCompletas(porPmid.get(p), p)).length;

  // (b) Últimos 7 dias — violações nomeadas por etapa faltante.
  const violacoes = [];
  for (const pmid of pmidsRecentes) {
    const a = porPmid.get(pmid);
    if (!a) { violacoes.push({ pmid, falta: 'artigo inexistente no banco' }); continue; }
    const faltas = [];
    if (!comAudio.has(pmid)) faltas.push('sem áudio (fora da biblioteca)');
    if (String(a.resumo_completo || '').length <= 100) faltas.push('sem resumo completo');
    if (!((Array.isArray(a.temas) && a.temas.length > 0) || a.tema)) faltas.push('sem tema');
    if (faltas.length) violacoes.push({ pmid, falta: faltas.join(' + ') });
  }

  const problemas = [];
  if (deHoje.length < minEdicoesEsperadas) {
    problemas.push(`HOJE (${hoje}): ${deHoje.length} edição(ões) persistida(s) — abaixo do mínimo esperado (${minEdicoesEsperadas}). O job rodou?`);
  }
  if (artigosHoje.length && completosHoje < artigosHoje.length) {
    problemas.push(`HOJE: só ${completosHoje}/${artigosHoje.length} artigos completaram TODAS as etapas (inclui áudio).`);
  }
  if (violacoes.length) {
    problemas.push(`ÚLTIMOS 7 DIAS: ${violacoes.length} artigo(s) de edição sem áudio/etapa completa.`);
  }

  return {
    ok: problemas.length === 0,
    hoje,
    edicoesHoje: deHoje.length,
    especialidadesHoje: deHoje.map(e => e.especialidade).sort(),
    artigosHoje: artigosHoje.length,
    completosHoje,
    janela7d: { de: corte7d, ate: hoje, artigos: pmidsRecentes.length, violacoes: violacoes.slice(0, 50) },
    problemas,
  };
}

module.exports = { avaliarSaude };
