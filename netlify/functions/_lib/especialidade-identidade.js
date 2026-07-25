// Identidade visual por especialidade + ciclo diário de publicação.
//
// Decisão de produto 21/07/2026: o Instagram publica UMA especialidade por dia,
// girando as 11 em ciclo fixo (dia após dia, uma diferente, até fechar e
// recomeçar). Cada especialidade tem uma COR-ASSINATURA constante — o dentista
// aprende "meu campo é o azul-céu" e localiza a edição dele no feed num relance.
// A base navy da marca é mantida em todas; só o acento muda.

// Ordem canônica do ciclo (nomes batem com specialtySlug/geração).
const CICLO = [
  'Ortodontia', 'Implantodontia', 'Periodontia', 'Endodontia', 'Dentística',
  'Prótese', 'Bucomaxilofacial', 'Odontopediatria', 'DTM e Dor Orofacial',
  'Radiologia', 'Estomatologia',
];

// Cor-assinatura de cada especialidade (11 matizes distintos, legíveis no navy).
const CORES = {
  'Ortodontia':          '#6D8BFF', // índigo-azul
  'Implantodontia':      '#22D3C7', // teal
  'Periodontia':         '#FF6B6B', // coral (gengiva)
  'Endodontia':          '#FFB020', // âmbar
  'Dentística':          '#B084F5', // violeta
  'Prótese':             '#D67BE6', // orquídea
  'Bucomaxilofacial':    '#FF5DA2', // rosa
  'Odontopediatria':     '#7ED957', // verde fresco
  'DTM e Dor Orofacial': '#FF8A3D', // laranja
  'Radiologia':          '#46A0F5', // azul-céu
  'Estomatologia':       '#2FD08A', // esmeralda
};

const FALLBACK_COR = '#37D7E7'; // ciano da marca, para especialidade fora do mapa

function corDe(esp) {
  return CORES[esp] || FALLBACK_COR;
}

// Fonte da capa escala conforme o tamanho do nome (evita estourar a largura).
function capaFontPx(nome) {
  const n = String(nome || '').length;
  if (n <= 10) return 168;
  if (n <= 13) return 132;
  if (n <= 17) return 104;
  return 82;
}

// Épocaancoragem do ciclo (UTC). A partir daqui, cada dia avança 1 no ciclo.
const EPOCH_UTC = Date.UTC(2026, 0, 1); // 2026-01-01

// Nº de dias inteiros desde a época do ciclo (determinístico pela data).
// Base do rodízio: o Instagram avança 1/dia (1 post); o Spotify avança em
// blocos (2/dia) a partir deste mesmo contador.
function diaDoCiclo(dateStr) {
  const t = Date.parse((dateStr || '') + 'T00:00:00Z');
  const base = Number.isNaN(t) ? Date.now() : t;
  return Math.floor((base - EPOCH_UTC) / 86400000);
}

// Especialidade do dia (determinística pela data): gira as 11 em ordem fixa.
// dateStr 'YYYY-MM-DD' → uma das 11. Estável: a mesma data sempre dá a mesma.
function especialidadeDoDia(dateStr) {
  const dias = diaDoCiclo(dateStr);
  const idx = ((dias % CICLO.length) + CICLO.length) % CICLO.length;
  return CICLO[idx];
}

// Prioridades do dia: o ciclo ROTACIONADO a partir da especialidade do dia.
// Consumidores (Instagram, Spotify) percorrem a lista e usam a PRIMEIRA
// especialidade que tiver conteúdo gerado — dia de área sem usuários ativos
// (sem edição) não pode deixar canal nenhum sem post (incidente 22/07:
// dia de Dentística sem digest → carrossel e reel pularam o dia).
function prioridadesDoDia(dateStr) {
  const idx = CICLO.indexOf(especialidadeDoDia(dateStr));
  return CICLO.map((_, i) => CICLO[(Math.max(0, idx) + i) % CICLO.length]);
}

// ANTI-REPETIÇÃO (incidente 25/07: Odontopediatria saiu no Instagram 2 dias
// seguidos). O bug: quando a especialidade principal do dia não tem edição, o
// canal cai para a PRÓXIMA com conteúdo — que pode ser a mesma de ontem, e/ou
// a que vira principal amanhã. Solução: escolher a 1ª das prioridades que TEM
// conteúdo e NÃO saiu nos últimos dias. Se TODAS as com conteúdo estiverem na
// lista de evitar (base com poucas especialidades ativas), libera — nunca
// deixamos o dia sem post. `carregarConteudo(esp)` é async e devolve o conteúdo
// (artigos/episódio) ou null/false; retorna { especialidade, conteudo } ou null.
async function escolherEspecialidadeComConteudo(prioridades, carregarConteudo, evitar = new Set()) {
  const cache = new Map();
  const carregar = async (esp) => {
    if (!cache.has(esp)) cache.set(esp, await carregarConteudo(esp));
    return cache.get(esp);
  };
  // 1ª passada: pula as que saíram recentemente.
  for (const esp of prioridades) {
    if (evitar.has(esp)) continue;
    const c = await carregar(esp);
    if (c) return { especialidade: esp, conteudo: c };
  }
  // 2ª passada: libera as evitadas — melhor repetir do que deixar o dia sem post.
  for (const esp of prioridades) {
    const c = await carregar(esp);
    if (c) return { especialidade: esp, conteudo: c };
  }
  return null;
}

// Especialidades já postadas nos últimos `dias` dias (para não repetir). Lê a
// coleção de histórico do canal (instagram_posts / instagram_reels; doc id =
// data 'YYYY-MM-DD'). Best-effort: falha de leitura não bloqueia o post.
async function especialidadesRecentes(db, colecao, dateStr, dias = 2) {
  const set = new Set();
  const base = Date.parse((dateStr || '') + 'T00:00:00Z');
  if (Number.isNaN(base)) return set;
  for (let i = 1; i <= dias; i++) {
    const d = new Date(base - i * 86400000).toISOString().slice(0, 10);
    const doc = await db.getDoc(colecao, d).catch(() => null);
    if (doc && doc.especialidade) set.add(doc.especialidade);
  }
  return set;
}

module.exports = { CICLO, CORES, FALLBACK_COR, corDe, capaFontPx, diaDoCiclo, especialidadeDoDia, prioridadesDoDia, escolherEspecialidadeComConteudo, especialidadesRecentes };
