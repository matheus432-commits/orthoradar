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

const MESES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Formata a DATA DE PUBLICAÇÃO do artigo em pt-BR, preservando a granularidade
// disponível: "15 mar 2024" (dia), "mar 2024" (mês) ou "2024" (só ano). Aceita o
// campo dataPublicacao (ISO "YYYY-MM-DD" / "YYYY-MM" / "YYYY") e cai para o ano.
// Parsing manual evita fuso horário (new Date('2024-03') vira UTC e pode recuar 1 mês).
function formatPublicationDate(article) {
  const raw = String(article.dataPublicacao || '').trim();
  const m = raw.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (m) {
    const [, y, mo, d] = m;
    if (d && mo)  return `${parseInt(d, 10)} ${MESES_PT[parseInt(mo, 10) - 1]} ${y}`;
    if (mo)       return `${MESES_PT[parseInt(mo, 10) - 1]} ${y}`;
    return y;
  }
  const year = String(article.year || '').trim();
  return /^\d{4}$/.test(year) ? year : '';
}

// Creates a hash used to identify the user in tracking URLs without exposing email
function emailHash(email) {
  return crypto.createHash('sha256').update(String(email)).digest('hex').slice(0, 16);
}

// Build the tracked click URL (base64url-encodes destination + optional tema for badge tracking)
function trackClick(baseUrl, digestId, pmid, email, targetUrl, tema) {
  const t  = Buffer.from(targetUrl, 'utf8').toString('base64url');
  const e  = emailHash(email);
  const th = tema ? Buffer.from(String(tema), 'utf8').toString('base64url') : '';
  const base = `${baseUrl}/.netlify/functions/track-click?d=${digestId}&p=${encodeURIComponent(pmid || '')}&e=${e}&t=${t}`;
  return th ? `${base}&th=${th}` : base;
}

// Resolve o destino REAL do artigo, em ordem de prioridade. NUNCA monta uma URL
// do PubMed a partir de um id sintético (ex.: "doi_10_1234_..."): só um PMID
// numérico real mapeia para pubmed.ncbi.nlm.nih.gov. Artigos só com DOI vão para
// doi.org (host permitido pelo track-click). Evita a "página desconhecida" quando
// o pubmedUrl armazenado está vazio e o id não é um PMID.
function resolveArticleUrl(article, baseUrl) {
  const rawPubmedUrl = String(article.pubmedUrl ?? '').trim();
  if (/^https?:\/\//i.test(rawPubmedUrl)) return rawPubmedUrl;
  const realPmid = String(article.pmid ?? '').trim();
  if (/^\d+$/.test(realPmid)) return `https://pubmed.ncbi.nlm.nih.gov/${realPmid}/`;
  const doi = String(article.doi ?? '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  if (doi) return `https://doi.org/${doi}`;
  const url = String(article.url || article.oaUrl || '').trim();
  if (/^https?:\/\//i.test(url)) return url;
  return baseUrl;
}

// ── Editorial intro generator ─────────────────────────────────────────────────
// STEP 1 — classify article relationship (convergent / coexistent)
// STEP 2 — detect invisible editorial theme from content signals
// STEP 3 — write editorial based on relationship type, never forcing connections
//
// Convergent  → multiple articles on same tema; show evidence consolidation
// Coexistent  → independent articles; use panorama approach, vary openers,
//               reference top-2 explicitly + remaining implicitly by tema name
// Never: sequential list, forced "Enquanto X, Y" across unrelated topics

function generateEditorialIntro(articles, esp) {
  const n = articles.length;
  const sorted = [...articles].sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  // ── STEP 1: Classify article relationship ─────────────────────────────────

  const temaCounts = {};
  articles.forEach(a => {
    const t = (a.tema || '').toLowerCase().trim();
    if (t) temaCounts[t] = (temaCounts[t] || 0) + 1;
  });
  const maxThemeCount = Math.max(0, ...Object.values(temaCounts));
  // Convergent when majority share a tema
  const convergent = maxThemeCount >= Math.ceil(n / 2);

  // ── STEP 2: Detect invisible editorial theme from content signals ──────────

  const allText = articles
    .map(a => (a.impacto_pratico || a.achados_principais || a.resumo_pt || ''))
    .join(' ');

  const sig = {
    estabilidade:     /estabilidade|recidiva|longo prazo|retent|conten/i.test(allText),
    previsibilidade:  /previsib|sobrevida|taxa de sucesso|consist/i.test(allText),
    adesao:           /ades[ãa]o|satisfa|higiene|motiva/i.test(allText),
    biomecanica:      /ancoragem|torque|retra[çc][ãa]o|biomec|estabilidade prim/i.test(allText),
    tecnologia:       /alinhador|digital|cbct|laser|isq/i.test(allText),
    protocolo:        /protocolo|abordagem|alternativa|associa[çc][ãa]o|combina[çc][ãa]o/i.test(allText),
    individualizacao: /indica[çc][ãa]o|sele[çc][ãa]o|individual|caso a caso|crit[eé]rio/i.test(allText),
  };

  let invisibleTheme = 'panorama';
  if      (sig.estabilidade && sig.previsibilidade) invisibleTheme = 'previsibilidade_estabilidade';
  else if (sig.adesao        && sig.estabilidade)   invisibleTheme = 'adesao_estabilidade';
  else if (sig.biomecanica   && sig.tecnologia)     invisibleTheme = 'precisao_tecnica';
  else if (sig.previsibilidade)                     invisibleTheme = 'previsibilidade';
  else if (sig.estabilidade)                        invisibleTheme = 'estabilidade';
  else if (sig.adesao)                              invisibleTheme = 'adesao';
  else if (sig.biomecanica)                         invisibleTheme = 'biomecanica';
  else if (sig.protocolo)                           invisibleTheme = 'protocolo';

  // ── STEP 3: Build editorial ───────────────────────────────────────────────

  function firstSentence(article) {
    const raw = (article.impacto_pratico || article.achados_principais || '').trim();
    if (raw.length < 20) return '';
    const m = raw.match(/^[^.!?]+[.!?]?/);
    let s = (m ? m[0] : raw.slice(0, 155)).trim().replace(/[.!?]$/, '');
    return s.charAt(0).toLowerCase() + s.slice(1);
  }

  function evRef(article) {
    const ev = (article.nivel_evidencia || '').toLowerCase();
    if (/meta/i.test(ev))            return 'meta-an&aacute;lise';
    if (/sistem/i.test(ev))          return 'revis&atilde;o sistem&aacute;tica';
    if (/rct|randomizado/i.test(ev)) return 'ensaio cl&iacute;nico randomizado';
    if (/coorte/i.test(ev))          return 'coorte prospectiva';
    return 'estudo recente';
  }

  const hooks      = sorted.map(firstSentence).filter(Boolean);
  const hasMeta    = articles.some(a => /meta|sistem/i.test(a.nivel_evidencia || ''));
  const hasRCT     = articles.some(a => /rct|randomizado/i.test(a.nivel_evidencia || ''));
  const highEvN    = articles.filter(a => /meta|sistem|rct|randomizado/i.test(a.nivel_evidencia || '')).length;
  const evLabel    = highEvN >= 2 ? 'evid&ecirc;ncias de alto n&iacute;vel'
                   : (hasMeta || hasRCT) ? 'evid&ecirc;ncia de n&iacute;vel elevado'
                   : 'estudos recentes';

  // Ordered tema names for implicit reference
  const temaNames = [...new Set(sorted.map(a => (a.tema || '').trim()).filter(Boolean))];

  // ── CONVERGENT: multiple articles on same clinical topic ──────────────────
  if (convergent) {
    const domTema = Object.entries(temaCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || esp;

    const p1 = `Uma tend&ecirc;ncia se consolida nesta edi&ccedil;&atilde;o em ${esc(esp)}: ${esc(domTema)} ocupa o centro da literatura recente com ${n > 2 ? 'm&uacute;ltiplos estudos' : 'mais de um estudo'} explorando suas implica&ccedil;&otilde;es cl&iacute;nicas sob &acirc;ngulos distintos. Quando desenhos metodol&oacute;gicos diferentes convergem sobre o mesmo problema, a base de evid&ecirc;ncias se torna mais s&oacute;lida &mdash; e as reflex&otilde;es, mais pertinentes.`;

    let p2 = '';
    if (hooks.length >= 2) {
      const e0 = evRef(sorted[0]); const E0 = e0.charAt(0).toUpperCase() + e0.slice(1);
      p2 = `${E0} sugere que ${esc(hooks[0])}, enquanto ${evRef(sorted[1])} aponta que ${esc(hooks[1])}.${hooks[2] ? `<br>Um terceiro estudo acrescenta que ${esc(hooks[2])}.` : ''}`;
    } else if (hooks.length === 1) {
      const e0 = evRef(sorted[0]); const E0 = e0.charAt(0).toUpperCase() + e0.slice(1);
      p2 = `${E0} sugere que ${esc(hooks[0])}.`;
    }

    const p3 = `Vale observar os achados &agrave; luz do protocolo atual &mdash; n&atilde;o como altera&ccedil;&atilde;o obrigat&oacute;ria de conduta, mas como insumo para reflex&atilde;o sobre indica&ccedil;&otilde;es, limites e vari&aacute;veis cl&iacute;nicas determinantes em ${esc(esp)}.`;

    return [p1, p2, p3].filter(Boolean).join('<br><br>');
  }

  // ── COEXISTENT: independent articles — panorama approach ─────────────────
  // Vary opener deterministically (no Math.random) and never use the same
  // "A edição de hoje reúne..." formula.

  const openers = [
    `A pr&aacute;tica cl&iacute;nica em ${esc(esp)} avan&ccedil;a em m&uacute;ltiplas frentes simultaneamente. Os estudos desta edi&ccedil;&atilde;o &mdash; apoiados em ${evLabel} &mdash; abordam diferentes dimens&otilde;es da tomada de decis&atilde;o na especialidade, cada um trazendo evid&ecirc;ncias sobre quest&otilde;es relevantes para o cotidiano cl&iacute;nico.`,

    `Nem sempre a literatura converge em um &uacute;nico tema &mdash; e isso n&atilde;o &eacute; fraqueza. &Eacute; reflexo de uma especialidade que evolui em paralelo, sobre quest&otilde;es igualmente urgentes. Os estudos desta edi&ccedil;&atilde;o em ${esc(esp)} s&atilde;o representativos desse movimento: distintos em foco, relevantes em aplicabilidade cl&iacute;nica.`,

    `A tomada de decis&atilde;o cl&iacute;nica em ${esc(esp)} raramente envolve apenas uma vari&aacute;vel. Os estudos desta edi&ccedil;&atilde;o exploram, sob perspectivas distintas, diferentes camadas dessa complexidade &mdash; da biomecanica ao comportamento do paciente, dos resultados imediatos &agrave; estabilidade de longo prazo.`,
  ];
  const p1 = openers[n % openers.length];

  // § 2: top-2 articles referenced explicitly; remaining by tema (implicit)
  let p2 = '';
  if (hooks.length >= 2) {
    const explicit =
      `A literatura recente indica que ${esc(hooks[0])}. ` +
      `Em outro aspecto da pr&aacute;tica, os dados sugerem que ${esc(hooks[1])}.`;

    // Implicit reference to remaining articles via tema names
    const implicitTemas = temaNames.slice(2, 5).filter(Boolean);
    const implicitStr = implicitTemas.length > 0
      ? ` Os achados sobre ${esc(implicitTemas.join(' e '))} complementam esse panorama com evid&ecirc;ncias adicionais sobre previsibilidade e limites dos procedimentos envolvidos.`
      : '';

    p2 = explicit + implicitStr;
  } else if (hooks.length === 1) {
    p2 = `A literatura recente indica que ${esc(hooks[0])}.`;
  }

  // § 3: closing tied to invisible theme
  const closings = {
    previsibilidade_estabilidade:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a uma tend&ecirc;ncia recorrente: previsibilidade e estabilidade em ${esc(esp)} dependem cada vez mais de indica&ccedil;&atilde;o criteriosa, acompanhamento rigoroso e controle das vari&aacute;veis que determinam o sucesso a longo prazo.`,
    adesao_estabilidade:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que a estabilidade dos resultados em ${esc(esp)} est&aacute; intimamente ligada &agrave; ades&atilde;o do paciente ao longo do tratamento &mdash; uma vari&aacute;vel t&atilde;o determinante quanto a t&eacute;cnica empregada.`,
    precisao_tecnica:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que precis&atilde;o t&eacute;cnica em ${esc(esp)} &eacute; necess&aacute;ria, mas n&atilde;o suficiente: a qualidade da indica&ccedil;&atilde;o e o controle das vari&aacute;veis cl&iacute;nicas s&atilde;o igualmente determinantes para o resultado final.`,
    previsibilidade:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que previsibilidade cl&iacute;nica em ${esc(esp)} n&atilde;o decorre apenas da t&eacute;cnica &mdash; mas da qualidade da indica&ccedil;&atilde;o e do controle rigoroso das vari&aacute;veis ao longo do tratamento.`,
    estabilidade:
      `O conjunto da edi&ccedil;&atilde;o sugere que estabilidade em ${esc(esp)} depende de decis&otilde;es que antecedem e seguem o procedimento principal &mdash; n&atilde;o apenas da t&eacute;cnica empregada.`,
    adesao:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que a ades&atilde;o do paciente &eacute; uma vari&aacute;vel cr&iacute;tica em ${esc(esp)} &mdash; frequentemente mais determinante para o resultado do que a pr&oacute;pria t&eacute;cnica escolhida.`,
    biomecanica:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que o dom&iacute;nio biomec&acirc;nico em ${esc(esp)} exige compreens&atilde;o das limita&ccedil;&otilde;es biol&oacute;gicas de cada protocolo e sele&ccedil;&atilde;o criteriosa dos casos &mdash; n&atilde;o apenas t&eacute;cnica de execu&ccedil;&atilde;o.`,
    protocolo:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a que a evolu&ccedil;&atilde;o dos protocolos em ${esc(esp)} demanda leitura cr&iacute;tica da literatura &mdash; avaliando n&atilde;o apenas efic&aacute;cia, mas limites e condi&ccedil;&otilde;es necess&aacute;rias para a reprodutibilidade cl&iacute;nica.`,
    panorama:
      `O conjunto da edi&ccedil;&atilde;o refor&ccedil;a uma tend&ecirc;ncia recorrente na literatura contempor&acirc;nea de ${esc(esp)}: previsibilidade cl&iacute;nica depende cada vez mais de individualiza&ccedil;&atilde;o terap&ecirc;utica, ades&atilde;o do paciente e controle rigoroso das vari&aacute;veis envolvidas.`,
  };

  const p3 = closings[invisibleTheme] || closings.panorama;

  return [p1, p2, p3].filter(Boolean).join('<br><br>');
}

// ── Article block (editorial newspaper style) ─────────────────────────────────

// Diretriz 19/07/2026: TODO link de artigo no e-mail leva à edição no SITE
// (edicaoUrl com token), não ao artigo original. O dentista ouve o áudio e
// acessa o estudo na íntegra a partir do OdontoFeed — a visita ao site é a
// métrica-chave para venda de publicidade. O clique continua rastreado por
// artigo via track-click (odontofeed.com está na allowlist do redirect).
function articleCard(article, index, total, opts) {
  const { baseUrl, dashboardUrl, digestId, email, edicaoUrl } = opts;
  const pmid         = String(article.pmid || article.id || '').trim();
  const badge        = BADGE_STYLE[article.nivel_evidencia] || BADGE_STYLE['Revisão Narrativa'];
  const titulo       = esc(truncate(article.titulo_pt || article.titulo || article.title || 'Sem título', 120));
  const impacto      = esc(truncate(article.impacto_pratico || '', 300));
  // resumo: prefer PT → raw English abstract → empty
  const resumo       = esc(truncate(article.resumo_pt || article._rawAbstract || article.abstract || '', 500));
  const journal      = esc(article.journal || '');
  const pubDate      = esc(formatPublicationDate(article));
  const tempoLeitura = article.tempo_leitura || 3;
  const nivel        = esc(article.nivel_evidencia || 'Revisão Narrativa');
  const isOA         = article.isOpenAccess ? '&#x1F513;&nbsp;' : '';
  const espTag       = esc(article.especialidade || article.tema || '');
  const isLast       = index === total - 1;

  const destinoSite = edicaoUrl || dashboardUrl || baseUrl;
  const trackedUrl  = trackClick(baseUrl, digestId, pmid, email, destinoSite, article.tema || article.especialidade);

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
        ${isOA}${pubDate ? `${pubDate}&nbsp;&middot;&nbsp;` : ''}${tempoLeitura}&nbsp;min
      </td>
    </tr>
  </table>

  <!-- Headline — primary clickable element (leva à edição no OdontoFeed) -->
  <h2 style="margin:0 0 14px;font-size:19px;font-weight:700;color:#1A1A18;line-height:1.35;
             font-family:Georgia,'Times New Roman',serif;">
    <a href="${esc(trackedUrl)}"
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

  <!-- Journal meta + link para a edição no site (áudio + artigo na íntegra) -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="font-size:12px;color:#9E988E;">
        ${journal
          ? `<span style="color:#6B665E;font-weight:500;">${journal}</span>${pubDate ? '&nbsp;&middot;&nbsp;' : ''}`
          : ''}${pubDate}
      </td>
      <td align="right">
        <a href="${esc(trackedUrl)}"
           style="font-size:12px;color:#B08968;text-decoration:none;font-weight:500;">
          Abrir no OdontoFeed&nbsp;&rarr;
        </a>
      </td>
    </tr>
  </table>

</div>
</td></tr>`;
}

// ── Curadoria Premium (assinantes) ───────────────────────────────────────────
// Card com layout DISTINTO dos 3 regulares: fundo lilás, borda violeta e selo
// "Exclusivo assinante" — o leitor entende na hora que aquele artigo só chegou
// porque ele assina. O resumo usa o texto RICO (resumo_completo, Sonnet com
// validador numérico) quando disponível, bem mais longo que o dos cards comuns.
// Renderiza o resumo estruturado (Objetivo/Métodos/Resultados/Relevância) no
// e-mail: títulos de seção em negrito, quebras preservadas. Resumos antigos em
// prosa passam direto como parágrafos.
const RESUMO_HEAD_RE = /^(Objetivo|Materiais? e m[ée]todos?|M[ée]todos?|Metodologia|Resultados?|Relev[âa]ncia cl[íi]nica|Limita[çc][õo]es)\s*:?\s*$/i;
function renderResumoEstruturado(texto) {
  return String(texto || '').split(/\n+/)
    .map(l => l.trim()).filter(Boolean)
    .map(l => RESUMO_HEAD_RE.test(l)
      ? `<strong style="display:block;margin-top:10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#7C5CBF;">${esc(l.replace(/\s*:\s*$/, ''))}</strong>`
      : esc(l))
    .join('<br>');
}

function premiumArticleCard(article, opts) {
  const { baseUrl, dashboardUrl, digestId, email, edicaoUrl } = opts;
  const pmid    = String(article.pmid || article.id || '').trim();
  const badge   = BADGE_STYLE[article.nivel_evidencia] || BADGE_STYLE['Revisão Narrativa'];
  const titulo  = esc(truncate(article.titulo_pt || article.titulo || article.title || 'Sem título', 140));
  const resumo  = renderResumoEstruturado(truncate(article.resumo_completo || article.resumo_pt || article.abstract || '', 1400));
  const impacto = esc(truncate(article.impacto_pratico || '', 300));
  const journal = esc(article.journal || '');
  const pubDate = esc(formatPublicationDate(article));
  const nivel   = esc(article.nivel_evidencia || 'Revisão Narrativa');
  const tema    = esc(article._premiumTema || '');

  const destinoSite = edicaoUrl || dashboardUrl || baseUrl;
  const trackedUrl  = trackClick(baseUrl, digestId, pmid, email, destinoSite, article.tema || article.especialidade);

  return `
<tr><td style="padding:0 36px 18px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#F6F3FB;border:1px solid #D8CFEA;border-left:3px solid #7C5CBF;border-radius:6px;">
    <tr><td style="padding:22px 24px;">

      <!-- Selo exclusivo + tema que motivou a escolha -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td style="vertical-align:middle;">
            <span style="display:inline-block;background:#7C5CBF;color:#FFFFFF;font-size:9.5px;font-weight:700;
                         padding:3px 10px;border-radius:100px;letter-spacing:1px;text-transform:uppercase;
                         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">&#9733;&nbsp;Exclusivo assinante</span>
            <span style="display:inline-block;background:${badge.bg};color:${badge.color};border:1px solid ${badge.border};
                         font-size:10px;font-weight:600;padding:2px 9px;border-radius:100px;letter-spacing:0.4px;margin-left:6px;">${nivel}</span>
          </td>
          <td align="right" style="font-size:11px;color:#8F86A8;white-space:nowrap;
                                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${pubDate}</td>
        </tr>
      </table>
      ${tema ? `
      <div style="font-size:10.5px;font-weight:700;color:#7C5CBF;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Pelo seu tema: ${tema}</div>` : `
      <div style="font-size:10.5px;font-weight:700;color:#7C5CBF;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Escolhido para voc&ecirc;</div>`}

      <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#241C3A;line-height:1.35;
                 font-family:Georgia,'Times New Roman',serif;">
        <a href="${esc(trackedUrl)}" style="color:#241C3A;text-decoration:none;">${titulo}</a>
      </h2>

      ${impacto ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr><td style="border-left:2px solid #7C5CBF;padding:8px 14px;">
          <div style="font-size:10px;font-weight:700;color:#7C5CBF;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Relev&acirc;ncia Cl&iacute;nica</div>
          <div style="font-size:13.5px;color:#443C5C;line-height:1.65;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${impacto}</div>
        </td></tr>
      </table>` : ''}

      ${resumo ? `
      <p style="margin:0 0 14px;font-size:13.5px;color:#524A6B;line-height:1.8;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${resumo}</p>` : ''}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:12px;color:#8F86A8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            ${journal ? `<span style="color:#524A6B;font-weight:500;">${journal}</span>` : ''}
          </td>
          <td align="right">
            <a href="${esc(trackedUrl)}"
               style="font-size:12px;color:#7C5CBF;text-decoration:none;font-weight:600;
                      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">Abrir no OdontoFeed&nbsp;&rarr;</a>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</td></tr>`;
}

// Cabeçalho da seção Premium — separa visualmente dos 3 artigos regulares.
function premiumSectionHeader(count) {
  return `
<tr><td style="padding:28px 36px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="border-top:2px solid #7C5CBF;padding-top:14px;">
        <span style="font-size:11px;font-weight:700;color:#7C5CBF;letter-spacing:2px;text-transform:uppercase;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">&#9733;&nbsp;Curadoria Premium</span>
        <span style="font-size:11px;color:#8F86A8;margin-left:8px;
                     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          +${count} artigo${count === 1 ? '' : 's'} selecionado${count === 1 ? '' : 's'} pelas suas prefer&ecirc;ncias &middot; com resumo aprofundado</span>
      </td>
    </tr>
  </table>
</td></tr>`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full HTML email for a digest.
 *
 * @param {Object} user      - { nome, email, especialidade }
 * @param {Array}  articles  - curated article list (fixo: 3)
 * @param {Object} opts      - { digestId, baseUrl, siteUrl, unsubscribeToken, editorial?, premiumExtras? }
 * @returns {{ html: string, subject: string }}
 */
// ── Achado da Semana card ─────────────────────────────────────────────────────

function achadoSemanaCard(achado, opts) {
  const { baseUrl, digestId, email } = opts;

  const pmid        = String(achado.pmid || achado.articleId || '').trim();
  const titulo      = esc(truncate(achado.titulo_pt || achado.titulo || 'Sem título', 160));
  const journal     = esc(achado.journal || '');
  const pubDate     = esc(formatPublicationDate(achado));
  const nivel       = esc(achado.nivel_evidencia || '');
  const isOA        = achado.isOpenAccess ? '<span style="color:#B08968;">&#x1F513;</span>&nbsp;' : '';

  // Format nota editorial: convert double-newlines to <br><br>
  const nota = (achado.notaEditorial || '')
    .split(/\n\n+/)
    .map(p => esc(p.trim()))
    .filter(Boolean)
    .join('<br><br>');

  const articleUrl  = resolveArticleUrl(achado, baseUrl);
  const trackedUrl  = trackClick(baseUrl, digestId, pmid, email, articleUrl, achado.especialidade || achado.tema);

  return `
<!-- ══ ACHADO DA SEMANA ══ -->
<tr><td style="padding:0;background:#FFF8E6;border-top:3px solid #C9A227;border-bottom:3px solid #C9A227;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="padding:26px 36px 28px;">

    <!-- Badge -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
      <tr>
        <td style="background:#C9A227;border-radius:3px;padding:4px 13px;">
          <span style="font-size:10px;font-weight:700;color:#FFFFFF;letter-spacing:1.5px;
                       text-transform:uppercase;
                       font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            &#11088;&nbsp; Achado da Semana
          </span>
        </td>
      </tr>
    </table>

    ${nivel ? `<!-- Nível de evidência -->
    <div style="margin-bottom:12px;">
      <span style="display:inline-block;font-size:10px;font-weight:700;color:#875A18;
                   background:#F5EDD8;border:1px solid #D4B87A;border-radius:2px;
                   padding:2px 9px;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        ${nivel}
      </span>
    </div>` : ''}

    <!-- Título -->
    <div style="font-size:20px;font-weight:700;color:#1A1A18;line-height:1.33;
                font-family:Georgia,'Times New Roman',serif;letter-spacing:-0.4px;
                margin-bottom:6px;">
      ${titulo}
    </div>

    <!-- Journal + ano -->
    <div style="font-size:11.5px;color:#9E988E;margin-bottom:18px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      ${isOA}${journal}${journal && pubDate ? '&nbsp;&middot;&nbsp;' : ''}${pubDate}
    </div>

    <!-- Nota editorial com borda dourada -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
           style="margin-bottom:20px;">
      <tr>
        <td style="border-left:3px solid #C9A227;padding-left:16px;">
          <p style="margin:0;font-size:14.5px;color:#3A3530;line-height:1.85;
                    font-family:Georgia,'Times New Roman',serif;font-style:italic;">
            ${nota}
          </p>
        </td>
      </tr>
    </table>

    <!-- Botão CTA dourado -->
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#C9A227;border-radius:3px;">
          <a href="${esc(articleUrl)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;padding:10px 22px;color:#FFFFFF;
                    text-decoration:none;font-size:12.5px;font-weight:700;
                    letter-spacing:0.4px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
            Ler artigo completo &rarr;
          </a>
        </td>
      </tr>
    </table>

  </td></tr>
  </table>
</td></tr>`;
}

/**
 * Builds the full digest HTML email.
 *
 * @param {Object} user      - { nome, email, especialidade }
 * @param {Array}  articles  - curated article list (fixo: 3)
 * @param {Object} opts      - { digestId, baseUrl, unsubscribeToken, editorial?, achadoSemana? }
 * @returns {{ html: string, subject: string }}
 */
function buildDigestEmail(user, articles, opts) {
  const {
    digestId,
    baseUrl          = 'https://odontofeed.com',
    unsubscribeToken = '',
    editorial:       editorialOverride = null,
    achadoSemana:    achado            = null,
    streak:          streakCount       = 0,
    newBadges:       newBadgesList     = [],
    edicaoUrl        = '',
    anuncio          = null, // publicidade contextual (plano Gratuito) — sempre identificada
    premiumExtras    = [],   // artigos extras do assinante (curadoria por tema, layout distinto)
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

  const subject    = achado
    ? `⭐ Achado da Semana + ${n} estudo${plural} em ${esp} — OdontoFeed`
    : `${n} estudo${plural} em ${esp} — OdontoFeed`;

  // Use Claude-generated editorial if provided; fall back to deterministic generator.
  const editorial  = editorialOverride
    ? editorialOverride
        .split(/\n\n+/)
        .map(p => esc(p.trim()))
        .filter(Boolean)
        .join('<br><br>')
    : generateEditorialIntro(articles, esp);

  const achadoHtml = achado
    ? achadoSemanaCard(achado, { baseUrl, digestId, email: user.email })
    : '';

  // Badge notification — shown when the user earned a new badge since last digest
  const newTopics  = newBadgesList
    .filter(b => /^Pesquisador em /.test(b))
    .map(b => b.replace(/^Pesquisador em /, ''))
    .filter(Boolean);
  const badgeRowHtml = newTopics.length > 0
    ? `
    <!-- ══ BADGE NOTIFICATION ══ -->
    <tr><td style="padding:12px 36px;background:#E8F0E7;border-bottom:1px solid #AECAAC;">
      <p style="margin:0;font-size:13px;color:#3A6A38;line-height:1.6;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        &#x1F4D6;&nbsp; Esta semana voc&ecirc; completou seu perfil em
        <strong>${esc(newTopics.join(' e '))}</strong>.
      </p>
    </td></tr>`
    : '';

  // Streak line for footer — only shown at 3+ consecutive days
  const streakInt      = Math.max(0, Math.floor(Number(streakCount) || 0));
  const streakLineHtml = streakInt >= 3
    ? `<div style="margin-top:10px;font-size:11.5px;color:#9E988E;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        &#x1F525;&nbsp; Voc&ecirc; est&aacute; h&aacute;
        <strong style="color:#6B665E;">${streakInt} dias</strong>
        acompanhando a literatura.
      </div>`
    : '';

  // edicaoUrl repassada aos cards: todo clique de artigo leva à edição no site.
  const cardOpts = { baseUrl, dashboardUrl, digestId, email: user.email, edicaoUrl };
  const cardsHtml = articles
    .map((art, i) => articleCard(art, i, articles.length, cardOpts))
    .join('\n');

  const premiumHtml = premiumExtras.length
    ? premiumSectionHeader(premiumExtras.length) +
      premiumExtras.map(a => premiumArticleCard(a, cardOpts)).join('\n')
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

    ${edicaoUrl ? `
    <!-- ══ ABRIR EDIÇÃO NO SITE (acesso via token, sem senha) ══ -->
    <tr><td style="padding:16px 36px;border-bottom:1px solid #E8E0D0;" align="center">
      <a href="${esc(edicaoUrl)}"
         style="display:inline-block;background:#1A1A18;color:#FDFAF5;font-size:13px;font-weight:700;
                text-decoration:none;padding:12px 26px;border-radius:3px;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Abrir minha edi&ccedil;&atilde;o no OdontoFeed &rarr;
      </a>
      <div style="margin-top:7px;font-size:10.5px;color:#9E988E;
                  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        Ou&ccedil;a a edi&ccedil;&atilde;o em &aacute;udio &#127911; e acesse os artigos na &iacute;ntegra
      </div>
    </td></tr>` : ''}

    ${achadoHtml}
    ${badgeRowHtml}

    <!-- ══ ARTICLES ══ -->
    ${cardsHtml}

    <!-- ══ CURADORIA PREMIUM (assinantes) ══ -->
    ${premiumHtml}

    ${anuncio && (anuncio.texto || anuncio.imagemUrl) ? `
    <!-- ══ PUBLICIDADE (plano Gratuito, sempre identificada) ══ -->
    <tr><td style="padding:6px 36px 20px;">
      <div style="border:1px dashed #C8C2B8;border-radius:4px;padding:12px 16px;background:#FDFAF5;">
        <div style="font-size:8.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#B5B0A8;margin-bottom:6px;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
          Publicidade &middot; ${esc(anuncio.patrocinador || 'parceiro')}
        </div>
        ${anuncio.linkUrl ? `<a href="${esc(anuncio.linkUrl)}" target="_blank" style="text-decoration:none;">` : ''}
        ${anuncio.imagemUrl ? `<img src="${esc(anuncio.imagemUrl)}" alt="${esc(anuncio.patrocinador || '')}" width="528" style="max-width:100%;border-radius:4px;display:block;margin-bottom:6px;border:0;"/>` : ''}
        ${anuncio.texto ? `<p style="margin:0;font-size:12.5px;color:#6B665E;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">${esc(anuncio.texto)}</p>` : ''}
        ${anuncio.linkUrl ? `</a>` : ''}
      </div>
    </td></tr>` : ''}

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
            <div style="margin-top:8px;font-size:10.5px;color:#B5B0A8;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
              &#x1F4CA;&nbsp; Sua curadoria &eacute; personalizada com base nos artigos que voc&ecirc; explora.
            </div>
            ${streakLineHtml}

            <!-- Disclaimer jurídico -->
            <div style="margin-top:18px;padding-top:14px;border-top:1px solid #E0D8CC;">
              <p style="margin:0;font-size:10px;color:#B5B0A8;line-height:1.75;
                        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
                O OdontoFeed tem como objetivo facilitar a atualiza&ccedil;&atilde;o cient&iacute;fica do
                cirurgi&atilde;o-dentista por meio de curadoria editorial de artigos recentes indexados em
                bases cient&iacute;ficas. As s&iacute;nteses s&atilde;o geradas por intelig&ecirc;ncia
                artificial com valida&ccedil;&atilde;o automatizada e podem conter imprecis&otilde;es;
                elas n&atilde;o substituem a leitura
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

module.exports = { buildDigestEmail, achadoSemanaCard, emailHash, trackClick, resolveArticleUrl };
