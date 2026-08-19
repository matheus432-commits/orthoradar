// PAINEL DE USO POR DENTISTA — exclusivo do admin (mesmo segredo do painel).
//
// GET ?secret=ADMIN_SECRET[&desde=2026-07-20]
//   → agrega o digest_metrics desde a data (padrão 20/07/26 — pedido do
//     fundador 15/08) e devolve:
//     • dias:      [{ d, open, click, resumo, audio, outros, ativos }]
//     • dentistas: [{ nome, email, especialidade, total, open, click, resumo,
//                     audio, outros, diasAtivos, ultimo }]       (por dentista)
//     ('audio' = plays no site via track-audio — pedido do fundador 15/08)
//     • naoAtribuidos: eventos sem dentista identificável
//
// Atribuição: 'open'/'click' do E-MAIL chegam sem email (só digestId) — o
// mapa digests/{digestId}→email resolve; eventos do SITE (context_opened,
// briefing_opened…) já trazem o email. PRIVACIDADE: nome/e-mail só saem por
// aqui, atrás do ADMIN_SECRET — nunca em log de Actions (repositório público).

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const log = require('./_lib/logger');

const DESDE_PADRAO = '2026-07-20';
const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'nao_autorizado' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  const qs = event.queryStringParameters || {};
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(qs.desde || '')) ? qs.desde : DESDE_PADRAO;

  try {
    // 1. Eventos desde a data (range de campo único — sem índice composto).
    const eventos = await db.query('digest_metrics', {
      where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: desde } } },
      select: sel('email', 'eventType', 'ts', 'digestId'),
      limit: 50000,
    });

    // 2. Mapa digestId→email (aberturas/cliques de e-mail não trazem email).
    //    Margem de 7 dias antes do período: evento de hoje pode referenciar
    //    digest enviado dias atrás.
    const margem = new Date(new Date(desde + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
    const digests = await db.query('digests', {
      where: { fieldFilter: { field: { fieldPath: 'enviadoEm' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: margem } } },
      select: sel('email'),
      limit: 20000,
    });
    const emailDoDigest = new Map();
    for (const d of digests) if (d.id && d.email) emailDoDigest.set(String(d.id), String(d.email).toLowerCase());

    // 3. Cadastros (nome + especialidade por e-mail).
    const cadastros = new Map();
    let pageToken = null;
    do {
      const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
      for (const u of docs) if (u.email) cadastros.set(String(u.email).toLowerCase(), u);
      pageToken = nextPageToken;
    } while (pageToken);

    // 4. Agregação.
    const tipoDe = (t) => (t === 'open' ? 'open' : t === 'click' ? 'click' : t === 'context_opened' ? 'resumo' : t === 'audio_play' ? 'audio' : 'outros');
    const porDia = new Map();      // d → {open, click, resumo, outros, ativos:Set}
    const porDentista = new Map(); // email → acumuladores
    let naoAtribuidos = 0;

    for (const ev of eventos) {
      const d = String(ev.ts || '').slice(0, 10);
      if (!d || d < desde) continue;
      const tipo = tipoDe(String(ev.eventType || ''));
      const email = String(ev.email || emailDoDigest.get(String(ev.digestId || '')) || '').toLowerCase();

      const dia = porDia.get(d) || { open: 0, click: 0, resumo: 0, audio: 0, outros: 0, ativos: new Set() };
      dia[tipo]++;
      if (email) dia.ativos.add(email);
      porDia.set(d, dia);

      if (!email) { naoAtribuidos++; continue; }
      const den = porDentista.get(email) || { total: 0, open: 0, click: 0, resumo: 0, audio: 0, outros: 0, dias: new Set(), ultimo: '' };
      den.total++;
      den[tipo]++;
      den.dias.add(d);
      if (String(ev.ts) > den.ultimo) den.ultimo = String(ev.ts);
      porDentista.set(email, den);
    }

    const dias = [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ d, open: v.open, click: v.click, resumo: v.resumo, audio: v.audio, outros: v.outros, ativos: v.ativos.size }));

    const dentistas = [...porDentista.entries()]
      .map(([email, v]) => {
        const cad = cadastros.get(email) || {};
        return {
          nome: cad.nome || '(sem cadastro)',
          email,
          especialidade: Array.isArray(cad.especialidade) ? (cad.especialidade[0] || '') : (cad.especialidade || ''),
          total: v.total, open: v.open, click: v.click, resumo: v.resumo, audio: v.audio, outros: v.outros,
          diasAtivos: v.dias.size,
          ultimo: v.ultimo.slice(0, 10),
        };
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'));

    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'private, no-store' },
      body: JSON.stringify({
        desde,
        geradoEm: new Date().toISOString(),
        totalEventos: eventos.length,
        naoAtribuidos,
        cadastrosTotal: cadastros.size,
        dias,
        dentistas,
      }),
    };
  } catch (err) {
    log.error('[get-uso] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
