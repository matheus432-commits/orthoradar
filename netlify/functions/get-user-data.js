const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const email = event.queryStringParameters && event.queryStringParameters.email;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!email || !token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email e token obrigatórios' }) };
  }

  try {
    // Find user and validate token
    const q = query(collection(db, 'cadastros'), where('email', '==', email));
    const snap = await getDocs(q);

    if (snap.empty) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Usuário não encontrado' }) };
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();

    // Validate magic token
    if (userData.magicToken !== token) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    // Check token expiry
    if (userData.magicTokenExpiry && new Date(userData.magicTokenExpiry) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token expirado. Solicite um novo link de acesso.' }) };
    }

    // Get articles sent to this user
    let artigos = [];
    try {
      const artigosQ = query(collection(db, 'artigos_enviados'), where('email', '==', email));
      const artigosSnap = await getDocs(artigosQ);
      artigos = artigosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date descending
      artigos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
    } catch(e) {
      console.warn('Could not fetch artigos:', e.message);
    }

    // Get friends (users with same especialidade, excluding self, limited to 20)
    let amigos = [];
    try {
      const amigosQ = query(collection(db, 'cadastros'), where('especialidade', '==', userData.especialidade), where('verificado', '==', true));
      const amigosSnap = await getDocs(amigosQ);
      amigos = amigosSnap.docs
        .filter(d => d.data().email !== email)
        .slice(0, 20)
        .map(d => {
          const d2 = d.data();
          return { nome: d2.nome, email: d2.email, especialidade: d2.especialidade };
        });
    } catch(e) {
      console.warn('Could not fetch amigos:', e.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        nome: userData.nome,
        email: userData.email,
        especialidade: userData.especialidade,
        temas: userData.temas || [],
        criadoEm: userData.criadoEm,
        artigos,
        curtidos: userData.curtidos || [],
        amigos
      })
    };

  } catch(err) {
    console.error('Get user data error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
