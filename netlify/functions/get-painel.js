// GET /.netlify/functions/get-painel?secret=ADMIN_SECRET[&dia=YYYY-MM-DD]
//
// Painel de administração (admin) — compila num só lugar tudo que o fundador
// precisa para manter o OdontoFeed rodando pleno em um dia:
//   • edições do dia de TODAS as especialidades (os 3 estudos de cada, com
//     nível de evidência e se o áudio já existe);
//   • saúde do pipeline do dia (digests prontos, episódios gerados, quais 2
//     especialidades subiram compiladas ao Spotify, carrossel e reel do IG);
//   • crescimento de cadastros (total, novos de hoje, ativos, Premium, por
//     especialidade);
//   • uso do orçamento de TTS do mês.
// Não devolve nomes/e-mails aqui (isso fica no get-dentistas, também admin).

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { firebaseDownloadUrl } = require('./_lib/storage');
const { specialtySlug } = require('./_lib/slug');
const log = require('./_lib/logger');

const TTS_BUDGET = parseInt(process.env.TTS_MONTHLY_BUDGET_CHARS || '', 10) || 3_600_000;

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');
  const db = new Firestore(projectId, apiKey);

  const now = new Date();
  const hoje = (event.queryStringParameters && event.queryStringParameters.dia) || now.toISOString().slice(0, 10);
  const month = hoje.slice(0, 7);

  try {
    // ── Edições do dia (todas as especialidades) ──
    const digests = (await db.query('digests_especialidade', { limit: 100 }).catch(() => []))
      .filter(d => String(d.id || '').endsWith('_' + hoje));

    // ── Episódios do dia: áudio por artigo + quais especialidades compilaram ──
    const eps = (await db.query('podcast_episodios', { limit: 300 }).catch(() => []))
      .filter(e => e.date === hoje);
    const audioPorArtigo = new Map();
    const compiladas = new Set(); // especialidades que subiram a edição completa (Spotify)
    let episodiosDia = 0;
    for (const e of eps) {
      if (e.tipo === 'completo') { if (e.especialidade) compiladas.add(e.especialidade); continue; }
      episodiosDia++;
      const k = String(e.artigoId || '');
      if (k && e.objectPath && e.downloadToken) {
        audioPorArtigo.set(k, { url: firebaseDownloadUrl(bucket, e.objectPath, e.downloadToken), secs: Number(e.secs) || 0 });
      }
    }

    // ── Instagram do dia (doc id = data) ──
    const [post, reel] = await Promise.all([
      db.getDoc('instagram_posts', hoje).catch(() => null),
      db.getDoc('instagram_reels', hoje).catch(() => null),
    ]);

    const edicoes = digests.map(d => {
      const esp = d.especialidade || d.id.replace('_' + hoje, '');
      const artigos = (Array.isArray(d.artigos) ? d.artigos : []).map(a => {
        const pmid = String(a.pmid || a.id || '');
        const au = audioPorArtigo.get(pmid);
        const tituloOk = String(a.titulo_pt || '').trim().length >= 10;
        const resumoOk = String(a.resumo_pt || '').trim().length >= 120;
        return {
          pmid,
          titulo: a.titulo_pt || a.titulo || '(sem título)',
          nivel: a.nivel_evidencia || '',
          journal: a.journal || '',
          temAudio: !!au,
          secs: au ? au.secs : 0,
          audioUrl: au ? au.url : null,
          enriquecido: tituloOk && resumoOk, // sinal de saúde (o card está pronto?)
        };
      });
      return {
        especialidade: esp,
        slug: specialtySlug(esp),
        status: d.status || '',
        noSpotify: compiladas.has(esp),
        artigos,
      };
    }).sort((a, b) => a.especialidade.localeCompare(b.especialidade, 'pt-BR'));

    // ── Cadastros (crescimento) ──
    let total = 0, ativos = 0, hojeNovos = 0, premium = 0, comIndicacao = 0, pageToken = null;
    const porEsp = {};
    do {
      const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
      for (const u of docs) {
        if (!u.email) continue;
        total++;
        if (u.ativo !== false && !u.bounced && u.emailFrequencia !== 'nunca') ativos++;
        if (String(u.criadoEm || '').slice(0, 10) === hoje) hojeNovos++;
        if (u.plano === 'premium') premium++;
        if (u.referredBy) comIndicacao++;
        const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
        specs.forEach(s => { if (s) porEsp[s] = (porEsp[s] || 0) + 1; });
      }
      pageToken = nextPageToken;
    } while (pageToken);

    // ── TTS do mês (orçamento) ──
    const tts = await db.getDoc('tts_usage', month).catch(() => null);
    const ttsChars = Number(tts?.chars) || 0;

    const payload = {
      dia: hoje,
      geradoEm: now.toISOString(),
      edicoes,
      pipeline: {
        edicoesProntas: edicoes.length,
        episodiosDia,
        spotifyCompiladas: [...compiladas].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        instagramCarrossel: !!post,
        instagramReel: !!reel,
      },
      dentistas: { total, ativos, hoje: hojeNovos, premium, comIndicacao, porEspecialidade: porEsp },
      tts: { chars: ttsChars, budget: TTS_BUDGET, pct: TTS_BUDGET ? Math.round((ttsChars / TTS_BUDGET) * 100) : 0 },
    };

    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  } catch (err) {
    log.error('[painel] erro', { error: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
