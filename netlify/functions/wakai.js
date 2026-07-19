// Wakai — assistente de IA pessoal do plano Premium (Fase C).
//
// POST { email, token, modo, pergunta }
//   modo 'conversa'  → resposta em prosa de colega especialista ("qual adesivo é melhor?")
//   modo 'protocolo' → passo a passo clínico em tópicos objetivos ("como cimentar pino de fibra?")
//
// Fundamentação: a Wakai responde ancorada nos artigos da base do OdontoFeed
// (especialidade do dentista) + na BIBLIOTECA PESSOAL dele (itens salvos e
// notas privadas) + no conhecimento consolidado da literatura. Os artigos
// usados são citados na resposta e devolvidos em `fontes`.
//
// Fair use: orçamento de TOKENS/dia (entrada + saída), não número de perguntas
// — o teto acompanha o custo real da API. Contador em wakai_usage, somando os
// dois modos. Gate Premium no servidor (403 premium_required).
// Modelo: WAKAI_MODEL (padrão Sonnet — qualidade clínica > custo).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { isPremium, WAKAI_DAILY_TOKEN_LIMIT } = require('./_lib/plans');
const { request } = require('./_lib');
const log = require('./_lib/logger');

const WAKAI_MODEL = process.env.WAKAI_MODEL || 'claude-sonnet-5';
const MAX_CONTEXT_ARTICLES = 8;
// Orçamento diário de tokens (env sobrepõe o padrão do plano).
const TOKEN_LIMIT = Number(process.env.WAKAI_DAILY_TOKEN_LIMIT) || WAKAI_DAILY_TOKEN_LIMIT;

function emailHash16(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}
function tokenEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function getUser(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  });
  return docs[0] || null;
}

// ── Fair use por orçamento de TOKENS/dia ──────────────────────────────────────
// Só sabemos o gasto real (entrada + saída) DEPOIS da chamada ao Claude, então:
//   1. usageDocId/readUsage: quanto já foi gasto hoje — se estourou, barra antes.
//   2. recordUsage: soma os tokens efetivamente consumidos após a resposta.
// Read-modify-write; uso individual, concorrência baixa.
function usageDocId(email) {
  return `${emailHash16(email)}_${new Date().toISOString().slice(0, 10)}`;
}
async function readUsage(db, email) {
  const doc = await db.getDoc('wakai_usage', usageDocId(email)).catch(() => null);
  const tokens = doc?.tokens || 0;
  return { tokens, restantes: Math.max(0, TOKEN_LIMIT - tokens), esgotado: tokens >= TOKEN_LIMIT };
}
async function recordUsage(db, email, tokensGastos) {
  const id = usageDocId(email);
  const doc = await db.getDoc('wakai_usage', id).catch(() => null);
  const tokens = (doc?.tokens || 0) + tokensGastos;
  const perguntas = (doc?.count || 0) + 1;
  await db.setDoc('wakai_usage', id, {
    email: emailHash16(email), date: new Date().toISOString().slice(0, 10), tokens, count: perguntas,
  }).catch(e => log.warn('[wakai] contador falhou', { err: e.message }));
  return { tokens, restantes: Math.max(0, TOKEN_LIMIT - tokens) };
}

// ── Recuperação de contexto: artigos da especialidade + biblioteca pessoal ────
// Firestore não tem busca textual — pontuamos por sobreposição de termos da
// pergunta com título/resumo/tema, com bônus para itens da biblioteca (o
// dentista já estudou aqueles) e para evidência forte.
function scoreArticle(art, terms, daBiblioteca) {
  const texto = norm((art.titulo_pt || art.titulo || '') + ' ' + (art.resumo_pt || '') + ' ' +
                     (art.tema || '') + ' ' + (art.impacto_pratico || '') + ' ' + (art.nota || ''));
  let score = 0;
  for (const t of terms) if (texto.includes(t)) score += 2;
  if (daBiblioteca) score += 3;
  if (/meta|sistem/i.test(art.nivel_evidencia || '')) score += 2;
  else if (/rct/i.test(art.nivel_evidencia || '')) score += 1;
  return score;
}

async function buildContext(db, user, pergunta) {
  const especialidade = Array.isArray(user.especialidade) ? user.especialidade[0] : user.especialidade;
  const terms = [...new Set(norm(pergunta).split(/[^a-z0-9]+/).filter(w => w.length > 3))];

  const [artigos, biblioteca] = await Promise.all([
    db.query('artigos', {
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
      ] } },
      limit: 120,
    }).catch(() => []),
    db.query('biblioteca_itens', {
      where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: user.email } } },
      limit: 100,
    }).catch(() => []),
  ]);

  const bibIds = new Set(biblioteca.map(b => String(b.pmid)));
  const notaPorPmid = Object.fromEntries(biblioteca.map(b => [String(b.pmid), b.nota || '']));

  const ranked = artigos
    .map(a => ({ ...a, nota: notaPorPmid[String(a.pmid || a.id)] || '',
                 _s: scoreArticle({ ...a, nota: notaPorPmid[String(a.pmid || a.id)] }, terms, bibIds.has(String(a.pmid || a.id))) }))
    .filter(a => a._s > 0)
    .sort((a, b) => b._s - a._s)
    .slice(0, MAX_CONTEXT_ARTICLES);

  const bloco = ranked.map((a, i) =>
    `[${i + 1}] ${(a.titulo_pt || a.titulo || '').slice(0, 140)} (${a.journal || 's/ periódico'}, ${a.year || 's/ ano'}; ${a.nivel_evidencia || 'evidência n/d'})` +
    `${bibIds.has(String(a.pmid || a.id)) ? ' [SALVO NA BIBLIOTECA DO DENTISTA]' : ''}` +
    `\nResumo: ${(a.resumo_pt || '').slice(0, 500)}` +
    `${a.nota ? `\nNota pessoal do dentista: ${String(a.nota).slice(0, 300)}` : ''}`
  ).join('\n\n');

  return { especialidade, bloco, fontes: ranked.map((a, i) => ({
    n: i + 1, pmid: String(a.pmid || a.id || ''), titulo: a.titulo_pt || a.titulo || '',
    nivel: a.nivel_evidencia || '', daBiblioteca: bibIds.has(String(a.pmid || a.id)),
  })) };
}

// ── Prompts por modo ──────────────────────────────────────────────────────────
function systemFor(modo, especialidade, temContexto) {
  const base =
`Você é a Wakai, assistente científica pessoal do OdontoFeed para um cirurgião-dentista de ${especialidade} no Brasil.
REGRAS PERMANENTES:
- Responda em português brasileiro, para um COLEGA profissional (nunca linguagem de paciente).
- Fundamente-se na literatura consolidada${temContexto ? ' e nos ARTIGOS DO CONTEXTO — cite-os como [1], [2] quando os usar. Dê peso especial aos marcados como salvos na biblioteca do dentista' : ''}.
- Seja honesta sobre incerteza: quando a evidência é fraca ou dividida, diga.
- NÃO invente números, referências nem artigos. Se não houver artigo no contexto sobre o tema, responda pelo conhecimento consolidado e diga isso.
- Encerre SEMPRE com uma linha: "⚠️ Conteúdo informativo — não substitui seu julgamento clínico nem a leitura das fontes."`;

  if (modo === 'protocolo') {
    return base + `
FORMATO OBRIGATÓRIO (modo Protocolo): responda como protocolo clínico em TÓPICOS numerados, objetivos e sequenciais (passo a passo executável em consultório). Estruture: Indicações → Materiais → Passo a passo → Erros comuns/atenção → Nível de evidência do protocolo. Sem parágrafos longos; frases curtas de comando.`;
  }
  return base + `
FORMATO (modo Conversa): prosa clara e direta de colega especialista; parágrafos curtos; compare alternativas quando a pergunta pedir escolha, com o porquê baseado em evidência.`;
}

// ATENÇÃO ao orçamento de tempo: a function síncrona do Netlify tem ~26s.
// O timeout padrão do _lib.request é 15s — insuficiente para o Sonnet gerar
// uma resposta clínica completa (bug real 19/07: "A Wakai teve um problema"
// em toda pergunta). Damos 20s SÓ para a chamada ao Claude, SEM retry
// (maxRetries=0): retry duplicaria a cobrança de tokens e estouraria os 26s.
const CLAUDE_TIMEOUT_MS = 20000;
const MAX_ANSWER_TOKENS = 1000; // ~13s de geração — cabe no orçamento com folga

async function askClaude(modo, especialidade, contexto, pergunta) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { const e = new Error('ANTHROPIC_API_KEY not set'); e.config = true; throw e; }
  const payload = JSON.stringify({
    model: WAKAI_MODEL,
    max_tokens: MAX_ANSWER_TOKENS,
    system: systemFor(modo, especialidade, !!contexto),
    messages: [{ role: 'user', content: (contexto ? `ARTIGOS DO CONTEXTO:\n${contexto}\n\n` : '') + `PERGUNTA DO DENTISTA:\n${pergunta}` }],
  });
  const buf = Buffer.from(payload, 'utf8');
  const res = await request({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    timeoutMs: CLAUDE_TIMEOUT_MS,
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
               'content-type': 'application/json', 'content-length': buf.length },
  }, buf, 0, 0 /* sem retry — ver comentário acima */);
  if (res.status !== 200) throw new Error('Claude ' + res.status + ': ' + res.body.slice(0, 200));
  const json = JSON.parse(res.body);
  const u = json.usage || {};
  const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) +
                 (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  // O retorno pode conter blocos não-textuais ANTES do texto (ex.: bloco de
  // raciocínio do modelo). Pegar só content[0] devolvia resposta vazia com a
  // API já cobrada (bug real 19/07: só as fontes apareciam no chat). Junta
  // TODOS os blocos de texto; sem nenhum, erra alto com diagnóstico no log.
  const texto = (Array.isArray(json.content) ? json.content : [])
    .filter(b => b && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text).join('\n').trim();
  if (!texto) {
    log.error('[wakai] resposta sem bloco de texto', {
      blocos: (json.content || []).map(b => b && b.type), stop: json.stop_reason, tokens,
    });
    const e = new Error('resposta_vazia'); e.vazia = true; throw e;
  }
  return { texto, tokens };
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }
  const { email, token, modo, pergunta } = body;
  if (!email || !token || !pergunta) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatorios faltando' }) };
  if (String(pergunta).length > 1000) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Pergunta muito longa (máx. 1000 caracteres).' }) };
  const modoOk = modo === 'protocolo' ? 'protocolo' : 'conversa';

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const db = new Firestore(projectId, process.env.FIREBASE_API_KEY);

  try {
    const user = await getUser(db, email);
    if (!user || !tokenEqual(user.sessionToken, token)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_invalida' }) };
    }
    if (user.sessionExpiry && new Date(user.sessionExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'sessao_expirada' }) };
    }
    if (!isPremium(user) || user.ativo === false) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'premium_required', message: 'A Wakai é exclusiva do plano Premium.' }) };
    }

    const uso = await readUsage(db, email);
    if (uso.esgotado) {
      return { statusCode: 429, headers, body: JSON.stringify({
        error: 'limite_diario', restantes: 0, limite: TOKEN_LIMIT,
        message: 'Você atingiu o limite de uso da Wakai hoje. O limite renova à meia-noite (UTC).',
      }) };
    }

    const ctx = await buildContext(db, user, pergunta);
    const { texto, tokens } = await askClaude(modoOk, ctx.especialidade, ctx.bloco, String(pergunta));
    const pos = await recordUsage(db, email, tokens);

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        resposta: texto, fontes: ctx.fontes, modo: modoOk,
        restantes: pos.restantes, limite: TOKEN_LIMIT,
      }),
    };
  } catch (err) {
    // Diagnóstico específico no log + mensagem útil ao dentista:
    //   config  → chave da IA ausente no ambiente do Netlify (erro de deploy)
    //   timeout → a geração passou do orçamento de tempo (pergunta muito ampla)
    log.error('[wakai] erro', { err: err.message, config: !!err.config });
    if (err.config) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'config', message: 'A Wakai está temporariamente indisponível por configuração do servidor. Já fomos avisados.' }) };
    }
    if (err.vazia) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'resposta_vazia', message: 'A Wakai não conseguiu concluir a resposta desta vez. Pergunte de novo, por favor.' }) };
    }
    if (/timeout/i.test(err.message)) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'timeout', message: 'A resposta demorou mais que o esperado. Tente de novo — perguntas mais específicas respondem mais rápido.' }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno', message: 'A Wakai teve um problema. Tente de novo em instantes.' }) };
  }
};
