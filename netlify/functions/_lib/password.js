// Hashing de senha no servidor com salt por usuário (scrypt, sem dependências).
//
// O cliente envia senhaHash = SHA-256('OF26_' + senha). Aqui tratamos esse valor
// como a "senha" de entrada e derivamos scrypt(senhaHash, saltAleatorio) para
// armazenar. Assim, um vazamento do Firestore NÃO entrega uma credencial
// reutilizável: o valor guardado (scrypt) não pode ser reenviado ao /login, e
// recuperar o senhaHash original exige brute force lento por usuário (salt único).
//
// Formato armazenado: "s2$<saltHex>$<derivedHex>"  (legado = 64-hex sem '$').

const crypto = require('crypto');

const SCRYPT_KEYLEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function hashPassword(clientHash) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(clientHash), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return 's2$' + salt.toString('hex') + '$' + derived.toString('hex');
}

function isLegacy(stored) {
  return typeof stored === 'string' && stored.length > 0 && !stored.startsWith('s2$');
}

// Retorna { match, needsUpgrade }.
// - Formato novo (s2$...): compara scrypt em tempo constante.
// - Formato legado (SHA-256 puro do cliente): compara direto e sinaliza upgrade.
function verifyPassword(clientHash, stored) {
  if (!stored || typeof stored !== 'string') return { match: false, needsUpgrade: false };

  if (stored.startsWith('s2$')) {
    const parts = stored.split('$');
    if (parts.length !== 3) return { match: false, needsUpgrade: false };
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    let derived;
    try { derived = crypto.scryptSync(String(clientHash), salt, expected.length || SCRYPT_KEYLEN, SCRYPT_PARAMS); }
    catch { return { match: false, needsUpgrade: false }; }
    const match = derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    return { match, needsUpgrade: false };
  }

  // Legado: valor armazenado é o próprio senhaHash do cliente (SHA-256).
  const a = Buffer.from(String(clientHash));
  const b = Buffer.from(stored);
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { match, needsUpgrade: match };
}

module.exports = { hashPassword, verifyPassword, isLegacy };
