// BUSCA TEXTUAL DA BIBLIOTECA (diretriz do fundador, 01/09): "quando ele
// pesquisar por exemplo por miniimplante apareçam todos os artigos que tiverem
// miniimplante escrito em algum lugar".
//
// A busca antiga olhava só `titulo + resumo`, e o resumo vinha CORTADO em 400
// caracteres — texto além disso era invisível, e o resumo completo e a
// relevância clínica nunca eram consultados. Além disso comparava string crua:
// "miniimplante" não achava "mini-implante", e "distalizacao" não achava
// "distalização".
//
// Solução: o servidor manda, por artigo, um BLOCO DE BUSCA já normalizado; o
// cliente normaliza só a consulta e casa por substring. Regras da normalização:
//   • minúsculas e sem acento           → "Distalização" ≈ "distalizacao"
//   • hífen/underscore/ponto SOMEM      → "mini-implante" vira "miniimplante"
//   • o resto da pontuação vira espaço
//   • palavras repetidas são removidas  → o bloco cabe no payload sem cortar
//     nenhum campo (é presença de termo que importa, não a prosa)
//
// Assim "miniimplante", "mini implante" e "mini-implante" encontram os mesmos
// artigos, e "implante" também os encontra (casamento por substring).

// Campos varridos: tudo que o dentista lê no card e no detalhe do artigo.
const CAMPOS = [
  'titulo_pt', 'titulo', 'title',
  'tema', 'especialidade', 'journal', 'nivel_evidencia',
  'resumo_pt', 'impacto_pratico', 'resumo_completo',
];

// Texto → forma canônica de busca (minúscula, sem acento, sem separadores
// internos de palavra). Usada nos DOIS lados: no bloco do artigo e na consulta.
function normalizarTexto(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')       // acentos
    .toLowerCase()
    // Separadores internos de palavra SOMEM: "mini-implante" vira
    // "miniimplante". Escapes \u explicitos porque esta MESMA classe se
    // repete no cliente (biblioteca.html) — colar o hifen/aspa "de verdade"
    // ja fez as duas divergirem, e busca que diverge erra em silencio.
    .replace(/[-_.\u2010-\u2015\u2018\u2019']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')                    // resto da pontuacao vira espaco
    .trim();
}

// Bloco de busca do artigo: todos os campos, normalizados, sem palavra
// repetida (ordem de primeira aparição preservada — título primeiro).
function blocoDeBusca(artigo) {
  const bruto = CAMPOS
    .map(c => {
      const v = artigo && artigo[c];
      return Array.isArray(v) ? v.join(' ') : v;
    })
    .filter(Boolean)
    .join(' ');
  const vistas = new Set();
  const palavras = [];
  for (const p of normalizarTexto(bruto).split(' ')) {
    if (!p || vistas.has(p)) continue;
    vistas.add(p);
    palavras.push(p);
  }
  return palavras.join(' ');
}

// Consulta → termos. Cada termo precisa aparecer (E lógico): "recidiva
// alinhador" traz só artigos com as duas coisas.
function termosDaQuery(q) {
  const n = normalizarTexto(q);
  return n ? n.split(' ').filter(Boolean) : [];
}

// Artigo casa com a consulta? Substring por termo — "implante" acha
// "miniimplante"; "miniimplante" acha o artigo que escreveu "mini-implante".
function casa(bloco, termos) {
  if (!termos.length) return true;
  const b = String(bloco || '');
  return termos.every(t => b.includes(t));
}

module.exports = { normalizarTexto, blocoDeBusca, termosDaQuery, casa, CAMPOS };
