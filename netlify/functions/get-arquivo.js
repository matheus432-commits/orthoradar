// GET /.netlify/functions/get-arquivo?secret=ADMIN_SECRET
//   → catálogo completo (todos os estudos com resumo + áudio, se existir)
// GET /.netlify/functions/get-arquivo?secret=...&id=PMID
//   → resumo escrito completo (texto) daquele estudo
//
// Uso: página admin /arquivo.html — o fundador revisa TUDO que o sistema gerou.
// Áudios vêm de podcast_salvos (acervo permanente) e podcast_episodios
// (recentes). Nota: episódios antigos não salvos são apagados na retenção, então
// nem todo áudio histórico continua existindo — o catálogo mostra o que existe.

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { firebaseDownloadUrl } = require('./_lib/storage');
const log = require('./_lib/logger');

const sel = (...paths) => ({ fields: paths.map(fieldPath => ({ fieldPath })) });

// Constrói o mapa pmid → { url, secs } com TODOS os áudios já produzidos.
// Diretriz 22/07: nada é deletado — episódios antigos vão para podcast_arquivo
// (mesmos campos) e os MP3 ficam no Storage para sempre.
async function audioMap(db, bucket) {
  const map = new Map();
  // Arquivo permanente (mais antigo) + coleção quente (recentes, sobrescreve).
  for (const coll of ['podcast_arquivo', 'podcast_episodios']) {
    const eps = await db.query(coll, {
      select: sel('artigoId', 'objectPath', 'downloadToken', 'secs'), limit: 5000,
    }).catch(() => []);
    for (const e of eps) {
      const k = String(e.artigoId || '');
      if (k && e.objectPath && e.downloadToken) {
        map.set(k, { url: firebaseDownloadUrl(bucket, e.objectPath, e.downloadToken), secs: Number(e.secs) || 0 });
      }
    }
  }
  // Preservados (acervo permanente) — têm prioridade (nunca somem).
  const salvos = await db.query('podcast_salvos', {
    select: sel('objectPath', 'downloadToken', 'secs'), limit: 5000,
  }).catch(() => []);
  for (const s of salvos) {
    if (s.id && s.objectPath && s.downloadToken) {
      map.set(String(s.id), { url: firebaseDownloadUrl(bucket, s.objectPath, s.downloadToken), secs: Number(s.secs) || 0 });
    }
  }
  return map;
}

function resumoDe(a) {
  return a.resumo_pt || a.resumo || a.resumoEstruturado || a.resumo_estruturado || '';
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  const bucket = process.env.GCS_BUCKET || (projectId + '.appspot.com');
  const db = new Firestore(projectId, apiKey);
  const id = event.queryStringParameters && event.queryStringParameters.id;

  try {
    // ── Detalhe de um estudo (resumo escrito completo) ──
    if (id) {
      let a = await db.getDoc('artigos', String(id)).catch(() => null);
      if (!a) {
        const q = await db.query('artigos', {
          where: { fieldFilter: { field: { fieldPath: 'pmid' }, op: 'EQUAL', value: { stringValue: String(id) } } },
          limit: 1,
        }).catch(() => []);
        a = q[0] || null;
      }
      if (!a) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
      const pmid = String(a.pmid || a.id);
      let audio = await db.getDoc('podcast_salvos', pmid).catch(() => null);
      let audioUrl = null, secs = 0;
      if (audio?.objectPath && audio?.downloadToken) { audioUrl = firebaseDownloadUrl(bucket, audio.objectPath, audio.downloadToken); secs = Number(audio.secs) || 0; }
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          pmid, titulo: a.titulo_pt || a.titulo || '', especialidade: a.especialidade || '',
          data: a.data || '', nivel: a.nivel_evidencia || '', journal: a.journal || '', year: a.year || '',
          resumo: resumoDe(a), audioUrl, secs,
        }),
      };
    }

    // ── Catálogo completo (leve — sem o texto do resumo) ──
    const audio = await audioMap(db, bucket);
    const arts = await db.query('artigos', {
      select: sel('pmid', 'titulo_pt', 'titulo', 'especialidade', 'data', 'nivel_evidencia', 'journal', 'year'),
      limit: 5000,
    }).catch(() => []);

    const artigos = arts.map(a => {
      const pmid = String(a.pmid || a.id);
      const au = audio.get(pmid) || audio.get(String(a.id));
      return {
        pmid, titulo: a.titulo_pt || a.titulo || '(sem título)',
        especialidade: a.especialidade || '—', data: a.data || '',
        nivel: a.nivel_evidencia || '', journal: a.journal || '', year: a.year || '',
        audioUrl: au ? au.url : null, secs: au ? au.secs : null,
      };
    }).sort((x, y) => String(y.data).localeCompare(String(x.data)));

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        total: artigos.length,
        comAudio: artigos.filter(a => a.audioUrl).length,
        artigos,
      }),
    };
  } catch (err) {
    log.error('[arquivo] erro', { error: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
