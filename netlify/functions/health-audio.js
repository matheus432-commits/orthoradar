// DIAGNÓSTICO DO ÁUDIO NO CAMINHO DO USUÁRIO — roda NO NETLIFY (produção).
//
// GET /.netlify/functions/health-audio?secret=ADMIN_SECRET
//
// Motivação (incidentes 04-07/08, player 0:00 recorrente): o job de podcasts
// e a auditoria provam que docs, URLs e MP3 estão íntegros — mas rodam no
// GitHub Actions. Quando o dentista ainda assim não ouve, o elo suspeito é o
// AMBIENTE DE LEITURA (funções do Netlify: versão do código deployada, env,
// rede). Esta função executa EXATAMENTE o que o get-edicao faz para cada uma
// das 11 especialidades e testa cada URL de áudio com um GET de 1 byte A
// PARTIR DO NETLIFY, devolvendo um veredito por especialidade.
//
// Interpretação rápida:
//   • 404 ao abrir esta função → o Netlify NÃO deployou o código novo
//     (a função nem existe lá) — é o deploy que está travado.
//   • ok:false com urlPersistida:false → doc sem URL gravada e leitor antigo.
//   • ok:false com status 404 na URL → bucket/objeto errado no ambiente.
//   • tudo ok:true → o problema está no NAVEGADOR/frontend, não nas funções.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { CICLO } = require('./_lib/especialidade-identidade');
const { specialtySlug, espDigestSlug } = require('./_lib/slug');
const { audioUrlDe, verifyUrl } = require('./_lib/storage');

// Marcador de versão: se a resposta trouxer outra string (ou a função der
// 404), o Netlify está servindo um deploy antigo.
const VERSAO = 'url-persistida-2026-08-07';

async function diagnosticarEspecialidade(db, esp, bucket, hoje) {
  const slug = specialtySlug(esp);
  const out = { especialidade: esp, slug, ok: false, problemas: [] };

  const doc = await db.getDoc('podcasts', slug).catch(() => null);
  if (!doc) { out.problemas.push('doc podcasts/' + slug + ' não existe'); return out; }
  out.dateDoc = doc.date || '';
  if (doc.date !== hoje) out.problemas.push(`doc é de ${doc.date || '?'} (não de hoje)`);

  const eps = Array.isArray(doc.episodios) ? doc.episodios : [];
  if (!eps.length) { out.problemas.push('doc sem episodios[]'); return out; }

  // Confere o pareamento com a edição do dia (o front só mostra o player se
  // o artigoId do episódio bater com um artigo do digest).
  const digest = await db.getDoc('digests_especialidade', `${espDigestSlug(esp)}_${hoje}`).catch(() => null);
  if (digest && Array.isArray(digest.artigos)) {
    const idsEdicao = new Set(digest.artigos.map(a => String(a.pmid || a.id || '')));
    const fora = eps.filter(e => !idsEdicao.has(String(e.artigoId || '')));
    if (fora.length) out.problemas.push(`episódios sem artigo correspondente na edição: ${fora.map(e => e.artigoId).join(', ')}`);
  } else {
    out.problemas.push('digest de hoje não encontrado para comparar artigoIds');
  }

  // Testa cada URL exatamente como o get-edicao entrega (persistida > rebuild)
  out.episodios = await Promise.all(eps.map(async (e) => {
    const url = audioUrlDe(e, bucket);
    const r = { n: e.n, artigoId: String(e.artigoId || ''), urlPersistida: !!e.url };
    if (!url) { r.ok = false; r.erro = 'sem url e sem path/token'; return r; }
    const vu = await verifyUrl(url);
    r.ok = vu.ok; r.status = vu.status;
    if (!vu.ok) r.url = url; // só expõe a URL quando falha, p/ investigar
    return r;
  }));
  const ruins = out.episodios.filter(e => !e.ok);
  if (ruins.length) out.problemas.push(`${ruins.length} episódio(s) com áudio inacessível a partir do Netlify`);

  out.ok = out.problemas.length === 0;
  return out;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');

  try {
    const especialidades = await Promise.all(
      CICLO.map(esp => diagnosticarEspecialidade(db, esp, bucket, hoje).catch(err => ({
        especialidade: esp, ok: false, problemas: ['diagnóstico falhou: ' + err.message],
      })))
    );
    const falhas = especialidades.filter(e => !e.ok);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        versao: VERSAO,
        dia: hoje,
        // Env de leitura do Netlify — se divergir do bucket do upload, é a
        // causa clássica dos players 0:00 em docs legados sem URL persistida.
        ambiente: { bucketNetlify: bucket, gcsBucketDefinido: !!process.env.GCS_BUCKET },
        resumo: falhas.length
          ? `✗ ${falhas.length} especialidade(s) com problema no caminho do usuário`
          : '✓ as 11 especialidades servem áudio a partir do Netlify',
        especialidades,
      }, null, 2),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
