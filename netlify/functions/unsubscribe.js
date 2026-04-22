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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/html; charset=utf-8'
  };

  const { email, token } = event.queryStringParameters || {};

  if (!email) {
    return {
      statusCode: 400,
      headers,
      body: errorPage('Link inválido', 'O link de cancelamento está incompleto ou expirado.')
    };
  }

  try {
    // Find the user by email
    const q = query(collection(db, 'cadastros'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      return {
        statusCode: 404,
        headers,
        body: errorPage('Email não encontrado', 'Este email não está cadastrado na plataforma.')
      };
    }

    // Update user status to unsubscribed
    const userDoc = snap.docs[0];
    await updateDoc(doc(db, 'cadastros', userDoc.id), {
      ativo: false,
      canceladoEm: new Date().toISOString(),
      motivoCancelamento: 'unsubscribe_link'
    });

    console.log('Unsubscribed:', email);

    return {
      statusCode: 200,
      headers,
      body: successPage(email)
    };

  } catch (err) {
    console.error('Unsubscribe error:', err);
    return {
      statusCode: 500,
      headers,
      body: errorPage('Erro interno', 'Não foi possível processar seu cancelamento. Tente novamente ou entre em contato.')
    };
  }
};

function successPage(email) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cancelamento confirmado – OdontoFeed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0a0a1a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: linear-gradient(135deg, #0d1a2e, #0a0f1e); border: 1px solid rgba(255,100,100,0.2); border-radius: 20px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #fff; }
    p { color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 8px; }
    .email { color: rgba(255,255,255,0.4); font-size: 14px; margin: 16px 0; padding: 10px 16px; background: rgba(255,255,255,0.05); border-radius: 8px; }
    .btn { display: inline-block; margin-top: 28px; padding: 14px 32px; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; font-weight: 700; border-radius: 100px; text-decoration: none; font-size: 15px; }
    .resubscribe { margin-top: 16px; font-size: 13px; color: rgba(255,255,255,0.4); }
    .resubscribe a { color: #00d4ff; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">😔</div>
    <h1>Cancelamento confirmado</h1>
    <p>Você foi removido da lista de envios do OdontoFeed.</p>
    <div class="email">${email}</div>
    <p>Sentiremos sua falta. Você não receberá mais artigos diários.</p>
    <a href="https://odontofeed.com" class="btn">Voltar ao site</a>
    <p class="resubscribe">Mudou de ideia? <a href="https://odontofeed.com/#cadastro">Cadastre-se novamente</a></p>
  </div>
</body>
</html>`;
}

function errorPage(titulo, mensagem) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Erro – OdontoFeed</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0a0a1a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: linear-gradient(135deg, #0d1a2e, #0a0f1e); border: 1px solid rgba(255,100,100,0.2); border-radius: 20px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; }
    .icon { font-size: 64px; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.6); line-height: 1.6; }
    .btn { display: inline-block; margin-top: 28px; padding: 14px 32px; background: linear-gradient(135deg, #00d4ff, #0099cc); color: #000; font-weight: 700; border-radius: 100px; text-decoration: none; font-size: 15px; }
  </style>
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
