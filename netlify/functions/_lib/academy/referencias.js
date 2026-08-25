// ACADEMY — busca de literatura com VERIFICAÇÃO OBRIGATÓRIA (guardrail 1).
//
// Regra de ferro: toda referência vem de resultado REAL do PubMed (esearch →
// efetch), com PMID sempre e DOI quando existir. Referência sem identificador
// verificável NUNCA entra no projeto — é omitida, não estimada. O modelo de
// linguagem nunca gera referência: ele só COMENTA a lista que este módulo
// devolve.
//
// Reusa a MESMA infra de rede do pipeline (raw https + throttle do NCBI).

const { request } = require('../../_lib');

const HOST = 'eutils.ncbi.nlm.nih.gov';
const NCBI_KEY = process.env.NCBI_API_KEY ? `&api_key=${process.env.NCBI_API_KEY}` : '';
let _ultimo = 0;
async function _throttle() {
  const min = NCBI_KEY ? 110 : 350; // limites do NCBI
  const delta = Date.now() - _ultimo;
  if (delta < min) await new Promise(r => setTimeout(r, min - delta));
  _ultimo = Date.now();
}

// Estratégia de busca a partir do PICO interno — termos MeSH/tiab + booleanos.
// Determinística e visível ao dentista em linguagem simples (a string técnica
// vai no pacote final, como manda a boa prática).
function montarEstrategia(pico) {
  const bloco = (s) => String(s || '').trim().replace(/["\[\]]/g, '');
  const p = bloco(pico.p), i = bloco(pico.i), c = bloco(pico.c), o = bloco(pico.o);
  const partes = [];
  if (p) partes.push(`(${p}[tiab] OR ${p}[MeSH Terms])`);
  if (i) partes.push(`(${i}[tiab] OR ${i}[MeSH Terms])`);
  if (c) partes.push(`(${c}[tiab])`);
  if (o) partes.push(`(${o}[tiab])`);
  return partes.join(' AND ') || 'dentistry[MeSH Terms]';
}

async function _esearch(termo, retmax = 12) {
  await _throttle();
  const path = `/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(termo)}&retmax=${retmax}&sort=relevance&retmode=json${NCBI_KEY}`;
  const res = await request({ hostname: HOST, path, method: 'GET' }, null);
  if (res.status !== 200) throw new Error('esearch ' + res.status);
  return (JSON.parse(res.body).esearchresult || {}).idlist || [];
}

// efetch com extração de DOI + campos Vancouver (autores até 6, volume/páginas).
async function _efetch(pmid) {
  await _throttle();
  const path = `/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract${NCBI_KEY}`;
  const res = await request({ hostname: HOST, path, method: 'GET' }, null);
  if (res.status !== 200) return null;
  const xml = res.body;
  const tag = (re) => { const m = xml.match(re); return m ? m[1].replace(/<[^>]+>/g, '').trim() : ''; };
  const titulo = tag(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
  if (!titulo) return null;
  const doiM = xml.match(/<ArticleId IdType="doi">([\s\S]*?)<\/ArticleId>/);
  const sobrenomes = xml.match(/<Author[\s\S]*?<\/Author>/g) || [];
  const autores = sobrenomes.slice(0, 6).map(a => {
    const ln = (a.match(/<LastName>([\s\S]*?)<\/LastName>/) || [])[1] || '';
    const ini = (a.match(/<Initials>([\s\S]*?)<\/Initials>/) || [])[1] || '';
    return (ln + (ini ? ' ' + ini : '')).trim();
  }).filter(Boolean);
  const abstracts = (xml.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g) || [])
    .map(a => a.replace(/<[^>]+>/g, '').trim()).join(' ');
  return {
    pmid: String(pmid),
    doi: doiM ? doiM[1].trim() : '',
    titulo,
    autores: autores.join(', ') + (sobrenomes.length > 6 ? ', et al.' : ''),
    journal: tag(/<ISOAbbreviation>([\s\S]*?)<\/ISOAbbreviation>/) || tag(/<Title>([\s\S]*?)<\/Title>/),
    ano: tag(/<Year>(\d{4})<\/Year>/) || '',
    volume: tag(/<Volume>([\s\S]*?)<\/Volume>/),
    paginas: tag(/<MedlinePgn>([\s\S]*?)<\/MedlinePgn>/),
    resumoOriginal: abstracts.slice(0, 1500),
    verificadaEm: new Date().toISOString(),
  };
}

// Busca completa: estratégia → esearch → efetch de cada PMID → SÓ verificadas.
async function buscarLiteratura(pico, { max = 10 } = {}) {
  const estrategia = montarEstrategia(pico);
  const pmids = await _esearch(estrategia, max + 4);
  const refs = [];
  const descartadas = [];
  for (const pmid of pmids) {
    if (refs.length >= max) break;
    const r = await _efetch(pmid).catch(() => null);
    // TRAVA: sem PMID confirmado no efetch (título presente) a referência é
    // OMITIDA — nunca "estimada" (guardrail 1).
    if (r && r.pmid && r.titulo) refs.push(r);
    else descartadas.push(String(pmid));
  }
  return { estrategia, referencias: refs, descartadasSemVerificacao: descartadas };
}

// Vancouver: Autores. Título. Journal. Ano;Volume:Páginas. DOI/PMID.
function formatarVancouver(r, n) {
  const partes = [
    `${n}. ${r.autores || '[autores no PubMed]'}.`,
    `${r.titulo}${/[.?!]$/.test(r.titulo) ? '' : '.'}`,
    `${r.journal}. ${r.ano}${r.volume ? ';' + r.volume : ''}${r.paginas ? ':' + r.paginas : ''}.`,
    r.doi ? `doi:${r.doi}.` : '',
    `PMID: ${r.pmid}.`,
  ];
  return partes.filter(Boolean).join(' ');
}

// Só entra no manuscrito o que tem PMID (sempre) — dupla checagem barata.
const referenciaVerificavel = (r) => !!(r && r.pmid && r.titulo && r.journal);

module.exports = { montarEstrategia, buscarLiteratura, formatarVancouver, referenciaVerificavel };
