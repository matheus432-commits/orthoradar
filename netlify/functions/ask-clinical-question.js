// POST /.netlify/functions/ask-clinical-question
// Searches the evidence base for a clinical question and returns a structured synthesis.
//
// Body: { question: string, specialty?: string, email?: string, ai?: boolean }
//
// By default returns algorithmic synthesis (fast, free).
// Pass ai: true to use Claude Haiku for richer synthesis (requires ANTHROPIC_API_KEY).

const { Firestore }               = require('./_lib/firestore');
const { answerClinicalQuestion, parseQuestion } = require('./_lib/clinical-query-engine');
const { logEvent }                = require('./_lib/engagement');
const log                         = require('./_lib/logger');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const CANDIDATE_LIMIT = 80;

exports.handler = async (event) => {
  const headers = CORS;

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const question = (body.question || '').trim();
  if (!question || question.length < 5) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question is required (min 5 chars)' }) };
  }
  if (question.length > 300) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Question too long (max 300 chars)' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Config error' }) };

  const db = new Firestore(projectId, apiKey);

  try {
    // Infer specialty from question or use provided override
    const { specialty: inferredSpec } = parseQuestion(question);
    const specialty = body.specialty || inferredSpec;

    // Fetch candidate articles
    const where = specialty
      ? {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'status'        }, op: 'EQUAL', value: { stringValue: 'active'    } } },
              { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: specialty   } } },
            ],
          },
        }
      : { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } };

    let articles;
    try {
      articles = await db.query('artigos', {
        where,
        orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }],
        limit:   CANDIDATE_LIMIT,
      });
    } catch {
      articles = await db.query('artigos', { where, limit: CANDIDATE_LIMIT });
    }

    const useAI = body.ai === true && !!process.env.ANTHROPIC_API_KEY;
    const result = await answerClinicalQuestion(question, articles, { useAI });

    // Track usage (non-blocking)
    logEvent(projectId, apiKey, {
      eventType: 'clinical_query_searched',
      email:     body.email || null,
      pmid:      question.slice(0, 100),
      digestId:  null,
    }).catch(() => {});

    log.debug('[ask-clinical-question]', {
      question:  question.slice(0, 80),
      specialty,
      articles:  articles.length,
      matches:   result.articleCount,
      aiUsed:    result.aiEnhanced,
    });

    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[ask-clinical-question] error', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
