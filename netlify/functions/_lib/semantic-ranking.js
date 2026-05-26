// Semantic ranking — TF-IDF inspired document scoring for knowledge retrieval.
// No external dependencies; no vector embeddings; pure deterministic JS.
//
// Approach:
//   1. Tokenize text (Portuguese stop-words removed)
//   2. Build term-frequency maps
//   3. Apply IDF weights (domain-tuned for dental/scientific vocabulary)
//   4. Score documents against a query; apply behaviour boost

// ── Portuguese stop-words ─────────────────────────────────────────────────────

const STOP = new Set([
  'a','à','ao','aos','as','às','da','das','de','do','dos','e','em','é','essa',
  'esse','este','esta','foi','há','isso','na','nas','no','nos','o','os','ou',
  'para','pela','pelas','pelo','pelos','por','que','se','ser','seu','sua',
  'tem','um','uma','uns','umas','com','mais','mas','não','num','numa','pelo',
  'os','pois','quando','qual','quais','sobre','após','entre','já','sem','até',
  'eles','elas','ele','ela','nós','eu','meu','minha','seus','suas','deste',
  'desta','desse','dessa','neste','nesta','nesse','nessa','are','the','and',
  'for','in','of','to','with','that','this','was','were','been','have','has',
]);

// Domain terms that are common in the corpus → lower IDF weight
const LOW_IDF = new Set([
  'estudo','artigo','paciente','pacientes','tratamento','resultado','grupo',
  'análise','clínico','clínica','dental','oral','dente','dentes','implante',
  'estud','trat','result','clin','odont','dental','oral','entre',
]);

// High-value clinical specificity terms → boosted IDF
const HIGH_IDF = new Set([
  'fumante','fumantes','peri-implantite','osseointegração','randomizado',
  'randomizada','sistêmica','meta-análise','alinhador','alinhadores',
  'endodontia','periodontia','ortodontia','implantodontia','bifosfonato',
  'zircônia','cbct','rod','atm','bruxismo','carcinoma','histologia',
  'blinding','cego','duplo','prospectivo','multicêntrico',
]);

// ── Tokenizer ─────────────────────────────────────────────────────────────────

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\wáàâãéèêíìîóòôõúùûç\s-]/gi, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^-+|-+$/g, ''))
    .filter(t => t.length >= 3 && !STOP.has(t));
}

// ── Term frequency (normalized) ───────────────────────────────────────────────

function buildTF(tokens) {
  const tf  = {};
  const len = tokens.length || 1;
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  for (const t in tf) tf[t] = tf[t] / len;
  return tf;
}

// ── IDF estimate ──────────────────────────────────────────────────────────────

function idf(term) {
  if (LOW_IDF.has(term))  return 0.4;
  if (HIGH_IDF.has(term)) return 3.5;
  return 2.0; // default
}

// ── Score one document against a set of query tokens ─────────────────────────

function scoreTFIDF(queryTokens, docText) {
  if (!docText || !queryTokens.length) return 0;
  const tokens = tokenize(docText);
  const tf     = buildTF(tokens);
  let   score  = 0;
  for (const qt of queryTokens) {
    score += (tf[qt] || 0) * idf(qt);
    // Bonus for substring match (handles stemming differences)
    if (!tf[qt]) {
      for (const t in tf) {
        if (t.includes(qt) || qt.includes(t)) {
          score += tf[t] * idf(t) * 0.4;
          break;
        }
      }
    }
  }
  return score;
}

// ── Keyword overlap (exact match fraction) ────────────────────────────────────

function keywordOverlap(queryTokens, docTokens) {
  if (!queryTokens.length || !docTokens.length) return 0;
  const docSet = new Set(docTokens);
  const hits   = queryTokens.filter(t => docSet.has(t)).length;
  return hits / queryTokens.length;
}

// ── Behaviour boost ───────────────────────────────────────────────────────────

function behaviourBoost(doc, savedSet, likedSet) {
  const pmid = String(doc.pmid || doc.id || '');
  if (likedSet && likedSet.has(pmid)) return 1.6;
  if (savedSet && savedSet.has(pmid)) return 1.3;
  return 1.0;
}

// ── Main ranking function ─────────────────────────────────────────────────────

/**
 * Ranks a list of documents (articles or notes) against a text query.
 *
 * @param {string} query      — raw user query
 * @param {Array}  documents  — objects with text fields
 * @param {Object} opts
 *   textFields  {string[]}  — fields to search (default: ['titulo','texto','resumo'])
 *   savedSet    {Set}       — PMIDs of saved articles (1.3× boost)
 *   likedSet    {Set}       — PMIDs of liked articles (1.6× boost)
 *   topN        {number}    — how many to return
 * @returns {Array} — sorted by _score DESC, with _score attached
 */
function rankByRelevance(query, documents, opts = {}) {
  const queryTokens = tokenize(query);
  if (!queryTokens.length) return documents.slice(0, opts.topN ?? 20);

  const fields = opts.textFields || ['titulo', 'titulo_pt', 'texto', 'resumo_pt', 'resumo', 'tema', 'tags'];

  return documents
    .map(doc => {
      const combined = fields.map(f => {
        const v = doc[f];
        return Array.isArray(v) ? v.join(' ') : (v || '');
      }).join(' ');

      const tfidf  = scoreTFIDF(queryTokens, combined);
      const overlap = keywordOverlap(queryTokens, tokenize(combined));
      const boost   = behaviourBoost(doc, opts.savedSet, opts.likedSet);

      const _score = (tfidf * 0.6 + overlap * 100 * 0.4) * boost;
      return { ...doc, _score };
    })
    .filter(d => d._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, opts.topN ?? 20);
}

module.exports = { tokenize, buildTF, idf, scoreTFIDF, keywordOverlap, rankByRelevance };
