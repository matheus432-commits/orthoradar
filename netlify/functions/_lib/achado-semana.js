// "Achado da Semana" — seleciona e armazena o artigo editorial especial de cada semana.
//
// Fluxo:
//   1. Calcula o ID da semana ISO (YYYY-W##).
//   2. Consulta Firestore: já existe um achado para esta semana + especialidade?
//      Sim → retorna o documento em cache (reutilizado terça a domingo).
//      Não → seleciona o melhor artigo, gera a nota editorial via Claude, persiste.
//   3. O achado é incluído pelo daily-digest no topo do email, antes dos artigos regulares.
//
// Storage: Firestore coleção `achado_semana`, doc ID = `{YYYY-W##}_{especialidade}`.

const { request } = require('../_lib');
const log         = require('./logger');
const { resolveModel } = require('./ai-config');

const HOST  = 'api.anthropic.com';
const MODEL = resolveModel('ACHADO_MODEL');

// ── Prioridade de nível de evidência ─────────────────────────────────────────

const EVIDENCE_PRIORITY = {
  'Meta-análise':        5,
  'Revisão Sistemática': 4,
  'RCT':                 3,
  'Estudo Coorte':       2,
  'Revisão Narrativa':   1,
  'Caso Clínico':        0,
  'In Vitro':            0,
  'Estudo Animal':       0,
};

// ── Utilitários de data ───────────────────────────────────────────────────────

// Retorna o número da semana ISO e ano: ex. "2025-W26"
function getWeekId(date) {
  const now = date || new Date();
  const d = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart  = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

// ── Seleção do melhor artigo ──────────────────────────────────────────────────

function selectBestArticle(candidates) {
  if (!candidates.length) return null;

  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 3600 * 1000).toISOString();

  // Elegíveis: evidência ≥ Coorte, clínicos (não lab/animal), publicados há ≤ 4 semanas
  const eligible = candidates.filter(a => {
    if ((EVIDENCE_PRIORITY[a.nivel_evidencia] || 0) < 2) return false;
    if (!a.data || a.data < fourWeeksAgo) return false;
    if (/vitro|animal/i.test(a.nivel_evidencia || '')) return false;
    return true;
  });

  const pool = eligible.length > 0 ? eligible : candidates;

  const scored = pool.map(a => ({
    article: a,
    score:
      (EVIDENCE_PRIORITY[a.nivel_evidencia] || 0) * 20 +
      (a.relevanceScore || 0) * 0.5 +
      (a.data && a.data >= fourWeeksAgo ? 10 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored[0].article;
}

// ── Geração da nota editorial via Claude ──────────────────────────────────────

async function generateNotaEditorial(article, especialidade, anthropicKey) {
  if (!anthropicKey) return null;

  const titulo   = article.titulo_pt || article.titulo || '';
  const abstract = (article.abstract || article.resumo_pt || '').slice(0, 1200);
  const impacto  = article.impacto_pratico || '';
  const nivel    = article.nivel_evidencia || 'estudo recente';
  const achados  = Array.isArray(article.achados_principais)
    ? article.achados_principais.map(x => (typeof x === 'string' ? x : '')).filter(Boolean).join('; ')
    : (article.achados_principais || impacto);

  const systemPrompt =
`Você é um especialista clínico sênior em ${especialidade} escrevendo para colegas dentistas brasileiros.

Sua tarefa: escrever a nota editorial "Por que este artigo importa agora?" para o Achado da Semana do OdontoFeed.

REGRAS ABSOLUTAS:
- Tom: colega especialista falando com pares, NÃO acadêmico, NÃO marketing
- Parágrafo 1: por que ESTE achado é relevante AGORA para ${especialidade}
- Parágrafo 2: o que muda (ou confirma) na prática clínica real
- Parágrafo 3: qual debate ou protocolo este estudo esclarece
- Parágrafo 4 (opcional): reflexão final concreta para o consultório
- PROIBIDO: citar metodologia, p-valor, IC, OR, amostras, estatísticas
- PROIBIDO: bullet points — escreva APENAS prosa fluida
- PROIBIDO: linguagem de marketing, superlativos vazios
- Separe parágrafos com linha em branco
- Português brasileiro, máximo 300 palavras`;

  const userContent =
`Artigo selecionado (${nivel}):
Título: ${titulo}
Achados: ${achados || abstract.slice(0, 400)}
${abstract.length > 400 ? `Resumo: ${abstract}` : ''}`;

  const body = JSON.stringify({
    model:      MODEL,
    max_tokens: 700,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userContent }],
  });

  try {
    const buf = Buffer.from(body, 'utf8');
    const res = await request({
      hostname: HOST,
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'Content-Length':    buf.length,
        'x-api-key':         anthropicKey,
        'anthropic-version': '2023-06-01',
      },
    }, buf);

    if (res.status === 429 || res.status === 529) {
      log.warn('[achado-semana] Claude rate limited', { status: res.status });
      return { text: null, rateLimited: true };
    }
    if (res.status !== 200) {
      log.warn('[achado-semana] Claude API error', { status: res.status });
      return { text: null, rateLimited: false };
    }

    const json = JSON.parse(res.body);
    return { text: json.content?.[0]?.text?.trim() || null, rateLimited: false };
  } catch (err) {
    log.warn('[achado-semana] generateNotaEditorial threw', { err: err.message });
    return { text: null, rateLimited: false };
  }
}

// Nota determinística de fallback quando Claude não está disponível
function buildFallbackNota(article, especialidade) {
  const impacto = (article.impacto_pratico || '').trim();
  const nivel   = (article.nivel_evidencia || 'Estudo recente').toLowerCase();
  if (impacto.length > 50) {
    return `Este ${nivel} em ${especialidade} apresenta uma contribuição relevante para a prática clínica: ${impacto}\n\nSua leitura pode enriquecer a tomada de decisão em casos do dia a dia. Recomendamos avaliar a aplicabilidade ao contexto do seu consultório.`;
  }
  return `Este estudo em ${especialidade} foi selecionado pelo OdontoFeed por seu potencial impacto clínico. Recomendamos a leitura completa para avaliar sua aplicabilidade.`;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Retorna o "Achado da Semana" para a especialidade.
 * Usa cache Firestore; gera apenas uma vez por semana por especialidade.
 *
 * @param {Firestore} db
 * @param {Array}     candidates  - artigos candidatos já filtrados para o usuário
 * @param {string}    especialidade
 * @param {string|null} anthropicKey
 * @returns {Promise<Object|null>} - documento do achado ou null se nenhum artigo elegível
 */
async function getOrCreateAchadoSemana(db, candidates, especialidade, anthropicKey) {
  const semana  = getWeekId();
  const safeEsp = especialidade.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
  const docId   = `${semana}_${safeEsp}`;

  // 1. Tentar cache Firestore
  try {
    const cached = await db.getDoc('achado_semana', docId);
    if (cached && cached.notaEditorial) {
      log.debug('[achado-semana] cache hit', { docId });
      return cached;
    }
  } catch (err) {
    log.warn('[achado-semana] cache read error', { docId, err: err.message });
  }

  // 2. Selecionar o melhor artigo — prioriza artigos da especialidade
  const forSpecialty = candidates.filter(a =>
    !a.especialidade || a.especialidade === especialidade
  );
  const best = selectBestArticle(forSpecialty.length >= 3 ? forSpecialty : candidates);

  if (!best) {
    log.warn('[achado-semana] no eligible article', { especialidade });
    return null;
  }

  log.info('[achado-semana] generating nota editorial', {
    especialidade, id: best.pmid || best.id,
  });

  // 3. Gerar nota editorial
  const notaResult    = await generateNotaEditorial(best, especialidade, anthropicKey);
  const notaRaw       = notaResult?.text || null;
  const rateLimited   = notaResult?.rateLimited || false;
  const notaEditorial = notaRaw || buildFallbackNota(best, especialidade);

  const doc = {
    pmid:           best.pmid         || null,
    articleId:      best.id           || best.pmid || '',
    titulo:         best.titulo       || best.title || '',
    titulo_pt:      best.titulo_pt    || '',
    journal:        best.journal      || '',
    year:           best.year         || null,
    autores:        best.autores      || [],
    nivel_evidencia: best.nivel_evidencia || '',
    isOpenAccess:   best.isOpenAccess || false,
    pubmedUrl:      best.pubmedUrl    || best.url || '',
    impacto_pratico: best.impacto_pratico || '',
    notaEditorial,
    especialidade,
    semana,
    criadoEm: new Date().toISOString(),
  };

  // 4. Persistir (best-effort; skipped when Claude rate-limited to avoid caching the fallback nota)
  if (!rateLimited) {
    try {
      await db.setDoc('achado_semana', docId, doc);
      log.info('[achado-semana] persisted', { docId });
    } catch (err) {
      log.warn('[achado-semana] persist failed', { docId, err: err.message });
    }
  } else {
    log.warn('[achado-semana] skipping persist — Claude rate limited', { docId });
  }

  return doc;
}

module.exports = { getOrCreateAchadoSemana, getWeekId };
