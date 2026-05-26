// GET /.netlify/functions/get-weekly-report
// Returns a weekly scientific intelligence summary for the authenticated user.
//
// Authorization: Bearer {sessionToken}
// Query: ?email={email}

const { Firestore }             = require('./_lib/firestore');
const { getProfile }            = require('./_lib/user-profile');
const { computeScientificScore } = require('./_lib/scientific-score');
const { classifyTrends }        = require('./_lib/trend-engine');
const { explainOneLiner }       = require('./_lib/explanation-engine');
const log                       = require('./_lib/logger');
const crypto                    = require('crypto');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
  'Cache-Control':                'private, max-age=3600',
};

function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

async function validateSession(db, email, token) {
  if (!email || !token) return null;
  try {
    const users = await db.query('cadastros', {
      where:  { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
      select: { fields: [{ fieldPath: 'sessionToken' }, { fieldPath: 'sessionExpiry' }, { fieldPath: 'especialidade' }, { fieldPath: 'nome' }] },
      limit:  1,
    });
    if (!users.length) return null;
    const u = users[0];
    if (!tokenEqual(u.sessionToken, token)) return null;
    if (u.sessionExpiry && new Date(u.sessionExpiry) < new Date()) return null;
    return u;
  } catch { return null; }
}

function weekBounds() {
  const now   = new Date();
  const day   = now.getDay();                    // 0=Sun
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const qs    = event.queryStringParameters || {};
  const email = qs.email || '';
  const auth  = event.headers?.authorization || event.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    const user = await validateSession(db, email, token);
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };

    const { start, end } = weekBounds();
    const specialties = Array.isArray(user.especialidade)
      ? user.especialidade.filter(Boolean)
      : user.especialidade ? [user.especialidade] : [];
    const primarySpec = specialties[0] || null;

    // Run queries in parallel
    const [profile, weekDigests, weekArticles] = await Promise.all([
      getProfile(email, db),

      // Digests sent this week
      db.query('digests', {
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'email'     }, op: 'EQUAL',                value: { stringValue: email } } },
              { fieldFilter: { field: { fieldPath: 'enviadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: start } } },
            ],
          },
        },
        limit: 10,
      }).catch(() => []),

      // New active articles this week for the user's specialty
      (primarySpec
        ? db.query('artigos', {
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL',                value: { stringValue: 'active'    } } },
                  { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL',                value: { stringValue: primarySpec  } } },
                  { fieldFilter: { field: { fieldPath: 'criadoEm'      }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: start        } } },
                ],
              },
            },
            orderBy: [{ field: { fieldPath: 'relevanceScore' }, direction: 'DESCENDING' }],
            limit:   50,
          })
        : Promise.resolve([])
      ).catch(() => []),
    ]);

    // Trending signal for the week
    const signals    = classifyTrends(weekArticles, 3);
    const topArticle = (signals.emAlta[0] || signals.consensoClinico[0] || weekArticles[0]) || null;

    // Articles read this week (from artigos_enviados with action=read — approximate via lidos)
    const readThisWeek = 0; // lidos is a flat list without timestamps; leave as 0

    // Compute score delta (current - stored if available)
    const currentScore = computeScientificScore(profile);

    // Top themes from the week's articles
    const themeCounts = {};
    for (const a of weekArticles) {
      if (a.tema) themeCounts[a.tema] = (themeCounts[a.tema] || 0) + 1;
    }
    const topThemes = Object.entries(themeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([tema, count]) => ({ tema, count }));

    // Build narrative highlight
    const highlight = buildHighlight(weekArticles, signals, primarySpec);

    const payload = {
      weekStart:        start,
      weekEnd:          end,
      specialty:        primarySpec,
      newArticlesThisWeek: weekArticles.length,
      digestsSentThisWeek: weekDigests.length,
      digestsOpenedThisWeek: weekDigests.filter(d => (d.aberturas || 0) > 0).length,
      articlesReadThisWeek: readThisWeek,
      topThemes,
      highlight,
      scientificScore:  currentScore.total,
      topTrendingArticle: topArticle ? {
        pmid:            topArticle.pmid || topArticle.id || '',
        titulo:          topArticle.titulo_pt || topArticle.titulo || '',
        journal:         topArticle.journal || '',
        nivel_evidencia: topArticle.nivel_evidencia || '',
        reason:          explainOneLiner(topArticle, profile),
        pubmedUrl:       topArticle.pubmedUrl || '',
      } : null,
      signals: {
        emAlta:           signals.emAlta.length,
        crescimentoRapido: signals.crescimentoRapido.length,
        emergente:        signals.emergente.length,
        consensoClinico:  signals.consensoClinico.length,
      },
    };

    log.debug('[weekly-report]', { email, newArticles: weekArticles.length });

    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (err) {
    log.error('[weekly-report] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function buildHighlight(articles, signals, specialty) {
  const metaCount = articles.filter(a => a.nivel_evidencia === 'Meta-análise').length;
  const rctCount  = articles.filter(a => a.nivel_evidencia === 'RCT').length;

  if (metaCount > 0) {
    const s = specialty ? ` em ${specialty}` : '';
    return `${metaCount} nova${metaCount > 1 ? 's' : ''} meta-análise${metaCount > 1 ? 's' : ''} publicada${metaCount > 1 ? 's' : ''}${s} esta semana.`;
  }
  if (rctCount > 0) {
    return `${rctCount} ensaio${rctCount > 1 ? 's' : ''} clínico${rctCount > 1 ? 's' : ''} randomizado${rctCount > 1 ? 's' : ''} indexado${rctCount > 1 ? 's' : ''} esta semana.`;
  }
  if (signals.emergente.length > 0) {
    return `${signals.emergente.length} artigo${signals.emergente.length > 1 ? 's' : ''} emergente${signals.emergente.length > 1 ? 's' : ''} com alto potencial de relevância identificado${signals.emergente.length > 1 ? 's' : ''}.`;
  }
  if (articles.length > 0) {
    return `${articles.length} novo${articles.length > 1 ? 's' : ''} artigo${articles.length > 1 ? 's' : ''} indexado${articles.length > 1 ? 's' : ''} na sua especialidade esta semana.`;
  }
  return 'Sem novos artigos indexados esta semana. O pipeline de ingestão roda diariamente.';
}
