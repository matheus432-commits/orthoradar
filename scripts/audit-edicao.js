// AUDITORIA DIÁRIA DE QUALIDADE da edição (pedido do fundador, 22/07):
// roda após a geração (e sob demanda) e REPROVA em vermelho quando encontra:
//   A. artigo da edição sem enriquecimento (titulo_pt/resumo_pt ausentes);
//   B. episódio de podcast curto demais (<40s) ou sem roteiro;
//   C. roteiro que menciona comparação/diferença sem declarar o VEREDITO
//      (qual grupo foi melhor/pior) — checagem via Haiku.
// Saída: relatório no log; exit 1 se qualquer item reprovar (o passo fica
// vermelho no Actions e o problema aparece no mesmo dia, não pelo usuário).

const { request } = require('../netlify/functions/_lib');
const { Firestore } = require('../netlify/functions/_lib/firestore');
const { tituloEmIngles } = require('../netlify/functions/_lib/scoring');
const { specialtySlug } = require('../netlify/functions/_lib/slug');
const { extractAnthropicText } = require('../netlify/functions/_lib/anthropic-text');
const { registrar, logCusto } = require('../netlify/functions/_lib/ai-meter');
const { verifyUrl } = require('../netlify/functions/_lib/storage');
const { billableChars } = require('../netlify/functions/_lib/tts-budget');
const { isHealthSystemCost, isResultadosIndisponiveis, isHealthPromotionBehavior, isBibliometricScoping } = require('../netlify/functions/daily-digest');

const HOJE = process.env.AUDIT_DATE || new Date().toISOString().slice(0, 10);
const VERIFY_MODEL = process.env.PODCAST_VERIFY_MODEL || 'claude-haiku-4-5-20251001';

async function haiku(key, system, user) {
  const body = Buffer.from(JSON.stringify({
    model: VERIFY_MODEL, max_tokens: 300, system,
    messages: [{ role: 'user', content: user }],
  }), 'utf8');
  const res = await request({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': body.length,
      'x-api-key': key, 'anthropic-version': '2023-06-01' },
  }, body);
  if (res.status !== 200) return null;
  const jsonBody = JSON.parse(res.body);
  registrar(VERIFY_MODEL, jsonBody.usage, 'auditoria');
  let text = extractAnthropicText(jsonBody);
  if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  // Parse tolerante: recorta do primeiro '{' ao último '}' (o modelo às vezes
  // anexa texto ao redor do JSON).
  const ini = text.indexOf('{'), fim = text.lastIndexOf('}');
  try { return JSON.parse(ini >= 0 && fim > ini ? text.slice(ini, fim + 1) : text); } catch { return null; }
}

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) { console.log('SEM_FIREBASE_API_KEY'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);
  const falhas = [];

  console.log(`=== AUDITORIA DA EDIÇÃO DE ${HOJE} ===`);

  // A. Digests do dia: todo artigo precisa estar (1) enriquecido, (2) com o
  // título EM PORTUGUÊS e (3) com RESUMO COMPLETO. Incidente 24/07: card em
  // inglês, sem resumo completo.
  // FILTRO NO SERVIDOR (auditoria 30/07): a coleção acumula ~12 docs/dia; sem o
  // where, o limit 100 alfabético deixaria de ver os digests de hoje dos slugs
  // do fim do alfabeto em ~8 dias.
  const digests = (await db.query('digests_especialidade', {
    where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: HOJE } } },
    limit: 100,
  }).catch(() => []))
    .filter(d => String(d.id || '').endsWith('_' + HOJE));
  console.log(`digests de hoje: ${digests.length}`);
  for (const d of digests) {
    for (const a of (Array.isArray(d.artigos) ? d.artigos : [])) {
      const id = a.pmid || a.id;
      const tituloOk = String(a.titulo_pt || '').trim().length >= 10;
      const resumoOk = String(a.resumo_pt || '').trim().length >= 120;
      if (!tituloOk || !resumoOk) {
        falhas.push(`[digest ${d.id}] artigo ${id} SEM ENRIQUECIMENTO (titulo_pt: ${tituloOk}, resumo_pt: ${resumoOk}) — "${String(a.titulo || a.titulo_pt || '').slice(0, 70)}"`);
        continue;
      }
      if (tituloEmIngles(a.titulo_pt, a.titulo || a.title || '')) {
        falhas.push(`[digest ${d.id}] artigo ${id} TÍTULO AINDA EM INGLÊS (não traduzido): "${String(a.titulo_pt).slice(0, 80)}"`);
      }
      if (String(a.resumo_completo || '').trim().length < 200) {
        falhas.push(`[digest ${d.id}] artigo ${id} SEM RESUMO COMPLETO (o "Ler resumo completo" ficaria vazio) — "${String(a.titulo_pt || '').slice(0, 60)}"`);
      }
      // Curadoria (diretriz 24/07): custo/economia no sistema de saúde e estudos
      // sem resultados acessíveis (remetem ao texto completo) NÃO entram.
      if (isHealthPromotionBehavior(a)) {
        falhas.push(`[digest ${d.id}] artigo ${id} PROMOÇÃO/COMPORTAMENTO/PROGRAMA (sem impacto clínico — não deveria entrar): "${String(a.titulo_pt || '').slice(0, 70)}"`);
      }
      if (isBibliometricScoping(a)) {
        falhas.push(`[digest ${d.id}] artigo ${id} META-PESQUISA (mapeamento/escopo/bibliometria — não deveria entrar): "${String(a.titulo_pt || '').slice(0, 70)}"`);
      }
      if (isHealthSystemCost(a)) {
        falhas.push(`[digest ${d.id}] artigo ${id} ESTUDO DE CUSTO/SISTEMA DE SAÚDE (sem impacto clínico — não deveria entrar): "${String(a.titulo_pt || '').slice(0, 70)}"`);
      }
      if (isResultadosIndisponiveis(a)) {
        falhas.push(`[digest ${d.id}] artigo ${id} SEM RESULTADOS ACESSÍVEIS (remete ao texto completo / dados indisponíveis — não deveria entrar): "${String(a.titulo_pt || '').slice(0, 70)}"`);
      }
    }
  }

  // B + C. Episódios do dia — filtrados NO SERVIDOR por data (incidente 30/07:
  // sem o where, o limit 300 devolvia os primeiros 300 IDs em ordem ALFABÉTICA
  // de slug; com semanas de histórico, protese_* e radiologia_* — fim do
  // alfabeto — nunca entravam e a auditoria acusava "SEM PODCAST" para
  // episódios que EXISTIAM. Alarme falso determinístico.)
  const eps = (await db.query('podcast_episodios', {
    where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'EQUAL', value: { stringValue: HOJE } } },
    limit: 300,
  }).catch(() => []))
    .filter(e => e.date === HOJE && e.tipo !== 'completo');
  console.log(`episódios de hoje: ${eps.length}`);

  // D. TODA especialidade com edição do dia precisa ter PODCAST (o erro mais
  // grave — incidente 24/07: generate-podcasts cancelado no meio deixou uma
  // especialidade sem áudio). Sem episódio individual da especialidade → reprova.
  const slugDe = (e) => e.slug || specialtySlug(e.especialidade || '');
  for (const d of digests) {
    const esp = d.especialidade || String(d.id || '').replace('_' + HOJE, '');
    const slug = specialtySlug(esp);
    const n = eps.filter(e => slugDe(e) === slug).length;
    if (n === 0) {
      falhas.push(`[${esp}] edição do dia SEM PODCAST — 0 episódios gerados (ERRO GRAVE: dentista sem áudio)`);
    }

    // F. DOC PONTEIRO (incidente 07/08): o SITE lê podcasts/{slug} via
    // get-edicao — auditar só o histórico (podcast_episodios) deixava o
    // caminho do usuário sem cobertura. Confere: doc de HOJE, todo episódio
    // com URL persistida SERVINDO, e artigoIds casando com a edição (o front
    // só mostra o player quando o id bate com um artigo do digest).
    const ponteiro = await db.getDoc('podcasts', slug).catch(() => null);
    if (!ponteiro || ponteiro.date !== HOJE) {
      falhas.push(`[${esp}] doc podcasts/${slug} ${ponteiro ? `é de ${ponteiro.date}` : 'NÃO EXISTE'} — site sem áudio de hoje`);
    } else {
      const pEps = Array.isArray(ponteiro.episodios) ? ponteiro.episodios : [];
      const idsEdicao = new Set((d.artigos || []).map(a => String(a.pmid || a.id || '')));
      for (const e of pEps) {
        if (!e.url) { falhas.push(`[${esp}] ponteiro ep${e.n} SEM URL persistida — leitor cai na remontagem por env`); continue; }
        const vu = await verifyUrl(e.url);
        if (!vu.ok) falhas.push(`[${esp}] ponteiro ep${e.n}: URL persistida NÃO serve (HTTP ${vu.status}) — dentista sem áudio AGORA`);
        if (!idsEdicao.has(String(e.artigoId || ''))) {
          falhas.push(`[${esp}] ponteiro ep${e.n} aponta artigo ${e.artigoId} que NÃO está na edição — front não mostra o player`);
        }
      }
    }
  }
  for (const e of eps) {
    const secs = Number(e.secs) || 0;
    if (secs < 40) falhas.push(`[episódio ${e.id}] áudio curto demais (${secs}s) — casca vazia?`);
    // G. TRUNCAMENTO DA VOZ (incidente 08/08 — "cortado no meio, ~2:10"): a
    // duração precisa condizer com o roteiro narrado (~17 chars/s em pt-BR).
    // Áudio < 80% do esperado = a voz parou antes do fim do texto.
    const charsRoteiro = billableChars(String(e.roteiro || ''));
    if (secs > 0 && charsRoteiro > 400 && secs < (charsRoteiro / 17) * 0.8) {
      falhas.push(`[episódio ${e.id}] áudio TRUNCADO pela voz (${secs}s narrados vs ~${Math.round(charsRoteiro / 17)}s de roteiro) — dentista ouve corte no meio`);
    }
    // E. URL PERSISTIDA (incidente 05/08 — player 0:00): todo episódio do dia
    // precisa ter a URL de download gravada no doc E servindo o 1º byte. É a
    // MESMA string que os leitores entregam ao navegador — se falhar aqui, o
    // dentista está sem áudio agora, não importa o que o job de podcasts disse.
    if (!e.url) {
      falhas.push(`[episódio ${e.id}] SEM URL persistida — leitores caem na remontagem por env (causa dos players 0:00)`);
    } else {
      const vu = await verifyUrl(e.url);
      if (!vu.ok) falhas.push(`[episódio ${e.id}] URL persistida NÃO serve o áudio (HTTP ${vu.status}) — dentista sem áudio AGORA`);
    }
    if (!String(e.roteiro || '').trim()) { falhas.push(`[episódio ${e.id}] SEM roteiro gravado`); continue; }

    // C. Veredito: só roteiros que falam de comparação/diferença.
    if (anthropicKey && /(diferen|compar|versus|\bvs\b|superior|inferior)/i.test(e.roteiro)) {
      await pausa(1200); // respeita o limite por minuto do modelo
      const veredito = await haiku(anthropicKey,
        'Você audita roteiros de podcast científico odontológico. Responda APENAS JSON: {"ok": true|false, "problemas": ["..."]}. ' +
        'ok=false SOMENTE se o roteiro afirmar que houve diferença/comparação entre grupos, técnicas ou materiais e NÃO disser qual lado foi MELHOR ou PIOR naquele desfecho. ' +
        'Se o roteiro nomear o vencedor de cada diferença citada (ou disser explicitamente que a fonte não indica a direção), ok=true.',
        `ROTEIRO:\n${String(e.roteiro).slice(0, 4000)}`);
      if (veredito && veredito.ok === false) {
        falhas.push(`[episódio ${e.id}] VEREDITO AUSENTE: ${(veredito.problemas || []).join('; ').slice(0, 300)}`);
      } else if (!veredito) {
        console.log(`  (aviso: checagem de veredito indisponível p/ ${e.id})`);
      }
    }
  }

  // Relatório.
  logCusto('auditoria');
  if (falhas.length) {
    console.log(`\n✗ AUDITORIA REPROVOU — ${falhas.length} problema(s):`);
    falhas.forEach(f => console.log('  -', f));
    process.exit(1);
  }
  console.log('\n✓ AUDITORIA APROVADA — edição do dia sem problemas detectados.');
})().catch(e => { console.error('ERRO_AUDITORIA', e.message); process.exit(1); });
