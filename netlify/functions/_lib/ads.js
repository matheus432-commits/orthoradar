// Publicidade contextual de marcas parceiras — slots do plano Gratuito.
//
// COMO ATIVAR UM ANÚNCIO (sem deploy): crie um documento na coleção Firestore
// `anuncios` com os campos abaixo. Para desativar, mude `ativo` para false.
//
//   {
//     ativo:          true,
//     patrocinador:   "Marca X",                       // sempre exibido (publicidade identificada)
//     slots:          ["email", "site", "podcast"],   // onde aparece
//     texto:          "Conheça o novo scanner...",     // email/site
//     linkUrl:        "https://parceiro.com/oferta",   // email/site
//     imagemUrl:      "https://.../banner.png",        // opcional (email/site)
//     textoPodcast:   "Este episódio é oferecido por Marca X — ...", // narrado no 1º episódio
//     especialidades: ["Ortodontia"],                  // opcional; ausente/vazio = todas
//     inicio: "2026-08-01", fim: "2026-08-31",        // opcional (YYYY-MM-DD, UTC)
//   }
//
// Regras: anúncios NÃO usam dados pessoais (contextuais por especialidade, no
// máximo) — mantém verdadeira a Política de Privacidade. Assinantes Premium
// não veem anúncios (gate feito pelos consumidores via featuresOf().semPublicidade).

const log = require('./logger');

function withinPeriod(ad, today) {
  if (ad.inicio && today < ad.inicio) return false;
  if (ad.fim && today > ad.fim) return false;
  return true;
}

function matchesEsp(ad, especialidade) {
  const list = Array.isArray(ad.especialidades) ? ad.especialidades.filter(Boolean) : [];
  return list.length === 0 || (especialidade && list.includes(especialidade));
}

// Retorna o primeiro anúncio ativo para o slot (e especialidade, se dada), ou null.
// Best-effort: qualquer falha retorna null — publicidade nunca derruba o produto.
async function getActiveAd(db, slot, especialidade = null) {
  try {
    const docs = await db.query('anuncios', {
      where: { fieldFilter: { field: { fieldPath: 'ativo' }, op: 'EQUAL', value: { booleanValue: true } } },
      limit: 20,
    });
    const today = new Date().toISOString().slice(0, 10);
    return docs.find(ad =>
      Array.isArray(ad.slots) && ad.slots.includes(slot) &&
      withinPeriod(ad, today) &&
      matchesEsp(ad, especialidade)
    ) || null;
  } catch (err) {
    log.warn('[ads] consulta falhou (seguindo sem anúncio)', { slot, err: err.message });
    return null;
  }
}

module.exports = { getActiveAd };
