const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc, arrayUnion, arrayRemove } = require('firebase/firestore');

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
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  let body;
  try { body = JSON.parse(event.body); } catch(e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { email, artigoId, action } = body;

  if (!email || !artigoId || !action || !token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Campos obrigatórios: email, artigoId, action' }) };
  }

  if (!['like', 'unlike'].includes(action)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action deve ser "like" ou "unlike"' }) };
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
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sessão expirada. Solicite um novo link de acesso.' }) };
    }

    // Update curtidos array
    const userRef = doc(db, 'cadastros', userDoc.id);
    if (action === 'like') {
      await updateDoc(userRef, { curtidos: arrayUnion(artigoId) });
    } else {
      await updateDoc(userRef, { curtidos: arrayRemove(artigoId) });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, action, artigoId })
    };

  } catch(err) {
    console.error('Like article error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erro interno: ' + err.message }) };
  }
};
