// Pre-send digest validation gate.
// validateDigest() must return { valid: true } before any email is sent.
// If valid === false the caller MUST NOT send — log and abort.

const log = require('./logger');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HIGH_EVIDENCE = new Set(['Meta-análise', 'Revisão Sistemática', 'RCT']);

const GENERIC_RESUMO_RE = [
  /^resumo\s+n[ãa]o\s+dispon[íi]vel/i,
  /^sem\s+resumo/i,
  /^no\s+abstract\s+available/i,
  /^abstract\s+(not\s+)?available/i,
  /^not\s+available/i,
  /^n\/a$/i,
];

const MIN_ARTICLES    = 3;
const MAX_ARTICLES    = 5;
const MIN_RESUMO_LEN  = 50;
const EDITORIAL_COVERAGE_THRESHOLD = 0.5; // warn if < 50% of articles referenced

// ── Core validator ────────────────────────────────────────────────────────────

/**
 * Validates a digest before sending.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateDigest({ user, articles, editorial, html }) {
  const errors   = [];
  const warnings = [];

  // ── USER ──────────────────────────────────────────────────────────────────
  if (!user?.email || !EMAIL_RE.test(user.email)) {
    errors.push(`USER: invalid or missing email ("${user?.email ?? ''}")`);
  }

  const userSpecs = Array.isArray(user?.especialidades) && user.especialidades.length > 0
    ? user.especialidades
    : user?.especialidade ? [user.especialidade] : [];

  if (userSpecs.length === 0) {
    errors.push(`USER: no specialty configured`);
  }

  // ── STRUCTURE — count ─────────────────────────────────────────────────────
  if (!Array.isArray(articles) || articles.length < MIN_ARTICLES) {
    errors.push(`STRUCTURE: ${articles?.length ?? 0} articles — minimum is ${MIN_ARTICLES}`);
  }
  if (Array.isArray(articles) && articles.length > MAX_ARTICLES) {
    errors.push(`STRUCTURE: ${articles.length} articles — maximum is ${MAX_ARTICLES}`);
  }

  // ── STRUCTURE — per article ───────────────────────────────────────────────
  const seenPmids = new Set();

  for (let i = 0; i < (articles?.length ?? 0); i++) {
    const a   = articles[i];
    const tag = `ART[${i}]`;

    if (!a || typeof a !== 'object') {
      errors.push(`${tag}: article is null or not an object`);
      continue;
    }

    // Identity
    const pid = String(a.pmid || a.id || '').trim();
    if (!pid) {
      errors.push(`${tag}: missing PMID/ID`);
    } else if (seenPmids.has(pid)) {
      errors.push(`${tag}: duplicate PMID/ID "${pid}"`);
    } else {
      seenPmids.add(pid);
    }

    // Title
    const title = String(a.titulo_pt || a.titulo || '').trim();
    if (!title) errors.push(`${tag}: missing title (titulo_pt/titulo)`);

    // Resumo — presence + length + generic pattern
    const resumo = String(a.resumo_pt || a.abstract || '').trim();
    if (!resumo || resumo.length < MIN_RESUMO_LEN) {
      errors.push(`${tag}: resumo too short (${resumo.length} chars, min ${MIN_RESUMO_LEN})`);
    } else if (GENERIC_RESUMO_RE.some(p => p.test(resumo))) {
      errors.push(`${tag}: resumo matches generic/empty pattern`);
    }

    // Evidence level
    if (!a.nivel_evidencia) {
      errors.push(`${tag}: missing nivel_evidencia`);
    }

    // Journal
    if (!a.journal) errors.push(`${tag}: missing journal`);

    // Specialty
    if (!a.especialidade) errors.push(`${tag}: missing especialidade`);

    // Clinical relevance — warn only (fallback paths may not have this)
    if (!a.impacto_pratico) {
      warnings.push(`${tag}: missing impacto_pratico (clinical relevance)`);
    }
  }

  // ── CONSISTENCY ───────────────────────────────────────────────────────────
  if (Array.isArray(articles) && articles.length >= MIN_ARTICLES) {

    // All articles must belong to at least one of the user's specialties
    if (userSpecs.length > 0) {
      const userSpecsLower = userSpecs.map(s => s.toLowerCase());
      const wrongSpec = articles.filter(a => {
        const aSpec = String(a?.especialidade || '').toLowerCase().trim();
        return aSpec && !userSpecsLower.includes(aSpec);
      });
      if (wrongSpec.length === articles.length) {
        errors.push(
          `CONSISTENCY: ALL ${articles.length} articles have wrong specialty` +
          ` (user specialties: ${userSpecs.join(', ')};` +
          ` article specialties: ${[...new Set(wrongSpec.map(a => a.especialidade))].join(', ')})`
        );
      } else if (wrongSpec.length > 0) {
        warnings.push(
          `CONSISTENCY: ${wrongSpec.length}/${articles.length} articles have a different specialty from user`
        );
      }
    }

    // Duplicate titles
    const titlesLower = articles.map(a => String(a?.titulo_pt || a?.titulo || '').toLowerCase().trim());
    const dupTitle = titlesLower.find((t, i) => t.length > 10 && titlesLower.indexOf(t) !== i);
    if (dupTitle) {
      errors.push(`CONSISTENCY: duplicate article title detected`);
    }
  }

  // ── QUALITY ───────────────────────────────────────────────────────────────
  if (Array.isArray(articles) && articles.length > 0) {
    const hasHighEvidence = articles.some(a => HIGH_EVIDENCE.has(a?.nivel_evidencia));
    if (!hasHighEvidence) {
      warnings.push(`QUALITY: no high-evidence study (Meta-análise / Revisão Sistemática / RCT) in digest`);
    }
  }

  // ── EDITORIAL ─────────────────────────────────────────────────────────────
  if (editorial && typeof editorial === 'string') {
    const editLower = editorial.toLowerCase();

    if (editorial.length < 80) {
      warnings.push(`EDITORIAL: very short (${editorial.length} chars)`);
    }

    if (Array.isArray(articles) && articles.length > 0) {
      let covered = 0;
      for (const a of articles) {
        const words = [
          ...String(a?.titulo_pt || a?.titulo || '').split(/\s+/),
          ...String(a?.tema || '').split(/\s+/),
        ].filter(w => w.length > 5);

        if (words.some(w => editLower.includes(w.toLowerCase()))) covered++;
      }
      const pct = covered / articles.length;
      if (pct < EDITORIAL_COVERAGE_THRESHOLD) {
        warnings.push(
          `EDITORIAL: low article coverage — ${Math.round(pct * 100)}%` +
          ` (${covered}/${articles.length} articles referenced)`
        );
      }
    }
  }

  // ── HTML / RENDER ─────────────────────────────────────────────────────────
  if (!html || typeof html !== 'string' || !html.trim()) {
    errors.push(`RENDER: HTML is missing or empty`);
  } else {
    if (!/<html[\s>]/i.test(html)) errors.push(`RENDER: missing <html> tag`);
    if (!html.includes('unsubscribe'))  errors.push(`RENDER: unsubscribe link missing from HTML`);
    if (!html.includes('track-open'))   warnings.push(`RENDER: open tracking pixel missing`);
    if (!html.includes('track-click'))  warnings.push(`RENDER: click tracking missing`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Logging wrapper ───────────────────────────────────────────────────────────

/**
 * Runs validateDigest, emits structured logs, and returns true if safe to send.
 * Returns false if the digest MUST be blocked.
 */
function runValidation(context, digestId) {
  const { valid, errors, warnings } = validateDigest(context);

  const meta = {
    digestId,
    email:     context.user?.email,
    specialty: (context.user?.especialidades ?? [context.user?.especialidade]).filter(Boolean).join(', ') || '(none)',
    articles:  context.articles?.length ?? 0,
  };

  if (warnings.length > 0) {
    log.warn('[DigestValidation] warnings', { ...meta, warnings });
  }

  if (!valid) {
    log.error('[DigestValidation] BLOCKED — digest will NOT be sent', { ...meta, errors });
    return false;
  }

  log.info('[DigestValidation] PASS', meta);
  return true;
}

module.exports = { validateDigest, runValidation };
