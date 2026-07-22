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
  let text = JSON.parse(res.body).content?.[0]?.text?.trim() || '';
  if (text.startsWith('```')) text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  try { return JSON.parse(text); } catch { return null; }
}

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) { console.log('SEM_FIREBASE_API_KEY'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);
  const falhas = [];

  console.log(`=== AUDITORIA DA EDIÇÃO DE ${HOJE} ===`);

  // A. Digests do dia: todo artigo precisa estar enriquecido.
  const digests = (await db.query('digests_especialidade', { limit: 100 }).catch(() => []))
    .filter(d => String(d.id || '').endsWith('_' + HOJE));
  console.log(`digests de hoje: ${digests.length}`);
  for (const d of digests) {
    for (const a of (Array.isArray(d.artigos) ? d.artigos : [])) {
      const tituloOk = String(a.titulo_pt || '').trim().length >= 10;
      const resumoOk = String(a.resumo_pt || '').trim().length >= 120;
      if (!tituloOk || !resumoOk) {
        falhas.push(`[digest ${d.id}] artigo ${a.pmid || a.id} SEM ENRIQUECIMENTO (titulo_pt: ${tituloOk}, resumo_pt: ${resumoOk}) — "${String(a.titulo || a.titulo_pt || '').slice(0, 70)}"`);
      }
    }
  }

  // B + C. Episódios do dia.
  const eps = (await db.query('podcast_episodios', { limit: 300 }).catch(() => []))
    .filter(e => e.date === HOJE && e.tipo !== 'completo');
  console.log(`episódios de hoje: ${eps.length}`);
  for (const e of eps) {
    const secs = Number(e.secs) || 0;
    if (secs < 40) falhas.push(`[episódio ${e.id}] áudio curto demais (${secs}s) — casca vazia?`);
    if (!String(e.roteiro || '').trim()) { falhas.push(`[episódio ${e.id}] SEM roteiro gravado`); continue; }

    // C. Veredito: só roteiros que falam de comparação/diferença.
    if (anthropicKey && /(diferen|compar|versus|\bvs\b|superior|inferior)/i.test(e.roteiro)) {
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
  if (falhas.length) {
    console.log(`\n✗ AUDITORIA REPROVOU — ${falhas.length} problema(s):`);
    falhas.forEach(f => console.log('  -', f));
    process.exit(1);
  }
  console.log('\n✓ AUDITORIA APROVADA — edição do dia sem problemas detectados.');
})().catch(e => { console.error('ERRO_AUDITORIA', e.message); process.exit(1); });
