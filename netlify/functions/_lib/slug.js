// Normaliza uma especialidade para um id seguro (path do Storage / doc id).
// "DTM e Dor Orofacial" → "DTM_e_Dor_Orofacial"; "Prótese" → "Protese".
// Precisa dar o MESMO resultado na geração e no get-podcast.
function specialtySlug(esp) {
  return String(esp || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Slug usado nas chaves da coleção digests_especialidade ("<slug>_<data>").
// "DTM e Dor Orofacial" → "dtm-e-dor-orofacial"; "Prótese" → "protese".
// Precisa dar o MESMO resultado no daily-digest (escrita) e no get-edicao (leitura).
function espDigestSlug(esp) {
  return String(esp)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { specialtySlug, espDigestSlug };
