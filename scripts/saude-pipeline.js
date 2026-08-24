// HEALTH CHECK DIÁRIO DO PIPELINE — Fase 4 da spec 2 (24/08).
// Roda no workflow "Saude do Pipeline" (cron diário pós-pipeline + manual).
// SÓ LEITURA no banco; falha (exit 1) quando o dia está abaixo do esperado ou
// quando artigo de edição dos últimos 7 dias está sem áudio/etapa — e AVISA o
// admin por e-mail (Resend) quando ALERT_EMAIL + RESEND_API_KEY existem.
// PRIVACIDADE: o log público só carrega pmids/etapas — nunca dados de dentistas.

const https = require('https');
const { Firestore } = require('../netlify/functions/_lib/firestore');
const { avaliarSaude } = require('../netlify/functions/_lib/saude-pipeline');

const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
const apiKey = process.env.FIREBASE_API_KEY;
if (!apiKey) { console.error('FIREBASE_API_KEY ausente'); process.exit(1); }

// 11 especialidades ativas → em dia normal esperamos edições; o piso fica
// conservador (1) para não alarmar em feriado de produção baixa — o número
// exato do dia sai no relatório de qualquer forma.
const MIN_EDICOES = Number(process.env.MIN_EDICOES) > 0 ? Number(process.env.MIN_EDICOES) : 1;

function enviarAlerta(assunto, texto) {
  const key = process.env.RESEND_API_KEY, para = process.env.ALERT_EMAIL;
  if (!key || !para) { console.log('(sem RESEND_API_KEY/ALERT_EMAIL — alerta só no log)'); return Promise.resolve(); }
  const body = JSON.stringify({
    from: process.env.EMAIL_FROM || 'OdontoFeed <alertas@odontofeed.com>',
    to: [para], subject: assunto,
    html: '<pre style="font-family:monospace;font-size:13px;">' + texto.replace(/</g, '&lt;') + '</pre>',
  });
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { console.log('alerta e-mail:', res.statusCode); res.resume(); res.on('end', resolve); });
    req.on('error', (e) => { console.log('alerta falhou:', e.message); resolve(); });
    req.end(body);
  });
}

(async () => {
  const db = new Firestore(projectId, apiKey);
  const s = await avaliarSaude(db, {
    bucket: process.env.GCS_BUCKET || (projectId + '.appspot.com'),
    minEdicoesEsperadas: MIN_EDICOES,
  });

  console.log(`SAÚDE DO PIPELINE — ${s.hoje}`);
  console.log(`edições de hoje: ${s.edicoesHoje} (${s.especialidadesHoje.join(', ') || 'nenhuma'})`);
  console.log(`artigos de hoje: ${s.artigosHoje} · completos em TODAS as etapas (com áudio): ${s.completosHoje}`);
  console.log(`janela 7d (${s.janela7d.de} → ${s.janela7d.ate}): ${s.janela7d.artigos} artigos de edição · violações: ${s.janela7d.violacoes.length}`);
  for (const v of s.janela7d.violacoes) console.log(`  ${v.pmid}: ${v.falta}`);

  if (s.ok) { console.log('\n✓ Pipeline saudável.'); return; }

  const texto = ['SAÚDE DO PIPELINE — PROBLEMAS EM ' + s.hoje, '', ...s.problemas, '',
    'Violações (até 50):', ...s.janela7d.violacoes.map(v => `  ${v.pmid}: ${v.falta}`),
    '', 'Detalhe completo: workflow "Diagnostico do Pipeline (leitura)" no Actions.'].join('\n');
  console.error('\n✗ PROBLEMAS:\n' + s.problemas.map(p => '  ' + p).join('\n'));
  await enviarAlerta('⚠️ OdontoFeed — pipeline abaixo do esperado (' + s.hoje + ')', texto);
  process.exit(1);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
