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
// Fair use: WAKAI_DAILY_LIMIT perguntas/dia (contador em wakai_usage), somando
// os dois modos. Gate Premium no servidor (403 premium_required).
// Modelo: WAKAI_MODEL (padrão Sonnet — qualidade clínica > custo; ~30 q/dia).

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { isPremium, WAKAI_DAILY_LIMIT } = require('./_lib/plans');
const { request } = require('./_lib');
const log = require('./_lib/logger');

const WAKAI_MODEL = process.env.WAKAI_MODEL || 'claude-sonnet-5';
const MAX_CONTEXT_ARTICLES = 8;

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

// ── Fair use (30/dia) — read-modify-write; uso individual, concorrência baixa ─
async function checkAndCountUsage(db, email) {
  const today = new Date().toISOString().slice(0, 10);
  const id = `${emailHash16(email)}_${today}`;
  const doc = await db.getDoc('wakai_usage', id).catch(() => null);
  const usadas = doc?.count || 0;
  if (usadas >= WAKAI_DAILY_LIMIT) return { ok: false, usadas, restantes: 0 };
  await db.setDoc('wakai_usage', id, { email: emailHash16(email), date: today, count: usadas + 1 })
    .catch(e => log.warn('[wakai] contador falhou', { err: e.message }));
  return { ok: true, usadas: usadas + 1, restantes: WAKAI_DAILY_LIMIT - usadas - 1 };
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

async function askClaude(modo, especialidade, contexto, pergunta) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  const payload = JSON.stringify({
    model: WAKAI_MODEL,
    max_tokens: 1200,
    system: systemFor(modo, especialidade, !!contexto),
    messages: [{ role: 'user', content: (contexto ? `ARTIGOS DO CONTEXTO:\n${contexto}\n\n` : '') + `PERGUNTA DO DENTISTA:\n${pergunta}` }],
  });
  const buf = Buffer.from(payload, 'utf8');
  const res = await request({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01',
               'content-type': 'application/json', 'content-length': buf.length },
  }, buf);
  if (res.status !== 200) throw new Error('Claude ' + res.status + ': ' + res.body.slice(0, 200));
  const json = JSON.parse(res.body);
  return (json.content?.[0]?.text || '').trim();
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

    const uso = await checkAndCountUsage(db, email);
    if (!uso.ok) {
      return { statusCode: 429, headers, body: JSON.stringify({
        error: 'limite_diario', restantes: 0,
        message: `Você usou as ${WAKAI_DAILY_LIMIT} perguntas de hoje. O limite renova à meia-noite (UTC).`,
      }) };
    }

    const ctx = await buildContext(db, user, pergunta);
    const resposta = await askClaude(modoOk, ctx.especialidade, ctx.bloco, String(pergunta));

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({ resposta, fontes: ctx.fontes, modo: modoOk, restantes: uso.restantes }),
    };
  } catch (err) {
    log.error('[wakai] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno', message: 'A Wakai teve um problema. Tente de novo em instantes.' }) };
  }
};
