const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "orthoradar.firebaseapp.com",
  projectId: "orthoradar",
  storageBucket: "orthoradar.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}
const db = getFirestore(app);

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_KCF7fs3T_JxYL3yhWF9TWs2oQarMXtehY';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/html; charset=utf-8'
  };

  const { email, token } = event.queryStringParameters || {};

  if (!email || !token) {
    return { statusCode: 400, headers, body: errorPage('Link inválido', 'O link de verificação está incompleto.') };
  }

  try {
    const q = query(collection(db, 'cadastros'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { statusCode: 404, headers, body: errorPage('Email não encontrado', 'Este email não está cadastrado na plataforma.') };
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (userData.verificado) {
      return { statusCode: 200, headers, body: alreadyVerifiedPage(userData.nome) };
    }

    if (userData.verifyToken !== token) {
      return { statusCode: 400, headers, body: errorPage('Link inválido', 'Este link de verificação é inválido ou expirou.') };
    }

    // Activate account
    await updateDoc(doc(db, 'cadastros', userDoc.id), {
      verificado: true,
      ativo: true,
      verificadoEm: new Date().toISOString(),
      verifyToken: null
    });

    console.log('Email verified:', email);

    // Send welcome email
    const unsubscribeUrl = `https://odontofeed.com/.netlify/functions/unsubscribe?email=${encodeURIComponent(email)}`;
    await sendWelcomeEmail(userData.nome, email, userData.especialidade, userData.temas, unsubscribeUrl);

    return { statusCode: 200, headers, body: successPage(userData.nome, userData.especialidade) };

  } catch (err) {
    console.error('Verify error:', err);
    return { statusCode: 500, headers, body: errorPage('Erro interno', 'Não foi possível verificar seu email. Tente novamente.') };
  }
};

async function sendWelcomeEmail(nome, email, especialidade, temas, unsubscribeUrl) {
  const temasLista = (temas || []).slice(0, 5).map(t => `<li style="margin-bottom:4px;color:rgba(255,255,255,0.8);">✓ ${t}</li>`).join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a1a;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1a2e,#0a0f1e);border:1px solid rgba(0,212,255,0.15);border-radius:20px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#001a2e,#002a40);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(0,212,255,0.1);">
            <div style="font-size:32px;font-weight:900;color:#00d4ff;letter-spacing:-1px;">Odonto<span style="color:#fff;">Feed</span></div>
            <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">Ciência odontológica direto para você</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <div style="font-size:48px;text-align:center;margin-bottom:16px;">🎉</div>
            <h1 style="color:#fff;font-size:24px;font-weight:700;text-align:center;margin:0 0 8px;">Bem-vindo ao OdontoFeed!</h1>
            <p style="color:rgba(255,255,255,0.6);text-align:center;margin:0 0 32px;line-height:1.6;">
              Olá, <strong style="color:#fff;">Dr(a). ${nome}</strong>! Sua conta foi ativada com sucesso. A partir de amanhã às <strong style="color:#00d4ff;">7h da manhã</strong>, você receberá seu primeiro artigo científico diário.
            </p>
            <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:20px;margin-bottom:24px;">
              <div style="color:#00d4ff;font-weight:700;font-size:13px;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">📚 Sua especialidade</div>
              <div style="color:#fff;font-size:16px;font-weight:600;margin-bottom:16px;">${especialidade}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:8px;">Temas que você selecionou:</div>
              <ul style="list-style:none;padding:0;margin:0;">${temasLista}</ul>
            </div>
            <div style="background:rgba(0,212,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
              <div style="color:#fff;font-size:14px;font-weight:600;margin-bottom:8px;">📱 Instale o app no celular</div>
              <p style="color:rgba(255,255,255,0.6);font-size:13px;margin:0 0 16px;line-height:1.5;">Acesse o OdontoFeed pelo celular e instale como app para ter seus artigos sempre à mão.</p>
              <a href="https://odontofeed.com" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:700;font-size:14px;padding:12px 28px;border-radius:100px;text-decoration:none;">Acessar OdontoFeed</a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;line-height:1.6;">
              OdontoFeed · Artigos científicos para dentistas brasileiros<br/>
              <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.3);">Cancelar inscrição</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'OdontoFeed <artigos@odontofeed.com>',
      to: [email],
      subject: '🎉 Conta ativada! Seu primeiro artigo chega amanhã às 7h',
      html
    })
  });
}

function successPage(nome, especialidade) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Conta ativada! – OdontoFeed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet"/>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#0a0a1a; color:#fff; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
    .card { background:linear-gradient(135deg,#0d1a2e,#0a0f1e); border:1px solid rgba(0,212,255,0.2); border-radius:24px; padding:48px 40px; max-width:480px; width:100%; text-align:center; }
    .logo { font-size:28px; font-weight:900; color:#00d4ff; margin-bottom:32px; letter-spacing:-1px; }
    .logo span { color:#fff; }
    .icon { font-size:64px; margin-bottom:20px; animation: bounce 0.6s ease; }
    @keyframes bounce { 0%{transform:scale(0)} 60%{transform:scale(1.1)} 100%{transform:scale(1)} }
    h1 { font-size:26px; font-weight:800; margin-bottom:12px; }
    .highlight { color:#00d4ff; }
    p { color:rgba(255,255,255,0.6); line-height:1.6; margin-bottom:16px; }
    .badge { display:inline-block; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.2); color:#00d4ff; padding:8px 20px; border-radius:100px; font-size:14px; font-weight:600; margin:16px 0 24px; }
    .info-box { background:rgba(0,212,255,0.05); border:1px solid rgba(0,212,255,0.1); border-radius:12px; padding:16px 20px; margin-bottom:28px; text-align:left; }
    .info-box .label { color:rgba(255,255,255,0.4); font-size:12px; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .info-box .value { color:#fff; font-weight:600; font-size:15px; }
    .btn { display:block; background:linear-gradient(135deg,#00d4ff,#0099cc); color:#000; font-weight:800; font-size:16px; padding:16px 32px; border-radius:100px; text-decoration:none; transition:transform 0.2s; }
    .btn:hover { transform:translateY(-2px); }
    .sub { margin-top:16px; color:rgba(255,255,255,0.35); font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Odonto<span>Feed</span></div>
    <div class="icon">✅</div>
    <h1>Conta <span class="highlight">ativada!</span></h1>
    <p>Parabéns, Dr(a). <strong style="color:#fff;">${nome}</strong>! Sua conta foi verificada com sucesso.</p>
    <div class="badge">📚 ${especialidade}</div>
    <div class="info-box">
      <div class="label">Próximo artigo</div>
      <div class="value">Amanhã às 7h da manhã ⏰</div>
    </div>
    <p style="font-size:14px;">Você receberá um email com um artigo científico curado especialmente para você todo dia às 7h.</p>
    <a href="https://odontofeed.com" class="btn">🏠 Ir para o OdontoFeed</a>
    <p class="sub">Verifique também sua caixa de entrada — enviamos um email de boas-vindas!</p>
  </div>
</body>
</html>`;
}

function alreadyVerifiedPage(nome) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Já verificado – OdontoFeed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:linear-gradient(135deg,#0d1a2e,#0a0f1e);border:1px solid rgba(0,212,255,0.2);border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.icon{font-size:56px;margin-bottom:20px}h1{font-size:22px;font-weight:700;margin-bottom:12px}p{color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:24px}.btn{display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:100px;text-decoration:none}</style>
</head>
<body>
  <div class="card">
    <div class="icon">ℹ️</div>
    <h1>Email já verificado</h1>
    <p>Olá, Dr(a). <strong style="color:#fff;">${nome}</strong>! Sua conta já está ativa e você já está recebendo artigos diários.</p>
    <a href="https://odontofeed.com" class="btn">Ir para o OdontoFeed</a>
  </div>
</body>
</html>`;
}

function errorPage(titulo, mensagem) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Erro – OdontoFeed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:linear-gradient(135deg,#0d1a2e,#0a0f1e);border:1px solid rgba(255,100,100,0.2);border-radius:24px;padding:48px 40px;max-width:480px;width:100%;text-align:center}.icon{font-size:56px;margin-bottom:20px}h1{font-size:22px;font-weight:700;margin-bottom:12px}p{color:rgba(255,255,255,0.6);line-height:1.6;margin-bottom:24px}.btn{display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:100px;text-decoration:none}</style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
    <a href="https://odontofeed.com" class="btn">Voltar ao site</a>
  </div>
</body>
</html>`;
}
