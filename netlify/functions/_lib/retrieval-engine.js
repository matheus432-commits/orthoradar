// Retrieval engine — unified search across notes, articles, and collections.
// Merges ranked results from multiple data sources with deduplication.

const { rankByRelevance } = require('./semantic-ranking');

const RESULT_TYPES = { NOTE: 'note', ARTICLE: 'article', COLLECTION: 'collection' };

// ── Source-specific scoring ───────────────────────────────────────────────────

function searchNotes(query, notes) {
  if (!notes || !notes.length) return [];
  const results = rankByRelevance(query, notes, {
    textFields: ['texto', 'tituloArtigo', 'tema', 'tags', 'especialidade'],
    topN: 10,
  });
  return results.map(n => ({
    type:     RESULT_TYPES.NOTE,
    id:       n.noteId,
    titulo:   n.tituloArtigo ? `Nota: ${n.tituloArtigo}` : 'Nota avulsa',
    resumo:   n.texto.slice(0, 200),
    meta:     [n.tipo, n.tema, n.especialidade].filter(Boolean).join(' · '),
    pmid:     n.pmid || null,
    data:     n.criadoEm,
    tags:     n.tags || [],
    _score:   n._score,
    raw:      n,
  }));
}

function searchArticles(query, articles, savedSet, likedSet) {
  if (!articles || !articles.length) return [];
  const results = rankByRelevance(query, articles, {
    textFields: ['titulo_pt', 'titulo', 'resumo_pt', 'tema', 'especialidade', 'achados_principais'],
    savedSet,
    likedSet,
    topN: 15,
  });
  return results.map(a => ({
    type:     RESULT_TYPES.ARTICLE,
    id:       a.pmid || a.id || '',
    titulo:   a.titulo_pt || a.titulo || '',
    resumo:   (a.resumo_pt || a.resumo || '').slice(0, 200),
    meta:     [a.nivel_evidencia, a.journal, a.data ? new Date(a.data).getFullYear() : null].filter(Boolean).join(' · '),
    pmid:     a.pmid || a.id || '',
    data:     a.data || null,
    tags:     [],
    pubmedUrl: a.pubmedUrl || '',
    isOpenAccess: a.isOpenAccess || false,
    isSaved:  savedSet ? savedSet.has(String(a.pmid || a.id || '')) : false,
    isLiked:  likedSet ? likedSet.has(String(a.pmid || a.id || '')) : false,
    nivel_evidencia: a.nivel_evidencia || '',
    _score:   a._score,
  }));
}

function searchCollections(query, collections) {
  if (!collections || !collections.length) return [];
  const results = rankByRelevance(query, collections, {
    textFields: ['nome', 'descricao', 'tags'],
    topN: 5,
  });
  return results.map(c => ({
    type:    RESULT_TYPES.COLLECTION,
    id:      c.collectionId,
    titulo:  c.nome,
    resumo:  c.descricao || `${(c.pmids || []).length} artigos`,
    meta:    `${(c.pmids || []).length} artigos · criada em ${c.criadoEm ? new Date(c.criadoEm).toLocaleDateString('pt-BR') : '?'}`,
    pmid:    null,
    data:    c.criadoEm,
    tags:    c.tags || [],
    _score:  c._score,
    raw:     c,
  }));
}

// ── Merge and deduplicate ─────────────────────────────────────────────────────

function mergeResults(noteResults, articleResults, collectionResults) {
  const all = [
    ...noteResults.map(r => ({ ...r, _score: r._score * 1.2 })),  // notes slightly boosted (personal context)
    ...articleResults,
    ...collectionResults.map(r => ({ ...r, _score: r._score * 1.1 })),
  ];

  // Deduplicate: if same pmid appears as both note and article, merge them
  const seenPmids  = new Set();
  const deduped    = [];
  for (const r of all.sort((a, b) => b._score - a._score)) {
    const key = r.pmid ? `pmid:${r.pmid}` : `${r.type}:${r.id}`;
    if (seenPmids.has(key)) continue;
    seenPmids.add(key);
    deduped.push(r);
  }
  return deduped;
}

/**
 * Main search function — searches across all knowledge sources.
 *
 * @param {string} query        — user's search query
 * @param {Object} sources      — { notes, articles, collections }
 * @param {Object} interactions — { savedPmids, likedPmids }
 * @param {string} filter       — 'all' | 'notes' | 'articles' | 'collections'
 * @returns {Array}             — ranked, merged results
 */
function searchKnowledge(query, sources, interactions = {}, filter = 'all') {
  const savedSet = new Set((interactions.savedPmids || []).map(String));
  const likedSet = new Set((interactions.likedPmids  || []).map(String));

  const noteRes  = (filter === 'all' || filter === 'notes')       ? searchNotes(query, sources.notes || [])                          : [];
  const artRes   = (filter === 'all' || filter === 'articles')    ? searchArticles(query, sources.articles || [], savedSet, likedSet) : [];
  const collRes  = (filter === 'all' || filter === 'collections') ? searchCollections(query, sources.collections || [])               : [];

  return mergeResults(noteRes, artRes, collRes);
}

module.exports = { searchKnowledge, searchNotes, searchArticles, searchCollections, RESULT_TYPES };
