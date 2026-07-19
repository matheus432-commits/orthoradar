// Tests de plans.js — foco no plano de CADASTRO (cortesia Premium 19/07/2026).
// Todo novo cadastro entra Premium até a forma de pagamento existir; reversível
// pela env SIGNUP_PLAN sem deploy.
// Run: node --test netlify/functions/_lib/__tests__/plans.test.js

const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { signupPlan, normalizePlan, isPremium, DEFAULT_PLAN } = require('../plans');

afterEach(() => { delete process.env.SIGNUP_PLAN; });

describe('plans — plano de cadastro (cortesia)', () => {
  test('sem env → novo cadastro entra PREMIUM (cortesia)', () => {
    delete process.env.SIGNUP_PLAN;
    assert.equal(signupPlan(), 'premium');
  });

  test('SIGNUP_PLAN=gratuito encerra a cortesia (novos entram grátis)', () => {
    process.env.SIGNUP_PLAN = 'gratuito';
    assert.equal(signupPlan(), 'gratuito');
  });

  test('SIGNUP_PLAN inválido cai no plano padrão (fail-safe, nunca quebra o cadastro)', () => {
    process.env.SIGNUP_PLAN = 'banana';
    assert.equal(signupPlan(), DEFAULT_PLAN); // 'gratuito'
  });

  test('o plano de cadastro é sempre um plano válido/premium reconhecido', () => {
    delete process.env.SIGNUP_PLAN;
    assert.equal(isPremium(signupPlan()), true);
    assert.equal(normalizePlan(signupPlan()), 'premium');
  });

  test('DEFAULT_PLAN continua gratuito (base do sistema, não é o de cadastro)', () => {
    assert.equal(DEFAULT_PLAN, 'gratuito');
  });
});
