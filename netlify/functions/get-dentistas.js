// GET /.netlify/functions/get-dentistas?secret=ADMIN_SECRET
//
// Lista COMPLETA de dentistas cadastrados (admin) — nome, e-mail, plano e data
// de cadastro — agrupada por especialidade. Contém DADOS PESSOAIS (LGPD): é
// estritamente administrativa, protegida pelo ADMIN_SECRET e nunca cacheada.
// Consumida pela página /admin-dentistas.html.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const lista = [];
    let pageToken = null;
    do {
      const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
      for (const u of docs) {
        if (!u.email) continue;
        const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
        lista.push({
          nome: u.nome || '(sem nome)',
          email: u.email,
          especialidade: specs[0] || '—',
          plano: u.plano || 'gratuito',
          planoOrigem: u.planoOrigem || '',
          criadoEm: u.criadoEm || '',
          ativo: u.ativo !== false && !u.bounced && u.emailFrequencia !== 'nunca',
          bounced: !!u.bounced,
          indicacoes: Number(u.indicacoes) || 0,
          porIndicacao: !!u.referredBy,
        });
      }
      pageToken = nextPageToken;
    } while (pageToken);

    // Agrupa por especialidade; dentro de cada grupo, mais recentes primeiro.
    const grupos = {};
    for (const d of lista) (grupos[d.especialidade] = grupos[d.especialidade] || []).push(d);
    const porEspecialidade = Object.keys(grupos)
      .sort((a, b) => grupos[b].length - grupos[a].length || a.localeCompare(b, 'pt-BR'))
      .map(esp => ({
        especialidade: esp,
        total: grupos[esp].length,
        dentistas: grupos[esp].sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))),
      }));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        total: lista.length,
        geradoEm: new Date().toISOString(),
        porEspecialidade,
      }),
    };
  } catch (err) {
    log.error('[dentistas] erro', { error: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
