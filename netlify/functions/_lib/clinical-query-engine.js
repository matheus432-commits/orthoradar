// Clinical query engine — maps natural-language clinical questions to evidence.
// Step 1: keyword extraction + specialty inference
// Step 2: Firestore query for relevant articles
// Step 3: client-side relevance scoring by keyword overlap
// Step 4: structured synthesis (algorithmic) + optional Claude synthesis

const { request }            = require('../_lib');
const { computeCuratedScore } = require('./digest-ranking');
const { resolveModel }       = require('./ai-config');
const { detectDirection }    = require('./consensus-engine');
const log                    = require('./logger');

// ── Portuguese stopwords ──────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a','de','do','da','dos','das','em','para','com','que','se','é','um','uma',
  'ao','na','no','ou','por','pelo','pela','mas','mais','como','são','tem',
  'não','o','os','as','e','este','esta','isso','aqui','qual','quais','quando',
  'quanto','onde','esse','essa','aumenta','diminui','causa','pode','deve',
  'seria','seria','qual','há','ter','ser','foi','foram','sendo',
]);

// ── Specialty keyword map ─────────────────────────────────────────────────────

const SPECIALTY_KEYWORDS = {
  'Implantodontia': ['implante','implantes','osseointegração','peri-implantar','carga imediata',
    'all-on','zigomático','seio maxilar','enxerto ósseo','overdenture','rog'],
  'Ortodontia':     ['alinhador','alinhadores','aparelho','braquete','expansão','mordida',
    'má-oclusão','cefalometria','retração','extração','ancoragem','invisalign'],
  'Periodontia':    ['periodontite','periodontal','periodonto','gengival','gengivite','placa bacteriana',
    'raspagem','curetagem','regeneração','tecido mole','mucogengival'],
  'Endodontia':     ['canal','endodontia','pulpa','polpa','raiz','instrumento','rotativo',
    'irrigação','retratamento','apicectomia','periapical','hipoclorito'],
  'Dentística':     ['resina','compósito','cerâmica','faceta','clareamento','adesão','cárie',
    'restauração','sensibilidade','erosão','bleaching','esmalte'],
  'Prótese':        ['prótese','ppc','ppf','zircônia','cad/cam','cimentação','oclusão',
    'reabilitação','overdenture','provisório','implanto-suportada'],
  'Bucomaxilofacial':['ortognática','trauma','fratura','mandíbula','maxila','cistos','tumor',
    'carcinoma','reconstrução','distração','glândula','fissura'],
  'Odontopediatria':['criança','crianças','decíduo','decíduos','infantil','bebê','cárie precoce',
    'pulpotomia','pulpectomia','hábito','HMI','hipomineralização'],
  'DTM e Dor Orofacial':['dtm','atm','bruxismo','dor orofacial','artralgia','miosite','placa oclusal',
    'botox','neuralgia','miofascial','mandíbula'],
  'Radiologia':     ['cbct','tomografia','radiografia','panorâmica','periapical','dose',
    'diagnóstico por imagem','inteligência artificial','ia','radiologia'],
};

/**
 * Extracts meaningful keywords from a clinical question.
 * Returns { keywords: string[], specialty: string|null }
 */
function parseQuestion(question) {
  const tokens = question.toLowerCase()
    .replace(/[?!.,;:]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));

  // Detect specialty by checking multi-word and single-word matches
  let matchedSpecialty = null;
  let maxMatches = 0;
  for (const [spec, keywords] of Object.entries(SPECIALTY_KEYWORDS)) {
    const lq = question.toLowerCase();
    const hits = keywords.filter(kw => lq.includes(kw.toLowerCase())).length;
    if (hits > maxMatches) { maxMatches = hits; matchedSpecialty = spec; }
  }

  return { keywords: tokens, specialty: matchedSpecialty };
}

/**
 * Scores an article's relevance to a set of keywords.
 * Returns 0–100.
 */
function keywordRelevance(article, keywords) {
  let score = 0;
  const fields = [
    { text: article.titulo_pt || article.titulo || '', weight: 4 },
    { text: article.tema || '', weight: 3 },
    { text: article.especialidade || '', weight: 2 },
    { text: Array.isArray(article.achados_principais) ? article.achados_principais.join(' ') : (article.achados_principais || ''), weight: 2 },
    { text: article.impacto_pratico || '', weight: 2 },
    { text: article.resumo_pt || article.resumo || '', weight: 1 },
  ];

  for (const kw of keywords) {
    for (const { text, weight } of fields) {
      if (text.toLowerCase().includes(kw)) score += weight;
    }
  }

  return Math.min(100, score * 2); // normalize
}

/**
 * Builds an algorithmic evidence synthesis from top articles.
 * Returns a structured object (no AI calls).
 */
function buildAlgorithmicSynthesis(question, articles) {
  if (!articles.length) {
    return {
      question,
      summary: 'Não foram encontrados artigos relevantes para esta pergunta na base atual.',
      direction: 'neutral',
      strength: 'Insuficiente',
      divergences: null,
      articleCount: 0,
      disclaimer: DISCLAIMER,
    };
  }

  const nivels = articles.map(a => a.nivel_evidencia).filter(Boolean);
  const HIGH_EV = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);
  const highCount = nivels.filter(n => HIGH_EV.has(n)).length;

  const directions = articles.map(a => {
    const text = (a.impacto_pratico || '') + ' ' + (Array.isArray(a.achados_principais) ? a.achados_principais.join(' ') : '');
    return detectDirection(text);
  });
  const posCount = directions.filter(d => d === 'positive').length;
  const negCount = directions.filter(d => d === 'negative').length;
  const mixCount = directions.filter(d => d === 'mixed').length;

  let direction = 'neutral';
  if (posCount > articles.length * 0.5) direction = 'positive';
  else if (negCount > articles.length * 0.4) direction = 'negative';
  else if (mixCount > 0 || (posCount > 0 && negCount > 0)) direction = 'mixed';

  let strength = 'Insuficiente';
  if (highCount >= 2 && articles.length >= 3) strength = 'Forte';
  else if (highCount >= 1 || articles.length >= 3) strength = 'Moderada';
  else if (articles.length >= 2) strength = 'Fraca';

  const directionText = {
    positive: 'sugerem efeito favorável',
    negative: 'apontam para resultado desfavorável ou limitado',
    mixed:    'apresentam achados heterogêneos',
    neutral:  'abordam o tema sem conclusão clara de direção',
  }[direction];

  const highStr = highCount > 0
    ? `${highCount} estudo${highCount > 1 ? 's' : ''} de alta evidência (${nivels.filter(n => HIGH_EV.has(n)).join(', ')})`
    : `${articles.length} estudo${articles.length > 1 ? 's' : ''}`;

  const summary = `${highStr} encontrado${articles.length > 1 ? 's' : ''} ${directionText} em relação à questão clínica. Força da evidência: ${strength}.`;

  const divergences = direction === 'mixed'
    ? `${mixCount + negCount} estudo${mixCount + negCount > 1 ? 's' : ''} apresenta${mixCount + negCount > 1 ? 'm' : ''} resultados conflitantes.`
    : null;

  return {
    question,
    summary,
    direction,
    strength,
    divergences,
    articleCount: articles.length,
    disclaimer:   DISCLAIMER,
  };
}

const DISCLAIMER = 'Este conteúdo é destinado à atualização científica e não substitui avaliação clínica individualizada.';

// ── Optional Claude synthesis ─────────────────────────────────────────────────

async function callClaudeForSynthesis(question, articles) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const context = articles.slice(0, 5).map((a, i) => {
    const achados = Array.isArray(a.achados_principais)
      ? a.achados_principais.slice(0, 2).join('; ')
      : (a.achados_principais || '');
    return `[${i + 1}] ${a.titulo_pt || a.titulo} (${a.nivel_evidencia || '?'}, ${a.journal || '?'})
Achados: ${achados || a.impacto_pratico || '—'}
Limitações: ${a.limitacoes || '—'}`;
  }).join('\n\n');

  const prompt =
    'Você é um assistente de síntese de evidências para dentistas. NÃO forneça diagnóstico, NÃO faça recomendação definitiva.\n\n' +
    `Pergunta clínica: "${question}"\n\n` +
    `Estudos disponíveis:\n${context}\n\n` +
    'Forneça uma síntese BREVE (máx 3 frases) em português brasileiro que:\n' +
    '1. Resuma o que a evidência disponível sugere\n' +
    '2. Aponte divergências, se existirem\n' +
    '3. Mencione força da evidência\n' +
    'Use linguagem qualificada ("estudos sugerem", "evidências indicam"). ' +
    'NUNCA use linguagem absoluta ou definitiva.\n' +
    'Responda apenas com o texto da síntese, sem títulos ou marcações.';

  try {
    const body = JSON.stringify({
      model:      resolveModel('CLINICAL_MODEL'),
      max_tokens: 280,
      messages:   [{ role: 'user', content: prompt }],
    });
    const buf = Buffer.from(body, 'utf8');
    const res = await Promise.race([
      request({
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers:  {
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
          'content-type':      'application/json',
          'content-length':    buf.length,
        },
      }, buf),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Claude timeout')), 7000)),
    ]);

    if (res.status !== 200) return null;
    const json = JSON.parse(res.body);
    return (json.content?.[0]?.text || '').trim() || null;
  } catch (err) {
    log.warn('[clinical-query] Claude synthesis failed', { err: err.message });
    return null;
  }
}

/**
 * Main entry — parse question, find articles, synthesise.
 *
 * @param {string}   question  — clinical question text
 * @param {Array}    articles  — pre-fetched candidate articles
 * @param {Object}   opts      — { useAI: bool }
 * @returns {Object}           — synthesis result
 */
async function answerClinicalQuestion(question, articles, opts = {}) {
  const { keywords, specialty } = parseQuestion(question);

  // Score and rank articles by keyword relevance + curation score
  const scored = articles
    .map(a => ({
      ...a,
      _krel: keywordRelevance(a, keywords),
      _cs:   computeCuratedScore(a),
    }))
    .filter(a => a._krel > 0 || keywords.length === 0)
    .sort((a, b) => (b._krel * 0.7 + b._cs * 0.3) - (a._krel * 0.7 + a._cs * 0.3))
    .slice(0, 6)
    .map(({ _krel, _cs, ...rest }) => rest);

  const algSynthesis = buildAlgorithmicSynthesis(question, scored);

  let aiSummary = null;
  if (opts.useAI && scored.length > 0 && process.env.ANTHROPIC_API_KEY) {
    aiSummary = await callClaudeForSynthesis(question, scored);
  }

  return {
    ...algSynthesis,
    summary:         aiSummary || algSynthesis.summary,
    aiEnhanced:      !!aiSummary,
    inferredSpecialty: specialty,
    keywords,
    articles: scored.map(a => ({
      pmid:            a.pmid || a.id || '',
      titulo:          a.titulo_pt || a.titulo || '',
      journal:         a.journal || '',
      data:            a.data || '',
      nivel_evidencia: a.nivel_evidencia || '',
      impacto:         a.impacto_pratico || '',
      limitacoes:      a.limitacoes || '',
      pubmedUrl:       a.pubmedUrl || '',
      isOpenAccess:    a.isOpenAccess || false,
    })),
  };
}

module.exports = { answerClinicalQuestion, parseQuestion, keywordRelevance, DISCLAIMER };
