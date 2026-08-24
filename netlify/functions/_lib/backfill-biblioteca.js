// BACKFILL DA BIBLIOTECA — Fase 3 da spec 2 (24/08).
//
// Repõe o que falta para o artigo entrar na biblioteca: o PODCAST (a
// biblioteca deriva de artigo ativo + título PT + ter áudio — regra 07/08).
// Idempotente: quem já tem episódio em qualquer coleção é pulado. Lotes
// pequenos com pausa e retry/backoff (TTS + Storage). DRY-RUN por padrão —
// lista candidatos e CUSTO ESTIMADO sem gerar nada.
//
// O GERADOR é injetado (scripts/backfill-biblioteca.js passa o real:
// generateScript → synthesizeLong → uploadMp3 → podcast_arquivo); os testes
// passam um fake. Este módulo só orquestra: seleção, filtros, lotes, retry.

const log = require('./logger');

const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });
const LOTE = 5;
const PAUSA_MS = 2000;
const TENTATIVAS = 3; // 1 + 2 retries com backoff 2s/4s
const CUSTO_ESTIMADO_POR_ARTIGO_USD = 0.03; // roteiro (IA) + TTS — ordem de grandeza p/ o dry-run

async function artigosComAudio(db) {
  const com = new Set();
  for (const coll of ['podcast_arquivo', 'podcast_episodios']) {
    const eps = await db.query(coll, { select: sel('artigoId', 'tipo'), limit: 5000 }).catch(() => []);
    for (const e of eps) if (e.tipo !== 'completo' && e.artigoId) com.add(String(e.artigoId));
  }
  const salvos = await db.query('podcast_salvos', { select: sel('secs'), limit: 5000 }).catch(() => []);
  for (const s of salvos) if (s.id) com.add(String(s.id));
  return com;
}

/**
 * opts: dryRun (true) · limit (20) · especialidade · dataDe/dataAte (YYYY-MM-DD,
 * sobre artigo.data) · gerar: async (artigo) => void (obrigatório fora do
 * dry-run) · pausaMs/backoffMs (testes).
 */
async function backfillBiblioteca(db, opts = {}) {
  const dryRun = opts.dryRun !== false;
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 20;
  const pausa = opts.pausaMs !== undefined ? opts.pausaMs : PAUSA_MS;
  const backoff = opts.backoffMs !== undefined ? opts.backoffMs : 2000;
  if (!dryRun && typeof opts.gerar !== 'function') throw new Error('fora do dry-run é obrigatório injetar gerar()');

  const com = await artigosComAudio(db);
  const arts = await db.query('artigos', {
    select: sel('pmid', 'titulo_pt', 'especialidade', 'data', 'status', 'resumo_pt', 'resumo_completo'),
    limit: 5000,
  });

  // Candidato: entraria na biblioteca se tivesse áudio.
  let candidatos = arts.filter(a =>
    a.status === 'active' &&
    String(a.titulo_pt || '').trim().length >= 10 &&
    !com.has(String(a.pmid || a.id || '')));
  if (opts.especialidade) candidatos = candidatos.filter(a => a.especialidade === opts.especialidade);
  if (opts.dataDe) candidatos = candidatos.filter(a => String(a.data || '').slice(0, 10) >= opts.dataDe);
  if (opts.dataAte) candidatos = candidatos.filter(a => String(a.data || '').slice(0, 10) <= opts.dataAte);
  candidatos.sort((x, y) => String(y.data || '').localeCompare(String(x.data || ''))); // recentes primeiro

  const porEsp = {};
  for (const a of candidatos) porEsp[a.especialidade || '(sem)'] = (porEsp[a.especialidade || '(sem)'] || 0) + 1;

  const base = {
    dryRun,
    totalSemAudio: candidatos.length,
    porEspecialidade: porEsp,
    processariaNesteRun: Math.min(limit, candidatos.length),
    custoEstimadoDoRunUSD: +(Math.min(limit, candidatos.length) * CUSTO_ESTIMADO_POR_ARTIGO_USD).toFixed(2),
    custoEstimadoTotalUSD: +(candidatos.length * CUSTO_ESTIMADO_POR_ARTIGO_USD).toFixed(2),
    amostra: candidatos.slice(0, 20).map(a => ({ pmid: String(a.pmid || a.id || ''), especialidade: a.especialidade, data: String(a.data || '').slice(0, 10), titulo: String(a.titulo_pt || '').slice(0, 80) })),
  };
  if (dryRun) return { ...base, gerados: 0, falhas: 0 };

  let gerados = 0, falhas = 0;
  const falhasDetalhe = [];
  const fila = candidatos.slice(0, limit);
  for (let i = 0; i < fila.length; i += LOTE) {
    const lote = fila.slice(i, i + LOTE);
    for (const a of lote) {
      let ok = false;
      for (let t = 0; t < TENTATIVAS && !ok; t++) {
        try {
          if (t > 0) await new Promise(r => setTimeout(r, backoff * Math.pow(2, t - 1)));
          await opts.gerar(a);
          ok = true; gerados++;
        } catch (err) {
          if (t === TENTATIVAS - 1) {
            falhas++;
            falhasDetalhe.push({ pmid: String(a.pmid || a.id || ''), err: err.message.slice(0, 120) });
            log.warn('[backfill-biblioteca] artigo falhou após retries — segue o lote', { pmid: a.pmid, err: err.message });
          }
        }
      }
    }
    if (i + LOTE < fila.length && pausa) await new Promise(r => setTimeout(r, pausa));
  }
  return { ...base, gerados, falhas, falhasDetalhe: falhasDetalhe.slice(0, 20) };
}

module.exports = { backfillBiblioteca, artigosComAudio, CUSTO_ESTIMADO_POR_ARTIGO_USD, LOTE, TENTATIVAS };
