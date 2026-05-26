// Premium responsive HTML email template for OdontoFeed daily digest.
// Multi-article layout with evidence badges, clinical impact highlights, and tracking.
// Compatible with Gmail, Outlook, Apple Mail, and mobile clients.

const crypto = require('crypto');

// ── Evidence badge colors ────────────────────────────────────────────────────

const BADGE_STYLE = {
  'Meta-análise':        { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'Revisão Sistemática': { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  'RCT':                 { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  'Estudo Coorte':       { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  'Caso Clínico':        { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  'In Vitro':            { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'Estudo Animal':       { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'Revisão Narrativa':   { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(s, maxLen) {
  s = String(s || '').trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1).trimEnd() + '…';
}

function formatDate() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  });
}

// Creates a hash used to identify the user in tracking URLs without exposing email
function emailHash(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}

// Build the tracked click URL (base64 encodes the destination)
function trackClick(baseUrl, digestId, pmid, email, targetUrl) {
  const t = Buffer.from(targetUrl, 'utf8').toString('base64url');
  const e = emailHash(email);
  return `${baseUrl}/.netlify/functions/track-click?d=${digestId}&p=${encodeURIComponent(pmid || '')}&e=${e}&t=${t}`;
}

// ── Article card HTML ─────────────────────────────────────────────────────────

function articleCard(article, index, opts) {
  const { baseUrl, dashboardUrl, digestId, email } = opts;
  const pmid          = article.pmid || article.id || '';
  const badge         = BADGE_STYLE[article.nivel_evidencia] || BADGE_STYLE['Revisão Narrativa'];
  const titulo        = esc(truncate(article.titulo_pt || article.titulo || article.title || 'Sem título', 120));
  const impacto       = esc(truncate(article.impacto_pratico || '', 280));
  const resumo        = esc(truncate(article.resumo_pt || '', 220));
  const journal       = esc(article.journal || '');
  const year          = esc(String(article.year || ''));
  const tempoLeitura  = article.tempo_leitura || 3;
  const nivel         = esc(article.nivel_evidencia || 'Revisão Narrativa');
  const isOA          = article.isOpenAccess ? '🔓 Acesso Aberto · ' : '';

  // Dashboard link with tracking and UTM
  const artDashUrl  = `${dashboardUrl}?pmid=${pmid}&utm_source=email&utm_medium=digest&utm_content=${pmid}`;
  const trackedUrl  = trackClick(baseUrl, digestId, pmid, email, artDashUrl);
  const border      = index < 2 ? 'border-bottom:1px solid #e2e8f0;' : '';

  return `
<tr><td style="${border}padding:0 40px;">
<div style="padding:28px 0;">

  <!-- Evidence badge + reading time -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td>
        <span style="display:inline-block;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;letter-spacing:0.6px;text-transform:uppercase;">${nivel}</span>
      </td>
      <td align="right" style="color:#94a3b8;font-size:12px;">${isOA}${tempoLeitura} min</td>
    </tr>
  </table>

  <!-- Title -->
  <h2 style="margin:0 0 14px;font-size:18px;font-weight:700;color:#0f172a;line-height:1.4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <a href="${trackedUrl}" style="color:#0f172a;text-decoration:none;">${titulo}</a>
  </h2>

  ${impacto ? `<!-- Clinical impact highlight -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
    <tr>
      <td style="background:#f0f9ff;border-left:3px solid #0ea5e9;border-radius:0 6px 6px 0;padding:10px 14px;">
        <div style="font-size:11px;font-weight:700;color:#0284c7;letter-spacing:0.5px;margin-bottom:5px;text-transform:uppercase;">💡 Impacto Clínico</div>
        <div style="font-size:14px;color:#0c4a6e;line-height:1.55;">${impacto}</div>
      </td>
    </tr>
  </table>` : ''}

  ${resumo ? `<!-- Summary excerpt -->
  <p style="margin:0 0 14px;font-size:14px;color:#475569;line-height:1.75;">${resumo}</p>` : ''}

  <!-- Journal meta -->
  <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;">
    ${journal ? `<strong style="color:#64748b;">${journal}</strong>&nbsp;·&nbsp;` : ''}${year}
  </p>

  <!-- CTA -->
  <a href="${trackedUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:7px;font-size:13px;font-weight:600;letter-spacing:0.2px;">Ler análise completa →</a>

</div>
</td></tr>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full HTML email for a digest.
 *
 * @param {Object} user      - { nome, email, especialidade }
 * @param {Array}  articles  - curated article list (3–5)
 * @param {Object} opts      - { digestId, baseUrl, siteUrl, unsubscribeToken }
 * @returns {{ html: string, subject: string }}
 */
function buildDigestEmail(user, articles, opts) {
  const {
    digestId,
    baseUrl       = 'https://odontofeed.com.br',
    unsubscribeToken = '',
  } = opts;

  const siteUrl      = baseUrl;
  const dashboardUrl = `${siteUrl}/dashboard.html`;
  const firstName    = String(user.nome || 'Doutor(a)').split(' ')[0];
  const esp          = Array.isArray(user.especialidade)
    ? user.especialidade[0] || 'Odontologia'
    : user.especialidade || 'Odontologia';

  const n       = articles.length;
  const plural  = n === 1 ? '' : 's';
  const ehash   = emailHash(user.email);

  const prefsUrl       = `${siteUrl}/dashboard.html?tab=preferences&utm_source=email&utm_medium=digest&utm_content=prefs`;
  const unsubUrl       = `${siteUrl}/.netlify/functions/unsubscribe?email=${encodeURIComponent(user.email)}&t=${unsubscribeToken}`;
  const dashCTA        = trackClick(baseUrl, digestId, '', user.email, `${dashboardUrl}?utm_source=email&utm_medium=digest&utm_content=header_cta`);
  const pixelUrl       = `${baseUrl}/.netlify/functions/track-open?d=${digestId}&e=${ehash}`;

  const subject = `${n} novidade${plural} em ${esp} — OdontoFeed`;

  const cardsHtml = articles
    .map((art, i) => articleCard(art, i, { baseUrl, dashboardUrl, digestId, email: user.email }))
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- Email container -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4f8;min-height:100vh;">
<tr><td align="center" style="padding:24px 16px;">

  <!-- Card wrapper -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- ── Header ── -->
    <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:22px;font-weight:800;color:#0ea5e9;letter-spacing:-0.5px;">OdontoFeed</div>
            <div style="font-size:12px;color:#64748b;margin-top:3px;letter-spacing:0.5px;text-transform:uppercase;">Atualização Científica · Odontologia</div>
          </td>
          <td align="right" style="font-size:12px;color:#475569;white-space:nowrap;">${formatDate()}</td>
        </tr>
      </table>
    </td></tr>

    <!-- ── Greeting ── -->
    <tr><td style="padding:28px 40px 20px;border-bottom:2px solid #f1f5f9;">
      <h1 style="margin:0 0 8px;font-size:21px;font-weight:700;color:#0f172a;line-height:1.3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        Bom dia, ${esc(firstName)}!
      </h1>
      <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">
        <strong style="color:#0ea5e9;">${n} novidade${plural} importante${plural}</strong> selecionada${plural} para você em <strong style="color:#0f172a;">${esc(esp)}</strong>.
      </p>
    </td></tr>

    <!-- ── Article cards ── -->
    ${cardsHtml}

    <!-- ── Dashboard CTA ── -->
    <tr><td style="padding:24px 40px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0 0 14px;font-size:14px;color:#64748b;">Quer ver mais artigos ou filtrar por tema?</p>
      <a href="${dashCTA}"
         style="display:inline-block;background:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
        Abrir painel completo
      </a>
    </td></tr>

    <!-- ── Footer ── -->
    <tr><td style="padding:20px 40px;background:#0f172a;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#475569;line-height:1.8;">
            <div style="font-weight:700;color:#64748b;margin-bottom:6px;">OdontoFeed</div>
            <div>Você recebe este email porque se inscreveu em <a href="${siteUrl}" style="color:#0ea5e9;text-decoration:none;">${siteUrl.replace('https://', '')}</a></div>
            <div style="margin-top:8px;">
              <a href="${esc(prefsUrl)}"   style="color:#0ea5e9;text-decoration:none;">Atualizar preferências</a>
              &nbsp;&middot;&nbsp;
              <a href="${esc(unsubUrl)}"   style="color:#0ea5e9;text-decoration:none;">Cancelar recebimento</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>

  </table>
  <!-- Tracking pixel — 1×1 transparent GIF -->
  <img src="${pixelUrl}" width="1" height="1" alt="" border="0"
       style="display:block;width:1px;height:1px;border:none;opacity:0;">

</td></tr>
</table>

</body>
</html>`;

  return { html, subject };
}

module.exports = { buildDigestEmail, emailHash, trackClick };
