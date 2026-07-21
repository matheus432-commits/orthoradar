// GET /.netlify/functions/get-custos?secret=ADMIN_SECRET
//
// Dashboard de custos (admin): agrega os CONTADORES REAIS do mês —
// tts_usage (caracteres narrados), digest_runs (e-mails enviados),
// instagram_posts/instagram_reels (publicações), reel_cenas (cache de
// ilustrações) e cadastros (usuários ativos) — e devolve o custo estimado
// via _lib/custos. Consumido pela página /custos.html.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { buildCustos } = require('./_lib/custos');
const log = require('./_lib/logger');

const TTS_BUDGET = parseInt(process.env.TTS_MONTHLY_BUDGET_CHARS || '', 10) || 3_600_000;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };

  const now = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const diaAtual = now.getUTCDate();
  const diasNoMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  try {
    const db = new Firestore(projectId, apiKey);

    // TTS: 1 doc por mês com { chars, byDay } (mantido por tts-budget).
    const tts = await db.getDoc('tts_usage', month).catch(() => null);

    // E-mails: soma dos `sent` dos digest_runs do mês (1 registro por execução).
    let emailsSent = 0;
    const runs = await db.query('digest_runs', { limit: 200 }).catch(() => []);
    for (const r of runs) {
      if (String(r.dateStr || '').startsWith(month)) emailsSent += Number(r.sent) || 0;
    }

    // Instagram: publicações do mês (id = data) e cache de cenas dos Reels.
    const [posts, reels, cenas] = await Promise.all([
      db.query('instagram_posts', { limit: 100 }).catch(() => []),
      db.query('instagram_reels', { limit: 100 }).catch(() => []),
      db.query('reel_cenas', { limit: 500 }).catch(() => []),
    ]);
    const doMes = (arr) => arr.filter(d => String(d.id || d.criadoEm || '').includes(month)).length;
    const imagensNovasMes = cenas.filter(c => String(c.criadoEm || '').startsWith(month)).length;

    // Cadastros: ativos (critério do digest) + total, novos de hoje e por
    // especialidade — para o fundador acompanhar o crescimento aqui no painel.
    const hojeISO = now.toISOString().slice(0, 10);
    let usuarios = 0, dentistasTotal = 0, dentistasHoje = 0, comIndicacao = 0, pageToken = null;
    const porEsp = {};
    do {
      const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
      for (const u of docs) {
        if (!u.email) continue;
        dentistasTotal++;
        if (u.ativo !== false && !u.bounced && u.emailFrequencia !== 'nunca') usuarios++;
        if (String(u.criadoEm || '').slice(0, 10) === hojeISO) dentistasHoje++;
        if (u.referredBy) comIndicacao++;
        const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
        specs.forEach(s => { if (s) porEsp[s] = (porEsp[s] || 0) + 1; });
      }
      pageToken = nextPageToken;
    } while (pageToken);

    const payload = buildCustos({
      month,
      ttsChars: Number(tts?.chars) || 0,
      ttsBudgetChars: TTS_BUDGET,
      emailsSent,
      igPosts: doMes(posts),
      igReels: doMes(reels),
      imagensNovasMes,
      cacheCenas: cenas.length,
      usuariosAtivos: usuarios,
      diasNoMes, diaAtual,
    });

    // Acompanhamento de cadastros (crescimento) — anexado ao payload de custos.
    payload.dentistas = {
      total: dentistasTotal,
      ativos: usuarios,
      hoje: dentistasHoje,
      comIndicacao,
      porEspecialidade: porEsp,
    };

    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (err) {
    log.error('[custos] erro', { error: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
