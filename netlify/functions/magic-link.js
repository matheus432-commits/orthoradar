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

let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_KCF7fs3T_JxYL3yhWF9TWs2oQarMXtehY';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { email } = body;
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email obrigatório' }) };

  try {
    // Check if user exists and is verified
    const q = query(collection(db, 'cadastros'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'E-mail não encontrado. Cadastre-se primeiro.' }) };
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    if (!userData.verificado) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'E-mail ainda não verificado. Verifique sua caixa de entrada.' }) };
    }

    // Generate magic token (1h expiry)
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const tokenExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // Save token to Firestore
    await updateDoc(doc(db, 'cadastros', userDoc.id), {
      magicToken: token,
      magicTokenExpiry: tokenExpiry
    });

    const loginUrl = `https://odontofeed.com/dashboard?token=${token}&email=${encodeURIComponent(email)}`;

    const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><title>Seu link de acesso – OdontoFeed</title></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a1a;padding:40px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0d1a2e,#0a1628);border-radius:20px;overflow:hidden;max-width:600px;">
<tr><td style="background:linear-gradient(135deg,#001a2e,#002a40);padding:32px 40px;text-align:center;">
<div style="font-size:28px;font-weight:900;color:#00d4ff;">Odonto<span style="color:#fff;">Feed</span></div>
</td></tr>
<tr><td style="padding:40px;">
<div style="font-size:40px;text-align:center;margin-bottom:16px;">🔑</div>
<h1 style="color:#fff;font-size:22px;text-align:center;margin:0 0 12px;">Seu link de acesso</h1>
<p style="color:rgba(255,255,255,0.6);text-align:center;margin:0 0 32px;line-height:1.6;">Olá, <strong style="color:#fff;">${userData.nome}</strong>! Clique no botão abaixo para entrar na sua conta OdontoFeed. O link expira em 1 hora.</p>
<div style="text-align:center;margin-bottom:32px;">
<a href="${loginUrl}" style="display:inline-block;background:linear-gradient(135deg,#00d4ff,#0099cc);color:#000;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;">Acessar minha conta →</a>
</div>
<p style="color:rgba(255,255,255,0.4);font-size:12px;text-align:center;">Se você não solicitou este link, ignore este e-mail. O link expira em 1 hora.</p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.05);">
<p style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;">OdontoFeed · Artigos científicos para dentistas</p>
</td></tr>
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
        to: email,
        subject: '🔑 Seu link de acesso ao OdontoFeed',
        html: emailHtml
      })
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Link de acesso enviado!' }) };

  } catch(err) {
    console.error('Magic link error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
