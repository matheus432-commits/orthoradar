// Regressão dos incidentes 04-05/08 (player 0:00 recorrente no site).
//
// Causa-raiz: o job de podcasts sobe o áudio com o bucket REAL (GCS_BUCKET do
// Actions / service account — ex.: orthoradar.firebasestorage.app) e cada
// leitor no Netlify REMONTAVA a URL com o próprio env, cujo fallback era
// {projectId}.appspot.com — bucket que nem existe em projetos Firebase novos.
// Job verde, site com player 0:00, nenhum log vermelho.
//
// Correção definitiva testada aqui:
//   1. audioUrlDe: leitores SEMPRE preferem a URL persistida no doc;
//   2. verifyUrl: a verificação pós-gravação confere a STRING persistida
//      (a mesma que o navegador recebe), não uma URL remontada;
//   3. estático: o gerador persiste `url` em todos os docs e NENHUM leitor
//      voltou a remontar URL de episódio com firebaseDownloadUrl.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const LIB_DIR = path.join(__dirname, '..');
const FUNCS   = path.join(LIB_DIR, '..');
const STORAGE = path.join(LIB_DIR, 'storage.js');
const LIB_JS  = path.join(FUNCS, '_lib.js');
const GCP_AUTH = path.join(LIB_DIR, 'gcp-auth.js');

function loadStorageWith(requestImpl) {
  require.cache[GCP_AUTH] = {
    id: GCP_AUTH, filename: GCP_AUTH, loaded: true,
    exports: { getAccessToken: async () => null, bucketName: () => 'mock-bucket' },
  };
  require.cache[LIB_JS] = {
    id: LIB_JS, filename: LIB_JS, loaded: true,
    exports: { request: requestImpl || (async () => ({ status: 200, body: '{}' })) },
  };
  delete require.cache[require.resolve(STORAGE)];
  return require(STORAGE);
}

describe('audioUrlDe — URL persistida vence a remontagem', () => {
  const { audioUrlDe } = loadStorageWith();

  test('prefere a URL persistida mesmo com path/token presentes', () => {
    const doc = {
      url: 'https://firebasestorage.googleapis.com/v0/b/orthoradar.firebasestorage.app/o/podcasts%2Fx.mp3?alt=media&token=abc',
      objectPath: 'podcasts/x.mp3',
      downloadToken: 'abc',
    };
    // bucket ERRADO de propósito (o fallback .appspot.com do Netlify) — a URL
    // persistida tem que vencer, senão o bug 05/08 volta.
    assert.equal(audioUrlDe(doc, 'orthoradar.appspot.com'), doc.url);
  });

  test('doc legado (sem url) remonta com o bucket informado', () => {
    const u = audioUrlDe({ objectPath: 'podcasts/a b.mp3', downloadToken: 'tok' }, 'bkt');
    assert.equal(u, 'https://firebasestorage.googleapis.com/v0/b/bkt/o/podcasts%2Fa%20b.mp3?alt=media&token=tok');
  });

  test('sem url e sem path/token → null (nunca URL quebrada)', () => {
    assert.equal(audioUrlDe({}, 'bkt'), null);
    assert.equal(audioUrlDe(null, 'bkt'), null);
    assert.equal(audioUrlDe({ objectPath: 'x' }, 'bkt'), null); // token faltando
  });
});

describe('verifyUrl — verifica a STRING persistida, byte a byte', () => {
  test('faz GET Range no host e path da URL dada; 206 = ok', async () => {
    let visto = null;
    const { verifyUrl } = loadStorageWith(async (opts) => { visto = opts; return { status: 206, body: '' }; });
    const url = 'https://firebasestorage.googleapis.com/v0/b/real-bucket/o/podcasts%2Fep1.mp3?alt=media&token=uuid-1';
    const r = await verifyUrl(url);
    assert.equal(r.ok, true);
    assert.equal(visto.hostname, 'firebasestorage.googleapis.com');
    assert.equal(visto.path, '/v0/b/real-bucket/o/podcasts%2Fep1.mp3?alt=media&token=uuid-1');
    assert.equal(visto.headers.Range, 'bytes=0-0');
  });

  test('404 (bucket/objeto errado) → ok:false com o status', async () => {
    const { verifyUrl } = loadStorageWith(async () => ({ status: 404, body: '' }));
    const r = await verifyUrl('https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=t');
    assert.equal(r.ok, false);
    assert.equal(r.status, 404);
  });

  test('URL vazia/inválida → ok:false sem lançar', async () => {
    const { verifyUrl } = loadStorageWith(async () => ({ status: 200, body: '' }));
    assert.equal((await verifyUrl('')).ok, false);
    assert.equal((await verifyUrl('não é url')).ok, false);
    assert.equal((await verifyUrl(null)).ok, false);
  });

  test('verifyDownloadUrl continua funcionando (monta e delega)', async () => {
    let visto = null;
    const { verifyDownloadUrl } = loadStorageWith(async (opts) => { visto = opts; return { status: 200, body: '' }; });
    const r = await verifyDownloadUrl('bkt', 'podcasts/e.mp3', 'tok');
    assert.equal(r.ok, true);
    assert.ok(visto.path.includes('/v0/b/bkt/o/podcasts%2Fe.mp3'));
  });
});

// ── Regressão ESTÁTICA: a cadeia inteira usa a URL persistida ────────────────
// (rodada de avaliação 05/08: não basta corrigir 1 leitor — qualquer leitor
// que volte a remontar URL de episódio reabre a classe do bug.)
describe('cadeia gravação → leitura usa a URL persistida', () => {
  const src = (p) => fs.readFileSync(p, 'utf8');

  test('generate-podcasts persiste `url` nos episódios, compilado, legado e histórico', () => {
    const gp = src(path.join(FUNCS, 'generate-podcasts.js'));
    assert.match(gp, /url:\s*up\.url/, 'episódio deve gravar a URL do upload');
    assert.match(gp, /url:\s*upFull\.url/, 'compilado deve gravar a URL do upload');
    assert.match(gp, /url:\s*episodios\[0\]\.url/, 'campos legados devem gravar a URL');
    assert.match(gp, /url:\s*ep\.url/, 'histórico (podcast_episodios) deve gravar a URL');
    assert.match(gp, /url:\s*compilado\.url/, 'histórico do compilado deve gravar a URL');
    // A verificação pós-gravação confere a string RELIDA do doc.
    assert.match(gp, /e\.objectPath && e\.downloadToken && e\.url/, 'verificação exige url persistida');
    assert.match(gp, /verifyUrl\(ep\.url\)/, 'verificação byte-a-byte usa a URL persistida relida');
    assert.doesNotMatch(gp, /verifyDownloadUrl/, 'gerador não deve mais verificar URL remontada');
  });

  test('nenhum leitor de episódio remonta URL diretamente (todos via audioUrlDe)', () => {
    const leitores = ['get-edicao.js', 'get-podcast.js', 'get-painel.js', 'get-arquivo.js',
                      'biblioteca.js', 'podcast-rss.js', 'instagram-reel.js'];
    for (const f of leitores) {
      const code = src(path.join(FUNCS, f));
      assert.ok(code.includes('audioUrlDe'), `${f} deve usar audioUrlDe`);
      assert.ok(!/firebaseDownloadUrl\(/.test(code),
        `${f} não pode chamar firebaseDownloadUrl direto — remontagem por env foi a causa do player 0:00`);
    }
  });

  test('auditoria diária reprova episódio sem URL persistida/servível', () => {
    const audit = src(path.join(FUNCS, '..', '..', 'scripts', 'audit-edicao.js'));
    assert.match(audit, /SEM URL persistida/);
    assert.match(audit, /verifyUrl\(e\.url\)/);
  });
});
