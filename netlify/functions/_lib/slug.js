// Normaliza uma especialidade para um id seguro (path do Storage / doc id).
// "DTM e Dor Orofacial" → "DTM_e_Dor_Orofacial"; "Prótese" → "Protese".
// Precisa dar o MESMO resultado na geração e no get-podcast.
function specialtySlug(esp) {
  return String(esp || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

module.exports = { specialtySlug };
