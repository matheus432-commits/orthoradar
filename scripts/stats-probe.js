// Sondagem de cadastros (diagnóstico): conta quantos dentistas há no OdontoFeed
// e quando entraram. Roda no CI (secrets FIREBASE_*) e imprime SOMENTE agregados
// e datas — NUNCA nome/e-mail — porque o repositório é público e o log também.

const { request } = require('../netlify/functions/_lib');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;

async function listAll(collection) {
  const docs = [];
  let pageToken = null;
  do {
    const qs = `pageSize=300&key=${apiKey}` + (pageToken ? `&pageToken=${pageToken}` : '');
    const res = await request({
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}?${qs}`,
      method: 'GET',
    });
    if (res.status !== 200) { console.log('ERRO listagem', res.status, String(res.body).slice(0, 200)); break; }
    const json = JSON.parse(res.body);
    if (json.documents) docs.push(...json.documents);
    pageToken = json.nextPageToken || null;
  } while (pageToken);
  return docs;
}

function str(f, k) { return f[k]?.stringValue || ''; }

(async () => {
  if (!apiKey) { console.log('SEM_FIREBASE_API_KEY'); process.exit(1); }
  const docs = await listAll('cadastros');
  const now = Date.now();
  const dia = 24 * 3600 * 1000;

  let total = 0, ativos = 0, comReferral = 0;
  let ult24h = 0, ult7d = 0;
  const porEsp = {};
  const datas = [];

  for (const d of docs) {
    const f = d.fields || {};
    total++;
    if (f.ativo?.booleanValue !== false) ativos++;
    if (str(f, 'referredBy')) comReferral++;

    const specs = f.especialidade?.arrayValue?.values
      ? f.especialidade.arrayValue.values.map(v => v.stringValue).filter(Boolean)
      : (str(f, 'especialidade') ? [str(f, 'especialidade')] : ['?']);
    specs.forEach(s => { porEsp[s] = (porEsp[s] || 0) + 1; });

    const criado = str(f, 'criadoEm');
    if (criado) {
      const t = new Date(criado).getTime();
      if (now - t <= dia) ult24h++;
      if (now - t <= 7 * dia) ult7d++;
      datas.push(criado.slice(0, 16).replace('T', ' '));
    }
  }

  datas.sort();
  console.log('=== CADASTROS OdontoFeed ===');
  console.log('total:', total, '| ativos:', ativos);
  console.log('novos nas ultimas 24h:', ult24h, '| nos ultimos 7 dias:', ult7d);
  console.log('vieram por indicacao (referredBy):', comReferral);
  console.log('por especialidade:', JSON.stringify(porEsp));
  console.log('datas de cadastro (mais antigo -> mais novo, UTC):');
  datas.forEach(d => console.log('  ', d));
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
