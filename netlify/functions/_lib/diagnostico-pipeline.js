// DIAGNÓSTICO DO PIPELINE BIBLIOTECA/ÁUDIO — Fase 1 da spec 2 (24/08).
// SÓ LEITURA: nenhum dado é alterado.
//
// Problema reportado: biblioteca de Ortodontia com só 63 artigos com áudio.
// Este relatório mede as hipóteses H1-H7 com DADOS, sem assumir nenhuma:
//   1. reconciliação temporal (edições/dia com zeros e datas faltantes);
//   2. cobertura por etapa do funil (onde o pipeline vaza);
//   3. cruzamento e-mail × biblioteca (50 IDs de cada divergência);
//   4. cobertura de áudio (por especialidade, temporal, POSIÇÃO NO LOTE,
//      existência real no storage via HEAD);
//   5. execuções (derivadas das edições persistidas por dia);
//   6. configuração real do sistema.
//
// FATOS DE ARQUITETURA que o relatório declara (diferem das premissas da
// spec, escrita para Netlify KV/scheduled functions):
//   • o job diário roda em GITHUB ACTIONS (4 jobs, ~04:50-06:00 UTC), não em
//     Netlify scheduled function — não há teto de 10s/26s no envio (H1 na
//     forma "timeout de function" não se aplica; a hipótese vira "áudio só
//     dos 3 da edição");
//   • o banco é FIRESTORE (REST), não Netlify KV; áudios ficam no FIREBASE
//     STORAGE com URL persistida no episódio;
//   • "publicado na biblioteca" NÃO é flag: a biblioteca DERIVA de
//     artigo ativo + título PT + TER PODCAST (regra do fundador 07/08) — a
//     H7 é portanto verdadeira POR DESIGN para artigos sem áudio, e os
//     extras premium (sem áudio por design) nunca aparecem nela.

const { audioUrlDe } = require('./storage');
const { request } = require('../_lib');

const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });
const dia = (s) => String(s || '').slice(0, 10);

// Série diária completa entre min e max, com zeros explícitos.
function serieDiaria(datas) {
  const cont = new Map();
  for (const d of datas) if (d) cont.set(d, (cont.get(d) || 0) + 1);
  const dias = [...cont.keys()].sort();
  if (!dias.length) return { serie: [], diasSemNada: [], primeiro: null, ultimo: null, diasCorridos: 0 };
  const primeiro = dias[0], ultimo = dias[dias.length - 1];
  const serie = [], diasSemNada = [];
  for (let t = new Date(primeiro + 'T00:00:00Z'); dia(t.toISOString()) <= ultimo; t = new Date(+t + 86400000)) {
    const d = dia(t.toISOString());
    const n = cont.get(d) || 0;
    serie.push({ d, n });
    if (!n) diasSemNada.push(d);
  }
  return { serie, diasSemNada, primeiro, ultimo, diasCorridos: serie.length };
}

// HEAD nos áudios persistidos (amostra limitada): URL gravada ≠ arquivo lá.
async function verificarStorage(urls, { max = 60, concorrencia = 8, verificarUrl } = {}) {
  const alvo = urls.slice(0, max);
  const check = verificarUrl || (async (u) => {
    try {
      const p = new URL(u);
      const res = await request({ hostname: p.hostname, path: p.pathname + p.search, method: 'HEAD' });
      return res.status === 200;
    } catch { return false; }
  });
  const quebradas = [];
  for (let i = 0; i < alvo.length; i += concorrencia) {
    const lote = alvo.slice(i, i + concorrencia);
    const oks = await Promise.all(lote.map(check));
    oks.forEach((ok, k) => { if (!ok) quebradas.push(lote[k]); });
  }
  return { verificadas: alvo.length, quebradas: quebradas.length, exemplosQuebradas: quebradas.slice(0, 10) };
}

async function construirDiagnosticoPipeline(db, opts = {}) {
  const bucket = opts.bucket || ((process.env.FIREBASE_PROJECT_ID || 'orthoradar') + '.appspot.com');

  // ── Fontes ────────────────────────────────────────────────────────────────
  // queryAll (27/08): o diagnóstico existe para dar o número VERDADEIRO —
  // com limit fixo ele herdaria o mesmo corte silencioso que encolheu a
  // biblioteca quando artigos passou de 5.000 docs.
  const arts = await db.queryAll('artigos', {
    select: sel('pmid', 'titulo_pt', 'resumo_pt', 'impacto_pratico', 'nivel_evidencia', 'especialidade', 'tema', 'temas', 'status', 'data', 'resumo_completo'),
  });
  const episodios = [];
  for (const coll of ['podcast_arquivo', 'podcast_episodios']) {
    const eps = await db.queryAll(coll, {
      select: sel('artigoId', 'objectPath', 'downloadToken', 'url', 'date', 'especialidade', 'tipo'),
    }).catch(() => []);
    for (const e of eps) if (e.tipo !== 'completo') episodios.push({ ...e, _coll: coll });
  }
  const salvos = await db.queryAll('podcast_salvos', { select: sel('objectPath', 'downloadToken', 'url') }).catch(() => []);
  const edicoes = await db.queryAll('digests_especialidade', {
    select: sel('date', 'especialidade', 'pmids'),
  }).catch(() => []);

  // Mapa pmid → áudio (mesma derivação do acervo/biblioteca).
  const audioDe = new Map();
  for (const e of episodios) {
    const k = String(e.artigoId || '');
    const url = audioUrlDe(e, bucket);
    if (k && url && !audioDe.has(k)) audioDe.set(k, { url, date: dia(e.date), coll: e._coll });
  }
  for (const s of salvos) {
    const url = audioUrlDe(s, bucket);
    if (s.id && url && !audioDe.has(String(s.id))) audioDe.set(String(s.id), { url, date: '', coll: 'podcast_salvos' });
  }

  // ── 1. Reconciliação temporal ────────────────────────────────────────────
  const porEspSeries = {};
  const espsEdicao = [...new Set(edicoes.map(e => e.especialidade).filter(Boolean))].sort();
  for (const esp of espsEdicao) {
    const s = serieDiaria(edicoes.filter(e => e.especialidade === esp).map(e => dia(e.date)));
    const pmidsEnviados = edicoes.filter(e => e.especialidade === esp).flatMap(e => e.pmids || []);
    porEspSeries[esp] = {
      primeiraEdicao: s.primeiro, ultimaEdicao: s.ultimo, diasCorridos: s.diasCorridos,
      diasComEdicao: s.serie.filter(x => x.n > 0).length,
      diasSemEdicao: s.diasSemNada,
      artigosEnviadosNasEdicoes: pmidsEnviados.length,
      esperadoNaCadencia3PorDia: s.serie.filter(x => x.n > 0).length * 3,
    };
  }

  // ── 2. Cobertura por etapa do funil ──────────────────────────────────────
  const pmidsEmEdicao = new Set(edicoes.flatMap(e => (e.pmids || []).map(String)));
  const funilPorEsp = {};
  const funilDe = (esp) => funilPorEsp[esp] || (funilPorEsp[esp] = {
    total: 0, ativos: 0, comResumo: 0, comImpacto: 0, comNivel: 0, comEspecialidade: 0,
    comTema: 0, comResumoCompleto: 0, comAudio: 0, naBiblioteca: 0, enviadoEmEdicao: 0,
  });
  const elegivelBiblioteca = (a) => a.status === 'active' && String(a.titulo_pt || '').trim().length >= 10;
  for (const a of arts) {
    const esp = a.especialidade || '(sem)';
    const f = funilDe(esp);
    const pmid = String(a.pmid || a.id || '');
    f.total++;
    if (a.status === 'active') f.ativos++;
    if (String(a.resumo_pt || '').length > 50) f.comResumo++;
    if (String(a.impacto_pratico || '').length > 10) f.comImpacto++;
    if (a.nivel_evidencia) f.comNivel++;
    if (a.especialidade) f.comEspecialidade++;
    if ((Array.isArray(a.temas) && a.temas.length) || a.tema) f.comTema++;
    if (String(a.resumo_completo || '').length > 100) f.comResumoCompleto++;
    if (audioDe.has(pmid)) f.comAudio++;
    if (elegivelBiblioteca(a) && audioDe.has(pmid)) f.naBiblioteca++;
    if (pmidsEmEdicao.has(pmid)) f.enviadoEmEdicao++;
  }

  // ── 3. Cruzamento e-mail × biblioteca ────────────────────────────────────
  const porPmid = new Map(arts.map(a => [String(a.pmid || a.id || ''), a]));
  const enviadosSemBiblioteca = [];
  for (const pmid of pmidsEmEdicao) {
    const a = porPmid.get(pmid);
    const na = a && elegivelBiblioteca(a) && audioDe.has(pmid);
    if (!na) {
      enviadosSemBiblioteca.push({
        pmid,
        motivo: !a ? 'artigo não existe no banco'
          : !audioDe.has(pmid) ? 'sem áudio (biblioteca exige podcast — regra 07/08)'
          : a.status !== 'active' ? `status=${a.status}`
          : 'título PT ausente/curto',
      });
    }
  }
  const bibliotecaSemEnvio = [];
  for (const [pmid, a] of porPmid.entries()) {
    if (elegivelBiblioteca(a) && audioDe.has(pmid) && !pmidsEmEdicao.has(pmid)) bibliotecaSemEnvio.push(pmid);
  }

  // ── 4. Cobertura de áudio ────────────────────────────────────────────────
  const audioTemporal = serieDiaria(episodios.map(e => dia(e.date)).filter(Boolean));
  // Posição no lote: dentro de cada edição, quais posições têm áudio (H1).
  const porPosicao = [];
  for (const e of edicoes) {
    (e.pmids || []).forEach((pmid, i) => {
      porPosicao[i] = porPosicao[i] || { posicao: i + 1, comAudio: 0, semAudio: 0 };
      if (audioDe.has(String(pmid))) porPosicao[i].comAudio++; else porPosicao[i].semAudio++;
    });
  }
  const storage = await verificarStorage([...audioDe.values()].map(v => v.url), opts);

  // ── 5/6. Execuções + configuração real ───────────────────────────────────
  const execucoes = serieDiaria(edicoes.map(e => dia(e.date)));

  return {
    geradoEm: new Date().toISOString(),
    somenteLeitura: true,
    arquitetura: {
      jobDiario: 'GitHub Actions (4 jobs ~04:50-06:00 UTC) — NÃO é Netlify scheduled function; sem teto de 10s/26s no envio. Histórico de duração: aba Actions do repositório.',
      banco: 'Firestore (REST) — não Netlify KV; sem limite prático de tamanho por doc no uso atual.',
      audio: 'TTS gravado no Firebase Storage; URL + objectPath persistidos no episódio (podcast_episodios/podcast_arquivo/podcast_salvos).',
      biblioteca: 'SEM flag "publicado": deriva de artigo ativo + título PT + TER PODCAST (regra do fundador 07/08). Sem áudio → fora da biblioteca (H7 por design).',
      extrasPremium: 'Extras premium são enviados por e-mail SEM áudio por design — nunca aparecem na biblioteca.',
      cronsNetlifyExistentes: 'cleanup-articles (0 3 * * 0), afiliados-expiracao (0 6 1 * *) — nenhum envolvido na geração de áudio.',
    },
    reconciliacaoTemporal: { porEspecialidade: porEspSeries },
    funilPorEspecialidade: funilPorEsp,
    cruzamento: {
      enviadosSemBiblioteca: { total: enviadosSemBiblioteca.length, primeiros50: enviadosSemBiblioteca.slice(0, 50) },
      bibliotecaSemEnvio: { total: bibliotecaSemEnvio.length, primeiros50: bibliotecaSemEnvio.slice(0, 50) },
    },
    audio: {
      totalEpisodios: episodios.length,
      artigosComAudio: audioDe.size,
      primeiroEpisodio: audioTemporal.primeiro,
      ultimoEpisodio: audioTemporal.ultimo,
      diasSemEpisodio: audioTemporal.diasSemNada,
      seriePorDia: audioTemporal.serie,
      posicaoNoLote: porPosicao,
      storage,
    },
    execucoes: {
      base: 'edições persistidas por dia (digests_especialidade) — registro fiel de "o job rodou e produziu"',
      primeiro: execucoes.primeiro, ultimo: execucoes.ultimo,
      diasCorridos: execucoes.diasCorridos,
      diasSemNenhumaEdicao: execucoes.diasSemNada,
      seriePorDia: execucoes.serie, // edições persistidas por dia (painel)
    },
  };
}

// CSV: funil por especialidade + série de áudio por dia.
function pipelineCSV(d) {
  const linhas = ['secao;chave;valor1;valor2;valor3'];
  for (const [esp, f] of Object.entries(d.funilPorEspecialidade)) {
    linhas.push(`funil;${esp};total=${f.total};com_audio=${f.comAudio};na_biblioteca=${f.naBiblioteca}`);
  }
  for (const x of d.audio.seriePorDia) linhas.push(`audio_por_dia;${x.d};${x.n};;`);
  for (const p of d.audio.posicaoNoLote) linhas.push(`posicao_no_lote;${p.posicao};com=${p.comAudio};sem=${p.semAudio};`);
  return '﻿' + linhas.join('\n');
}

module.exports = { construirDiagnosticoPipeline, pipelineCSV, serieDiaria, verificarStorage };
