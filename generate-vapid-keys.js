#!/usr/bin/env node
// Run once: node generate-vapid-keys.js
// Then add output to Netlify environment variables.
const { generateKeyPairSync } = require('crypto');

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

// Private key: PKCS8 DER → base64url (used server-side for JWT signing)
const privateKeyB64u = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64url');

// Public key: extract raw uncompressed point (0x04 || x || y = 65 bytes) from SPKI DER
const spkiDer = publicKey.export({ format: 'der', type: 'spki' });
const publicKeyRaw = spkiDer.slice(-65); // last 65 bytes are the uncompressed EC point
const publicKeyB64u = publicKeyRaw.toString('base64url');

console.log('Add these to your Netlify environment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + publicKeyB64u);
console.log('VAPID_PRIVATE_KEY=' + privateKeyB64u);
console.log('VAPID_SUBJECT=mailto:admin@odontofeed.com');
console.log('\nNote: generate keys only once. Regenerating invalidates all existing push subscriptions.');
