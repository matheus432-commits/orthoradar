// Tests da regra "até 3 especialidades por cadastro" (diretriz 22/07/2026).
// Recurso Premium: teto 3; Gratuito continua 1. A primeira é a principal.
// Run: node --test netlify/functions/_lib/__tests__/especialidades.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  ESPECIALIDADES_VALIDAS,
  MAX_ESPECIALIDADES_PREMIUM,
  MAX_ESPECIALIDADES_GRATUITO,
  maxEspecialidades,
  validarEspecialidades,
  especialidadesDe,
  escolherEspecialidade,
} = require('../especialidades');
const { CICLO } = require('../especialidade-identidade');

describe('especialidades — tetos por plano', () => {
  test('constantes: Premium 3, Gratuito 1', () => {
    assert.equal(MAX_ESPECIALIDADES_PREMIUM, 3);
    assert.equal(MAX_ESPECIALIDADES_GRATUITO, 1);
  });

  test('maxEspecialidades aceita plano string, objeto user e valores legados', () => {
    assert.equal(maxEspecialidades('premium'), 3);
    assert.equal(maxEspecialidades('gratuito'), 1);
    assert.equal(maxEspecialidades({ plano: 'premium' }), 3);
    assert.equal(maxEspecialidades({ plano: 'gratuito' }), 1);
    assert.equal(maxEspecialidades('pro'), 3);        // legado 'pro' herda premium
    assert.equal(maxEspecialidades('basico'), 1);     // legado desconhecido → gratuito
    assert.equal(maxEspecialidades(null), 1);         // sem plano → gratuito (fail-safe)
    assert.equal(maxEspecialidades(undefined), 1);
  });

  test('as 11 especialidades do ciclo são todas válidas', () => {
    assert.equal(ESPECIALIDADES_VALIDAS.size, 11);
    for (const esp of CICLO) assert.ok(ESPECIALIDADES_VALIDAS.has(esp), esp);
  });
});

describe('validarEspecialidades — Premium (até 3)', () => {
  test('1, 2 e 3 especialidades válidas passam', () => {
    assert.deepEqual(validarEspecialidades(['Ortodontia'], 'premium'),
      { ok: true, especialidades: ['Ortodontia'] });
    assert.deepEqual(validarEspecialidades(['Ortodontia', 'Prótese'], 'premium'),
      { ok: true, especialidades: ['Ortodontia', 'Prótese'] });
    assert.deepEqual(validarEspecialidades(['Ortodontia', 'Prótese', 'Endodontia'], 'premium'),
      { ok: true, especialidades: ['Ortodontia', 'Prótese', 'Endodontia'] });
  });

  test('4 especialidades reprovam com a mensagem oficial', () => {
    const r = validarEspecialidades(['Ortodontia', 'Prótese', 'Endodontia', 'Periodontia'], 'premium');
    assert.equal(r.ok, false);
    assert.match(r.error, /até 3 especialidades/);
    assert.match(r.error, /área de membro/);
  });

  test('a ORDEM é preservada (a primeira é a principal, define o e-mail)', () => {
    const r = validarEspecialidades(['Prótese', 'Ortodontia'], 'premium');
    assert.deepEqual(r.especialidades, ['Prótese', 'Ortodontia']);
  });

  test('duplicatas são removidas sem reprovar (3 únicas entre 4 entradas)', () => {
    const r = validarEspecialidades(['Ortodontia', 'Ortodontia', 'Prótese', 'Endodontia'], 'premium');
    assert.equal(r.ok, true);
    assert.deepEqual(r.especialidades, ['Ortodontia', 'Prótese', 'Endodontia']);
  });

  test('espaços são aparados; vazios ignorados', () => {
    const r = validarEspecialidades([' Ortodontia ', '', null, 'Prótese'], 'premium');
    assert.equal(r.ok, true);
    assert.deepEqual(r.especialidades, ['Ortodontia', 'Prótese']);
  });

  test('string única (formato legado) é aceita', () => {
    assert.deepEqual(validarEspecialidades('Endodontia', 'premium'),
      { ok: true, especialidades: ['Endodontia'] });
  });

  test('especialidade inexistente reprova nomeando a inválida', () => {
    const r = validarEspecialidades(['Ortodontia', 'Cardiologia'], 'premium');
    assert.equal(r.ok, false);
    assert.match(r.error, /inválida: Cardiologia/);
  });

  test('lista vazia / nula reprova pedindo ao menos uma', () => {
    for (const entrada of [[], '', null, undefined, ['', '  ']]) {
      const r = validarEspecialidades(entrada, 'premium');
      assert.equal(r.ok, false);
      assert.match(r.error, /ao menos uma/);
    }
  });

  test('todas as 11 do ciclo passam individualmente', () => {
    for (const esp of CICLO) {
      assert.equal(validarEspecialidades([esp], 'premium').ok, true, esp);
    }
  });
});

describe('validarEspecialidades — Gratuito (1)', () => {
  test('1 especialidade passa; 2 reprovam citando o Premium', () => {
    assert.equal(validarEspecialidades(['Ortodontia'], 'gratuito').ok, true);
    const r = validarEspecialidades(['Ortodontia', 'Prótese'], 'gratuito');
    assert.equal(r.ok, false);
    assert.match(r.error, /Premium/);
  });

  test('sem plano informado, vale o teto do Gratuito (fail-safe)', () => {
    assert.equal(validarEspecialidades(['Ortodontia', 'Prótese'], null).ok, false);
    assert.equal(validarEspecialidades(['Ortodontia'], null).ok, true);
  });
});

describe('especialidadesDe — normalização do doc de cadastro', () => {
  test('array, string, vazio e sujeira', () => {
    assert.deepEqual(especialidadesDe({ especialidade: ['Ortodontia', 'Prótese'] }), ['Ortodontia', 'Prótese']);
    assert.deepEqual(especialidadesDe({ especialidade: 'Ortodontia' }), ['Ortodontia']);
    assert.deepEqual(especialidadesDe({ especialidade: [' Ortodontia ', '', null] }), ['Ortodontia']);
    assert.deepEqual(especialidadesDe({}), []);
    assert.deepEqual(especialidadesDe(null), []);
  });
});

describe('escolherEspecialidade — seletor da área de membro (?esp=)', () => {
  const minhas = ['Ortodontia', 'Prótese', 'Endodontia'];

  test('sem ?esp= vale a principal (primeira)', () => {
    assert.equal(escolherEspecialidade(minhas, undefined), 'Ortodontia');
    assert.equal(escolherEspecialidade(minhas, ''), 'Ortodontia');
  });

  test('?esp= de uma especialidade do dentista é respeitada', () => {
    assert.equal(escolherEspecialidade(minhas, 'Prótese'), 'Prótese');
    assert.equal(escolherEspecialidade(minhas, 'Endodontia'), 'Endodontia');
  });

  test('?esp= que NÃO é do dentista cai na principal (sem vazar edição de outrem por URL)', () => {
    assert.equal(escolherEspecialidade(minhas, 'Periodontia'), 'Ortodontia');
    assert.equal(escolherEspecialidade(minhas, 'qualquer-coisa'), 'Ortodontia');
  });

  test('sem especialidades → string vazia (o handler devolve 404)', () => {
    assert.equal(escolherEspecialidade([], 'Ortodontia'), '');
    assert.equal(escolherEspecialidade(null, null), '');
  });
});

describe('integração com os handlers (contratos usados por register/update-preferences)', () => {
  test('cadastro Premium cortesia com 3 especialidades gera doc válido', () => {
    // Simula o caminho do register.js: valida com o plano de entrada e usa
    // o array normalizado no documento.
    const r = validarEspecialidades(['Dentística', 'Radiologia', 'Estomatologia'], 'premium');
    assert.equal(r.ok, true);
    const doc = { especialidade: r.especialidades };
    assert.deepEqual(especialidadesDe(doc), ['Dentística', 'Radiologia', 'Estomatologia']);
    // O e-mail diário usa a principal:
    assert.equal(especialidadesDe(doc)[0], 'Dentística');
  });

  test('update-preferences: trocar a ordem troca a principal', () => {
    const antes = validarEspecialidades(['Ortodontia', 'Prótese'], 'premium');
    const depois = validarEspecialidades(['Prótese', 'Ortodontia'], 'premium');
    assert.equal(antes.especialidades[0], 'Ortodontia');
    assert.equal(depois.especialidades[0], 'Prótese');
  });
});
