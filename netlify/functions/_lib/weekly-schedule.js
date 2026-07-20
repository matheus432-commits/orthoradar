// Rodízio FIXO por dia da semana (decisão de produto 19/07/2026) — fonte única,
// usada pelo feed mestre do Spotify (podcast-rss) e pelos Reels do Instagram.
// Seg Endo+Perio · Ter Buco+DTM · Qua Dent+Prót · Qui Odonto+Estoma ·
// Sex Implanto+Radio · Sáb só Ortodontia (11 é ímpar) · Dom nada.
// Nomes CANÔNICOS (batem com specialtySlug/geração).

const WEEKLY_SCHEDULE = {
  1: ['Endodontia', 'Periodontia'],                 // segunda
  2: ['Bucomaxilofacial', 'DTM e Dor Orofacial'],   // terça
  3: ['Dentística', 'Prótese'],                     // quarta
  4: ['Odontopediatria', 'Estomatologia'],          // quinta
  5: ['Implantodontia', 'Radiologia'],              // sexta
  6: ['Ortodontia'],                                // sábado
  0: [],                                            // domingo (sem destaque)
};

// Especialidades destaque da DATA (UTC == data BRT: o pipeline roda 00h BRT).
function scheduledForDate(date) {
  const wd = new Date(date + 'T00:00:00Z').getUTCDay();
  return WEEKLY_SCHEDULE[Number.isNaN(wd) ? -1 : wd] || [];
}

module.exports = { WEEKLY_SCHEDULE, scheduledForDate };
