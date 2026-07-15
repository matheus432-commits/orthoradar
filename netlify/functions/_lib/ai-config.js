// Configuração central do modelo Anthropic usado por todas as features de IA.
//
// Precedência (do mais específico para o mais geral):
//   1. Env var específica da feature (ex.: EDITORIAL_MODEL, ACHADO_MODEL,
//      ENRICH_MODEL, CLINICAL_MODEL) — permite usar um modelo diferente por uso.
//   2. ANTHROPIC_MODEL — modelo global para todas as features.
//   3. DEFAULT_MODEL — padrão do projeto: Claude Haiku 4.5 (barato).
//
// PADRÃO = Haiku 4.5 para conter custo (o pipeline enriquece ~20 artigos/dia).
// Para usar o Fable 5 (bem mais caro), configure ANTHROPIC_MODEL=claude-fable-5
// (global) ou a env de uma feature específica, ex. EDITORIAL_MODEL=claude-fable-5
// só no editorial que o usuário lê.

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function resolveModel(featureVar) {
  return (featureVar && process.env[featureVar]) || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

module.exports = { resolveModel, DEFAULT_MODEL };
