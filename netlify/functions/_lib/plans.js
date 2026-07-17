// Fonte única de verdade dos planos de assinatura do OdontoFeed.
//
// Modelo (diretriz 07/2026): o Gratuito entrega TODO o conteúdo (email,
// resumos completos no site, podcast diário em áudio, painel) apoiado por
// publicidade contextual. O Premium não entrega mais artigos — entrega mais
// INTELIGÊNCIA: biblioteca pessoal, preferências por tema com curadoria
// individual, a assistente Wakai (fair use 30 perguntas/dia), revisão
// inteligente e comparação de estudos. Sem publicidade.

const PLANS = {
  gratuito: {
    id:            'gratuito',
    nome:          'Gratuito',
    precoMensal:   0,
    precoCentavos: 0,
    features: {
      digestDiario:      true,   // 3 artigos/dia por email
      resumoCompleto:    true,   // resumo detalhado no site
      podcastDiario:     true,   // 3 áudios/dia da especialidade — para TODOS
      dashboard:         true,
      biblioteca:        false,  // salvar/coleções/notas/busca
      preferenciasTema:  false,  // curadoria individual por temas
      wakai:             false,  // assistente de IA pessoal
      revisaoInteligente: false,
      comparacaoEstudos: false,
      semPublicidade:    false,  // Gratuito exibe publicidade contextual
    },
  },
  premium: {
    id:            'premium',
    nome:          'Premium',
    precoMensal:   59.90,
    precoCentavos: 5990,
    features: {
      digestDiario:      true,
      resumoCompleto:    true,
      podcastDiario:     true,
      dashboard:         true,
      biblioteca:        true,
      preferenciasTema:  true,
      wakai:             true,   // limite de uso justo: WAKAI_DAILY_LIMIT
      revisaoInteligente: true,
      comparacaoEstudos: true,
      semPublicidade:    true,
    },
  },
};

const DEFAULT_PLAN = 'gratuito';

// Fair use da Wakai (perguntas/dia por assinante Premium)
const WAKAI_DAILY_LIMIT = 30;

// Planos legados de antes da diretriz atual — nunca houve contratação paga,
// então qualquer valor antigo ('basico'/'pro') é normalizado com generosidade:
// 'pro' herda premium; o resto cai no gratuito.
function normalizePlan(plano) {
  const p = String(plano || '').trim().toLowerCase();
  if (PLANS[p]) return p;
  if (p === 'pro') return 'premium';
  return DEFAULT_PLAN;
}

function isPremium(userOrPlan) {
  const plano = (userOrPlan && typeof userOrPlan === 'object') ? userOrPlan.plano : userOrPlan;
  return normalizePlan(plano) === 'premium';
}

// Compat: código antigo pergunta isPro — hoje equivale a Premium.
const isPro = isPremium;

// Retorna as features do plano do usuário (sempre um objeto válido).
function featuresOf(userOrPlan) {
  const plano = (userOrPlan && typeof userOrPlan === 'object') ? userOrPlan.plano : userOrPlan;
  return PLANS[normalizePlan(plano)].features;
}

module.exports = { PLANS, DEFAULT_PLAN, WAKAI_DAILY_LIMIT, normalizePlan, isPremium, isPro, featuresOf };
