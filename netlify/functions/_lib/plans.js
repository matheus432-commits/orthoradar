// Fonte única de verdade dos planos de assinatura do OdontoFeed.
// Usado por register (plano padrão), pela geração de podcast (só especialidades
// com assinante Pro) e pelo gate Pro (get-podcast).

const PLANS = {
  basico: {
    id:            'basico',
    nome:          'Básico',
    precoMensal:   47,        // R$/mês
    precoCentavos: 4700,      // para gateways de pagamento
    features: {
      digestDiario:   true,   // 3 artigos/dia por email
      dashboard:      true,
      podcastDiario:  false,  // ← exclusivo do Pro
    },
  },
  pro: {
    id:            'pro',
    nome:          'Pro',
    precoMensal:   97,
    precoCentavos: 9700,
    features: {
      digestDiario:   true,
      dashboard:      true,
      podcastDiario:  true,   // 1 podcast/dia da especialidade do dentista
    },
  },
};

const DEFAULT_PLAN = 'basico';

// Normaliza qualquer valor para um id de plano válido (default: basico).
function normalizePlan(plano) {
  const p = String(plano || '').trim().toLowerCase();
  return PLANS[p] ? p : DEFAULT_PLAN;
}

// Aceita o id do plano OU o objeto do usuário (com .plano). Retorna boolean.
function isPro(userOrPlan) {
  const plano = (userOrPlan && typeof userOrPlan === 'object') ? userOrPlan.plano : userOrPlan;
  return normalizePlan(plano) === 'pro';
}

// Retorna as features do plano do usuário (sempre um objeto válido).
function featuresOf(userOrPlan) {
  const plano = (userOrPlan && typeof userOrPlan === 'object') ? userOrPlan.plano : userOrPlan;
  return PLANS[normalizePlan(plano)].features;
}

module.exports = { PLANS, DEFAULT_PLAN, normalizePlan, isPro, featuresOf };
