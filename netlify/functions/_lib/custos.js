// Motor do dashboard de custos — transforma os CONTADORES REAIS do produto
// (tts_usage, digest_runs, instagram_posts/reels, reel_cenas, cadastros) em
// custo mensal estimado, aplicando as tabelas de preço dos fornecedores.
//
// Filosofia: medir o que dá para medir (TTS por caractere, e-mails enviados,
// imagens geradas) e rotular claramente o que é ESTIMATIVA de faixa (Anthropic
// API, Firebase). Preços em USD; conversão por BRL_FX (default 5.50).

const FX = parseFloat(process.env.BRL_FX || '5.5');

// ── Tabelas de preço (USD) ───────────────────────────────────────────────────
const PRICE = {
  // Google Cloud TTS — voz Chirp3-HD: 1M chars grátis/mês, depois US$30/1M.
  // (Fallback Neural2 seria US$16/1M — usamos o teto Chirp, conservador.)
  ttsFreeChars: 1_000_000,
  ttsPerMillion: 30,
  // Resend: 3.000 e-mails/mês grátis; acima disso, plano Pro US$20 (até 50k).
  resendFreeEmails: 3000,
  resendProUsd: 20,
  resendProLimit: 50000,
  // Imagen (Vertex): ~US$0.04/imagem gerada (cache evita regeneração).
  imagenPerImage: 0.04,
  // Domínio: ~US$15/ano.
  domainMonthly: 15 / 12,
  // Anthropic API (produto): faixa estimada — enriquecimento tem trava de
  // US$0.50/dia no código; resumos/roteiros/editorial/Wakai são Sonnet em
  // volume pequeno. Não medido diretamente → rotulado como estimativa.
  anthropicMinUsd: 30,
  anthropicMaxUsd: 50,
  // Firebase (Firestore+Storage): base pequena, quase tudo no free tier.
  firebaseMinUsd: 0,
  firebaseMaxUsd: 6,
};

const brl = (usd) => Math.round(usd * FX * 100) / 100;

// TTS: custo do mês a partir dos caracteres consumidos (contados em tts_usage).
function ttsCostUsd(chars) {
  const paid = Math.max(0, (Number(chars) || 0) - PRICE.ttsFreeChars);
  return (paid / 1_000_000) * PRICE.ttsPerMillion;
}

// Resend: 0 até o free tier; acima, o plano Pro fixo.
function resendCostUsd(emails) {
  const n = Number(emails) || 0;
  if (n <= PRICE.resendFreeEmails) return 0;
  return PRICE.resendProUsd; // até 50k — muito acima do nosso volume
}

function imagenCostUsd(newImages) {
  return (Number(newImages) || 0) * PRICE.imagenPerImage;
}

// Monta o payload completo do dashboard a partir das métricas coletadas.
// metrics: { month, ttsChars, ttsBudgetChars, emailsSent, igPosts, igReels,
//            imagensNovasMes, cacheCenas, usuariosAtivos, diasNoMes, diaAtual }
function buildCustos(m) {
  const tts = ttsCostUsd(m.ttsChars);
  // Projeção do TTS até o fim do mês (ritmo atual), limitada ao teto do budget.
  const ritmo = m.diaAtual > 0 ? (m.ttsChars / m.diaAtual) : 0;
  const projChars = Math.min(m.ttsBudgetChars || Infinity, Math.round(ritmo * m.diasNoMes));
  const ttsProj = ttsCostUsd(projChars);

  const resend = resendCostUsd(m.emailsSent);
  const imagen = imagenCostUsd(m.imagensNovasMes);

  const items = [
    {
      id: 'tts', nome: 'Google TTS (narração dos podcasts)', tipo: 'medido',
      detalhe: `${(m.ttsChars / 1e6).toFixed(2)}M de ${(m.ttsBudgetChars / 1e6).toFixed(1)}M chars do teto`,
      usoPct: m.ttsBudgetChars ? Math.round((m.ttsChars / m.ttsBudgetChars) * 100) : 0,
      mesAtualUsd: tts, projecaoUsd: ttsProj,
    },
    {
      id: 'anthropic', nome: 'Anthropic API (resumos, roteiros, Wakai)', tipo: 'estimado',
      detalhe: 'Enriquecimento travado em US$0,50/dia no código',
      minUsd: PRICE.anthropicMinUsd, maxUsd: PRICE.anthropicMaxUsd,
    },
    {
      id: 'resend', nome: 'Resend (e-mails)', tipo: 'medido',
      detalhe: `${m.emailsSent} e-mails no mês (grátis até ${PRICE.resendFreeEmails})`,
      mesAtualUsd: resend, projecaoUsd: resend,
    },
    {
      id: 'imagen', nome: 'Imagen (ilustrações dos Reels)', tipo: 'medido',
      detalhe: `${m.imagensNovasMes} novas no mês · cache com ${m.cacheCenas} cenas`,
      mesAtualUsd: imagen, projecaoUsd: imagen * (m.diaAtual > 0 ? m.diasNoMes / m.diaAtual : 1),
    },
    {
      id: 'firebase', nome: 'Firebase (banco + arquivos)', tipo: 'estimado',
      detalhe: 'Base pequena — majoritariamente no nível gratuito',
      minUsd: PRICE.firebaseMinUsd, maxUsd: PRICE.firebaseMaxUsd,
    },
    {
      id: 'dominio', nome: 'Domínio odontofeed.com', tipo: 'fixo',
      detalhe: '~US$15/ano', mesAtualUsd: PRICE.domainMonthly, projecaoUsd: PRICE.domainMonthly,
    },
    {
      id: 'gratis', nome: 'Netlify · GitHub · Meta · Spotify · PubMed/EPMC/OpenAlex', tipo: 'fixo',
      detalhe: 'Todos no nível gratuito', mesAtualUsd: 0, projecaoUsd: 0,
    },
  ];

  // Totais: mês corrente (mín/máx pelos itens estimados) e projeção fim-do-mês.
  const medidoAtual = tts + resend + imagen + PRICE.domainMonthly;
  const medidoProj  = ttsProj + resend + items[3].projecaoUsd + PRICE.domainMonthly;
  const minExtra = PRICE.anthropicMinUsd + PRICE.firebaseMinUsd;
  const maxExtra = PRICE.anthropicMaxUsd + PRICE.firebaseMaxUsd;

  const totais = {
    mesAtualMinUsd: medidoAtual + (minExtra * (m.diaAtual / m.diasNoMes)),
    mesAtualMaxUsd: medidoAtual + (maxExtra * (m.diaAtual / m.diasNoMes)),
    projecaoMinUsd: medidoProj + minExtra,
    projecaoMaxUsd: medidoProj + maxExtra,
  };
  for (const k of Object.keys(totais)) totais[k] = Math.round(totais[k] * 100) / 100;

  const porUsuario = m.usuariosAtivos > 0
    ? { min: brl(totais.projecaoMinUsd / m.usuariosAtivos), max: brl(totais.projecaoMaxUsd / m.usuariosAtivos) }
    : null;

  return {
    month: m.month, fx: FX, geradoEm: new Date().toISOString(),
    usuariosAtivos: m.usuariosAtivos,
    igPosts: m.igPosts, igReels: m.igReels,
    items: items.map(i => ({
      ...i,
      mesAtualBrl:  i.mesAtualUsd  != null ? brl(i.mesAtualUsd)  : undefined,
      projecaoBrl:  i.projecaoUsd  != null ? brl(i.projecaoUsd)  : undefined,
      minBrl:       i.minUsd       != null ? brl(i.minUsd)       : undefined,
      maxBrl:       i.maxUsd       != null ? brl(i.maxUsd)       : undefined,
    })),
    totais: {
      ...totais,
      mesAtualMinBrl: brl(totais.mesAtualMinUsd), mesAtualMaxBrl: brl(totais.mesAtualMaxUsd),
      projecaoMinBrl: brl(totais.projecaoMinUsd), projecaoMaxBrl: brl(totais.projecaoMaxUsd),
    },
    porUsuarioBrl: porUsuario,
  };
}

module.exports = { buildCustos, ttsCostUsd, resendCostUsd, imagenCostUsd, PRICE, _brl: brl };
