// Correção pontual de um artigo defeituoso (incidente 15/07: artigo NÃO
// enriquecido — card com título em inglês e áudio de 24s sem conteúdo).
//
// O que faz (roda no CI, com os secrets):
//   1. Localiza o artigo em `artigos` (busca por trecho do título, env FIX_QUERY).
//   2. Enriquece: titulo_pt, resumo_pt (com veredito), achados etc. — grava no doc.
//   3. Gera o resumo completo (o "Ler o resumo").
//   4. Regenera o ROTEIRO (regras novas: abstract + veredito) e o ÁUDIO via TTS.
//   5. Atualiza TODAS as referências de áudio do artigo (podcast_episodios,
//      podcast_salvos, podcasts/{slug} de hoje) apontando para o áudio novo.
//
// Envs: FIX_QUERY (trecho do título), FIX_ESP (especialidade p/ narração).

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { enrichArticle, generateResumoCompleto } = require('../netlify/functions/_lib/claude');
const { generateScript } = require('../netlify/functions/_lib/podcast-script');
const { synthesize } = require('../netlify/functions/_lib/tts');
const { uploadMp3 } = require('../netlify/functions/_lib/storage');
const { mp3DurationSecs } = require('../netlify/functions/_lib/mp3');
const { specialtySlug } = require('../netlify/functions/_lib/slug');

const QUERY = (process.env.FIX_QUERY || 'arch width changes following first premolar').toLowerCase();
const ESP   = process.env.FIX_ESP || 'Ortodontia';

(async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !process.env.ANTHROPIC_API_KEY) { console.log('FALTAM_SECRETS'); process.exit(1); }
  const db = new Firestore(projectId, apiKey);

  // 1. Localizar o artigo pelo trecho do título.
  const candidatos = await db.query('artigos', { limit: 3000 });
  const alvo = candidatos.find(a =>
    String(a.titulo || a.title || '').toLowerCase().includes(QUERY) ||
    String(a.titulo_pt || '').toLowerCase().includes(QUERY));
  if (!alvo) { console.log('ARTIGO_NAO_ENCONTRADO para:', QUERY); process.exit(1); }
  const pmid = String(alvo.pmid || alvo.id);
  console.log('ARTIGO:', pmid, '|', String(alvo.titulo || '').slice(0, 90));
  console.log('estado atual: titulo_pt?', !!alvo.titulo_pt, '| resumo_pt chars:', String(alvo.resumo_pt || '').length);

  // 2. Enriquecer (traduz título, resumo com veredito, achados, nível).
  const enriched = await enrichArticle(alvo);
  if (!enriched?.titulo_pt) { console.log('ENRIQUECIMENTO_FALHOU'); process.exit(1); }
  await db.updateDoc('artigos', alvo.id, {
    titulo_pt: enriched.titulo_pt,
    resumo_pt: enriched.resumo_pt,
    impacto_pratico: enriched.impacto_pratico,
    achados_principais: enriched.achados_principais,
    nivel_evidencia: enriched.nivel_evidencia,
    limitacoes: enriched.limitacoes,
  });
  console.log('ENRIQUECIDO:', enriched.titulo_pt.slice(0, 90));

  const artigoAtualizado = { ...alvo, ...enriched };

  // 3. Resumo completo (best-effort — o "Ler o resumo" do site).
  try {
    const rc = await generateResumoCompleto(artigoAtualizado);
    if (rc) { await db.updateDoc('artigos', alvo.id, { resumo_completo: rc }); console.log('RESUMO_COMPLETO ok:', rc.length, 'chars'); }
    else console.log('RESUMO_COMPLETO reprovado no validador — mantido sem');
  } catch (e) { console.log('RESUMO_COMPLETO falhou:', e.message); }

  // 4. Roteiro + áudio novos (regras novas: abstract na geração + veredito).
  const roteiro = await generateScript(artigoAtualizado, ESP, process.env.ANTHROPIC_API_KEY);
  if (!roteiro) { console.log('SEM_ROTEIRO (material insuficiente mesmo após enriquecer)'); process.exit(1); }
  console.log('ROTEIRO:', roteiro.length, 'chars |', roteiro.slice(0, 140).replace(/\n/g, ' '), '…');

  const tts = await synthesize(db, { text: roteiro });
  if (!tts.ok) { console.log('TTS_FALHOU:', tts.reason); process.exit(1); }
  const audio = Buffer.from(tts.audioBase64, 'base64');
  const secs = mp3DurationSecs(audio);
  console.log('AUDIO NOVO:', audio.length, 'bytes |', secs, 's');
  if (secs < 40) { console.log('AUDIO_AINDA_CURTO — abortando sem publicar'); process.exit(1); }

  const objectPath = `podcasts/fixes/${pmid}-${Date.now()}.mp3`;
  const up = await uploadMp3(objectPath, audio);
  if (!up.ok) { console.log('UPLOAD_FALHOU:', up.reason); process.exit(1); }

  // 5. Atualizar todas as referências de áudio deste artigo.
  const patch = { objectPath, downloadToken: up.downloadToken, bytes: audio.length, secs, roteiro, titulo: enriched.titulo_pt };
  let refs = 0;

  const eps = await db.query('podcast_episodios', {
    where: { fieldFilter: { field: { fieldPath: 'artigoId' }, op: 'EQUAL', value: { stringValue: pmid } } },
    limit: 20,
  }).catch(() => []);
  for (const e of eps) {
    if (e.tipo === 'completo') continue; // edição compilada não é deste artigo só
    await db.updateDoc('podcast_episodios', e.id, patch);
    console.log('ATUALIZADO podcast_episodios/' + e.id);
    refs++;
  }

  const salvo = await db.getDoc('podcast_salvos', pmid).catch(() => null);
  if (salvo) {
    await db.updateDoc('podcast_salvos', pmid, { objectPath, downloadToken: up.downloadToken, secs, bytes: audio.length, titulo: enriched.titulo_pt });
    console.log('ATUALIZADO podcast_salvos/' + pmid);
    refs++;
  }

  const diario = await db.getDoc('podcasts', specialtySlug(ESP)).catch(() => null);
  if (diario && Array.isArray(diario.episodios) && diario.episodios.some(e => String(e.artigoId) === pmid)) {
    diario.episodios = diario.episodios.map(e => String(e.artigoId) === pmid ? { ...e, ...patch } : e);
    await db.setDoc('podcasts', specialtySlug(ESP), diario);
    console.log('ATUALIZADO podcasts/' + specialtySlug(ESP));
    refs++;
  }

  console.log(refs ? `OK — ${refs} referência(s) de áudio atualizadas.` :
    'OK — artigo corrigido; nenhuma referência de áudio antiga encontrada (o player que mostrava 24s passará a 404 ou já expirou; o card agora tem título/resumo corretos).');
})().catch(e => { console.error('ERRO', e.message); process.exit(1); });
