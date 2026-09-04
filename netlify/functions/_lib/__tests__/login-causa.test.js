// Incidente 04/09: "não estou conseguindo logar" na conta E no painel de admin.
//
// O que a investigação achou: as DUAS telas mentiam sobre a causa.
//   • /login: qualquer falha do Firestore (chave errada, cota, rede) caía no
//     mesmo `return null` do "e-mail não existe", e o usuário lia "e-mail ou
//     senha incorretos" — mandando trocar a senha por um problema de servidor.
//   • admin.html: qualquer resposta não-200 do get-painel virava "Segredo
//     inválido.", inclusive 404 (função não publicada) e 500 (variável de
//     ambiente faltando).
//
// Regra que fica travada aqui: falha de infraestrutura NUNCA se disfarça de
// credencial errada, e a mensagem diz de quem é a culpa.
//
// Run: node --test netlify/functions/_lib/__tests__/login-causa.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const LIB_JS = path.join(FUNCS, '_lib.js');
const LOGIN = path.join(FUNCS, 'login.js');

// Carrega login.js com o `request` (HTTP para o Firestore) trocado por um duplê.
function carregarLogin(requestImpl) {
  require.cache[LIB_JS] = {
    id: LIB_JS, filename: LIB_JS, loaded: true,
    exports: { request: requestImpl },
  };
  delete require.cache[require.resolve(LOGIN)];
  return require(LOGIN);
}

const evento = (body) => ({ httpMethod: 'POST', body: JSON.stringify(body) });
const CREDENCIAL = { email: 'quem@exemplo.com', senhaHash: 'a'.repeat(64) };
const semUsuario = async () => ({ status: 200, body: '[{}]' });

async function responder(requestImpl, env = {}) {
  const antes = { ...process.env };
  Object.assign(process.env, { FIREBASE_API_KEY: 'chave-de-teste', FIREBASE_PROJECT_ID: 'projeto', ...env });
  try {
    const r = await carregarLogin(requestImpl).handler(evento(CREDENCIAL));
    return { status: r.statusCode, ...JSON.parse(r.body) };
  } finally {
    for (const k of ['FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID']) { if (antes[k] === undefined) delete process.env[k]; else process.env[k] = antes[k]; }
  }
}

describe('login: a causa da falha aparece como ela é', () => {
  test('e-mail que não existe continua sendo 401 genérico (anti-enumeração)', async () => {
    const r = await responder(semUsuario);
    assert.equal(r.status, 401);
    assert.match(r.error, /senha incorretos/i);
    assert.equal(r.causa, undefined, '401 não revela nada além do genérico');
  });

  test('Firestore fora do ar vira 503 e diz que não é a senha', async () => {
    for (const status of [403, 429, 500, 503]) {
      const r = await responder(async () => ({ status, body: '{"error":{"message":"x"}}' }));
      assert.equal(r.status, 503, 'status ' + status);
      assert.equal(r.causa, 'banco');
      assert.match(r.error, /não é a sua senha/i);
      assert.doesNotMatch(r.error, /senha incorret/i, 'não pode culpar a senha do usuário');
    }
  });

  test('resposta ilegível do banco também é 503, nunca "senha incorreta"', async () => {
    const r = await responder(async () => ({ status: 200, body: '<html>502 Bad Gateway</html>' }));
    assert.equal(r.status, 503);
    assert.equal(r.causa, 'banco');
  });

  test('FIREBASE_API_KEY ausente no Netlify vira 503 de configuração, sem tocar no banco', async () => {
    let chamou = false;
    const r = await responder(async () => { chamou = true; return { status: 200, body: '[]' }; }, { FIREBASE_API_KEY: '' });
    assert.equal(r.status, 503);
    assert.equal(r.causa, 'config');
    assert.match(r.error, /configuração/i);
    assert.equal(chamou, false, 'sem chave não adianta chamar o Firestore');
  });

  test('exceção de rede vira 500 explicando que não é a senha', async () => {
    const r = await responder(async () => { throw new Error('ECONNRESET'); });
    assert.equal(r.status, 500);
    assert.equal(r.causa, 'interno');
    assert.match(r.error, /não é a sua senha/i);
  });

  test('senha errada de usuário existente continua 401, com o bloqueio por tentativas intacto', async () => {
    const doc = (campos) => JSON.stringify([{ document: { name: 'projects/p/databases/(default)/documents/cadastros/u1', fields: campos } }]);
    const chamadas = [];
    const r = await responder(async (opcoes) => {
      chamadas.push(opcoes.method);
      if (opcoes.method === 'POST') return { status: 200, body: doc({ email: { stringValue: CREDENCIAL.email }, senhaHash: { stringValue: 'b'.repeat(64) }, loginAttempts: { stringValue: '4' } }) };
      return { status: 200, body: '{}' }; // PATCH das tentativas
    });
    assert.equal(r.status, 401);
    assert.match(r.error, /Muitas tentativas|senha incorretos/i);
    assert.ok(chamadas.includes('PATCH'), 'a 5ª tentativa errada precisa gravar o bloqueio');
  });
});

describe('admin.html: cada falha do painel com o nome certo', () => {
  const html = fs.readFileSync(path.join(FUNCS, '..', '..', 'admin.html'), 'utf8');
  test('401 é segredo inválido; 404 e 500 não são', () => {
    assert.ok(html.includes("res.status === 401"), 'só o 401 vira "Segredo inválido."');
    assert.ok(html.includes('res.status === 404') && html.includes('não está publicada'), '404 = função não publicada');
    assert.ok(html.includes('FIREBASE_API_KEY') && html.includes('falta a variável'), 'variável faltando tem mensagem própria');
    assert.ok(html.includes('O segredo pode estar certo'), 'erro de servidor não acusa o segredo');
  });
  test('queda de rede não vira "segredo inválido"', () => {
    assert.ok(html.includes('Não foi possível falar com o servidor'), 'fetch que estoura tem mensagem própria');
  });
});
