// DIAGNÓSTICO DE TEMAS (Fase 1 da spec 24/08) — SÓ LEITURA, zero escrita.
//
// Motivo: filtro "Alinhadores invisíveis" devolvia 6 de 666 artigos de
// Ortodontia. Hipóteses: mesmo tema gravado com strings diferentes
// (correspondência exata do filtro), tema vazio, migração parcial e
// classificação restritiva. Este relatório mede TODAS antes de corrigir.
//
// Núcleo compartilhado entre a Netlify Function admin (diagnostico-temas.js)
// e o script do workflow (scripts/diagnostico-temas.js) — mesma verdade nas
// duas rotas. Nenhum dado pessoal envolvido (só metadados de artigos).

const { mapear, mapearLista, normalizar, TAXONOMIA_VERSAO } = require('./taxonomia');

const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });

// Distância de Levenshtein clássica (strings curtas de tema — custo baixo).
function levenshtein(a, b) {
  a = String(a); b = String(b);
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Item 4 do relatório: candidatos a fusão — strings distintas que (a) colidem
// após normalização ou (b) ficam a Levenshtein <= 3 na forma normalizada.
function detectarVariantes(strings) {
  const porNorm = new Map();
  for (const s of strings) {
    const n = normalizar(s);
    if (!porNorm.has(n)) porNorm.set(n, []);
    porNorm.get(n).push(s);
  }
  const grupos = [];
  for (const [norm, brutas] of porNorm.entries()) {
    if (brutas.length > 1) grupos.push({ tipo: 'colisao_normalizacao', norm, variantes: brutas });
  }
  const normas = [...porNorm.keys()];
  const paresProximos = [];
  for (let i = 0; i < normas.length; i++) {
    for (let j = i + 1; j < normas.length; j++) {
      // Poda barata antes do Levenshtein: diferença de tamanho já decide.
      if (Math.abs(normas[i].length - normas[j].length) > 3) continue;
      const d = levenshtein(normas[i], normas[j]);
      if (d > 0 && d <= 3) paresProximos.push({ a: normas[i], b: normas[j], distancia: d });
    }
  }
  return { grupos, paresProximos };
}

async function construirDiagnostico(db) {
  const arts = await db.query('artigos', {
    select: sel('pmid', 'titulo_pt', 'titulo', 'resumo_pt', 'especialidade', 'tema', 'temas', 'temas_raw', 'versao_taxonomia', 'status'),
    limit: 5000,
  });

  const porEsp = new Map(); // esp → agregadores
  const espDe = (a) => a.especialidade || '(sem especialidade)';
  const agg = (esp) => {
    if (!porEsp.has(esp)) {
      porEsp.set(esp, {
        total: 0, ativos: 0, comTema: 0, semTema: 0,
        formatoString: 0, formatoArray: 0,
        comTemasV2: 0, naVersaoCorrente: 0,
        mapeariaPorSinonimo: 0, precisariaIA: 0,
        distribuicao: new Map(), // string EXATA → contagem
      });
    }
    return porEsp.get(esp);
  };

  for (const a of arts) {
    const g = agg(espDe(a));
    g.total++;
    if (a.status === 'active') g.ativos++;

    // Item 5: formato do campo (string vs array vs vazio) — inconsistência
    // entre registros é exatamente o que este contador revela.
    const bruto = a.tema;
    const vazio = bruto == null || (typeof bruto === 'string' && !bruto.trim()) || (Array.isArray(bruto) && !bruto.length);
    if (vazio) g.semTema++;
    else {
      g.comTema++;
      if (Array.isArray(bruto)) g.formatoArray++; else g.formatoString++;
      for (const t of (Array.isArray(bruto) ? bruto : [bruto])) {
        const k = String(t); // EXATAMENTE como gravado, sem normalizar (item 3)
        g.distribuicao.set(k, (g.distribuicao.get(k) || 0) + 1);
      }
    }
    if (Array.isArray(a.temas) && a.temas.length) g.comTemasV2++;
    if (a.versao_taxonomia === TAXONOMIA_VERSAO) g.naVersaoCorrente++;

    // Prévia da migração: quantos resolvem por sinônimo (custo zero) e
    // quantos precisariam de IA — dimensiona o custo da Fase 3.
    if (!vazio && mapearLista(bruto, espDe(a)).length) g.mapeariaPorSinonimo++;
    else if (a.status === 'active') g.precisariaIA++;
  }

  const especialidades = {};
  for (const [esp, g] of [...porEsp.entries()].sort((x, y) => y[1].total - x[1].total)) {
    especialidades[esp] = {
      total: g.total, ativos: g.ativos,
      temaPreenchido: g.comTema, temaVazio: g.semTema,
      formato: { string: g.formatoString, array: g.formatoArray },
      jaComTemasV2: g.comTemasV2, naVersaoCorrente: g.naVersaoCorrente,
      previaMigracao: { mapeariaPorSinonimo: g.mapeariaPorSinonimo, precisariaIA: g.precisariaIA },
      distribuicaoBruta: [...g.distribuicao.entries()]
        .sort((x, y) => y[1] - x[1])
        .map(([tema, contagem]) => ({ tema, contagem })),
      variantes: detectarVariantes([...g.distribuicao.keys()]),
    };
  }

  // Item 6: amostra de Ortodontia com alinhador/aligner/invisalign no título
  // ou resumo — dimensiona o falso negativo do filtro atual.
  const RX = /alinhador|aligner|invisalign/i;
  const amostraAlinhadores = arts
    .filter(a => espDe(a) === 'Ortodontia' && (RX.test(a.titulo_pt || a.titulo || '') || RX.test(a.resumo_pt || '')))
    .slice(0, 20)
    .map(a => ({
      pmid: String(a.pmid || a.id || ''),
      titulo: String(a.titulo_pt || a.titulo || '').slice(0, 120),
      temaGravado: a.tema ?? null,
      temasV2: Array.isArray(a.temas) ? a.temas : null,
      mapeariaPara: mapear(a.tema, 'Ortodontia'),
    }));
  const totalComAlinhadorNoTexto = arts
    .filter(a => espDe(a) === 'Ortodontia' && (RX.test(a.titulo_pt || a.titulo || '') || RX.test(a.resumo_pt || ''))).length;
  const totalComTemaAlinhadores = arts
    .filter(a => espDe(a) === 'Ortodontia' && mapearLista(a.tema, 'Ortodontia').includes('alinhadores-invisiveis')).length;

  return {
    geradoEm: new Date().toISOString(),
    somenteLeitura: true,
    versaoTaxonomiaCorrente: TAXONOMIA_VERSAO,
    totalArtigos: arts.length,
    especialidades,
    casoAlinhadores: {
      // O número que motivou tudo: quantos artigos FALAM de alinhadores vs
      // quantos o filtro atual capturaria.
      artigosDeOrtodontiaComAlinhadorNoTexto: totalComAlinhadorNoTexto,
      artigosCujoTemaMapeiaParaAlinhadores: totalComTemaAlinhadores,
      amostra20: amostraAlinhadores,
    },
  };
}

// CSV da distribuição bruta (item 3) — separador ; e BOM para Excel BR.
function distribuicaoCSV(diagnostico) {
  const linhas = ['especialidade;tema_gravado;contagem;mapearia_para'];
  for (const [esp, g] of Object.entries(diagnostico.especialidades)) {
    for (const { tema, contagem } of g.distribuicaoBruta) {
      const alvo = mapear(tema, esp) || '';
      const seguro = /[";\n]/.test(tema) ? '"' + tema.replace(/"/g, '""') + '"' : tema;
      linhas.push(`${esp};${seguro};${contagem};${alvo}`);
    }
  }
  return '﻿' + linhas.join('\n');
}

module.exports = { construirDiagnostico, distribuicaoCSV, detectarVariantes, levenshtein };
