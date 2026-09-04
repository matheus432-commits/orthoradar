'use strict';
// Taxonomia de ENSINO (aluno + professor): monta a árvore completa
// área → módulo → tema → página a partir das três fontes, com ids estáveis
// (slugs) e um índice de busca. Puro, sem I/O — a mesma função serve o site,
// o gerador de apostilas/aulas e os testes.
//
//   const { taxonomia, buscar, resumo } = require('./taxonomia');
//   taxonomia().areas[0]            → { id, nome, ciclo, cfo, modulos:[...] }
//   buscar('miniimplante')          → [{ area, modulo, tema, pagina? , score }]
//   resumo()                        → { areas, modulos, temas, paginas, cfo }

const FONTES = [
  ...require('./temas-base'),
  ...require('./temas-clinicas-1'),
  ...require('./temas-clinicas-2'),
  ...require('./temas-clinicas-3'),
  ...require('./temas-especialidades'),
];

const CICLOS = ['básico', 'pré-clínico', 'clínico', 'pós'];

// Rótulo curricular/regulatório da área (revisão 04/09: "base/especialidade"
// induzia a achar que toda área é especialidade reconhecida pelo CFO).
const STATUS = {
  especialidade_cfo: 'Especialidade reconhecida pelo CFO',
  disciplina: 'Disciplina de formação odontológica',
  complementar: 'Área temática complementar',
};

// Módulo transversal (revisão 04/09): toda área fecha com "Prática baseada em
// evidências", para que a apostila não vire manual de técnicas. Montado aqui,
// não na fonte, para ser idêntico em todas as áreas.
const MODULO_EVIDENCIA = {
  nome: 'Prática baseada em evidências',
  transversal: true,
  temas: [{
    nome: 'As quatro perguntas de cada conduta',
    paginas: ['Qual é a indicação?', 'Qual é a contraindicação?', 'Qual é a qualidade da evidência?', 'O que mudou nos últimos anos?', 'O que é tradição de escola e o que é evidência: como a apostila diferencia'],
  }],
};

function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let _cache = null;
function taxonomia() {
  if (_cache) return _cache;
  const vistos = new Set();
  const unico = (id) => {
    if (vistos.has(id)) throw new Error('id duplicado na taxonomia de ensino: ' + id);
    vistos.add(id);
    return id;
  };
  const areas = FONTES.map((a) => {
    const areaId = unico(slug(a.nome));
    if (!CICLOS.includes(a.ciclo)) throw new Error('ciclo inválido em ' + a.nome);
    const modulos = [...(a.modulos || []), MODULO_EVIDENCIA].map((m) => {
      const moduloId = unico(areaId + '/' + slug(m.nome));
      const temas = (m.temas || []).map((t) => {
        const temaId = unico(moduloId + '/' + slug(t.nome));
        const paginas = (t.paginas || []).map((p) => ({ id: unico(temaId + '/' + slug(p)), nome: p }));
        return { id: temaId, nome: t.nome, paginas };
      });
      return { id: moduloId, nome: m.nome, temas, ...(m.transversal ? { transversal: true } : {}) };
    });
    const status = a.status || (a.cfo ? 'especialidade_cfo' : 'disciplina');
    if (!STATUS[status]) throw new Error('status inválido em ' + a.nome);
    return { id: areaId, nome: a.nome, ciclo: a.ciclo, cfo: !!a.cfo, status, statusRotulo: STATUS[status], descricao: a.descricao || '', ...(a.nota ? { nota: a.nota } : {}), modulos };
  });
  _cache = { versao: '1.0', areas };
  return _cache;
}

// Índice plano para busca: uma linha por página (e uma por tema, para temas
// sem página). Normalização igual à da Biblioteca: sem acento, sem hífen.
function normalizar(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[-_.‐-―‘’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

let _indice = null;
function indice() {
  if (_indice) return _indice;
  const linhas = [];
  for (const area of taxonomia().areas) {
    for (const modulo of area.modulos) {
      for (const tema of modulo.temas) {
        const base = { area: area.nome, areaId: area.id, modulo: modulo.nome, tema: tema.nome, temaId: tema.id };
        if (!tema.paginas.length) linhas.push({ ...base, texto: normalizar([area.nome, modulo.nome, tema.nome].join(' ')) });
        for (const p of tema.paginas) {
          linhas.push({ ...base, pagina: p.nome, paginaId: p.id, texto: normalizar([area.nome, modulo.nome, tema.nome, p.nome].join(' ')) });
        }
      }
    }
  }
  _indice = linhas;
  return _indice;
}

// Busca por E de termos (substring, como na Biblioteca). Prioriza acerto no
// nome da página, depois no tema, depois no resto.
function buscar(query, { area, limite = 50 } = {}) {
  const termos = normalizar(query).split(' ').filter((t) => t.length >= 2);
  if (!termos.length) return [];
  const out = [];
  for (const l of indice()) {
    if (area && l.areaId !== area) continue;
    if (!termos.every((t) => l.texto.includes(t))) continue;
    const np = normalizar(l.pagina || ''), nt = normalizar(l.tema);
    const score = termos.reduce((s, t) => s + (np.includes(t) ? 3 : nt.includes(t) ? 2 : 1), 0);
    out.push({ ...l, score });
  }
  return out.sort((a, b) => b.score - a.score || a.area.localeCompare(b.area)).slice(0, limite);
}

function resumo() {
  const t = taxonomia();
  let modulos = 0, temas = 0, paginas = 0;
  for (const a of t.areas) for (const m of a.modulos) { modulos++; for (const te of m.temas) { temas++; paginas += te.paginas.length; } }
  return { areas: t.areas.length, cfo: t.areas.filter((a) => a.cfo).length, modulos, temas, paginas };
}

module.exports = { taxonomia, buscar, resumo, slug, normalizar, CICLOS, STATUS, MODULO_EVIDENCIA };
