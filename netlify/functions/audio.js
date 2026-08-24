// PROXY DE ÁUDIO PELO NOSSO DOMÍNIO (incidente 10/08 — print da dentista:
// "firebasestorage.googleapis.com demorou muito para responder").
//
// O celular/operadora de alguns dentistas não alcança o host do Firebase
// Storage — o download pendura sem erro e o player fica em 0:00 para sempre,
// enquanto o mesmo áudio serve normalmente para o resto do mundo (Vigia verde).
// Esta função busca o MP3 do Storage DO LADO DO NETLIFY e o entrega pelo
// odontofeed.com, que o aparelho alcança. É FALLBACK: o player só cai aqui
// quando o cão de guarda detecta download pendurado — a rota padrão continua
// sendo a URL direta do Storage (banda fora do Netlify).
//
// Segurança: só repassa URLs do NOSSO host/caminho de podcasts; o token da URL
// continua sendo validado pelo próprio Firebase (sem token válido, 403 lá).
// Nada de log da URL — ela carrega o token de download.

const https = require('https');

const HOST_PERMITIDO = 'firebasestorage.googleapis.com';

function baixarBinario(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    // Teto de 9s: abaixo do timeout de 10s da função — falha limpa, não 502 mudo.
    req.setTimeout(9000, () => req.destroy(new Error('timeout na origem')));
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const u = String((event.queryStringParameters || {}).u || '');
  let alvo;
  try { alvo = new URL(u); } catch { return { statusCode: 400, body: 'url invalida' }; }
  const permitido = alvo.protocol === 'https:'
    && alvo.hostname === HOST_PERMITIDO
    && alvo.pathname.startsWith('/v0/b/')
    && alvo.pathname.includes('/o/podcasts');
  if (!permitido) return { statusCode: 403, body: 'apenas audio do OdontoFeed' };

  const res = await baixarBinario(alvo.toString()).catch(() => null);
  if (!res || res.status !== 200) {
    return { statusCode: 502, body: 'origem indisponivel (' + (res ? res.status : 'sem resposta') + ')' };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
    body: res.body.toString('base64'),
    isBase64Encoded: true,
  };
};
