// Geração diária dos podcasts — 3 áudios por especialidade (um por artigo da
// edição do dia), para TODA especialidade com ao menos um usuário ativo.
// Diretriz 07/2026: o podcast é do plano GRATUITO — o áudio é compartilhado
// por especialidade, então o custo não cresce com o nº de usuários.
//
// Fluxo por especialidade (SEQUENCIAL — exigência do orçamento de TTS):
//   edição do dia (digests_especialidade) → roteiro por artigo (Claude) →
//   TTS Neural2 (com guardrail de orçamento) → upload/rotação no Storage →
//   metadados em `podcasts/{slug}` com a lista de episódios.
//
// Protegido por lock (podcast_lock) contra execuções concorrentes — o contador
// de orçamento é read-modify-write, então dois runs simultâneos poderiam gastar
// em dobro. Se faltar GOOGLE_TTS_API_KEY / credenciais do Storage, cada etapa é
// pulada sem quebrar o pipeline.

const crypto = require('crypto');
const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { generateScript } = require('./_lib/podcast-script');
const { synthesizeLong } = require('./_lib/tts');
// DIRETRIZ 22/07: nenhum objeto de áudio é deletado do Storage (acervo da
// futura biblioteca pública) — por isso não importamos deleteObject.
const { uploadMp3 } = require('./_lib/storage');
const { billableChars } = require('./_lib/tts-budget');
const { mp3DurationSecs, mp3Silence } = require('./_lib/mp3');
const { specialtySlug: slug, espDigestSlug } = require('./_lib/slug');
const { acquireLock, releaseLock } = require('./_lib/pipeline-lock');
const { getActiveAd } = require('./_lib/ads');
const log = require('./_lib/logger');

const LOCK = 'podcast_lock';
const MAX_EPISODES = 3;
// Episódios ficam disponíveis por N dias (feed RSS / Spotify) e depois são
// removidos do Storage — controla o custo de armazenamento (~14d × 11 esp × 3 eps).
const RETENTION_DAYS = 14;

// Especialidades distintas entre os usuários ATIVOS (qualquer plano — o
// podcast agora é para todos).
async function activeSpecialties(db) {
  let users = [], pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    users = users.concat(docs);
    pageToken = nextPageToken;
  } while (pageToken);

  const set = new Set();
  for (const u of users) {
    if (u.ativo === false) continue;
    const specs = Array.isArray(u.especialidade) ? u.especialidade : (u.especialidade ? [u.especialidade] : []);
    for (const s of specs) if (s) set.add(s);
  }
  return [...set];
}

// Remove podcasts de especialidades sem usuário ativo — invalida os tokens de
// download órfãos. Apaga TODOS os objetos do doc (episódios + legado) antes do doc.
// DIRETRIZ 22/07 (fundador): NUNCA apagar áudios/resumos — tudo fica
// armazenado para a futura biblioteca pública. A "limpeza" remove apenas o
// PONTEIRO diário (doc podcasts/{slug}) de especialidade sem usuário ativo;
// os episódios continuam em podcast_episodios/podcast_arquivo e os MP3
// permanecem intactos no Storage.
async function cleanupStale(db, activeSlugs) {
  let existing = [];
  try { existing = await db.query('podcasts', { limit: 200 }); } catch { return; }
  for (const doc of existing) {
    if (!doc.id || activeSlugs.has(doc.id)) continue;
    await db.deleteDoc('podcasts', doc.id).catch(() => {});
    log.info('[podcasts] ponteiro diário removido (áudios preservados)', { slug: doc.id });
  }
}

// ARQUIVA episódios além da janela do feed. DIRETRIZ 22/07 (fundador): NADA é
// apagado — nem doc, nem áudio no Storage. O episódio antigo apenas MUDA de
// coleção (podcast_episodios → podcast_arquivo, mesmo id/campos), mantendo a
// coleção "quente" pequena para as queries do feed RSS. O acervo completo
// (podcast_arquivo + Storage intacto) alimentará a futura biblioteca pública.
// Best-effort: falha aqui nunca bloqueia a geração do dia.
async function cleanupOldEpisodes(db) {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
  let old = [];
  try {
    old = await db.query('podcast_episodios', {
      where: { fieldFilter: { field: { fieldPath: 'date' }, op: 'LESS_THAN', value: { stringValue: cutoff } } },
      limit: 300,
    });
  } catch (err) {
    log.warn('[podcasts] arquivamento — query falhou', { err: err.message });
    return;
  }
  for (const ep of old) {
    if (!ep.id) continue;
    // 1. Copia o doc inteiro para o ARQUIVO permanente (id preservado).
    const { id, ...campos } = ep;
    const arq = await db.setDoc('podcast_arquivo', id, {
      ...campos, arquivadoEm: new Date().toISOString(),
    }).then(() => true).catch(e => { log.warn('[podcasts] arquivamento falhou — mantendo p/ retry', { ep: id, err: e.message }); return false; });
    if (!arq) continue;
    // 2. Só então remove da coleção quente. O MP3 no Storage fica intocado.
    await db.deleteDoc('podcast_episodios', id).catch(() => {});
  }
  if (old.length) log.info('[podcasts] arquivamento aplicado (nada apagado)', { cutoff, movidos: old.length });
}

// Artigos do dia: a edição compartilhada (mesma que o e-mail e a /edicao.html).
// Fallback: artigo mais recente da especialidade, como episódio único.
async function editionArticles(db, especialidade) {
  const today = new Date().toISOString().slice(0, 10);
  const doc = await db.getDoc('digests_especialidade', `${espDigestSlug(especialidade)}_${today}`).catch(() => null);
  if (doc?.status === 'ready' && Array.isArray(doc.artigos) && doc.artigos.length) {
    return doc.artigos.slice(0, MAX_EPISODES);
  }
  const where = { fieldFilter: { field: { fieldPath: 'especialidade' }, op: 'EQUAL', value: { stringValue: especialidade } } };
  let rows = await db.query('artigos', { where, orderBy: [{ field: { fieldPath: 'data' }, direction: 'DESCENDING' }], limit: 5 }).catch(() => null);
  if (!rows) rows = await db.query('artigos', { where, limit: 20 }).catch(() => []);
  rows.sort((a, b) => (b.data || '') > (a.data || '') ? 1 : (b.data || '') < (a.data || '') ? -1 : 0);
  const art = rows.find(a => a.status === 'active') || rows[0] || null;
  return art ? [art] : [];
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey    = process.env.FIREBASE_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY || null;
  if (!apiKey) { log.error('[podcasts] FIREBASE_API_KEY ausente'); return { error: 'no_firebase_key' }; }

  const db = new Firestore(projectId, apiKey);
  const runId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  const locked = await acquireLock(db, runId, LOCK);
  if (!locked) { log.warn('[podcasts] outro run em andamento — abortando'); return { aborted: true }; }

  let generated = 0, skipped = 0, total = 0;
  try {
    const specialties = await activeSpecialties(db);
    total = specialties.length;
    const activeSlugs = new Set(specialties.map(slug).filter(Boolean));
    await cleanupStale(db, activeSlugs);
    await cleanupOldEpisodes(db); // retenção do histórico (feed RSS)
    log.info('[podcasts] especialidades ativas', { count: total, specialties });

    // Patrocínio do podcast (slot 'podcast') — uma consulta por run, best-effort.
    const anuncio = await getActiveAd(db, 'podcast').catch(() => null);

    // SEQUENCIAL — o contador de orçamento do TTS depende disso.
    for (const esp of specialties) {
      const s = slug(esp);
      if (!s) { log.warn('[podcasts] slug vazio — pulando', { esp }); skipped++; continue; }
      try {
        const forceRegen = String(process.env.FORCE_REGEN || '').toLowerCase() === 'true';

        const artigos = await editionArticles(db, esp);
        if (!artigos.length) { log.warn('[podcasts] sem artigos', { esp }); skipped++; continue; }

        // Idempotência diária: só pula quando os episódios de hoje CORRESPONDEM
        // à edição atual (mesmos artigos). Um doc de hoje com episódios de
        // outros artigos (ex.: regeneração manual antes da meia-noite, quando a
        // edição ainda não existia) NÃO conta — senão o pipeline das 00h herda
        // áudio órfão e o dentista fica sem botão de áudio (bug real 19/07).
        // FORCE_REGEN=true ignora o check.
        const existing = await db.getDoc('podcasts', s).catch(() => null);
        const expectedIds = artigos.map(a => String(a.pmid || a.id || '')).filter(Boolean);
        const existingIds = (Array.isArray(existing?.episodios) ? existing.episodios : [])
          .map(e => String(e.artigoId || '')).filter(Boolean);
        const upToDate = existing?.date === today &&
          existingIds.length === expectedIds.length &&
          expectedIds.every(id => existingIds.includes(id));
        if (!forceRegen && upToDate) {
          log.info('[podcasts] já gerado hoje (episódios batem com a edição) — pulando', { esp });
          skipped++;
          continue;
        }
        if (existing?.date === today && !upToDate) {
          log.warn('[podcasts] episódios de hoje NÃO correspondem à edição — regenerando', {
            esp, existentes: existingIds, esperados: expectedIds, forceRegen,
          });
        } else if (forceRegen && existing?.date === today) {
          log.warn('[podcasts] FORCE_REGEN — regenerando episódios de hoje', { esp });
        }

        const episodios = [];
        const buffers   = []; // áudios do dia — reusados p/ compilar a edição completa
        for (let i = 0; i < artigos.length; i++) {
          const art = artigos[i];
          const script = await generateScript(art, esp, anthropicKey, {
            sponsorText: i === 0 ? (anuncio?.textoPodcast || null) : null, // patrocínio só no 1º episódio
          });
          // Sem material narratável → sem episódio (nunca publicar áudio "casca
          // vazia" de segundos — incidente 15/07, áudio de 24s sem conteúdo).
          if (!script) { log.warn('[podcasts] episódio pulado — sem roteiro (artigo sem material)', { esp, ep: i + 1, artigo: art.pmid || art.id }); continue; }

          const tts = await synthesizeLong(db, { text: script });
          if (!tts.ok) { log.warn('[podcasts] TTS pulado', { esp, ep: i + 1, reason: tts.reason }); continue; }

          const audio = Buffer.from(tts.audioBase64, 'base64');
          // Cinto e suspensório: áudio anormalmente curto (<40s) = narração sem
          // conteúdo real; descarta em vez de publicar.
          const secsCheck = mp3DurationSecs(audio);
          if (secsCheck > 0 && secsCheck < 40) {
            log.warn('[podcasts] áudio curto demais — descartado', { esp, ep: i + 1, secs: secsCheck, artigo: art.pmid || art.id });
            continue;
          }
          // Path datado: o áudio de cada dia é um objeto próprio — o de ontem
          // continua válido p/ o feed RSS (Spotify) até a retenção limpar.
          const path  = `podcasts/${s}/${today}/ep${i + 1}.mp3`;
          const up = await uploadMp3(path, audio);
          if (!up.ok) { log.warn('[podcasts] upload pulado', { esp, ep: i + 1, reason: up.reason }); continue; }

          episodios.push({
            n:             i + 1,
            artigoId:      String(art.pmid || art.id || ''),
            titulo:        art.titulo_pt || art.titulo || '',
            objectPath:    path,
            downloadToken: up.downloadToken,
            chars:         billableChars(script),
            bytes:         audio.length,
            secs:          mp3DurationSecs(audio),
            roteiro:       script, // texto narrado — base da sincronia dos Reels (cena ↔ áudio)
          });
          buffers.push(audio);
        }

        if (!episodios.length) { skipped++; continue; }

        // EDIÇÃO COMPLETA (decisão 19/07): concatena os episódios do dia num
        // único MP3 (~8 min) — é ESTE áudio que o feed mestre publica no
        // Spotify para as especialidades do dia. Sem custo de TTS (reusa os
        // áudios); MP3 CBR do mesmo encoder concatena por bytes sem re-encode.
        // Entre um estudo e outro entra uma PAUSA de ~1,2s (frames de silêncio
        // fabricados no MESMO formato do áudio — ver _lib/mp3.js); se o formato
        // for ilegível, concatena sem pausa. Best-effort: sem o compilado, o
        // feed cai no episódio 1.
        let compilado = null;
        try {
          const pausa = buffers.length > 1 ? mp3Silence(buffers[0], 1200) : null;
          if (buffers.length > 1 && !pausa) {
            log.warn('[podcasts] pausa entre estudos indisponível (formato MP3 ilegível) — concatenando direto', { esp });
          }
          const partes = [];
          buffers.forEach((b, i) => { if (i > 0 && pausa) partes.push(pausa); partes.push(b); });
          const fullBuf  = Buffer.concat(partes);
          const fullPath = `podcasts/${s}/${today}/edicao-completa.mp3`;
          const upFull   = await uploadMp3(fullPath, fullBuf);
          if (upFull.ok) {
            compilado = {
              objectPath:    fullPath,
              downloadToken: upFull.downloadToken,
              bytes:         fullBuf.length,
              secs:          mp3DurationSecs(fullBuf),
              titulos:       episodios.map(e => e.titulo),
            };
          } else {
            log.warn('[podcasts] upload da edição completa pulado', { esp, reason: upFull.reason });
          }
        } catch (err) {
          log.warn('[podcasts] compilação da edição completa falhou', { esp, err: err.message });
        }

        await db.setDoc('podcasts', s, {
          especialidade: esp,
          date:          today,
          episodios,
          compilado, // edição completa (áudio único) — null se a compilação falhou
          // Campos legados (1º episódio) — mantêm consumidores antigos funcionando
          artigoId:      episodios[0].artigoId,
          titulo:        episodios[0].titulo,
          objectPath:    episodios[0].objectPath,
          downloadToken: episodios[0].downloadToken,
          geradoEm:      new Date().toISOString(),
        }).catch(e => log.warn('[podcasts] setDoc falhou', { esp, err: e.message }));

        // Histórico permanente (até a retenção): um doc por episódio, id
        // determinístico ({slug}_{data}_ep{n}) — re-runs não duplicam.
        for (const ep of episodios) {
          await db.setDoc('podcast_episodios', `${s}_${today}_ep${ep.n}`, {
            slug:          s,
            especialidade: esp,
            date:          today,
            n:             ep.n,
            artigoId:      ep.artigoId,
            titulo:        ep.titulo,
            objectPath:    ep.objectPath,
            downloadToken: ep.downloadToken,
            bytes:         ep.bytes,
            secs:          ep.secs,
            roteiro:       ep.roteiro || '',
            geradoEm:      new Date().toISOString(),
          }).catch(e => log.warn('[podcasts] histórico setDoc falhou', { esp, ep: ep.n, err: e.message }));
        }
        // Edição completa no histórico ({slug}_{data}_completo) — é o item que
        // o feed mestre do Spotify publica; a retenção limpa igual aos demais.
        if (compilado) {
          await db.setDoc('podcast_episodios', `${s}_${today}_completo`, {
            slug:          s,
            especialidade: esp,
            date:          today,
            tipo:          'completo',
            n:             0,
            titulo:        `Edição completa — ${episodios.length} estudo${episodios.length === 1 ? '' : 's'}`,
            titulos:       compilado.titulos,
            objectPath:    compilado.objectPath,
            downloadToken: compilado.downloadToken,
            bytes:         compilado.bytes,
            secs:          compilado.secs,
            geradoEm:      new Date().toISOString(),
          }).catch(e => log.warn('[podcasts] histórico da edição completa falhou', { esp, err: e.message }));
        }

        generated += episodios.length;
        log.info('[podcasts] gerado', { esp, episodios: episodios.length });
      } catch (err) {
        log.error('[podcasts] erro na especialidade', { esp, err: err.message });
        skipped++;
      }
    }
  } finally {
    await releaseLock(db, runId, LOCK);
  }

  log.info('[podcasts] concluído', { generated, skipped, total });
  return { generated, skipped, total };
}

exports.handler = async (event) => {
  if (!checkAdmin(event)) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  try { return { statusCode: 200, body: JSON.stringify(await main()) }; }
  catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};

if (require.main === module) {
  main().then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
        .catch(e => { console.error(e.message); process.exit(1); });
}
