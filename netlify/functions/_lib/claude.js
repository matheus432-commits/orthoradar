// Claude Haiku API client for article enrichment.
// Uses raw HTTPS via _lib.js (no npm dependency).

const { request } = require('../_lib');
const log = require('./logger');
const { resolveModel } = require('./ai-config');
const { extractAnthropicText } = require('./anthropic-text');

const HOST          = 'api.anthropic.com';
const MODEL         = resolveModel('ENRICH_MODEL');
const MAX_TOKENS    = 1024;
// Cost guard: stop enriching if accumulated cost exceeds this per run
const MAX_COST_USD  = 0.50;
// Approximate token prices (USD per 1M tokens)
const PRICE_INPUT   = 0.25;
const PRICE_OUTPUT  = 1.25;

// Dental specialty names in Portuguese, used to build context
const EVIDENCE_LEVELS = [
  'Meta-análise', 'Revisão Sistemática', 'RCT', 'Estudo Coorte',
  'Caso Clínico', 'Revisão Narrativa', 'In Vitro', 'Estudo Animal',
];

// Especialidades canônicas do cadastro — a classificação SEMPRE usa esta lista.
// 'Outra' vira 'Odontologia Geral' (nunca entra em digest de especialidade).
const CANONICAL_ESPECIALIDADES = [
  'Ortodontia', 'Implantodontia', 'Periodontia', 'Dentística',
  'Bucomaxilofacial', 'Prótese', 'Endodontia', 'Odontopediatria',
  'DTM e Dor Orofacial', 'Radiologia', 'Estomatologia',
];

// Guia de escopo + regras de desempate usado em TODA classificação (enriquecimento
// e reclassificação em massa). Erros reais que este guia corrige: artigo sobre
// coroa em dente decíduo indo para Prótese; restauração direta substituindo
// amálgama indo para Prótese em vez de Dentística.
const ESPECIALIDADE_GUIDE =
  'ESCOPO DE CADA ESPECIALIDADE:\n' +
  '- Odontopediatria: QUALQUER artigo cuja população/objeto seja dentes decíduos (deciduous/primary teeth/dentition) ou pacientes infantis — mesmo que o procedimento seja coroa, restauração, pulpotomia/pulpectomia, trauma ou prevenção. População pediátrica/decídua SEMPRE prevalece sobre o procedimento.\n' +
  '- Dentística: restaurações DIRETAS em dentes permanentes (resina composta, amálgama e sua substituição, ionômero de vidro), adesão/sistemas adesivos, clareamento, manejo restaurador de cárie e lesões não cariosas. Substituir amálgama por resina é Dentística, NUNCA Prótese.\n' +
  '- Prótese: reabilitação INDIRETA em adultos — coroas e facetas indiretas, inlay/onlay, prótese parcial fixa/removível, prótese total, componente protético sobre implante, materiais cerâmicos/zircônia PARA prótese indireta, oclusão protética.\n' +
  '- Implantodontia: cirurgia de implante, osseointegração, peri-implantite, enxertos e regeneração óssea (a fase protética sobre implante é Prótese).\n' +
  '- Endodontia: tratamento de canal em dentes PERMANENTES, retratamento, irrigação, medicação intracanal, cirurgia parendodôntica (pulpoterapia em decíduo é Odontopediatria).\n' +
  '- Periodontia: doença periodontal, gengivite, raspagem, cirurgia periodontal, tecidos moles ao redor de DENTES.\n' +
  '- Ortodontia: má oclusão, aparelhos, alinhadores, biomecânica, cefalometria, ancoragem.\n' +
  '- Bucomaxilofacial: extrações, cirurgia ortognática, trauma facial, patologia cirúrgica, ATM cirúrgica.\n' +
  '- DTM e Dor Orofacial: disfunção temporomandibular, bruxismo, dor orofacial não cirúrgica, apneia do sono.\n' +
  '- Radiologia: quando o FOCO é o método de imagem em si (CBCT, IA diagnóstica em imagem, protocolos de aquisição) — não o uso incidental de radiografia.\n' +
  '- Estomatologia: lesões da mucosa oral, câncer bucal, medicina oral, manifestações orais de doenças sistêmicas.\n' +
  'REGRAS DE DESEMPATE (aplicar nesta ordem):\n' +
  '1. População decídua/pediátrica → Odontopediatria, sem exceção.\n' +
  '2. Restauração direta (resina/amálgama/ionômero) → Dentística; indireta em adulto → Prótese.\n' +
  '3. Implante: fase cirúrgica/biológica → Implantodontia; fase protética → Prótese.\n' +
  '4. O que decide é o FOCO CLÍNICO PRINCIPAL do estudo, não palavras isoladas.\n';

function buildPrompt(article) {
  // 1500 chars de contexto: com 400 a parte do abstract que revela a população
  // (ex.: "primary molars in children") ficava de fora e a classificação errava.
  const abstract = (article.abstract || '').slice(0, 1500);
  return (
    'Você é um editor científico especializado em Odontologia, escrevendo para dentistas brasileiros.\n' +
    'Dado o artigo abaixo, produza conteúdo ORIGINAL em português brasileiro para uma newsletter profissional.\n' +
    'REGRA EDITORIAL DE DIREITO AUTORAL (obrigatória, ver docs/REGRAS-EDITORIAIS.md):\n' +
    'o abstract é apenas CONTEXTO — é PROIBIDO reproduzi-lo, parafraseá-lo frase a frase\n' +
    'ou traduzi-lo literalmente (isso criaria obra derivada sem licença). Extraia os FATOS\n' +
    'e ACHADOS (não protegidos por direito autoral) e escreva texto analítico e prático\n' +
    'inteiramente com suas próprias palavras e estrutura.\n' +
    'QUALIDADE DE LINGUAGEM (obrigatória): use a terminologia odontológica consagrada no Brasil — ' +
    '"deciduous/primary teeth"→"dentes decíduos", "root canal treatment"→"tratamento endodôntico", ' +
    '"resin-based composite"→"resina composta", "survival rate"→"taxa de sobrevivência", ' +
    '"prosthodontist"→"protesista" (NUNCA "prostodontista"), "general dentist"→"clínico geral", ' +
    '"randomized clinical trial"→"ensaio clínico randomizado". Nada de tradução literal palavra a palavra, ' +
    'anglicismos desnecessários ou frases que soem traduzidas; o texto deve ler como escrito por um ' +
    'professor brasileiro da área. Siglas: mantenha as consagradas (CBCT, RCT explicada) e traduza o resto.\n\n' +
    ESPECIALIDADE_GUIDE + '\n' +
    `TÍTULO (inglês): ${article.titulo || article.title || ''}\n` +
    `CONTEXTO ABSTRACT (inglês, uso interno): ${abstract}\n` +
    `RÓTULO DE ORIGEM (veio da BUSCA e é FREQUENTEMENTE errado — não confie nele): ${article.especialidade || ''}\n` +
    `PERIÓDICO: ${article.journal || ''}\n` +
    `ANO: ${article.year || ''}\n\n` +
    'Responda APENAS com JSON válido (sem markdown, sem código fence):\n' +
    '{\n' +
    '  "titulo_pt": "Título adaptado em português (máx 120 chars), terminologia brasileira correta",\n' +
    '  "resumo_pt": "Resumo transformativo original em PT (150-250 palavras). Comece pelo problema clínico. Descreva metodologia brevemente. Foque em achados práticos. Tom: colega explicando a colega. OBRIGATÓRIO: quando o estudo COMPARA grupos, técnicas ou materiais, feche com o VEREDITO — diga qual grupo se saiu MELHOR e qual foi PIOR (a direção do resultado), não apenas que \'houve diferença\'. Se o material só disser que houve diferença sem indicar o vencedor, diga isso explicitamente; nunca invente a direção.",\n' +
    '  "impacto_pratico": "1-2 frases: o que este estudo muda (ou confirma) na prática clínica",\n' +
    '  "achados_principais": ["achado 1", "achado 2", "achado 3"] (cada achado CONCRETO e com direção: em comparações, diga qual grupo foi melhor/pior, não apenas que houve diferença),\n' +
    `  "nivel_evidencia": "um de: ${EVIDENCE_LEVELS.join(' | ')}",\n` +
    '  "limitacoes": "Principais limitações em 1 frase",\n' +
    '  "tempo_leitura": 3,\n' +
    '  "concluido": "true se o estudo JÁ FOI CONCLUÍDO e apresenta RESULTADOS/achados; false se for PROTOCOLO, registro de ensaio clínico, ou estudo em andamento que ainda NÃO tem resultados (ex.: título com \'protocol for a randomized trial\', abstract que diz \'we will recruit/assess\'). Na dúvida entre protocolo e estudo concluído, responda false.",\n' +
    `  "especialidade": "aplique o ESCOPO e as REGRAS DE DESEMPATE acima e classifique pelo FOCO CLÍNICO PRINCIPAL em UMA de: ${CANONICAL_ESPECIALIDADES.join(' | ')} | Outra. Use 'Outra' quando não se encaixar claramente."\n` +
    '}'
  );
}

// ── Cost tracker (per process lifetime) ──────────────────────────────────────

let _runCostUsd = 0;

function addCost(inputTokens, outputTokens) {
  _runCostUsd += (inputTokens / 1_000_000) * PRICE_INPUT +
                 (outputTokens / 1_000_000) * PRICE_OUTPUT;
}

function currentCost() { return _runCostUsd; }
function resetCost()    { _runCostUsd = 0; }

// Correções DETERMINÍSTICAS de terminologia BR — rede de segurança sobre a IA.
// Ex.: "prostodontista"→"protesista" (o termo consagrado no Brasil para o
// especialista em prótese). Preserva maiúscula inicial e plural.
function corrigirTermosBR(s) {
  if (!s) return s;
  const cap = (repl, m) => (m[0] === m[0].toUpperCase() ? repl[0].toUpperCase() + repl.slice(1) : repl);
  return String(s)
    .replace(/prostodontistas/gi, m => cap('protesistas', m))
    .replace(/prostodontista/gi,  m => cap('protesista', m));
}

// ── Core API call ─────────────────────────────────────────────────────────────

async function callClaude(prompt, attempt = 0, model = MODEL, maxTokens = MAX_TOKENS) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    messages:   [{ role: 'user', content: prompt }],
  });
  const buf = Buffer.from(body, 'utf8');

  const res = await request({
    hostname: HOST,
    path:     '/v1/messages',
    method:   'POST',
    headers:  {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
      'content-length':    buf.length,
    },
  }, buf);

  if (res.status === 429 || res.status === 529) {
    if (attempt < 3) {
      const delay = 2000 * Math.pow(2, attempt);
      log.warn('[claude] Rate limited, retrying', { attempt, delay_ms: delay });
      await new Promise(r => setTimeout(r, delay));
      return callClaude(prompt, attempt + 1, model);
    }
    throw new Error(`Claude rate limit after ${attempt} retries`);
  }

  if (res.status === 400) {
    // Log the specific error — often a malformed message
    log.error('[claude] 400 Bad Request', { body: res.body.slice(0, 400) });
    throw new Error(`Claude 400: ${res.body.slice(0, 200)}`);
  }

  if (res.status !== 200) {
    throw new Error(`Claude ${res.status}: ${res.body.slice(0, 200)}`);
  }

  const json = JSON.parse(res.body);
  // content[] pode ter blocos NÃO-textuais (raciocínio) antes do texto — junta
  // TODOS os blocos de texto (ver _lib/anthropic-text.js). Pegar content[0]
  // devolvia resumo/JSON VAZIO com a API já cobrada (incidente 24/07).
  const text = extractAnthropicText(json);
  const usage = json.usage || {};
  addCost(usage.input_tokens || 0, usage.output_tokens || 0);

  return { text, inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 };
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Enriches a raw article with Claude Haiku.
 * Returns enriched fields object, or null on failure.
 */
async function enrichArticle(article) {
  if (_runCostUsd >= MAX_COST_USD) {
    log.warn('[claude] Cost limit reached, skipping enrichment', { cost_usd: _runCostUsd.toFixed(4) });
    return null;
  }

  const prompt = buildPrompt(article);

  let raw;
  try {
    raw = await callClaude(prompt);
  } catch (err) {
    log.error('[claude] enrichArticle failed', { pmid: article.pmid, err: err.message });
    return null;
  }

  // Strip accidental markdown code fences
  let jsonStr = raw.text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let enriched;
  try {
    enriched = JSON.parse(jsonStr);
  } catch (parseErr) {
    log.error('[claude] JSON parse failed', {
      pmid:    article.pmid,
      preview: jsonStr.slice(0, 200),
      err:     parseErr.message,
    });
    return null;
  }

  log.debug('[claude] Enriched article', {
    pmid:          article.pmid,
    input_tokens:  raw.inputTokens,
    output_tokens: raw.outputTokens,
    cost_usd:      _runCostUsd.toFixed(4),
  });

  return {
    titulo_pt:         corrigirTermosBR(String(enriched.titulo_pt || '').slice(0, 200)),
    resumo_pt:         corrigirTermosBR(String(enriched.resumo_pt  || '').slice(0, 2000)),
    impacto_pratico:   corrigirTermosBR(String(enriched.impacto_pratico || '').slice(0, 500)),
    achados_principais: Array.isArray(enriched.achados_principais) ? enriched.achados_principais.slice(0, 5).map(x => corrigirTermosBR(String(x))) : [],
    nivel_evidencia:   EVIDENCE_LEVELS.includes(enriched.nivel_evidencia) ? enriched.nivel_evidencia : 'Revisão Narrativa',
    limitacoes:        corrigirTermosBR(String(enriched.limitacoes || '').slice(0, 500)),
    tempo_leitura:     Number.isInteger(enriched.tempo_leitura) ? enriched.tempo_leitura : 3,
    // concluido: "concluído, a menos que a IA diga explicitamente false" — se o
    // campo vier ausente, NÃO rejeitamos por aqui (evita perder artigos bons);
    // o detector determinístico (isUnfinishedStudy) pega os protocolos óbvios.
    concluido:         !(enriched.concluido === false || String(enriched.concluido).toLowerCase() === 'false'),
    // 'Odontologia Geral' (para 'Outra'/inválida) nunca casa com digest de especialidade
    especialidade:     CANONICAL_ESPECIALIDADES.includes(enriched.especialidade)
      ? enriched.especialidade
      : (enriched.especialidade ? 'Odontologia Geral' : null),
  };
}

// ── Resumo completo (site) ────────────────────────────────────────────────────
// Resumo detalhado (~350-450 palavras) exibido na /edicao.html pelo botão
// "Ler o resumo". Diretriz 19/07/2026 (v2, pedido do fundador): PROSA FLUIDA —
// sem títulos de seção nem tópicos — mas cobrindo obrigatoriamente as mesmas
// 4 dimensões do podcast: objetivo, materiais e métodos, resultados e
// relevância clínica. Muitos dentistas não têm acesso ao artigo completo; o
// resumo escrito precisa se sustentar sozinho. É texto para LEITURA (não o
// roteiro do áudio). Gerado com SONNET (fidelidade factual maior que o Haiku)
// + validador numérico determinístico — nenhum número que não exista na origem
// passa. Uma retentativa em caso de reprovação; persistindo, retorna null
// (a página cai no resumo curto — nunca publica número não verificado).

const RESUMO_COMPLETO_MODEL = process.env.RESUMO_COMPLETO_MODEL || 'claude-sonnet-5';
const { numbersConsistent } = require('./numeric-check');

// As 4 dimensões obrigatórias (mesmas do podcast). Alimentam o prompt, o
// detector abaixo e a renderização de compatibilidade (e-mail/site).
const RESUMO_SECOES = ['Objetivo', 'Materiais e métodos', 'Resultados', 'Relevância clínica'];

// True quando o texto está no formato COM TÍTULOS de seção (janela curta de
// 19/07 antes da v2). O formato vigente é prosa fluida — o digest usa este
// detector para regenerar os resumos com títulos; prosa retorna false e fica.
function isResumoEstruturado(texto) {
  const t = String(texto || '');
  return RESUMO_SECOES.every(s =>
    new RegExp('(^|\\n)\\s*' + s.replace(/[áàâãéêíóôõúç]/gi, '.') + '\\s*:?\\s*(\\n|$)', 'i').test(t));
}

function buildResumoCompletoPrompt(article, strictNote) {
  const abstract = (article.abstract || '').slice(0, 2500);
  return (
    'Você é um editor científico especializado em Odontologia escrevendo para dentistas brasileiros.\n' +
    'Escreva o RESUMO COMPLETO do estudo abaixo em português (350 a 450 palavras), em PROSA FLUIDA: ' +
    'parágrafos corridos, SEM títulos de seção, SEM tópicos e SEM marcadores.\n' +
    'O texto deve obrigatoriamente cobrir, de forma integrada e nesta ordem:\n' +
    '1) o problema clínico e o OBJETIVO do estudo;\n' +
    '2) os MATERIAIS E MÉTODOS (desenho do estudo, amostra, grupos, acompanhamento);\n' +
    '3) os RESULTADOS — a parte central do resumo: enuncie com clareza o que o estudo encontrou (desfechos, comparações, direção do efeito), NUNCA de forma vaga. Se o estudo COMPARA grupos, técnicas ou materiais, é OBRIGATÓRIO declarar o VEREDITO: qual grupo se saiu MELHOR e qual foi PIOR, em cada desfecho relevante. Dizer apenas que \'houve diferenças significativas entre os grupos\' sem indicar quem foi superior é uma FALHA — é a informação que o clínico mais precisa. (Se o material realmente não indicar a direção, afirme isso de forma explícita; jamais invente o vencedor.);\n' +
    '4) a RELEVÂNCIA CLÍNICA, incluindo as limitações do estudo.\n' +
    'Muitos leitores não terão acesso ao artigo completo: o resumo precisa se sustentar sozinho. ' +
    'É texto para LEITURA — não reaproveite a estrutura de roteiro do áudio.\n' +
    'REGRA DE DIREITO AUTORAL (obrigatória): o abstract é apenas CONTEXTO — é PROIBIDO reproduzi-lo ou traduzi-lo literalmente; escreva com suas próprias palavras e estrutura.\n' +
    'REGRA DE FIDELIDADE NUMÉRICA (obrigatória): cite APENAS números que constam literalmente no material abaixo (amostras, percentuais, tempos, medidas). ' +
    'NUNCA derive, arredonde, converta ou estime números. Se um dado não estiver no material, descreva-o qualitativamente sem número.\n' +
    (strictNote ? 'ATENÇÃO: a versão anterior citou números inexistentes no material (' + strictNote + '). Remova qualquer número que não esteja literalmente no material.\n' : '') +
    'Responda APENAS com o texto do resumo, sem títulos nem marcadores.\n\n' +
    `TÍTULO: ${article.titulo || article.title || ''}\n` +
    `ABSTRACT (contexto): ${abstract}\n` +
    `PERIÓDICO/ANO: ${article.journal || ''} ${article.year || ''}`
  );
}

async function generateResumoCompleto(article) {
  const sourceText = [article.titulo, article.title, article.abstract, article.journal, article.year].join(' ');
  let strictNote = null;

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let raw;
    try {
      // max_tokens ALTO (2500): o resumo estruturado (objetivo/métodos/
      // resultados/relevância) não cabia nos 1024 padrão e saía CORTADO no
      // meio (incidente 23/07 "9 linhas e …"). O corte final de 4000 chars é
      // só a rede de segurança de tamanho.
      raw = await callClaude(buildResumoCompletoPrompt(article, strictNote), 0, RESUMO_COMPLETO_MODEL, 2500);
    } catch (err) {
      log.warn('[claude] resumo_completo falhou', { pmid: article.pmid, err: err.message });
      return null;
    }
    const texto = corrigirTermosBR(raw.text.trim().slice(0, 4000));
    // Resposta VAZIA/curta demais nunca é aceita em silêncio (incidente 24/07:
    // o Sonnet devolvia bloco de raciocínio e o texto vinha vazio — o resumo
    // "sumia" sem erro). Loga e tenta de novo; persistindo, retorna null e a
    // página cai no resumo curto.
    if (texto.length < 200) {
      log.warn('[claude] resumo_completo vazio/curto — resposta sem texto útil', {
        pmid: article.pmid, tentativa: tentativa + 1, len: texto.length,
      });
      continue;
    }
    const check = numbersConsistent(sourceText, texto);
    if (check.ok) return texto;

    log.warn('[claude] resumo_completo reprovado no validador numérico', {
      pmid: article.pmid, tentativa: tentativa + 1, numeros: check.offending.slice(0, 10),
    });
    strictNote = check.offending.slice(0, 10).join(', ');
  }
  return null; // nunca publica número não verificado
}

// Classificação isolada (sem enriquecimento completo) — usada pelo script de
// correção em massa fix-especialidades.js. Retorna uma especialidade canônica,
// 'Odontologia Geral', ou null em falha.
// Modelo: CLASSIFY_MODEL (default Sonnet — roda raramente e em lote; a precisão
// aqui corrige a base inteira, então vale o custo por chamada maior).
const CLASSIFY_MODEL = process.env.CLASSIFY_MODEL || 'claude-sonnet-5';

async function classifyEspecialidade(article) {
  const prompt =
    'Classifique o artigo odontológico abaixo pelo seu FOCO CLÍNICO PRINCIPAL.\n' +
    ESPECIALIDADE_GUIDE + '\n' +
    `Responda APENAS com uma opção exata desta lista: ${CANONICAL_ESPECIALIDADES.join(' | ')} | Outra\n` +
    'Use "Outra" quando o artigo não se encaixar claramente em nenhuma.\n\n' +
    `TÍTULO: ${article.titulo || article.title || ''}\n` +
    `ABSTRACT (contexto): ${(article.abstract || article.resumo_pt || '').slice(0, 1500)}\n` +
    `RÓTULO ATUAL (frequentemente errado — não confie nele): ${article.especialidade || ''}`;

  try {
    const raw = await callClaude(prompt, 0, CLASSIFY_MODEL);
    const answer = raw.text.trim().split('\n')[0].trim();
    if (CANONICAL_ESPECIALIDADES.includes(answer)) return answer;
    if (/^outra$/i.test(answer)) return 'Odontologia Geral';
    const hit = CANONICAL_ESPECIALIDADES.find(e => answer.includes(e));
    return hit || null;
  } catch (err) {
    log.warn('[claude] classifyEspecialidade failed', { pmid: article.pmid || article.id, err: err.message });
    return null;
  }
}

module.exports = { enrichArticle, generateResumoCompleto, isResumoEstruturado, RESUMO_SECOES, classifyEspecialidade, CANONICAL_ESPECIALIDADES, corrigirTermosBR, currentCost, resetCost, MODEL };
