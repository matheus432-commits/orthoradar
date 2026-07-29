// GARANTIA (fundador 28/07): o funil NUNCA pode zerar para NENHUMA especialidade.
// A reserva é o acervo do PubMed (dezenas de milhares por área): buscar PMIDs é
// grátis, só o selecionado é enriquecido. searchOne varre PÁGINA POR PÁGINA até
// achar um artigo NOVO — estes testes simulam o acervo com a camada HTTP mockada
// (o CI local não alcança o NCBI) e provam a varredura profunda.

const { test } = require('node:test');
const assert = require('node:assert');
const pubmed = require('../pubmed.js');

// Constrói um mock de esearch/efetch. `enviados` = PMIDs já enviados (aparecem
// nas primeiras páginas, simulando o acervo esgotado no topo). `frescoNaPagina`
// = em que página aparece o primeiro PMID novo. Cada página tem 100 PMIDs.
function mockHttp({ total, frescoNaPagina, semFresco = false }) {
  return async ({ path }) => {
    if (path.includes('esearch')) {
      const rs = Number((path.match(/retstart=(\d+)/) || [])[1] || 0);
      const rm = Number((path.match(/retmax=(\d+)/) || [])[1] || 100);
      const idlist = [];
      for (let i = 0; i < rm && rs + i < total; i++) {
        const idx = rs + i;
        const paginaAtual = Math.floor(rs / 100);
        // PMIDs "novos" (>= 900000000) só a partir de frescoNaPagina; senão, "já enviados"
        const novo = !semFresco && paginaAtual >= frescoNaPagina;
        idlist.push(String(novo ? 900000000 + idx : idx));
      }
      return { status: 200, body: JSON.stringify({ esearchresult: { count: String(total), idlist } }) };
    }
    // efetch: devolve um registro com abstract útil
    const pmid = (path.match(/id=(\d+)/) || [])[1];
    return { status: 200, body:
      `<ArticleTitle>Estudo ${pmid}</ArticleTitle>` +
      `<AbstractText>Resultado do estudo ${pmid} com dados suficientes para narrar e comparar grupos de forma conclusiva e detalhada para o card.</AbstractText>` +
      `<Title>Journal Teste</Title><Year>2026</Year><PubDate><Year>2026</Year></PubDate><LastName>Silva</LastName>` };
  };
}

test('acha artigo NOVO mesmo com as primeiras 5 páginas (500 recentes) já enviadas', async () => {
  pubmed._setHttpForTest(mockHttp({ total: 5000, frescoNaPagina: 5 }));
  const enviados = new Set();
  for (let i = 0; i < 500; i++) enviados.add(String(i)); // 500 recentes já enviados
  const art = await pubmed.searchOne('prosthodontics[MeSH Major Topic]', enviados);
  pubmed._setHttpForTest(null);
  assert.ok(art, 'deveria achar um artigo novo na reserva profunda');
  assert.ok(Number(art.pmid) >= 900000000, 'o artigo achado deve ser um NÃO enviado (fresco)');
});

test('acervo gigante com topo esgotado — ainda acha (Prótese/Estomatologia)', async () => {
  pubmed._setHttpForTest(mockHttp({ total: 200000, frescoNaPagina: 3 }));
  const enviados = new Set();
  for (let i = 0; i < 300; i++) enviados.add(String(i));
  const art = await pubmed.searchOne('stomatognathic diseases[MeSH Major Topic]', enviados);
  pubmed._setHttpForTest(null);
  assert.ok(art && Number(art.pmid) >= 900000000);
});

test('pubmedFallbackArticles entrega os 3 exigidos com o topo esgotado (sem enriquecer)', async () => {
  pubmed._setHttpForTest(mockHttp({ total: 50000, frescoNaPagina: 4 }));
  const enviados = new Set();
  for (let i = 0; i < 400; i++) enviados.add(String(i));
  // anthropicKey null → não enriquece; usa o abstract como resumo. Prova o VOLUME.
  const arts = await pubmed.pubmedFallbackArticles({ especialidade: 'Ortodontia', temas: [] }, enviados, 3, null);
  pubmed._setHttpForTest(null);
  assert.ok(arts.length >= 3, `esperava >= 3, veio ${arts.length}`);
  assert.ok(arts.every(a => !enviados.has(String(a.pmid))), 'todos devem ser novos');
});

test('banco GRANDE: pubmedFallbackArticles entrega ~18 quando pedido (enriquecimento paralelo)', async () => {
  // Após paralelizar o enriquecimento, um alvo maior (18) cabe no orçamento.
  // Prova que a função entrega o volume pedido, não só o mínimo de 3.
  pubmed._setHttpForTest(mockHttp({ total: 80000, frescoNaPagina: 2 }));
  const enviados = new Set();
  for (let i = 0; i < 200; i++) enviados.add(String(i));
  const arts = await pubmed.pubmedFallbackArticles({ especialidade: 'Ortodontia', temas: [] }, enviados, 18, null);
  pubmed._setHttpForTest(null);
  assert.ok(arts.length >= 12, `esperava um banco robusto (>=12), veio ${arts.length}`);
  // Sem duplicados: cada PMID único.
  const ids = new Set(arts.map(a => String(a.pmid)));
  assert.strictEqual(ids.size, arts.length, 'não pode haver PMID duplicado no banco');
  assert.ok(arts.every(a => !enviados.has(String(a.pmid))), 'todos devem ser novos');
});

test('reserva REALMENTE esgotada (nada novo) retorna vazio sem travar (bounded)', async () => {
  pubmed._setHttpForTest(mockHttp({ total: 2000, semFresco: true }));
  const enviados = new Set();
  for (let i = 0; i < 2000; i++) enviados.add(String(i));
  const art = await pubmed.searchOne('root canal therapy[MeSH Major Topic]', enviados);
  pubmed._setHttpForTest(null);
  assert.strictEqual(art, null, 'sem material novo, retorna null sem loop infinito');
});
