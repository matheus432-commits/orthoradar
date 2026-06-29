// Monthly reading summary — personal scientific retrospective for each user.
// Sent on the last day of each month to users who clicked ≥1 article that month.
//
// Schedule: GitHub Actions monthly-summary.yml (cron 0 13 28-31 * *)
//           The handler checks isLastDayOfMonth() and exits early otherwise.
//
// Run manually: node netlify/functions/monthly-summary.js

const crypto     = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { request }   = require('./_lib');
const log           = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com.br';

// ── Date helpers ──────────────────────────────────────────────────────────────

function isLastDayOfMonth() {
  const d  = new Date();
  const tomorrow = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return tomorrow.getUTCDate() === 1;
}

function monthLabel() {
  const MONTHS = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
  ];
  return MONTHS[new Date().getUTCMonth()];
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildMonthlySummaryEmail(user, eng, month) {
  const nome  = esc(String(user.nome || '').split(' ')[0] || 'Dentista');
  const esp   = esc(user.especialidade || '');
  const total = eng.totalArticlesThisMonth || 0;
  const plural = total === 1 ? '' : 's';
  const streak = eng.streak || 0;

  // Top 3 temas this month (fall back to all-time if no monthly data)
  const themeSource = eng.clicksByThemeThisMonth || eng.clicksByTheme || {};
  const topThemes = Object.entries(themeSource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const themesHtml = topThemes.length > 0
    ? topThemes.map(([tema, count]) => `
      <tr>
        <td style="padding:7px 0;border-bottom:1px solid #F0EAE0;
                   font-size:13.5px;color:#4A4540;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          ${esc(tema)}
        </td>
        <td align="right" style="padding:7px 0;border-bottom:1px solid #F0EAE0;
                                  font-size:13px;color:#9E988E;
                                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          ${count}&nbsp;artigo${count > 1 ? 's' : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="2" style="font-size:13px;color:#9E988E;padding:8px 0;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Nenhum tema registrado este m&ecirc;s.</td></tr>`;

  const newBadges = eng.newBadgesThisMonth || [];
  const badgesHtml = newBadges.length > 0
    ? `
    <!-- Badges -->
    <tr><td style="padding:0 36px;">
      <div style="padding:20px 0;border-top:1px solid #E8E0D0;">
        <p style="margin:0 0 12px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                  text-transform:uppercase;color:#B08968;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          Perfis Completados em ${esc(month)}
        </p>
        <div>
          ${newBadges.map(b => `<span style="display:inline-block;margin:0 6px 6px 0;
            background:#E8F0E7;color:#3A6A38;border:1px solid #AECAAC;
            font-size:11px;font-weight:600;padding:3px 11px;border-radius:100px;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            ${esc(b)}</span>`).join('')}
        </div>
      </div>
    </td></tr>`
    : '';

  const streakLine = streak >= 3
    ? `<p style="margin:12px 0 0;font-size:13px;color:#6B665E;
                 font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Sua sequ&ecirc;ncia atual: <strong>${streak} dias</strong> acompanhando a literatura.
      </p>`
    : '';

  const subject = `Seu relatório de ${month} — OdontoFeed`;

  const espLine = esp
    ? `Curadoria em <strong>${esp}</strong> &mdash; `
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EDE8DF;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
       style="background:#EDE8DF;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px 48px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0"
         style="max-width:600px;width:100%;background:#FDFAF5;border:1px solid #E0D8CC;border-radius:4px;">

    <!-- HEADER -->
    <tr><td style="padding:26px 36px 22px;border-bottom:1px solid #E8E0D0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:18px;font-weight:700;color:#1A1A18;letter-spacing:-0.3px;
                        font-family:Georgia,'Times New Roman',serif;">
              OdontoFeed<span style="color:#B08968;">.</span>
            </div>
            <div style="font-size:10px;color:#9E988E;margin-top:5px;letter-spacing:1.2px;
                        text-transform:uppercase;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
              Relat&oacute;rio de Leitura &middot; ${esc(month)}
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- INTRO -->
    <tr><td style="padding:22px 36px;border-bottom:1px solid #E8E0D0;background:#F8F3EA;">
      <p style="margin:0 0 4px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                text-transform:uppercase;color:#B08968;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Relat&oacute;rio Cient&iacute;fico Pessoal
      </p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#1A1A18;line-height:1.35;
                font-family:Georgia,'Times New Roman',serif;">
        ${nome}, em ${esc(month)} voc&ecirc; explorou
        ${total}&nbsp;artigo${plural}&nbsp;cient&iacute;fico${plural}.
      </p>
      <p style="margin:10px 0 0;font-size:13px;color:#6B665E;line-height:1.7;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        ${espLine}${total > 0 ? 'Abaixo, um recorte da sua atividade de leitura no m&ecirc;s.' : 'Continue acompanhando a literatura &mdash; novos artigos chegam diariamente.'}
      </p>
      ${streakLine}
    </td></tr>

    <!-- TEMAS -->
    <tr><td style="padding:22px 36px;${newBadges.length ? '' : 'border-bottom:1px solid #E8E0D0;'}">
      <p style="margin:0 0 14px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                text-transform:uppercase;color:#B08968;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Temas Mais Explorados
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${themesHtml}
      </table>
    </td></tr>

    ${badgesHtml}

    <!-- FOOTER -->
    <tr><td style="padding:22px 36px;background:#F2EDE3;border-top:1px solid #E8E0D0;">
      <div style="font-size:11.5px;color:#9E988E;line-height:1.75;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Curadoria cient&iacute;fica para dentistas brasileiros.<br>
        <a href="${BASE_URL}"
           style="color:#B08968;text-decoration:none;">${BASE_URL.replace('https://', '')}</a>
      </div>
    </td></tr>

  </table>
</td></tr>
</table>
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function runMonthlySummary() {
  if (!isLastDayOfMonth()) {
    log.info('[monthly-summary] not last day of month, skipping');
    return { skipped: true };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey)    { log.error('[monthly-summary] FIREBASE_API_KEY not set'); return { error: 'no_firebase_key' }; }
  if (!resendKey) { log.error('[monthly-summary] RESEND_API_KEY not set');   return { error: 'no_resend_key' }; }

  const db               = new Firestore(projectId, apiKey);
  const month            = monthLabel();
  const currentMonthStr  = new Date().toISOString().slice(0, 7);

  // ── Load all active users from cadastros ─────────────────────────────────
  const userMap = {};  // email → user doc
  let pageToken = null;
  do {
    try {
      const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
      docs.filter(u => u.email && u.ativo !== false && !u.bounced)
          .forEach(u => { userMap[u.email] = u; });
      pageToken = nextPageToken;
    } catch (err) {
      log.error('[monthly-summary] failed loading cadastros — aborting', { err: err.message });
      return { error: 'cadastros_load_failed' };
    }
  } while (pageToken);

  log.info('[monthly-summary] active users loaded', { count: Object.keys(userMap).length });

  // ── Load all user_engagement docs ────────────────────────────────────────
  const engDocs = [];
  pageToken = null;
  do {
    try {
      const { docs, nextPageToken } = await db.listDocs('user_engagement', { pageSize: 300, pageToken });
      engDocs.push(...docs);
      pageToken = nextPageToken;
    } catch (err) {
      log.error('[monthly-summary] failed loading user_engagement — aborting', { err: err.message });
      return { error: 'engagement_load_failed' };
    }
  } while (pageToken);

  // ── Filter eligible: has email, active user, read ≥1 article this month,
  //    and not already sent this month (idempotency) ────────────────────────
  const eligible = engDocs.filter(eng =>
    eng.email &&
    userMap[eng.email] &&
    (eng.totalArticlesThisMonth || 0) > 0 &&
    eng.monthlySummarySentAt !== currentMonthStr
  );
  log.info('[monthly-summary] eligible users', { count: eligible.length, month });

  let sent = 0, errors = 0;

  for (const eng of eligible) {
    const user    = userMap[eng.email];
    const nome    = (Array.isArray(user.nome) ? user.nome[0] : user.nome) || '';
    const esp     = (Array.isArray(user.especialidade)
      ? user.especialidade[0]
      : user.especialidade) || '';

    try {
      const { html, subject } = buildMonthlySummaryEmail({ nome, email: eng.email, especialidade: esp }, eng, month);
      const res = await sendEmail(resendKey, eng.email, subject, html);

      if (res.status === 200 || res.status === 201) {
        sent++;
        // Reset monthly counters after successful send (idempotency stamp prevents double-send)
        const ehash = crypto.createHash('sha256').update(String(eng.email)).digest('hex').slice(0, 16);
        db.updateDoc('user_engagement', ehash, {
          monthlySummarySentAt:   currentMonthStr,
          totalArticlesThisMonth: 0,
          clicksByThemeThisMonth: {},
          newBadgesThisMonth:     [],
          currentMonth:           currentMonthStr,
        }).catch(e => log.warn('[monthly-summary] reset monthly counters failed', { email: eng.email, err: e.message }));

        log.info('[monthly-summary] sent', { email: eng.email });
      } else {
        log.warn('[monthly-summary] send failed', { email: eng.email, status: res.status });
        errors++;
      }
    } catch (err) {
      log.warn('[monthly-summary] error for user', { email: eng.email, err: err.message });
      errors++;
    }
  }

  log.info('[monthly-summary] complete', { sent, errors });
  return { sent, errors, skipped: engDocs.length - eligible.length };
}

// ── Netlify handler ───────────────────────────────────────────────────────────

exports.handler = async () => {
  try {
    const result = await runMonthlySummary();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    log.error('[monthly-summary] handler error', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

if (require.main === module) {
  runMonthlySummary()
    .then(r => { console.log('Done:', JSON.stringify(r, null, 2)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
