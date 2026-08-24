// MIGRAÇÃO E RECLASSIFICAÇÃO DE TEMAS — Fase 3 da spec 24/08.
//
// Novo schema do artigo:
//   temas:            ["alinhadores-invisiveis", ...]  // 1 a 3 ids canônicos
//   temas_raw:        [...]                            // original preservado p/ auditoria
//   tema:             "Alinhadores invisíveis"         // label do 1º id — RETROCOMPAT:
//                     tudo que hoje lê `tema` (digest, preferências, e-mail)
//                     continua funcionando durante a transição
//   versao_taxonomia: 2                                // idempotência
//
// Ordem de decisão por artigo (barato → caro):
//   1. versão corrente → PULA (idempotente);
//   2. tema(s) atual(is) mapeiam por sinônimo → grava ids (CUSTO ZERO);
//   3. sem tema ou sem mapa → IA (prompt EXATO da spec, validação estrita:
//      id fora da lista é DESCARTADO e logado — nunca gravado);
//   4. modo completo: quem mapeou para 1 tema roda a assistiva para temas
//      ADICIONAIS (máx. 3 no total).
//
// Lotes de 10 com 1s entre lotes. DRY-RUN nunca grava. `classificarIA` é
// injetável (testes rodam sem rede).

const { mapearLista, idsDe, ehIdValido, labelDe, TAXONOMIA_VERSAO, ESPECIALIDADES } = require('./taxonomia');
const log = require('./logger');

const MAX_TEMAS_POR_ARTIGO = 3;
const TAMANHO_DO_LOTE = 10;
const PAUSA_ENTRE_LOTES_MS = 1000;

// Prompt EXATO da spec (24/08) — o mesmo usado no pipeline diário (Fase 4).
function montarPromptClassificacao(artigo) {
  const esp = artigo.especialidade || '';
  return 'Classifique o artigo odontológico abaixo em 1 a 3 temas clínicos.\n'
    + 'Responda APENAS com os ids separados por vírgula, sem explicação,\n'
    + 'sem texto adicional.\n'
    + `Use EXCLUSIVAMENTE ids desta lista: ${idsDe(esp).join(', ')}\n`
    + 'Se nenhum se aplicar bem, responda: sem-tema\n'
    + `Especialidade: ${esp}\n`
    + `Título: ${String(artigo.titulo_pt || artigo.titulo || '').slice(0, 300)}\n`
    + `Resumo: ${String(artigo.resumo_pt || artigo.abstract || '').slice(0, 1200)}`;
}

// Validação ESTRITA da resposta: só ids exatos da lista da especialidade.
// Qualquer outra coisa vai para `descartados` (o chamador loga) — nunca grava.
function validarRespostaIA(texto, especialidade) {
  const brutos = String(texto || '').trim().split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  const ids = [];
  const descartados = [];
  for (const b of brutos) {
    if (b === 'sem-tema') continue;
    if (ehIdValido(b, especialidade)) { if (!ids.includes(b)) ids.push(b); }
    else descartados.push(b);
  }
  return { ids: ids.slice(0, MAX_TEMAS_POR_ARTIGO), descartados };
}

// Campos gravados no artigo. temas_raw preserva o valor ORIGINAL do primeiro
// contato (nunca é sobrescrito por runs posteriores).
function camposGravacao(artigo, ids) {
  const raw = artigo.temas_raw !== undefined
    ? artigo.temas_raw
    : (artigo.tema == null || artigo.tema === '' ? [] : (Array.isArray(artigo.tema) ? artigo.tema : [artigo.tema]));
  return {
    temas: ids,
    temas_raw: raw,
    tema: ids.length ? labelDe(ids[0]) : (typeof artigo.tema === 'string' ? artigo.tema : ''),
    versao_taxonomia: TAXONOMIA_VERSAO,
  };
}

const _relVazio = () => ({ processados: 0, pulados: 0, mapeadosPorSinonimo: 0, reclassificadosIA: 0, assistivaComplementou: 0, semTema: 0, falhasIA: 0, idsDescartados: 0 });

/**
 * Migra o acervo. opts:
 *   dryRun (true)   — nunca grava;
 *   modo            — 'mapear' (zero IA) | 'completo' (IA p/ sem-mapa + assistiva);
 *   limit           — teto de artigos PROCESSADOS (não pulados);
 *   especialidade   — filtra uma especialidade;
 *   classificarIA   — async (prompt) => texto (injetável; obrigatório no modo completo);
 *   pausaMs         — override da pausa entre lotes (testes).
 */
async function migrarAcervo(db, opts = {}) {
  const dryRun = opts.dryRun !== false;
  const modo = opts.modo === 'completo' ? 'completo' : 'mapear';
  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : Infinity;
  const pausa = opts.pausaMs !== undefined ? opts.pausaMs : PAUSA_ENTRE_LOTES_MS;
  if (modo === 'completo' && typeof opts.classificarIA !== 'function') {
    throw new Error('modo completo exige classificarIA');
  }

  const sel = { fields: ['pmid', 'titulo_pt', 'titulo', 'resumo_pt', 'abstract', 'especialidade', 'tema', 'temas', 'temas_raw', 'versao_taxonomia', 'status'].map(fieldPath => ({ fieldPath })) };
  let artigos = await db.query('artigos', { select: sel, limit: 5000 });
  if (opts.especialidade) artigos = artigos.filter(a => a.especialidade === opts.especialidade);

  const total = _relVazio();
  const porEsp = new Map();
  const rel = (esp) => { if (!porEsp.has(esp)) porEsp.set(esp, _relVazio()); return porEsp.get(esp); };
  const exemplosDescartados = [];

  // Fila só com quem precisa de trabalho (idempotência antes de tudo).
  const fila = [];
  for (const a of artigos) {
    const esp = a.especialidade || '';
    if (!ESPECIALIDADES.includes(esp)) continue; // especialidade fora do sistema: não inventa
    if (a.versao_taxonomia === TAXONOMIA_VERSAO) { total.pulados++; rel(esp).pulados++; continue; }
    if (fila.length >= limit) continue;
    fila.push(a);
  }

  for (let i = 0; i < fila.length; i += TAMANHO_DO_LOTE) {
    const lote = fila.slice(i, i + TAMANHO_DO_LOTE);
    for (const a of lote) {
      const esp = a.especialidade;
      const r = rel(esp);
      total.processados++; r.processados++;

      // 1) Mapa por sinônimo — junta o legado `tema` e um eventual `temas`.
      let ids = mapearLista([].concat(a.tema ?? [], Array.isArray(a.temas) ? a.temas : []), esp)
        .slice(0, MAX_TEMAS_POR_ARTIGO);
      let veioDeSinonimo = ids.length > 0;

      // 2) Sem mapa → IA (só modo completo e só artigo ativo — custo controlado).
      if (!ids.length && modo === 'completo' && a.status === 'active') {
        try {
          const resp = await opts.classificarIA(montarPromptClassificacao(a));
          const v = validarRespostaIA(resp, esp);
          ids = v.ids;
          if (v.descartados.length) {
            total.idsDescartados += v.descartados.length;
            exemplosDescartados.push(...v.descartados.slice(0, 3));
            log.warn('[migracao-temas] IA devolveu id fora da lista — DESCARTADO', { pmid: a.pmid, descartados: v.descartados });
          }
          if (ids.length) { total.reclassificadosIA++; r.reclassificadosIA++; }
        } catch (err) {
          total.falhasIA++; r.falhasIA++;
          log.warn('[migracao-temas] classificação IA falhou — artigo fica para o próximo run', { pmid: a.pmid, err: err.message });
          continue; // NÃO grava versão — idempotência re-tenta amanhã
        }
      }

      // 3) Assistiva: mapeou 1 tema → IA busca ADICIONAIS (modo completo).
      if (veioDeSinonimo && ids.length === 1 && modo === 'completo' && a.status === 'active') {
        try {
          const resp = await opts.classificarIA(montarPromptClassificacao(a));
          const v = validarRespostaIA(resp, esp);
          if (v.descartados.length) {
            total.idsDescartados += v.descartados.length;
            log.warn('[migracao-temas] assistiva devolveu id fora da lista — DESCARTADO', { pmid: a.pmid, descartados: v.descartados });
          }
          const extras = v.ids.filter(id => !ids.includes(id));
          if (extras.length) {
            ids = ids.concat(extras).slice(0, MAX_TEMAS_POR_ARTIGO);
            total.assistivaComplementou++; r.assistivaComplementou++;
          }
        } catch (err) {
          // Assistiva é bônus: falhou, segue com o tema mapeado.
          log.warn('[migracao-temas] assistiva falhou — seguindo com o tema do sinônimo', { pmid: a.pmid, err: err.message });
        }
      }

      if (veioDeSinonimo) { total.mapeadosPorSinonimo++; r.mapeadosPorSinonimo++; }
      if (!ids.length) { total.semTema++; r.semTema++; }

      if (!dryRun) {
        const docId = String(a.id || a.pmid || '');
        await db.updateDoc('artigos', docId, camposGravacao(a, ids));
      }
    }
    if (i + TAMANHO_DO_LOTE < fila.length && pausa) await new Promise(res => setTimeout(res, pausa));
  }

  return {
    dryRun, modo, versaoTaxonomia: TAXONOMIA_VERSAO,
    total, porEspecialidade: Object.fromEntries(porEsp),
    restantes: Math.max(0, artigos.filter(a => ESPECIALIDADES.includes(a.especialidade || '') && a.versao_taxonomia !== TAXONOMIA_VERSAO).length - fila.length),
    exemplosIdsDescartados: exemplosDescartados.slice(0, 10),
  };
}

module.exports = {
  migrarAcervo, montarPromptClassificacao, validarRespostaIA, camposGravacao,
  MAX_TEMAS_POR_ARTIGO, TAMANHO_DO_LOTE, PAUSA_ENTRE_LOTES_MS,
};
