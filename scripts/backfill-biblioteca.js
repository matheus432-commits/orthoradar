// BACKFILL DA BIBLIOTECA — Fase 3 da spec 2 (24/08).
// Gera podcast para artigos ELEGÍVEIS que estão fora da biblioteca por falta
// de áudio (regra 07/08: biblioteca = ativo + título PT + podcast).
//
// ENV:
//   DRY_RUN        padrão true (parser tolerante): lista candidatos + CUSTO
//                  ESTIMADO, não gera nada;
//   LIMIT          artigos processados no run (padrão 20 — custo controlado);
//   ESPECIALIDADE  opcional;
//   DATA_DE / DATA_ATE  opcional (YYYY-MM-DD, sobre a data do artigo).
//
// Idempotente (pula quem já tem episódio); lotes de 5 com pausa e retry com
// backoff; cada sucesso grava em podcast_arquivo (coleção PERMANENTE — o
// cleanup semanal da coleção quente não apaga; diretriz 22/07: nada se perde).
// CUSTO REAL: roteiro (IA) + TTS por artigo — só rodar com DRY_RUN=false
// depois de o fundador aprovar o número do dry-run.

const { Firestore } = require('../netlify/functions/_lib/firestore');
const { backfillBiblioteca } = require('../netlify/functions/_lib/backfill-biblioteca');
const { generateScript } = require('../netlify/functions/_lib/podcast-script');
const { synthesizeLong } = require('../netlify/functions/_lib/tts');
const { uploadMp3 } = require('../netlify/functions/_lib/storage');
const { mp3DurationSecs } = require('../netlify/functions/_lib/mp3');

const DRY_RUN = !/^(false|0|n[aã]o|no)$/i.test(String(process.env.DRY_RUN ?? 'true').trim());
const LIMIT = Number(process.env.LIMIT) > 0 ? Number(process.env.LIMIT) : 20;
const ESPECIALIDADE = String(process.env.ESPECIALIDADE || '').trim() || undefined;
const DATA_DE = String(process.env.DATA_DE || '').trim() || undefined;
const DATA_ATE = String(process.env.DATA_ATE || '').trim() || undefined;

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

const db = new Firestore(projectId, apiKey);

// Gera roteiro STRICT (fidelidade verificada — mesma regra do fix-artigo),
// sintetiza, sobe ao Storage e persiste no ARQUIVO permanente.
async function gerar(a) {
  const pmid = String(a.pmid || a.id || '');
  let roteiro = null;
  for (let t = 1; t <= 3 && !roteiro; t++) {
    roteiro = await generateScript(a, a.especialidade, process.env.ANTHROPIC_API_KEY, { strict: true });
  }
  if (!roteiro) throw new Error('roteiro sem confirmação de fidelidade (3 tentativas)');

  const tts = await synthesizeLong(db, { text: roteiro });
  if (!tts.ok) throw new Error('TTS: ' + tts.reason);
  const audio = Buffer.from(tts.audioBase64, 'base64');
  const secs = mp3DurationSecs(audio);
  if (secs < 40) throw new Error('áudio curto demais (' + secs + 's) — não publicado');

  const objectPath = `podcasts/backfill/${pmid}-${Date.now()}.mp3`;
  const up = await uploadMp3(objectPath, audio);
  if (!up.ok) throw new Error('upload: ' + up.reason);

  await db.setDoc('podcast_arquivo', `backfill-${pmid}`, {
    artigoId: pmid,
    objectPath,
    downloadToken: up.downloadToken,
    bytes: audio.length,
    secs,
    roteiro,
    titulo: a.titulo_pt || '',
    especialidade: a.especialidade || '',
    date: String(a.data || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    tipo: 'resumo',
    origem: 'backfill-biblioteca',
    criadoEm: new Date().toISOString(),
  });
  console.log(`OK ${pmid} · ${secs}s · ${a.especialidade} · "${String(a.titulo_pt).slice(0, 60)}"`);
}

(async () => {
  console.log(`BACKFILL BIBLIOTECA — DRY_RUN=${DRY_RUN} (input recebido: ${JSON.stringify(process.env.DRY_RUN)}) · LIMIT=${LIMIT}${ESPECIALIDADE ? ' · ESP=' + ESPECIALIDADE : ''}${DATA_DE ? ' · DE=' + DATA_DE : ''}${DATA_ATE ? ' · ATE=' + DATA_ATE : ''}`);
  if (!DRY_RUN && (!process.env.ANTHROPIC_API_KEY || !process.env.GOOGLE_TTS_API_KEY)) {
    console.error('Fora do dry-run são necessárias ANTHROPIC_API_KEY e GOOGLE_TTS_API_KEY'); process.exit(1);
  }

  const rel = await backfillBiblioteca(db, {
    dryRun: DRY_RUN, limit: LIMIT, especialidade: ESPECIALIDADE, dataDe: DATA_DE, dataAte: DATA_ATE,
    gerar: DRY_RUN ? undefined : gerar,
  });

  console.log('\n══════════ RELATÓRIO ══════════');
  console.log(`artigos elegíveis SEM áudio (fora da biblioteca): ${rel.totalSemAudio}`);
  console.log('por especialidade:', JSON.stringify(rel.porEspecialidade));
  console.log(`este run processaria: ${rel.processariaNesteRun} · custo estimado do run: ~US$${rel.custoEstimadoDoRunUSD} · custo estimado TOTAL: ~US$${rel.custoEstimadoTotalUSD}`);
  console.log('amostra:');
  for (const a of rel.amostra) console.log(`  ${a.pmid} · ${a.especialidade} · ${a.data} · "${a.titulo}"`);
  if (!rel.dryRun) console.log(`\nGERADOS: ${rel.gerados} · FALHAS: ${rel.falhas}${rel.falhasDetalhe && rel.falhasDetalhe.length ? '\n' + rel.falhasDetalhe.map(f => '  ' + f.pmid + ': ' + f.err).join('\n') : ''}`);
  else console.log('\nDRY-RUN: NADA foi gerado nem gravado. Rode com DRY_RUN=false após aprovar o custo.');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
