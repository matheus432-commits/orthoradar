const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, addDoc, query, where, getDocs } = require('firebase/firestore');

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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { nome, email, especialidade, temas } = body;

  if (!nome || !email || !especialidade || !temas || !temas.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatórios faltando' }) };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email inválido' }) };
  }

  try {
    // Check if email already exists
    const existing = query(collection(db, 'cadastros'), where('email', '==', email));
    const existingSnap = await getDocs(existing);

    if (!existingSnap.empty) {
      const existingData = existingSnap.docs[0].data();
      if (existingData.ativo === false) {
        return { statusCode: 409, headers, body: JSON.stringify({ error: 'reativacao', message: 'Este email estava cancelado. Por favor entre em contato para reativar.' }) };
      }
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'duplicado', message: 'Este email já está cadastrado!' }) };
    }

    // Generate verification token
    const verifyToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'cadastros'), {
      nome,
      email,
      especialidade,
      temas,
      ativo: false, // inactive until email verified
      verificado: false,
      verifyToken,
      criadoEm: new Date().toISOString(),
      ultimoArtigo: null
    });

    console.log('Cadastro criado:', docRef.id, email);

    // Send verification email
    const verifyUrl = `https://odontofeed.com/.netlify/functions/verify?email=${encodeURIComponent(email)}&token=${verifyToken}`;
    const unsubscribeUrl = `https://odontofeed.com/.netlify/functions/unsubscribe?email=${encodeURIComponent(email)}`;

    const temasLista = temas.slice(0, 5).map(t => `<li style="margin-bottom:6px;">✓ ${t}</li>`).join('');
    const maisText = temas.length > 5 ? `<li style="color:rgba(255,255,255,0.4);">+ ${temas.length - 5} mais...</li>` : '';

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Confirme seu email – OdontoFeed</title>
</head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a1a;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1a2e,#0a0f1e);border:1px solid rgba(0,212,255,0.15);border-radius:20px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#001a2e,#002a40);padding:32px 40px;text-align:center;border-bottom:1px solid rgba(0,212,255,0.1);">
            <div style="font-size:32px;font-weight:900;color:#00d4ff;letter-spacing:-1px;">Odonto<span style="color:#fff;">Feed</span></div>
            <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">Ciência odontológica direto para você</div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <div style="font-size:42px;text-align:center;margin-bottom:16px;">✉️</div>
            <h1 style="color:#fff;font-size:22px;font-weight:700;text-align:center;margin:0 0 8px;">Confirme seu email</h1>
            <p style="color:rgba(255,255,255,0.6);text-align:center;margin:0 0 32px;line-height:1.6;">Olá, <strong style="color:#fff;">${nome}</strong>! Clique no botão abaixo para ativar sua conta e começar a receber artigos científicos diários.</p>

            <!-- Verify Button -->
            <div style="text-align:center;margin-bottom:32px;">
              <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;font-weight:800;font-size:16px;padding:16px 40px;border-radius:100px;text-decoration:none;letter-spacing:0.3px;">
                ✓ Confirmar meu email
              </a>
            </div>

            <!-- Preferences Summary -->
            <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.15);border-radius:12px;padding:20px;margin-bottom:24px;">
              <div style="color:#00d4ff;font-weight:700;font-size:14px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Suas preferências</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:8px;">Especialidade:</div>
              <div style="color:#fff;font-weight:600;font-size:15px;margin-bottom:16px;">${especialidade}</div>
              <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:8px;">Temas selecionados:</div>
              <ul style="color:rgba(255,255,255,0.8);font-size:14px;padding-left:4px;list-style:none;margin:0;">
                ${temasLista}${maisText}
              </ul>
            </div>

            <div style="background:rgba(255,200,0,0.05);border:1px solid rgba(255,200,0,0.15);border-radius:12px;padding:16px;margin-bottom:24px;">
              <p style="color:rgba(255,200,0,0.9);font-size:13px;margin:0;line-height:1.5;">⏰ <strong>O link de confirmação expira em 48 horas.</strong> Se você não se cadastrou no OdontoFeed, ignore este email.</p>
            </div>

            <p style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;line-height:1.6;">
              Se o botão não funcionar, copie e cole este link no navegador:<br/>
              <span style="color:#00d4ff;word-break:break-all;">${verifyUrl}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin:0;line-height:1.6;">
              OdontoFeed · Artigos científicos para dentistas<br/>
              <a href="${unsubscribeUrl}" style="color:rgba(255,255,255,0.3);">Cancelar inscrição</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'OdontoFeed <artigos@odontofeed.com>',
        to: [email],
        subject: '✉️ Confirme seu email para ativar o OdontoFeed',
        html: emailHtml
      })
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'Cadastro realizado! Verifique seu email para ativar a conta.',
        id: docRef.id 
      })
    };

  } catch (err) {
    console.error('Register error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
