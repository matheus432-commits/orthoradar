// OdontoFeed "O Que Ficou" — weekly top-articles recap email.
//
// Run: node netlify/functions/weekly-digest.js
// Schedule: GitHub Actions weekly-digest.yml at "0 11 * * 6" (Saturday 11h UTC = 8h BRT).
//   Roda via Actions — não como Netlify scheduled function — porque o envio
//   percorre todos os usuários e não cabe no timeout de ~26s do Netlify.
//   O conteúdo (top 3 da comunidade + editorial) já é gerado UMA vez e
//   compartilhado por todos; por usuário há apenas render, envio e log.
//
// Reliability:
//   - Per-user idempotency via `weekly_digest_logs` (skip if already sent this week)
//   - Skips early if < 3 articles have weekly click data
//   - Editorial frase falls back to a deterministic string on Claude API failure

const crypto        = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { request }   = require('./_lib');
const { getWeekId } = require('./_lib/engagement');
const { resolveModel } = require('./_lib/ai-config');
const log           = require('./_lib/logger');

const BASE_URL      = process.env.SITE_URL || 'https://odontofeed.com.br';
const RESEND_RETRIES = 3;
const MIN_ARTICLES   = 3;
const TOP_N          = 20; // candidates loaded from Firestore

// ── Helpers ───────────────────────────────────────────────────────────────────

function emailHash(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getWeekDateRange(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - dayNum + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const d1 = monday.getUTCDate();
  const d2 = sunday.getUTCDate();
  const m1 = MONTHS[monday.getUTCMonth()];
  const m2 = MONTHS[sunday.getUTCMonth()];
  const yr = sunday.getUTCFullYear();

  return monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${d1}&ndash;${d2} ${m1} ${yr}`
    : `${d1} ${m1} &ndash; ${d2} ${m2} ${yr}`;
}

function buildWeeklyUnsubToken(email) {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error('UNSUBSCRIBE_SECRET nao configurado');
  return crypto.createHmac('sha256', secret).update('weekly:' + email).digest('hex');
}

// ── Data access ───────────────────────────────────────────────────────────────

async function getActiveUsers(db) {
  const users = [];
  let pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users.push(...docs);
    pageToken = nextPageToken;
  } while (pageToken);

  return users.filter(u =>
    u.email &&
    u.ativo !== false &&
    !u.bounced &&
    u.emailFrequencia !== 'nunca' &&
    !u.weeklyDigestOptOut
  ).map(u => ({
    ...u,
    especialidade: Array.isArray(u.especialidade)
      ? (u.especialidade.filter(Boolean)[0] || '')
      : (u.especialidade || ''),
    nome: Array.isArray(u.nome) ? (u.nome[0] || '') : (u.nome || ''),
  }));
}

// Returns top articles for the current ISO week, enriched with artigos details.
// Requires a Firestore composite index on article_week_clicks (weekId ASC, count DESC).
// Falls back to in-memory sort if the index is not ready.
async function getWeeklyTopArticles(db, weekId) {
  let clicks;
  const where = {
    fieldFilter: {
      field: { fieldPath: 'weekId' },
      op:    'EQUAL',
      value: { stringValue: weekId },
    },
  };

  try {
    clicks = await db.query('article_week_clicks', {
      where,
      orderBy: [{ field: { fieldPath: 'count' }, direction: 'DESCENDING' }],
      limit:   TOP_N,
    });
  } catch {
    try {
      clicks = await db.query('article_week_clicks', { where, limit: TOP_N });
      clicks.sort((a, b) => (b.count || 0) - (a.count || 0));
    } catch (err) {
      log.warn('[weekly] article_week_clicks query failed', { weekId, err: err.message });
      return [];
    }
  }

  if (!clicks.length) return [];

  // Parallel join with artigos for article details
  const enriched = await Promise.all(
    clicks.map(async c => {
      if (!c.pmid) return null;
      try {
        const art = await db.getDoc('artigos', c.pmid);
        if (!art) return null;
        return { ...art, weeklyClicks: Number(c.count) || 0 };
      } catch { return null; }
    })
  );

  return enriched
    .filter(Boolean)
    .sort((a, b) => b.weeklyClicks - a.weeklyClicks);
}

// ── Claude API: editorial frase ───────────────────────────────────────────────

function defaultWeeklyEditorial(topArticles) {
  const especialidades = [...new Set(
    topArticles.slice(0, 3).map(a => a.especialidade).filter(Boolean)
  )];
  if (!especialidades.length) {
    return 'Esta semana a comunidade odontológica explorou os principais estudos da literatura, com atenção redobrada aos temas de maior impacto clínico.';
  }
  if (especialidades.length === 1) {
    return `Esta semana a comunidade concentrou atenção em ${especialidades[0]}, com destaque para os artigos de maior relevância clínica e evidência científica.`;
  }
  return `Esta semana os interesses da comunidade distribuíram-se entre ${especialidades.join(' e ')}, refletindo a diversidade e o dinamismo da prática odontológica atual.`;
}

async function generateWeeklyEditorial(topArticles) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || topArticles.length < 1) return null;

  const MODEL = resolveModel('EDITORIAL_MODEL');

  const articleList = topArticles.slice(0, 3).map((art, i) => {
    const title = (art.titulo_pt || art.titulo || '').slice(0, 120);
    const esp   = art.especialidade || 'Odontologia';
    return `${i + 1}. ${title} (${esp}, ${art.weeklyClicks} leituras)`;
  }).join('\n');

  const payload = JSON.stringify({
    model:      MODEL,
    max_tokens: 200,
    system: 'Você é o editor científico do OdontoFeed. Escreva 2–3 linhas editoriais em português, tom sofisticado e conciso, que contextualizem o padrão de leitura desta semana com base nos artigos mais acessados pela comunidade. Sem listas, sem numeração. Apenas o texto editorial em um único parágrafo.',
    messages: [{
      role:    'user',
      content: `Os artigos mais lidos pelos dentistas esta semana foram:\n${articleList}\n\nEscreva a nota editorial de encerramento.`,
    }],
  });
  const buf = Buffer.from(payload, 'utf8');

  try {
    const res = await request({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers:  {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
        'content-length':    buf.length,
      },
    }, buf);

    if (res.status !== 200) {
      log.warn('[weekly] editorial API error', { status: res.status });
      return null;
    }
    const json = JSON.parse(res.body);
    return (json.content?.[0]?.text || '').trim() || null;
  } catch (err) {
    log.warn('[weekly] generateWeeklyEditorial failed', { err: err.message });
    return null;
  }
}

// ── HTML template ─────────────────────────────────────────────────────────────

const RANK_COLORS = ['#B08968', '#7A7570', '#B5B0A8'];
const RANK_LABELS = ['#1 Mais lido', '#2', '#3'];
const FONT_SANS   = `-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif`;
const FONT_SERIF  = `Georgia,'Times New Roman',serif`;

function buildClickUrl(digestId, pmid, ehash, tema) {
  const target = Buffer.from(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`).toString('base64url');
  const th     = tema ? Buffer.from(String(tema)).toString('base64url') : '';
  return `${BASE_URL}/.netlify/functions/track-click?d=${encodeURIComponent(digestId)}&p=${encodeURIComponent(pmid)}&e=${ehash}&t=${target}${th ? '&th=' + th : ''}`;
}

function buildTopArticleCard(art, rank, digestId, ehash, isLast) {
  const title    = esc((art.titulo_pt || art.titulo || '').slice(0, 160));
  const summary  = esc((art.impacto_pratico || art.resumo || '').slice(0, 240));
  const esp      = esc(art.especialidade || '');
  const nivel    = esc(art.nivel_evidencia || '');
  const clicks   = Number(art.weeklyClicks) || 0;
  const clickUrl = buildClickUrl(digestId, art.pmid || art.id, ehash, art.tema);
  const rankColor = RANK_COLORS[rank - 1] || '#B5B0A8';
  const rankLabel = RANK_LABELS[rank - 1] || `#${rank}`;
  const border    = isLast ? '' : 'border-bottom:1px solid #EEE8DE;';

  return `
  <div style="margin-bottom:20px;padding-bottom:20px;${border}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="background:${rankColor};color:#FFFFFF;font-size:9.5px;font-weight:700;
                       letter-spacing:0.8px;text-transform:uppercase;padding:3px 10px;
                       border-radius:2px;display:inline-block;font-family:${FONT_SANS};">
            ${rankLabel}
          </span>
        </td>
        <td align="right">
          <span style="font-size:11.5px;color:#9E988E;font-family:${FONT_SANS};">
            &#x2197;&nbsp;${clicks}&nbsp;leitura${clicks !== 1 ? 's' : ''} esta semana
          </span>
        </td>
      </tr>
    </table>
    <h3 style="margin:10px 0 8px;font-size:15px;font-weight:700;color:#1A1A18;
               line-height:1.4;font-family:${FONT_SERIF};">
      ${title}
    </h3>
    ${summary ? `<p style="margin:0 0 10px;font-size:13px;color:#6B665E;line-height:1.65;
                            font-family:${FONT_SANS};">${summary}</p>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      ${esp   ? `<td style="padding-right:12px;"><span style="font-size:11px;color:#9E988E;font-family:${FONT_SANS};">${esp}</span></td>` : ''}
      ${nivel ? `<td><span style="background:#E8F0E7;color:#3A6A38;border:1px solid #AECAAC;font-size:10px;font-weight:600;padding:2px 9px;border-radius:100px;font-family:${FONT_SANS};">${nivel}</span></td>` : ''}
    </tr></table>
    <div style="margin-top:12px;">
      <a href="${clickUrl}"
         style="background:#B08968;color:#FFFFFF;font-size:12px;font-weight:600;
                text-decoration:none;padding:7px 18px;border-radius:2px;
                display:inline-block;font-family:${FONT_SANS};">
        Ler artigo
      </a>
    </div>
  </div>`;
}

function buildSpecialtyCard(art, digestId, ehash) {
  const title    = esc((art.titulo_pt || art.titulo || '').slice(0, 160));
  const summary  = esc((art.impacto_pratico || art.resumo || '').slice(0, 240));
  const nivel    = esc(art.nivel_evidencia || '');
  const clicks   = Number(art.weeklyClicks) || 0;
  const clickUrl = buildClickUrl(digestId, art.pmid || art.id, ehash, art.tema);

  return `
    <div style="background:#F8F3EA;border:1px solid #D4C9B8;border-radius:3px;padding:18px 20px;">
      <h3 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1A1A18;
                 line-height:1.4;font-family:${FONT_SERIF};">
        ${title}
      </h3>
      ${summary ? `<p style="margin:0 0 10px;font-size:12.5px;color:#6B665E;line-height:1.6;
                              font-family:${FONT_SANS};">${summary}</p>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        ${nivel  ? `<td style="padding-right:10px;"><span style="background:#E8F0E7;color:#3A6A38;border:1px solid #AECAAC;font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:100px;font-family:${FONT_SANS};">${nivel}</span></td>` : ''}
        ${clicks ? `<td><span style="font-size:11px;color:#9E988E;font-family:${FONT_SANS};">&#x2197;&nbsp;${clicks}&nbsp;leitura${clicks !== 1 ? 's' : ''}</span></td>` : ''}
      </tr></table>
      <div style="margin-top:12px;">
        <a href="${clickUrl}"
           style="background:#1A1A18;color:#FDFAF5;font-size:12px;font-weight:600;
                  text-decoration:none;padding:7px 16px;border-radius:2px;
                  display:inline-block;font-family:${FONT_SANS};">
          Ler artigo
        </a>
      </div>
    </div>`;
}

function buildWeeklyEmail({ nome, email, especialidade }, top3, specialtyArt, editorial, weekDateRange, digestId) {
  const ehash          = emailHash(email);
  const firstName      = esc(String(nome || '').split(' ')[0] || 'Dentista');
  const espLabel       = esc(especialidade || '');
  const weeklyUnsubUrl = `${BASE_URL}/.netlify/functions/weekly-unsubscribe?email=${encodeURIComponent(email)}&token=${buildWeeklyUnsubToken(email)}`;
  const mainUnsubUrl   = `${BASE_URL}/.netlify/functions/unsubscribe?email=${encodeURIComponent(email)}`;
  const openPixelUrl   = `${BASE_URL}/.netlify/functions/track-open?d=${encodeURIComponent(digestId)}&e=${ehash}`;

  const top3Html = top3.map((art, i) =>
    buildTopArticleCard(art, i + 1, digestId, ehash, i === top3.length - 1)
  ).join('');

  const specialtyHtml = specialtyArt ? `
    <!-- SPECIALTY -->
    <tr><td style="padding:0 36px 24px;border-top:1px solid #E8E0D0;">
      <p style="margin:0 0 12px;padding-top:24px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                text-transform:uppercase;color:#B08968;font-family:${FONT_SANS};">
        Na Sua Especialidade${espLabel ? ` &mdash; ${espLabel}` : ''}
      </p>
      ${buildSpecialtyCard(specialtyArt, digestId, ehash)}
    </td></tr>` : '';

  const editorialHtml = editorial ? `
    <!-- EDITORIAL CLOSE -->
    <tr><td style="padding:0 36px 24px;">
      <div style="background:#F8F3EA;border-left:3px solid #B08968;
                  padding:16px 20px;border-radius:0 2px 2px 0;">
        <p style="margin:0;font-size:13px;color:#6B665E;line-height:1.75;
                  font-style:italic;font-family:${FONT_SERIF};">
          ${esc(editorial)}
        </p>
      </div>
    </td></tr>` : '';

  const subject = `📋 O que a odontologia leu essa semana — OdontoFeed`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>O que a odontologia leu essa semana &mdash; OdontoFeed</title>
</head>
<body style="margin:0;padding:0;background:#EDE8DF;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#EDE8DF;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px 48px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:#FDFAF5;border:1px solid #E0D8CC;border-radius:4px;">

    <!-- HEADER -->
    <tr><td style="background:#1A1A18;padding:28px 36px;border-radius:4px 4px 0 0;">
      <div style="font-size:20px;font-weight:700;letter-spacing:-0.3px;
                  font-family:${FONT_SERIF};color:#FDFAF5;">
        OdontoFeed<span style="color:#B08968;">.</span>
      </div>
      <div style="margin-top:10px;">
        <span style="background:#B08968;color:#FFFFFF;font-size:9px;font-weight:700;
                     letter-spacing:1.4px;text-transform:uppercase;
                     padding:3px 10px;border-radius:2px;font-family:${FONT_SANS};">
          Edi&ccedil;&atilde;o Semanal
        </span>
        <span style="color:#9E988E;font-size:11px;margin-left:10px;font-family:${FONT_SANS};">
          ${weekDateRange}
        </span>
      </div>
    </td></tr>

    <!-- INTRO -->
    <tr><td style="padding:22px 36px;background:#F8F3EA;border-bottom:1px solid #E8E0D0;">
      <p style="margin:0 0 5px;font-size:13.5px;color:#1A1A18;font-weight:600;
                font-family:${FONT_SERIF};">
        Ol&aacute;, ${firstName}.
      </p>
      <p style="margin:0;font-size:13px;color:#6B665E;line-height:1.7;font-family:${FONT_SANS};">
        Estes foram os artigos mais explorados por dentistas brasileiros esta semana.
      </p>
    </td></tr>

    <!-- TOP 3 -->
    <tr><td style="padding:24px 36px 4px;">
      <p style="margin:0 0 18px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                text-transform:uppercase;color:#B08968;font-family:${FONT_SANS};">
        O Que a Comunidade Leu
      </p>
      ${top3Html}
    </td></tr>

    ${specialtyHtml}

    ${editorialHtml}

    <!-- FOOTER -->
    <tr><td style="padding:22px 36px;background:#F2EDE3;border-top:1px solid #E8E0D0;border-radius:0 0 4px 4px;">
      <div style="font-size:11.5px;color:#9E988E;line-height:1.9;font-family:${FONT_SANS};">
        Curadoria cient&iacute;fica para dentistas brasileiros &middot;
        <a href="${mainUnsubUrl}" style="color:#B08968;text-decoration:none;">Cancelar assinatura</a>
        &nbsp;&middot;&nbsp;
        <a href="${weeklyUnsubUrl}" style="color:#9E988E;text-decoration:none;">
          N&atilde;o quero receber o resumo semanal
        </a>
      </div>
      <div style="margin-top:10px;font-size:10px;color:#B5B0A8;line-height:1.7;font-family:${FONT_SANS};">
        As s&iacute;nteses s&atilde;o geradas por intelig&ecirc;ncia artificial com valida&ccedil;&atilde;o
        automatizada e n&atilde;o substituem a leitura dos estudos originais nem orienta&ccedil;&atilde;o
        cl&iacute;nica individualizada.
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
<img src="${openPixelUrl}" width="1" height="1" alt="" style="border:0;display:none;" />
</body>
</html>`;

  return { html, subject };
}

// ── Email sending ─────────────────────────────────────────────────────────────

async function sendEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({
    from:    'OdontoFeed <artigos@odontofeed.com>',
    to,
    subject,
    html,
    headers: {
      'List-Unsubscribe':      `<${BASE_URL}/.netlify/functions/unsubscribe?email=${encodeURIComponent(to)}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'X-Entity-Ref-ID':       to,
    },
  });
  return request({
    hostname: 'api.resend.com',
    path:     '/emails',
    method:   'POST',
    headers:  {
      Authorization:    'Bearer ' + resendKey,
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, payload);
}

async function sendEmailWithRetry(resendKey, to, subject, html) {
  for (let attempt = 0; attempt < RESEND_RETRIES; attempt++) {
    const res = await sendEmail(resendKey, to, subject, html);
    if (res.status === 200 || res.status === 201) return res;

    if (res.status === 429 && attempt < RESEND_RETRIES - 1) {
      const delay = 8000 * Math.pow(2, attempt);
      log.warn('[weekly] Resend rate limited, retrying', { to, attempt: attempt + 1, delay_ms: delay });
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return res;
  }
  return sendEmail(resendKey, to, subject, html);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runWeeklyDigest() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey)    { log.error('[weekly] FIREBASE_API_KEY not set'); return { error: 'no_firebase_key' }; }
  if (!resendKey) { log.error('[weekly] RESEND_API_KEY not set');   return { error: 'no_resend_key' }; }
  if (!process.env.UNSUBSCRIBE_SECRET) { log.error('[weekly] UNSUBSCRIBE_SECRET not set'); return { error: 'no_unsub_secret' }; }

  const db        = new Firestore(projectId, apiKey);
  const weekId    = getWeekId();
  const weekRange = getWeekDateRange();
  const runStart  = Date.now();

  log.info('[weekly] starting weekly digest', { weekId, weekRange });
  console.log(`\n[START WEEKLY] weekId=${weekId} ts=${new Date().toISOString()}`);

  // ── Top articles for this week ───────────────────────────────────────────────
  const topArticles = await getWeeklyTopArticles(db, weekId);
  log.info('[weekly] top articles loaded', { count: topArticles.length, weekId });

  if (topArticles.length < MIN_ARTICLES) {
    log.warn('[weekly] insufficient click data — skipping send', { count: topArticles.length, weekId });
    console.log(`[SKIP] Not enough click data this week (${topArticles.length}/${MIN_ARTICLES} needed).`);
    return { skipped: true, reason: 'insufficient_data', count: topArticles.length };
  }

  const top3 = topArticles.slice(0, 3);

  // ── Editorial frase (generated once, shared by all users) ───────────────────
  const editorial = (await generateWeeklyEditorial(top3)) || defaultWeeklyEditorial(top3);
  log.info('[weekly] editorial ready', { chars: editorial.length });

  // ── Load active users ───────────────────────────────────────────────────────
  let users;
  try {
    users = await getActiveUsers(db);
  } catch (err) {
    log.error('[weekly] getActiveUsers failed — aborting', { err: err.message });
    return { error: 'users_load_failed' };
  }
  log.info('[weekly] users to process', { count: users.length });
  console.log(`[USERS] ${users.length} eligible users`);

  let sent = 0, errors = 0, skipped = 0;
  const top3Pmids = new Set(top3.map(a => String(a.pmid || a.id)));

  for (const user of users) {
    const { email, nome, especialidade } = user;
    const ehash  = emailHash(email);
    const logKey = `${weekId}_${ehash}`;

    // ── Idempotency: skip if already sent this week ──────────────────────────
    try {
      const existing = await db.getDoc('weekly_digest_logs', logKey);
      if (existing?.status === 'sent') {
        log.info('[weekly] SKIP (idempotent)', { email, logKey });
        skipped++;
        continue;
      }
    } catch { /* proceed on read failure */ }

    // ── Specialty highlight: first article in user's specialty not in top 3 ──
    const specialtyArt = especialidade
      ? (topArticles.find(a => a.especialidade === especialidade && !top3Pmids.has(String(a.pmid || a.id))) || null)
      : null;

    // ── Build and send ───────────────────────────────────────────────────────
    const digestId = crypto.randomUUID();
    let html, subject;
    try {
      ({ html, subject } = buildWeeklyEmail(
        { nome, email, especialidade },
        top3, specialtyArt, editorial, weekRange, digestId
      ));
    } catch (err) {
      log.warn('[weekly] buildWeeklyEmail failed', { email, err: err.message });
      errors++;
      continue;
    }

    try {
      const res = await sendEmailWithRetry(resendKey, email, subject, html);
      if (res.status === 200 || res.status === 201) {
        sent++;
        console.log(`[SEND OK] ${email}`);
        log.info('[weekly] sent', { email, digestId });

        // Record sent for idempotency (best-effort)
        await db.setDoc('weekly_digest_logs', logKey, {
          email, weekId, digestId, status: 'sent', sentAt: new Date().toISOString(),
        }).catch(e => log.warn('[weekly] log write failed', { email, err: e.message }));
      } else {
        log.warn('[weekly] send failed', { email, status: res.status, body: res.body.slice(0, 200) });
        console.log(`[FAILED] ${email} — HTTP ${res.status}`);
        errors++;
      }
    } catch (err) {
      log.warn('[weekly] send error', { email, err: err.message });
      console.log(`[FAILED] ${email} — ${err.message?.slice(0, 80)}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
  const summary = { weekId, sent, errors, skipped, elapsed_s: Number(elapsed) };
  log.info('[weekly] complete', summary);
  console.log(`\n[COMPLETE] sent=${sent} errors=${errors} skipped=${skipped} elapsed=${elapsed}s`);

  return summary;
}

// ── Netlify Function handler ──────────────────────────────────────────────────

exports.handler = async () => {
  try {
    const result = await runWeeklyDigest();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[weekly] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  runWeeklyDigest()
    .then(r => { console.log('\nDone:', JSON.stringify(r, null, 2)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
