// Smart context retrieval — builds a contextual knowledge bundle for a given article.
// Pulls related notes, articles, collections, consensus, and guidelines from the user's
// personal knowledge base using TF-IDF overlap + behavioral signals.

const { tokenize }            = require('./semantic-ranking');
const { getUserNotes, getUserCollections } = require('./memory-engine');
const { analyzeConsensus }    = require('./consensus-engine');
const { detectGuidelineAlerts } = require('./guideline-tracker');
const { computeRelatedness }  = require('./related-engine');

// ── Pairwise similarity helpers ───────────────────────────────────────────────

function noteRelatedness(article, note) {
  let score = 0;
  const artTheme  = (article.tema           || '').toLowerCase();
  const artSpec   = (article.especialidade  || '').toLowerCase();
  const noteTheme = (note.tema              || '').toLowerCase();
  const noteSpec  = (note.especialidade     || '').toLowerCase();

  if (artTheme && noteTheme) {
    if (artTheme === noteTheme) score += 50;
    else if (artTheme.includes(noteTheme) || noteTheme.includes(artTheme)) score += 28;
  }
  if (artSpec && noteSpec && artSpec === noteSpec) score += 18;

  // title + note keyword overlap
  const artTokens  = tokenize([(article.titulo_pt || article.titulo || ''), artTheme].join(' '));
  const noteTokens = tokenize([note.texto, (note.tituloArtigo || ''), noteTheme].join(' '));
  const artSet     = new Set(artTokens);
  const overlap    = noteTokens.filter(t => artSet.has(t)).length;
  score += Math.min(32, overlap * 5);

  return Math.min(100, score);
}

function collectionRelatedness(article, collection) {
  let score = 0;
  const pmid     = String(article.pmid || article.id || '');
  const artTokens = tokenize([(article.titulo_pt || article.titulo || ''), (article.tema || '')].join(' '));
  const colTokens = tokenize([(collection.nome || ''), (collection.descricao || ''), (collection.tags || []).join(' ')].join(' '));

  const artSet  = new Set(artTokens);
  const overlap = colTokens.filter(t => artSet.has(t)).length;
  score += Math.min(60, overlap * 10);

  if (pmid && (collection.pmids || []).map(String).includes(pmid)) score += 40;
  return Math.min(100, score);
}

// ── Public retrieval functions ────────────────────────────────────────────────

function getRelatedNotes(article, notes) {
  if (!notes?.length) return [];
  return notes
    .map(n => ({ ...n, _r: noteRelatedness(article, n) }))
    .filter(n => n._r >= 28)
    .sort((a, b) => b._r - a._r)
    .slice(0, 5)
    .map(({ _r, ...rest }) => ({ ...rest, relatedness: _r }));
}

function getRelatedArticles(article, articles, profile) {
  if (!articles?.length) return [];
  const pmid = String(article.pmid || article.id || '');
  return articles
    .filter(a => String(a.pmid || a.id || '') !== pmid)
    .map(a => ({ ...a, _r: computeRelatedness(article, a, profile).score }))
    .filter(a => a._r >= 30)
    .sort((a, b) => b._r - a._r)
    .slice(0, 6)
    .map(({ _r, ...rest }) => ({ ...rest, relatedness: _r }));
}

function getRelatedCollections(article, collections) {
  if (!collections?.length) return [];
  return collections
    .map(c => ({ ...c, _r: collectionRelatedness(article, c) }))
    .filter(c => c._r >= 18)
    .sort((a, b) => b._r - a._r)
    .slice(0, 3)
    .map(({ _r, ...rest }) => ({ ...rest, relatedness: _r }));
}

async function getRelatedConsensus(article, db) {
  const tema = article.tema || null;
  const spec = article.especialidade || null;
  if (!tema && !spec) return [];
  try {
    const filter = tema
      ? { fieldFilter: { field: { fieldPath: 'tema' }, op: 'EQUAL', value: { stringValue: tema } } }
      : { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: spec } } };
    const candidates = await db.query('artigos', { where: filter, limit: 20 }).catch(() => []);
    if (candidates.length < 3) return [];
    return analyzeConsensus(candidates, 3).slice(0, 2);
  } catch { return []; }
}

async function getRelatedGuidelines(article, db) {
  try {
    const filters = [
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'ativo' } } },
    ];
    if (article.especialidade) {
      filters.push({ fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: article.especialidade } } });
    }
    const candidates = await db.query('artigos', {
      where: filters.length > 1
        ? { compositeFilter: { op: 'AND', filters } }
        : filters[0],
      limit: 30,
    }).catch(() => []);

    const alerts = detectGuidelineAlerts(candidates, 4, 180);
    const articleTema = (article.tema || '').toLowerCase();
    return alerts
      .filter(a =>
        (articleTema && (a.titulo || '').toLowerCase().includes(articleTema)) ||
        (article.especialidade && a.especialidade === article.especialidade)
      )
      .slice(0, 2);
  } catch { return []; }
}

// ── Main bundle builder ───────────────────────────────────────────────────────

/**
 * Builds a complete context bundle for one article.
 *
 * @param {Object}   article         — the pivot article
 * @param {Array}    userNotes       — user's personal notes
 * @param {Array}    userArticles    — user's saved/liked articles
 * @param {Array}    userCollections — user's collections
 * @param {Object}   db              — Firestore instance
 * @param {Object}   profile         — behavioral profile (can be null)
 * @returns {Object}
 */
async function buildContextBundle(article, userNotes, userArticles, userCollections, db, profile = null) {
  const [r0, r1, r2, r3, r4] = await Promise.allSettled([
    Promise.resolve(getRelatedNotes(article, userNotes)),
    Promise.resolve(getRelatedArticles(article, userArticles, profile)),
    Promise.resolve(getRelatedCollections(article, userCollections)),
    getRelatedConsensus(article, db),
    getRelatedGuidelines(article, db),
  ]);

  const relatedNotes       = r0.value || [];
  const relatedArticles    = r1.value || [];
  const relatedCollections = r2.value || [];
  const relatedConsensus   = r3.value || [];
  const relatedGuidelines  = r4.value || [];

  const confidence = parseFloat(Math.min(1,
    Math.min(0.30, relatedNotes.length * 0.10) +
    Math.min(0.40, relatedArticles.length * 0.07) +
    Math.min(0.20, relatedCollections.length * 0.07) +
    (relatedConsensus.length ? 0.10 : 0)
  ).toFixed(2));

  return {
    article: {
      pmid:            article.pmid || article.id || '',
      titulo:          article.titulo_pt || article.titulo || '',
      tema:            article.tema || '',
      especialidade:   article.especialidade || '',
      nivel_evidencia: article.nivel_evidencia || '',
    },
    relatedNotes,
    relatedArticles,
    relatedCollections,
    relatedConsensus,
    relatedGuidelines,
    confidence,
  };
}

module.exports = {
  buildContextBundle,
  getRelatedNotes,
  getRelatedArticles,
  getRelatedCollections,
  getRelatedConsensus,
  getRelatedGuidelines,
  noteRelatedness,
  collectionRelatedness,
};
