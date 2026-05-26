// Knowledge graph builder — creates a hierarchical map of the user's scientific knowledge.
// Connects specialties → themes → articles → notes.
// Returns a tree structure renderable as nested HTML (no D3 or heavy libraries).

/**
 * Builds a knowledge tree from user's interaction data.
 *
 * @param {Array}  articles     — all active articles the user has interacted with (saved/liked/read)
 * @param {Array}  notes        — user's personal notes
 * @param {Array}  collections  — user's collections
 * @param {Object} profile      — user behavioral profile
 * @returns {Object}            — { nodes, edges, tree, stats }
 */
function buildGraph(articles, notes, collections, profile) {
  // Group articles by specialty → tema
  const specMap = {};

  for (const a of articles) {
    const spec = a.especialidade || 'Geral';
    const tema = a.tema           || 'Geral';
    if (!specMap[spec]) specMap[spec] = {};
    if (!specMap[spec][tema]) specMap[spec][tema] = [];
    specMap[spec][tema].push(a);
  }

  // Build note index by PMID
  const notesByPmid = {};
  for (const n of notes) {
    if (!n.pmid) continue;
    if (!notesByPmid[n.pmid]) notesByPmid[n.pmid] = [];
    notesByPmid[n.pmid].push(n);
  }

  // Build flat node/edge lists for analytics + flat graph exports
  const nodes = [];
  const edges = [];

  // Build tree structure for HTML rendering
  const tree = Object.entries(specMap)
    .sort(([, a], [, b]) => totalArticles(b) - totalArticles(a))
    .map(([spec, temaMap]) => {
      const specNode = { id: `esp:${spec}`, label: spec, type: 'specialty', count: totalArticles(temaMap) };
      nodes.push(specNode);

      const temas = Object.entries(temaMap)
        .sort(([, a], [, b]) => b.length - a.length)
        .slice(0, 8) // max 8 themes per specialty in graph
        .map(([tema, arts]) => {
          const temaNode = { id: `tema:${spec}:${tema}`, label: tema, type: 'tema', count: arts.length };
          nodes.push(temaNode);
          edges.push({ from: specNode.id, to: temaNode.id, weight: arts.length });

          const topArts = arts
            .slice(0, 5) // max 5 articles per theme in graph
            .map(a => {
              const pmid    = String(a.pmid || a.id || '');
              const artNotes = notesByPmid[pmid] || [];
              const artNode  = {
                id:            `art:${pmid}`,
                label:         (a.titulo_pt || a.titulo || '').slice(0, 60),
                type:          'article',
                pmid,
                nivel_evidencia: a.nivel_evidencia || '',
                pubmedUrl:     a.pubmedUrl || '',
                hasNote:       artNotes.length > 0,
                noteCount:     artNotes.length,
                isOpenAccess:  a.isOpenAccess || false,
              };
              nodes.push(artNode);
              edges.push({ from: temaNode.id, to: artNode.id, weight: 1 });

              // Note sub-nodes
              artNotes.slice(0, 2).forEach(note => {
                const noteNode = { id: `note:${note.noteId}`, label: note.texto.slice(0, 40) + '…', type: 'note', noteId: note.noteId };
                nodes.push(noteNode);
                edges.push({ from: artNode.id, to: noteNode.id, weight: 1 });
              });

              return artNode;
            });

          return { ...temaNode, articles: topArts };
        });

      return { ...specNode, temas };
    });

  // Collection nodes (flat, not part of spec tree)
  const collectionNodes = collections.map(c => ({
    id:    `col:${c.collectionId}`,
    label: c.nome,
    type:  'collection',
    count: (c.pmids || []).length,
  }));

  // Stats
  const stats = {
    specialties:   Object.keys(specMap).length,
    themes:        Object.values(specMap).reduce((s, t) => s + Object.keys(t).length, 0),
    articles:      articles.length,
    notes:         notes.length,
    collections:   collections.length,
    notedArticles: Object.keys(notesByPmid).length,
  };

  // Related article pairs (shared tema/journal)
  const related = findRelatedPairs(articles, 5);

  return { nodes, edges, tree, collectionNodes, stats, relatedPairs: related };
}

function totalArticles(temaMap) {
  return Object.values(temaMap).reduce((s, arr) => s + arr.length, 0);
}

/**
 * Finds pairs of articles that are strongly related (shared tema + adjacent evidence levels).
 */
function findRelatedPairs(articles, maxPairs) {
  const pairs = [];
  for (let i = 0; i < articles.length && pairs.length < maxPairs; i++) {
    for (let j = i + 1; j < articles.length && pairs.length < maxPairs; j++) {
      const a = articles[i], b = articles[j];
      if (a.tema && a.tema === b.tema) {
        pairs.push({
          pmidA:   a.pmid || a.id,
          tituloA: (a.titulo_pt || a.titulo || '').slice(0, 60),
          pmidB:   b.pmid || b.id,
          tituloB: (b.titulo_pt || b.titulo || '').slice(0, 60),
          tema:    a.tema,
          reason:  `Ambos abordam ${a.tema}`,
        });
      }
    }
  }
  return pairs;
}

module.exports = { buildGraph };
