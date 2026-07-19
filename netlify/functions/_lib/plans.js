// Fonte única de verdade dos planos de assinatura do OdontoFeed.
//
// Modelo (diretriz 07/2026): o Gratuito entrega TODO o conteúdo (email,
// resumos completos no site, podcast diário em áudio, painel) apoiado por
// publicidade contextual. O Premium não entrega mais artigos — entrega mais
// INTELIGÊNCIA: biblioteca pessoal, preferências por tema com curadoria
// individual, a assistente Wakai (fair use por orçamento de tokens/dia),
// revisão inteligente e comparação de estudos. Sem publicidade.

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
      wakai:             true,   // limite de uso justo: WAKAI_DAILY_TOKEN_LIMIT
      revisaoInteligente: true,
      comparacaoEstudos: true,
      semPublicidade:    true,
    },
  },
};

const DEFAULT_PLAN = 'gratuito';

// Plano com que um NOVO cadastro entra. Período de cortesia (19/07/2026): todos
// os cadastros entram como PREMIUM até a forma de pagamento estar configurada —
// depois o fundador pede o downgrade geral e quem quiser paga para subir.
// Reversível sem deploy pela env SIGNUP_PLAN ('gratuito' encerra a cortesia).
function signupPlan() {
  return normalizePlan(process.env.SIGNUP_PLAN || 'premium');
}

// Fair use da Wakai: orçamento de TOKENS/dia por assinante Premium (entrada +
// saída somados). Limitar por tokens — e não por número de perguntas — casa o
// teto com o custo real da API: perguntas com contexto grande ou respostas
// longas consomem mais orçamento.
// Dimensionamento: preço cheio do Sonnet 5 (US$ 3/1M entrada, US$ 15/1M saída)
// dá custo médio ponderado ~US$ 6,4/1M tokens. Teto de 16k tok/dia → ~480k
// tok/mês → ~US$ 3,1 (~R$ 18) no PIOR caso de uso pesado, mantendo a Wakai
// dentro da margem dos R$ 59,90. ~5-6 perguntas típicas/dia. Ajustável por env
// WAKAI_DAILY_TOKEN_LIMIT.
const WAKAI_DAILY_TOKEN_LIMIT = 16000;

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

module.exports = { PLANS, DEFAULT_PLAN, signupPlan, WAKAI_DAILY_TOKEN_LIMIT, normalizePlan, isPremium, isPro, featuresOf };
