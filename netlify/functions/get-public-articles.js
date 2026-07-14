const { request } = require('./_lib');

// Especialidades atribuídas aos artigos na ingestão (ver ingest-pubmed.js).
// Buscamos o artigo mais recente de CADA uma para garantir que cada quadro da
// seção "Publicações desta semana" mostre uma especialidade diferente — mesmo
// quando a ingestão recente é dominada por uma única área.
const SPECIALTIES = [
  'Ortodontia', 'Implantodontia', 'Periodontia', 'Endodontia', 'Dentística',
  'Prótese', 'Cirurgia', 'Odontopediatria', 'Saúde Pública', 'Radiologia',
  'Estomatologia', 'DTM'
];

const SELECT_FIELDS = [
  { fieldPath: 'pmid' }, { fieldPath: 'titulo' }, { fieldPath: 'titulo_pt' },
  { fieldPath: 'tema' }, { fieldPath: 'especialidade' },
  { fieldPath: 'data' }, { fieldPath: 'journal' },
  { fieldPath: 'year' }, { fieldPath: 'nivel_evidencia' }, { fieldPath: 'doi' },
  { fieldPath: 'resumo_pt' }, { fieldPath: 'impacto_pratico' },
  { fieldPath: 'pubmedUrl' }, { fieldPath: 'url' }
];

function mapDoc(d) {
  const f = d.document.fields || {};
  return {
    id: d.document.name.split('/').pop(),
    pmid: f.pmid?.stringValue || f.pmid?.integerValue || '',
    titulo: f.titulo?.stringValue || '',
    titulo_pt: f.titulo_pt?.stringValue || '',
    tema: f.tema?.stringValue || '',
    especialidade: f.especialidade?.stringValue || '',
    data: f.data?.stringValue || '',
    journal: f.journal?.stringValue || '',
    year: f.year?.stringValue || f.year?.integerValue || '',
    nivel_evidencia: f.nivel_evidencia?.stringValue || '',
    doi: f.doi?.stringValue || '',
    resumo_pt: f.resumo_pt?.stringValue || '',
    impacto_pratico: f.impacto_pratico?.stringValue || '',
    pubmedUrl: f.pubmedUrl?.stringValue || '',
    url: f.url?.stringValue || '',
    status: f.status?.stringValue || '',
  };
}

// Busca o artigo mais recente de uma especialidade. Tenta com orderBy(data DESC);
// se o índice composto não existir (400), refaz sem orderBy e ordena no cliente.
async function fetchLatestForSpecialty(projectId, apiKey, especialidade) {
  const run = async (withOrder) => {
    const q = {
      from: [{ collectionId: 'artigos' }],
      where: { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } },
      select: { fields: SELECT_FIELDS.concat([{ fieldPath: 'status' }]) },
      limit: withOrder ? 3 : 20,
    };
    if (withOrder) q.orderBy = [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }];
    const buf = Buffer.from(JSON.stringify({ structuredQuery: q }), 'utf8');
    return request({
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/' + projectId + '/databases/(default)/documents:runQuery?key=' + apiKey,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': buf.length }
    }, buf);
  };

  let res = await run(true);
  if (res.status !== 200) res = await run(false);
  if (res.status !== 200) return null;

  const rows = JSON.parse(res.body).filter(d => d.document).map(mapDoc);
  if (!rows.length) return null;
  // Ordena por data DESC (garante o mais recente mesmo no fallback sem orderBy)
  rows.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
  // Prefere um artigo já enriquecido (status active); senão, o mais recente disponível.
  return rows.find(a => a.status === 'active') || rows[0];
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;

  try {
    // Uma busca por especialidade, em paralelo — cada uma traz seu artigo mais recente.
    const picks = (await Promise.all(
      SPECIALTIES.map(spec => fetchLatestForSpecialty(projectId, apiKey, spec).catch(() => null))
    )).filter(Boolean);

    // Ordena por recência: o mais recente vira o destaque; cada quadro é de uma
    // especialidade diferente. Limita a 8 (1 destaque + 3 laterais + 4 grade).
    picks.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : -1);
    const artigos = picks.slice(0, 8).map(({ status, ...rest }) => rest);

    return { statusCode: 200, headers, body: JSON.stringify({ artigos }) };
  } catch (err) {
    console.error('get-public-articles error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
