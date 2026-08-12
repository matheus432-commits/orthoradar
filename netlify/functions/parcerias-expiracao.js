// EXPIRAÇÃO DOS BENEFÍCIOS DE PARCERIA — scheduled DIÁRIA (netlify.toml).
//
// Para cada resgate com benefício ATIVO:
//   • faltando ≤7 dias → e-mail de aviso ÚNICO (flag aviso7EnviadoEm) com as
//     opções: assinar mensal, assinar anual (2 meses grátis) ou voltar ao
//     plano Gratuito. NUNCA cobrança automática.
//   • no dia do fim (ou depois) → e-mail de encerramento e:
//       - assinante com plano PAGO registrado → status 'convertido_pago'
//         (PROTEÇÃO: jamais rebaixa quem paga);
//       - senão, e somente se o Premium veio DESTA parceria
//         (premiumOrigem === 'parceria') → rebaixa para o Gratuito;
//       - status → 'beneficio_encerrado'.
//
// Sem gate de auth (precedente cleanup-articles/afiliados-expiracao): a
// resposta só carrega CONTADORES — nenhum dado pessoal vaza por HTTP.
// Zero IA/TTS; só Firestore + Resend.

const { Firestore } = require('./_lib/firestore');
const { request } = require('./_lib');
const { STATUS, precisaAviso7, precisaEncerrar, converteuParaPago, diasRestantes } = require('./_lib/parcerias');
const log = require('./_lib/logger');

const BASE_URL = process.env.SITE_URL || 'https://odontofeed.com';

function emailHtml(titulo, corpo) {
  return `<!doctype html><html lang="pt-br"><body style="margin:0;background:#F6F1E8;font-family:Georgia,'Times New Roman',serif;color:#1A1A18;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border:1px solid #EDE6D8;border-radius:14px;padding:28px;">
      <p style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#2D6A4F;margin:0 0 12px;font-family:'Segoe UI',sans-serif;font-weight:700;">OdontoFeed</p>
      <h1 style="font-size:22px;margin:0 0 14px;letter-spacing:-.3px;">${titulo}</h1>
      <div style="font-size:15px;line-height:1.7;font-family:'Segoe UI',sans-serif;color:#3d3a33;">${corpo}</div>
      <a href="${BASE_URL}/precos" style="display:inline-block;margin-top:18px;background:#2D6A4F;color:#fff;border-radius:10px;padding:12px 24px;font-family:'Segoe UI',sans-serif;font-weight:600;font-size:14px;text-decoration:none;">Ver os planos</a>
    </div>
    <p style="font-size:11px;color:#8A8478;font-family:'Segoe UI',sans-serif;margin-top:14px;">Nada será cobrado automaticamente — a escolha é sempre sua.</p>
  </div></body></html>`;
}

async function enviarEmail(resendKey, to, subject, html) {
  const payload = JSON.stringify({ from: 'OdontoFeed <artigos@odontofeed.com>', to: [to], subject, html });
  const buf = Buffer.from(payload, 'utf8');
  const res = await request({
    hostname: 'api.resend.com', path: '/emails', method: 'POST',
    headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json', 'Content-Length': buf.length },
  }, buf);
  if (res.status >= 300) throw new Error('Resend ' + res.status);
}

async function getUser(db, email) {
  const docs = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
    limit: 1,
  }).catch(() => []);
  return docs[0] || null;
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_API_KEY ausente');
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);

  const resgates = await db.query('parcerias_resgates', { limit: 5000 }).catch(() => []);
  let avisos = 0, encerrados = 0, convertidos = 0, rebaixados = 0, falhas = 0;

  for (const r of resgates) {
    if (r.status !== STATUS.ATIVO) continue;
    const email = String(r.usuario_email || '').toLowerCase();
    try {
      if (precisaEncerrar(r, hoje)) {
        const user = email ? await getUser(db, email) : null;
        if (converteuParaPago(user)) {
          await db.updateDoc('parcerias_resgates', r.id, { status: STATUS.CONVERTIDO, encerradoEm: hoje });
          convertidos++;
        } else {
          await db.updateDoc('parcerias_resgates', r.id, { status: STATUS.ENCERRADO, encerradoEm: hoje });
          // Rebaixa SÓ quem tem Premium originado nesta cortesia de parceria.
          if (user && user.premiumOrigem === 'parceria') {
            await db.updateDoc('cadastros', user.id, { plano: 'gratuito', premiumOrigem: null }).catch(() => { falhas++; });
            rebaixados++;
          }
          if (resendKey && email) {
            await enviarEmail(resendKey, email, 'Seu período Premium de cortesia terminou — OdontoFeed',
              emailHtml('Seu período de cortesia terminou',
                `<p>Os 3 meses de OdontoFeed Premium da sua parceria chegaram ao fim hoje. Sua conta voltou ao plano <b>Gratuito</b> — você continua recebendo a edição diária da sua especialidade.</p>
                 <p>Para manter os podcasts, os estudos extras e a Biblioteca completa, escolha um plano quando quiser: <b>mensal</b> ou <b>anual (2 meses grátis)</b>. Nada é cobrado automaticamente.</p>`)).catch(() => { falhas++; });
          }
          encerrados++;
        }
        continue;
      }
      if (precisaAviso7(r, hoje)) {
        if (resendKey && email) {
          const dias = diasRestantes(r.data_fim_beneficio, hoje);
          await enviarEmail(resendKey, email, `Faltam ${dias} dias do seu Premium de cortesia — OdontoFeed`,
            emailHtml(`Faltam ${dias} dias do seu período Premium`,
              `<p>Seu acesso Premium de cortesia termina em <b>${String(r.data_fim_beneficio).split('-').reverse().join('/')}</b>.</p>
               <p>A partir daí, você escolhe: assinar o plano <b>mensal</b>, o <b>anual (2 meses grátis)</b>, ou continuar no plano <b>Gratuito</b> com a edição diária da sua especialidade. Nada será cobrado automaticamente — avisamos de novo no dia.</p>`));
        }
        await db.updateDoc('parcerias_resgates', r.id, { aviso7EnviadoEm: hoje });
        avisos++;
      }
    } catch (err) {
      falhas++;
      log.error('[parcerias-expiracao] falha em resgate', { id: r.id, err: err.message });
    }
  }

  const out = { date: hoje, avisos, encerrados, convertidos, rebaixados, falhas };
  log.info('[parcerias-expiracao] concluído', out);
  return out;
}

// Resposta HTTP: SÓ contadores (mesmo precedente do afiliados-expiracao).
exports.handler = async () => {
  try {
    const r = await main();
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    log.error('[parcerias-expiracao] erro', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};

if (require.main === module) {
  main().then(r => { console.log('Done:', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
