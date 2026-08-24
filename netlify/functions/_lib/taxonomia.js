// TAXONOMIA CANÔNICA v2 (spec do fundador 24/08) — carregador e normalizador.
//
// Fonte de verdade: data/taxonomia-temas.json (versionado no repositório).
//   id        = slug ASCII gravado no banco (campo `temas` do artigo) e usado
//               no filtro da biblioteca;
//   label     = texto exibido ao dentista;
//   sinonimos = lowercase sem acento — SÓ para normalização/mapeamento.
//
// O mapeador casa a string bruta (tema legado, resposta de IA, variante
// gravada) contra id + label + sinônimos, todos passados pelo MESMO
// normalizador (lowercase, sem acento, pontuação→espaço, trim, singular).
// Nenhum sinônimo pode pertencer a dois temas da MESMA especialidade —
// validar() devolve as violações e o teste da suíte falha se houver.

const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', '..', '..', 'data', 'taxonomia-temas.json');
const _dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf8'));

const TAXONOMIA_VERSAO = _dados.versao;
const ESPECIALIDADES = Object.keys(_dados.especialidades);

// ── Normalização ─────────────────────────────────────────────────────────────
// Singular aproximado por palavra (pt-BR): as DUAS pontas passam pela mesma
// regra, então o que importa é consistência, não perfeição linguística.
function _singular(w) {
  if (w.length <= 3) return w;
  if (/oes$/.test(w) || /aes$/.test(w)) return w.replace(/[oa]es$/, 'ao');
  if (/ais$/.test(w)) return w.replace(/ais$/, 'al');
  if (/eis$/.test(w)) return w.replace(/eis$/, 'el');
  if (/ns$/.test(w)) return w.replace(/ns$/, 'm');
  if (/[rz]es$/.test(w)) return w.replace(/es$/, '');
  if (/s$/.test(w)) return w.replace(/s$/, '');
  return w;
}

function normalizar(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // acentos fora
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')                      // pontuação/hífen/barra → espaço
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(_singular)
    .join(' ');
}

// ── Índices por especialidade (construídos uma vez no require) ───────────────
// _porEsp: esp → { temas:[{id,label,sinonimos}], ids:Set, mapa: Map<norm,id> }
const _porEsp = new Map();
for (const [esp, temas] of Object.entries(_dados.especialidades)) {
  const ids = new Set();
  const mapa = new Map();
  for (const t of temas) {
    ids.add(t.id);
    const chaves = [t.id.replace(/-/g, ' '), t.label, ...(t.sinonimos || [])];
    for (const c of chaves) {
      const n = normalizar(c);
      if (n && !mapa.has(n)) mapa.set(n, t.id);
    }
  }
  _porEsp.set(esp, { temas, ids, mapa });
}
const _labelGlobal = new Map(); // id → label (primeira ocorrência)
for (const temas of Object.values(_dados.especialidades)) {
  for (const t of temas) if (!_labelGlobal.has(t.id)) _labelGlobal.set(t.id, t.label);
}

// ── API ──────────────────────────────────────────────────────────────────────
function temasDe(especialidade) { return (_porEsp.get(especialidade) || { temas: [] }).temas; }
function idsDe(especialidade) { return temasDe(especialidade).map(t => t.id); }
function ehIdValido(id, especialidade) { return (_porEsp.get(especialidade) || { ids: new Set() }).ids.has(String(id || '')); }
function labelDe(id) { return _labelGlobal.get(String(id || '')) || ''; }

// Mapeia UMA string bruta (tema legado, variante, resposta de IA) para o id
// canônico da especialidade — null quando nada casa.
function mapear(bruto, especialidade) {
  const idx = _porEsp.get(especialidade);
  if (!idx) return null;
  const s = String(bruto || '').trim();
  if (!s) return null;
  if (idx.ids.has(s)) return s; // já é um id canônico
  return idx.mapa.get(normalizar(s)) || null;
}

// Mapeia o campo tema de um artigo (string OU array) → array de ids únicos.
function mapearLista(bruto, especialidade) {
  const lista = Array.isArray(bruto) ? bruto : [bruto];
  const ids = [];
  for (const item of lista) {
    const id = mapear(item, especialidade);
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// ── Validação estrutural (usada pelo teste da suíte) ─────────────────────────
const SLUG_RX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function validar() {
  const problemas = [];
  for (const [esp, temas] of Object.entries(_dados.especialidades)) {
    if (temas.length < 25 || temas.length > 40) {
      problemas.push(`${esp}: ${temas.length} temas (esperado 25-40)`);
    }
    const idsVistos = new Set();
    const donoDoSinonimo = new Map(); // norm → id
    for (const t of temas) {
      if (!SLUG_RX.test(t.id)) problemas.push(`${esp}/${t.id}: id não é slug ASCII`);
      if (idsVistos.has(t.id)) problemas.push(`${esp}/${t.id}: id duplicado`);
      idsVistos.add(t.id);
      if (!String(t.label || '').trim()) problemas.push(`${esp}/${t.id}: label vazio`);
      for (const sRaw of [t.label, ...(t.sinonimos || [])]) {
        if (sRaw !== t.label && sRaw !== String(sRaw).toLowerCase()) {
          problemas.push(`${esp}/${t.id}: sinônimo "${sRaw}" não está em lowercase`);
        }
        if (sRaw !== t.label && /[À-ſ]/.test(sRaw)) {
          problemas.push(`${esp}/${t.id}: sinônimo "${sRaw}" tem acento`);
        }
        const n = normalizar(sRaw);
        if (!n) continue;
        const dono = donoDoSinonimo.get(n);
        if (dono && dono !== t.id) {
          problemas.push(`${esp}: "${sRaw}" colide entre ${dono} e ${t.id}`);
        }
        donoDoSinonimo.set(n, t.id);
      }
    }
  }
  return problemas;
}

module.exports = {
  TAXONOMIA_VERSAO, ESPECIALIDADES, ARQUIVO,
  normalizar, temasDe, idsDe, ehIdValido, labelDe, mapear, mapearLista, validar,
};
