// TEMAS NO PIPELINE DIÁRIO — Fase 4 da spec 24/08 (prevenção).
//
// O enriquecimento passa a gravar `temas` (ids canônicos), `tema` (label do
// 1º — retrocompat com digest/preferências/e-mail) e `versao_taxonomia`,
// usando o MESMO arquivo de taxonomia e o MESMO prompt da migração, com
// validação ESTRITA contra o enum: id fora da lista é descartado e logado —
// string livre NUNCA é gravada.
//
// Resiliência (lição de 08/08 — "os requests vão falhar"): a IA é a via
// principal, mas TODA falha (rede, chave, resposta vazia) cai no
// classificador determinístico v1 → mapeado para id canônico. O pipeline
// nunca fica sem tema por causa de uma chamada de API.

const { mapearLista, labelDe, ESPECIALIDADES, TAXONOMIA_VERSAO } = require('./taxonomia');
const { montarPromptClassificacao, validarRespostaIA } = require('./migracao-temas');
const log = require('./logger');

/**
 * Classifica um artigo já enriquecido nos temas canônicos.
 * opts.classificarIA: async (prompt) => texto — injetado pelo chamador
 * (claude.js passa o callClaude/Haiku; testes passam um fake; ausente = só
 * o fallback determinístico, custo zero).
 */
async function classificarTemasCanonicos(artigo, opts = {}) {
  const esp = artigo.especialidade || '';
  const semTema = { temas: [], tema: '', versao_taxonomia: TAXONOMIA_VERSAO };
  if (!ESPECIALIDADES.includes(esp)) return semTema;

  if (typeof opts.classificarIA === 'function') {
    try {
      const resp = await opts.classificarIA(montarPromptClassificacao(artigo));
      const v = validarRespostaIA(resp, esp);
      if (v.descartados.length) {
        log.warn('[temas-pipeline] IA devolveu valor fora do enum — DESCARTADO, nunca gravado', {
          pmid: artigo.pmid, especialidade: esp, descartados: v.descartados,
        });
      }
      if (v.ids.length) {
        return { temas: v.ids, tema: labelDe(v.ids[0]), versao_taxonomia: TAXONOMIA_VERSAO };
      }
      // 'sem-tema' ou tudo descartado → tenta o determinístico abaixo.
    } catch (err) {
      log.warn('[temas-pipeline] IA indisponível — seguindo no determinístico (custo zero)', { pmid: artigo.pmid, err: err.message });
    }
  }

  // Fallback determinístico: classificador v1 (labels) → mapeado para id.
  // O teste de retrocompatibilidade garante que TODO label v1 tem id v2.
  const { classificarTema } = require('./temas-classificador');
  const labelV1 = classificarTema(artigo);
  const ids = mapearLista(labelV1, esp);
  if (!ids.length) return semTema;
  return { temas: ids, tema: labelDe(ids[0]), versao_taxonomia: TAXONOMIA_VERSAO };
}

module.exports = { classificarTemasCanonicos };
