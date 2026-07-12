// Configuração central do modelo Anthropic usado por todas as features de IA.
//
// Precedência (do mais específico para o mais geral):
//   1. Env var específica da feature (ex.: EDITORIAL_MODEL, ACHADO_MODEL,
//      ENRICH_MODEL, CLINICAL_MODEL) — permite usar um modelo diferente por uso.
//   2. ANTHROPIC_MODEL — modelo global para todas as features.
//   3. DEFAULT_MODEL — padrão do projeto: Claude Fable 5.
//
// Para usar o Fable 5 em tudo, basta NÃO configurar nada (é o padrão) ou
// definir ANTHROPIC_MODEL=claude-fable-5. Para baratear uma feature específica
// (ex.: enriquecimento em massa), defina a env var daquela feature.

const DEFAULT_MODEL = 'claude-fable-5';

function resolveModel(featureVar) {
  return (featureVar && process.env[featureVar]) || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

module.exports = { resolveModel, DEFAULT_MODEL };
