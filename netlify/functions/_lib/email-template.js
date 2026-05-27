// Editorial HTML email template for OdontoFeed daily digest.
// Design: warm bege/off-white, newspaper-style, editorial tone.
// Referências: MIT Technology Review, Nature Briefing, Morning Brew.
// Compatible with Gmail, Outlook, Apple Mail, and mobile clients.

const crypto = require('crypto');

// ── Evidence badge colors (warm editorial palette) ───────────────────────────

const BADGE_STYLE = {
  'Meta-análise':        { bg: '#E8F0E7', color: '#3A6A38', border: '#AECAAC' },
  'Revisão Sistemática': { bg: '#E8F0E7', color: '#3A6A38', border: '#AECAAC' },
  'RCT':                 { bg: '#EAE4F4', color: '#5A3B96', border: '#C2B5E2' },
  'Estudo Coorte':       { bg: '#F5EDD8', color: '#875A18', border: '#D4B87A' },
  'Caso Clínico':        { bg: '#F0E8E5', color: '#7A3A28', border: '#CDA094' },
  'In Vitro':            { bg: '#EDEBE7', color: '#6B665E', border: '#C8C2B8' },
  'Estudo Animal':       { bg: '#EDEBE7', color: '#6B665E', border: '#C8C2B8' },
  'Revisão Narrativa':   { bg: '#F2EFEB', color: '#9E988E', border: '#D5CEC4' },
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

// ── Editorial intro generator ─────────────────────────────────────────────────
// Builds a journalistic hook using real article data (impacto_pratico,
// achados_principais, nivel_evidencia) from the highest-scored article.
// Tone: editorial/scientific provocation — never prescriptive.

function generateEditorialIntro(articles, esp, firstName) {
  // Lead article = highest relevanceScore; fallback to first
  const sorted  = [...articles].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  const lead    = sorted[0];

  // Extract best available hook text from lead article
  const rawHook = (lead.impacto_pratico || lead.achados_principais || lead.resumo_pt || '').trim();

  // Evidence profile of the full edition
  const evs      = articles.map(a => (a.nivel_evidencia || '').toLowerCase());
  const hasMeta  = evs.some(e => /meta|sistem/i.test(e));
  const hasRCT   = evs.some(e => /rct|randomizado|randomized/i.test(e));
  const hasCohort = evs.some(e => /coorte|cohort/i.test(e));
  const n        = articles.length;
  const estudos  = n === 1 ? 'O estudo' : 'Os estudos';

  // Evidence qualifier for closing sentence
  let evQual = 'com evid&ecirc;ncias recentes aplic&aacute;veis &agrave; pr&aacute;tica';
  if (hasMeta && hasRCT) evQual = 'com meta-an&aacute;lise e ensaios cl&iacute;nicos randomizados';
  else if (hasMeta)      evQual = 'com destaque para revis&atilde;o sistem&aacute;tica recente';
  else if (hasRCT)       evQual = 'com dados de ensaios cl&iacute;nicos randomizados';
  else if (hasCohort)    evQual = 'com dados longitudinais de coorte';

  // Build hook from real impact text
  if (rawHook && rawHook.length > 30) {
    // First sentence only, stripped of trailing period
    const match   = rawHook.match(/^[^.!?]+[.!?]?/);
    let hook      = (match ? match[0] : truncate(rawHook, 160)).trim().replace(/[.!?]$/, '');
    // Lowercase first char for smooth sentence integration
    hook = hook.charAt(0).toLowerCase() + hook.slice(1);

    return `As evid&ecirc;ncias recentes sugerem que ${esc(hook)}. ${estudos} desta edi&ccedil;&atilde;o em ${esc(esp)} &mdash; ${evQual} &mdash; exploram essa e outras implica&ccedil;&otilde;es cl&iacute;nicas. Vale observar os achados &agrave; luz do seu protocolo atual.`;
  }

  // Fallback: structured generic by evidence type
  if (hasMeta && hasRCT) {
    return `${estudos} desta edi&ccedil;&atilde;o em ${esc(esp)} incluem meta-an&aacute;lise e ensaios cl&iacute;nicos randomizados. As evid&ecirc;ncias sugerem tend&ecirc;ncias que podem representar implica&ccedil;&otilde;es relevantes para protocolos cl&iacute;nicos contempor&acirc;neos &mdash; vale observar os achados.`;
  }
  if (hasMeta) {
    return `${estudos} desta edi&ccedil;&atilde;o em ${esc(esp)} incluem uma revis&atilde;o sistem&aacute;tica recente. As evid&ecirc;ncias indicam tend&ecirc;ncias que vale considerar na perspectiva do seu protocolo atual.`;
  }
  if (hasRCT) {
    return `${estudos} desta edi&ccedil;&atilde;o em ${esc(esp)} apresentam dados prim&aacute;rios de ensaios cl&iacute;nicos. As evid&ecirc;ncias recentes indicam achados que podem ser relevantes para a tomada de decis&atilde;o cl&iacute;nica.`;
  }
  return `${estudos} selecionados nesta edi&ccedil;&atilde;o em ${esc(esp)} trazem evid&ecirc;ncias recentes com poss&iacute;veis implica&ccedil;&otilde;es para a pr&aacute;tica odontol&oacute;gica. Vale observar os achados &agrave; luz do contexto cl&iacute;nico de cada caso.`;
}

// ── Article block (editorial newspaper style) ─────────────────────────────────

function articleCard(article, index, total, opts) {
  const { baseUrl, dashboardUrl, digestId, email } = opts;
  const pmid         = article.pmid || article.id || '';
  const badge        = BADGE_STYLE[article.nivel_evidencia] || BADGE_STYLE['Revisão Narrativa'];
  const titulo       = esc(truncate(article.titulo_pt || article.titulo || article.title || 'Sem título', 120));
  const impacto      = esc(truncate(article.impacto_pratico || '', 280));
  const resumo       = esc(truncate(article.resumo_pt || '', 220));
  const journal      = esc(article.journal || '');
  const year         = esc(String(article.year || ''));
  const tempoLeitura = article.tempo_leitura || 3;
  const nivel        = esc(article.nivel_evidencia || 'Revisão Narrativa');
  const isOA         = article.isOpenAccess ? '&#x1F513;&nbsp;' : '';
  const espTag       = esc(article.especialidade || article.tema || '');
  const isLast       = index === total - 1;

  const artDashUrl = `${dashboardUrl}?pmid=${pmid}&utm_source=email&utm_medium=digest&utm_content=${pmid}`;
  const trackedUrl = trackClick(baseUrl, digestId, pmid, email, artDashUrl);

  return `
<tr><td style="padding:0 36px;${isLast ? '' : 'border-bottom:1px solid #E8E0D0;'}">
<div style="padding:30px 0;">

  <!-- Meta row: specialty tag + evidence badge + reading time -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin-bottom:14px;">
    <tr>
      <td style="vertical-align:middle;">
        ${espTag
          ? `<span style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#B08968;margin-right:10px;">${espTag}</span>`
          : ''}
        <span style="display:inline-block;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};font-size:10px;font-weight:600;padding:2px 9px;border-radius:100px;letter-spacing:0.4px;">${nivel}</span>
      </td>
      <td align="right" style="font-size:11px;color:#9E988E;white-space:nowrap;">
        ${isOA}${tempoLeitura}&nbsp;min
      </td>
    </tr>
  </table>

  <!-- Headline — primary clickable element -->
  <h2 style="margin:0 0 14px;font-size:19px;font-weight:700;color:#1A1A18;line-height:1.35;
             font-family:Georgia,'Times New Roman',serif;">
    <a href="${trackedUrl}"
       style="color:#1A1A18;text-decoration:none;">${titulo}</a>
  </h2>

  ${impacto ? `<!-- Clinical relevance (left-border editorial callout) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin-bottom:14px;">
    <tr>
      <td style="border-left:2px solid #B08968;padding:8px 14px;">
        <div style="font-size:10px;font-weight:700;color:#B08968;letter-spacing:1px;
                    text-transform:uppercase;margin-bottom:5px;">Relev&acirc;ncia Cl&iacute;nica</div>
        <div style="font-size:13.5px;color:#4A4540;line-height:1.65;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${impacto}</div>
      </td>
    </tr>
  </table>` : ''}

  ${resumo
    ? `<p style="margin:0 0 14px;font-size:13.5px;color:#6B665E;line-height:1.8;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${resumo}</p>`
    : ''}

  <!-- Journal meta + discrete article link -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:12px;color:#9E988E;">
        ${journal
          ? `<span style="color:#6B665E;font-weight:500;">${journal}</span>&nbsp;&middot;&nbsp;`
          : ''}${year}
      </td>
      <td align="right">
        <a href="${trackedUrl}"
           style="font-size:12px;color:#B08968;text-decoration:none;font-weight:500;">
          Abrir artigo&nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>

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
    baseUrl          = 'https://odontofeed.com.br',
    unsubscribeToken = '',
  } = opts;

  const siteUrl      = baseUrl;
  const dashboardUrl = `${siteUrl}/dashboard.html`;
  const firstName    = String(user.nome || '').split(' ')[0] || '';
  const esp          = Array.isArray(user.especialidade)
    ? user.especialidade[0] || 'Odontologia'
    : user.especialidade || 'Odontologia';

  const n      = articles.length;
  const plural = n === 1 ? '' : 's';
  const ehash  = emailHash(user.email);

  const prefsUrl   = `${siteUrl}/dashboard.html?tab=preferences&utm_source=email&utm_medium=digest&utm_content=prefs`;
  const unsubUrl   = `${siteUrl}/.netlify/functions/unsubscribe?email=${encodeURIComponent(user.email)}&t=${unsubscribeToken}`;
  const pixelUrl   = `${baseUrl}/.netlify/functions/track-open?d=${digestId}&e=${ehash}`;

  const subject    = `${n} estudo${plural} em ${esp} — OdontoFeed`;
  const editorial  = generateEditorialIntro(articles, esp, firstName);

  const cardsHtml = articles
    .map((art, i) => articleCard(art, i, articles.length, { baseUrl, dashboardUrl, digestId, email: user.email }))
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#EDE8DF;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<!-- ── Outer container ── -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#EDE8DF;min-height:100vh;">
<tr><td align="center" style="padding:32px 16px 48px;">

  <!-- ── Email card (warm off-white) ── -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
         style="max-width:600px;width:100%;background:#FDFAF5;border:1px solid #E0D8CC;border-radius:4px;">

    <!-- ══ HEADER ══ -->
    <tr><td style="padding:26px 36px 22px;border-bottom:1px solid #E8E0D0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:18px;font-weight:700;color:#1A1A18;letter-spacing:-0.3px;
                        font-family:Georgia,'Times New Roman',serif;line-height:1;">
              OdontoFeed<span style="color:#B08968;">.</span>
            </div>
            <div style="font-size:10px;color:#9E988E;margin-top:5px;letter-spacing:1.2px;
                        text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
              Curadoria Cient&iacute;fica &middot; ${esc(esp)}
            </div>
          </td>
          <td align="right" style="vertical-align:top;font-size:11.5px;color:#9E988E;
                                   white-space:nowrap;padding-top:2px;
                                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            ${formatDate()}
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ══ EDITORIAL INTRO ══ -->
    <tr><td style="padding:22px 36px;border-bottom:1px solid #E8E0D0;background:#F8F3EA;">
      <p style="margin:0 0 5px;font-size:9.5px;font-weight:700;letter-spacing:1.4px;
                text-transform:uppercase;color:#B08968;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Nota Editorial
      </p>
      <p style="margin:0;font-size:14px;color:#4A4540;line-height:1.8;font-style:italic;
                font-family:Georgia,'Times New Roman',serif;">
        ${editorial}
      </p>
    </td></tr>

    <!-- ══ ARTICLES ══ -->
    ${cardsHtml}

    <!-- ══ FOOTER ══ -->
    <tr><td style="padding:22px 36px 26px;border-top:1px solid #E8E0D0;background:#F2EDE3;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:13px;font-weight:700;color:#1A1A18;margin-bottom:5px;
                        font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.2px;">
              OdontoFeed<span style="color:#B08968;">.</span>
            </div>
            <div style="font-size:11.5px;color:#9E988E;line-height:1.75;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
              Curadoria cient&iacute;fica para dentistas brasileiros.<br>
              Voc&ecirc; recebe porque se inscreveu em
              <a href="${siteUrl}"
                 style="color:#B08968;text-decoration:none;">${siteUrl.replace('https://', '')}</a>
            </div>
            <div style="margin-top:12px;font-size:11px;color:#B5B0A8;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
              <a href="${esc(prefsUrl)}"
                 style="color:#9E988E;text-decoration:underline;">Atualizar prefer&ecirc;ncias</a>
              &nbsp;&middot;&nbsp;
              <a href="${esc(unsubUrl)}"
                 style="color:#9E988E;text-decoration:underline;">Cancelar recebimento</a>
            </div>

            <!-- Disclaimer jurídico -->
            <div style="margin-top:18px;padding-top:14px;border-top:1px solid #E0D8CC;">
              <p style="margin:0;font-size:10px;color:#B5B0A8;line-height:1.75;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                O OdontoFeed tem como objetivo facilitar a atualiza&ccedil;&atilde;o cient&iacute;fica do
                cirurgi&atilde;o-dentista por meio de curadoria editorial de artigos recentes indexados em
                bases cient&iacute;ficas. As s&iacute;nteses apresentadas n&atilde;o substituem a leitura
                integral dos estudos originais, nem devem ser interpretadas como recomenda&ccedil;&atilde;o
                cl&iacute;nica definitiva ou altera&ccedil;&atilde;o obrigat&oacute;ria de protocolo
                profissional. Decis&otilde;es cl&iacute;nicas devem considerar o contexto individual de cada
                paciente e o julgamento do profissional respons&aacute;vel.
              </p>
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
