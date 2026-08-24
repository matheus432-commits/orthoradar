// MOVER ESPECIALIDADE DE UM ARTIGO — correção pontual SÓ DE DADOS.
//
// Incidente 10/08: "Toxina botulínica antes do reposicionamento cirúrgico de
// lábio" (cirurgia plástica periodontal) apareceu fora de Periodontia na
// Biblioteca. O fix-artigo.js re-enriquece e REGENERA áudio (custa IA + TTS);
// para um rótulo errado isso é desperdício — este script só corrige os DADOS:
//   1. artigos/{id}: especialidade (guarda especialidadeOriginal) + tema
//      recalculado pelo classificador determinístico da nova especialidade;
//   2. podcast_episodios e podcast_arquivo do mesmo artigoId: campo
//      especialidade (a Biblioteca mostra os episódios por ele).
// Zero IA, zero TTS, zero regen. O áudio e a URL persistida não mudam.
//
// Uso (workflow mover-especialidade.yml, SÓ dispatch manual):
//   MOVER_QUERY='trecho do título'  MOVER_ESP='Periodontia'  node scripts/mover-especialidade.js
// A busca é por substring (case/acento-insensível) em titulo_pt e titulo.
// Recusa execução se a query casar mais de 3 artigos (proteção contra
// query genérica demais) — refine a query.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { classificarTema } = require('../netlify/functions/_lib/temas-classificador');

const QUERY = String(process.env.MOVER_QUERY || '').trim();
const ESP   = String(process.env.MOVER_ESP || '').trim();

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

async function main() {
  if (!QUERY || !ESP) { console.error('MOVER_QUERY e MOVER_ESP são obrigatórios'); process.exit(1); }
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  const artigos = await db.query('artigos', { limit: 3000 });
  const alvo = norm(QUERY);
  const achados = artigos.filter(a => norm(a.titulo_pt).includes(alvo) || norm(a.titulo).includes(alvo));
  console.log(`[mover] query "${QUERY}" → ${achados.length} artigo(s)`);
  if (!achados.length) { console.error('[mover] nenhum artigo casa com a query'); process.exit(1); }
  if (achados.length > 3) {
    console.error('[mover] query genérica demais (>3 artigos) — refine para não mover artigo errado:');
    achados.slice(0, 10).forEach(a => console.error(`  - ${a.id}: ${a.titulo_pt || a.titulo}`));
    process.exit(1);
  }

  for (const a of achados) {
    const de = a.especialidade || '(vazia)';
    if (de === ESP) { console.log(`[mover] ${a.id} já está em ${ESP} — nada a fazer`); continue; }
    // Tema recalculado DETERMINISTICAMENTE para a nova especialidade (a
    // taxonomia é por especialidade — o tema antigo não vale mais).
    const tema = classificarTema({
      especialidade: ESP,
      titulo_pt: a.titulo_pt, titulo: a.titulo,
      resumo_pt: a.resumo_pt, abstract: a.abstract,
    }) || '';
    await db.updateDoc('artigos', a.id, {
      especialidade: ESP,
      especialidadeOriginal: a.especialidadeOriginal || de,
      tema,
    });
    console.log(`[mover] artigos/${a.id}: ${de} → ${ESP}${tema ? ` (tema: ${tema})` : ' (sem tema na taxonomia)'}`);
    console.log(`  título: ${a.titulo_pt || a.titulo}`);

    // Episódios do mesmo artigo (Biblioteca lista por especialidade do episódio).
    for (const coll of ['podcast_episodios', 'podcast_arquivo']) {
      const eps = await db.query(coll, {
        where: { fieldFilter: { field: { fieldPath: 'artigoId' }, op: 'EQUAL', value: { stringValue: String(a.id) } } },
        limit: 20,
      }).catch(() => []);
      for (const e of eps) {
        await db.updateDoc(coll, e.id, { especialidade: ESP })
          .then(() => console.log(`[mover] ${coll}/${e.id}: especialidade → ${ESP}`))
          .catch(err => console.error(`[mover] ERRO em ${coll}/${e.id}: ${err.message}`));
      }
    }
  }
  console.log('[mover] concluído — sem IA, sem TTS, sem regen; áudio e URLs intocados.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
