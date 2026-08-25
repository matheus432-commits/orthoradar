// Tests da MONETIZAÇÃO do Academy (spec 25/08) — a fiação em volta do motor
// puro (que academy-credito.test.js já cobre com os exemplos exatos da spec):
//
//   • fiação estática: paywall 402 SÓ na exportação, prévia de cancelamento,
//     jobs agendados (mensal + expiração diária), nenhum preço hardcoded fora
//     dos defaults-semente, transparência na UI e painel admin ligado ao hub;
//   • simulação RUNTIME do ciclo completo nos handlers reais (Firestore fake):
//     sem assinatura → assinar → 3 mensalidades → 402 com memória → confirmar
//     consome o crédito (saldo zera) → re-download livre → idempotência →
//     cancelamento com prévia do crédito em risco.
//
// Run: node --test netlify/functions/_lib/__tests__/academy-monetizacao.test.js

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

const fsModule = require('../firestore.js');
const estado = require('../academy/estado');
const { DEFAULTS } = require('../academy/precos');
const { aplicarPagamento } = require('../academy/credito');

// ── fiação estática ──────────────────────────────────────────────────────────
describe('monetização — fiação estática', () => {
  test('paywall SÓ na exportação: 402 com memória no GET, confirmação explícita no POST', () => {
    const ex = src(path.join(FUNCS, 'academy-export.js'));
    assert.ok(ex.includes('402') && ex.includes('pagamento_necessario'), 'GET não pago responde 402');
    assert.ok(ex.includes('memoria'), '402 carrega a memória de cálculo');
    assert.ok(ex.includes('confirmar !== true'), 'POST exige confirmar:true');
    assert.ok(ex.includes('consumirCredito('), 'confirmação consome o crédito (saldo zera)');
    assert.ok(ex.includes('ja_exportado'), 'idempotente por projeto');
    // Nenhuma OUTRA function do Academy cobra: o fluxo de construção é livre.
    for (const f of ['academy-projeto', 'academy-chat', 'academy-busca', 'academy-upload']) {
      const code = src(path.join(FUNCS, f + '.js'));
      assert.ok(!code.includes('402') && !code.includes('calcularExportacao'), f + ' não cobra nada');
    }
  });
  test('cancelamento tem prévia (crédito em risco + carência) antes do confirmar', () => {
    const asn = src(path.join(FUNCS, 'academy-assinatura.js'));
    assert.ok(asn.includes('credito_em_risco'));
    assert.ok(asn.indexOf('confirmar !== true') < asn.indexOf('aplicarCancelamento('), 'prévia vem antes de aplicar');
    assert.ok(asn.includes('mens-${email}-'), 'id_transacao determinística por mês (pronta para o webhook do gateway)');
  });
  test('jobs agendados: expiração diária (Netlify) e mensalidades dia 1 (Actions, dry-run manual)', () => {
    const toml = src(path.join(RAIZ, 'netlify.toml'));
    assert.match(toml, /\[functions\."academy-expiracao"\]\s*\n\s*schedule = "0 10 \* \* \*"/);
    const yml = src(path.join(RAIZ, '.github', 'workflows', 'academy-mensalidades.yml'));
    assert.ok(yml.includes("cron: '0 9 1 * *'"), 'dia 1 de cada mês');
    assert.ok(yml.includes("default: 'true'"), 'dispatch manual nasce em dry-run');
    assert.ok(yml.includes("github.event_name == 'schedule' && 'false'"), 'agendado roda valendo');
    const job = src(path.join(RAIZ, 'scripts', 'academy-mensalidades.js'));
    assert.ok(!/console\.(log|error)\([^)]*\bemail\b/.test(job), 'log de Actions é público: só contadores, nunca e-mail');
  });
  test('nenhum preço hardcoded fora dos defaults-semente (config/precos é a fonte)', () => {
    const alvos = [
      ...['academy-precos', 'academy-assinatura', 'academy-export', 'academy-expiracao', 'get-academy-financeiro'].map(f => path.join(FUNCS, f + '.js')),
      path.join(FUNCS, '_lib', 'academy', 'credito.js'),
      path.join(RAIZ, 'academy.html'),
      path.join(RAIZ, 'admin-academy.html'),
    ];
    for (const a of alvos) {
      assert.ok(!/\b(497|29[.,]90|287[.,]04|248[.,]50)\b/.test(src(a)), path.basename(a) + ' sem preço hardcoded');
    }
    // Os defaults-semente existem UMA vez, em precos.js, com os valores da spec.
    assert.equal(DEFAULTS.premium_mensal, 29.90);
    assert.equal(DEFAULTS.academy_mensal, 59.90);
    assert.equal(DEFAULTS.exportacao_valor, 497.00);
    assert.equal(DEFAULTS.teto_credito_pct, 50);
    assert.equal(DEFAULTS.carencia_credito_dias, 30);
  });
  test('transparência na UI: landing pública, widget permanente, simulação, memória e prévia', () => {
    const html = src(path.join(RAIZ, 'academy.html'));
    assert.ok(html.includes('/.netlify/functions/academy-precos'), 'landing lê preços SEM sessão (antes do cadastro)');
    assert.ok(html.includes('widget-credito') && html.includes('Crédito acumulado'), 'widget permanente');
    assert.ok(html.includes('exportacao_por'), 'simulação 1/3/6 meses ao assinar');
    assert.ok(html.includes('r.status===402') && html.includes('mostrarMemoria'), 'memória de cálculo antes da confirmação');
    assert.ok(html.includes('confirmar:true'), 'confirmação explícita da exportação');
    assert.ok(html.indexOf("acao:'cancelar'}") < html.indexOf("acao:'cancelar',confirmar:true"), 'cancelamento pede a prévia antes de confirmar');
    const precosFn = src(path.join(FUNCS, 'academy-precos.js'));
    assert.ok(!precosFn.includes('sessaoValida'), 'endpoint de preços é público de verdade');
    assert.ok(!/email/i.test(precosFn.replace(/\/\/[^\n]*/g, '')), 'endpoint público não toca dado de usuário');
  });
  test('painel financeiro: link no hub + admin-guard + passivo de crédito', () => {
    assert.ok(src(path.join(RAIZ, 'admin.html')).includes('/admin-academy.html'), 'hub linka o painel');
    const fin = src(path.join(FUNCS, 'get-academy-financeiro.js'));
    assert.ok(fin.includes('checkAdmin(event)'), 'ADMIN_SECRET obrigatório');
    assert.ok(fin.includes('credito_em_circulacao') && fin.includes('receita_por_origem_mes'));
    assert.ok(src(path.join(RAIZ, 'admin-academy.html')).includes('get-academy-financeiro'));
  });
});

// ── simulação runtime do ciclo completo ──────────────────────────────────────
const EMAIL = 'dra@exemplo.com';
const TOKEN = 'tok-academy-123';

function projetoPronto() {
  const p = estado.novoProjeto(EMAIL);
  p.id = 'acad-sim';
  p.tipo_trabalho = 'relato_de_caso';
  p.conformidade = { ...p.conformidade, avaliada: true, liberado: true, paciente_identificavel: true, tcle_disponivel: true, envolve_alem_do_relato: false };
  p.referencias = [{ pmid: '12345678', doi: '10.1000/x', titulo: 'Estudo real.', autores: 'Silva A', journal: 'Braz Oral Res', ano: '2024' }];
  for (const s of estado.SECOES) p.secoes[s] = { texto: 'Texto da seção ' + s + '.', aprovada: true };
  p.periodico_alvo = 'journal-of-applied-oral-science';
  return p;
}

function prepararDb(state) {
  fsModule.Firestore = class {
    async getDoc(coll, id) {
      const d = (state[coll] || {})[id];
      if (!d) throw new Error('not-found');
      return JSON.parse(JSON.stringify({ id, ...d }));
    }
    async setDoc(coll, id, val) {
      state[coll] = state[coll] || {};
      const { id: _drop, ...resto } = val;
      state[coll][id] = JSON.parse(JSON.stringify(resto));
    }
    async query(coll) {
      if (coll === 'cadastros') return [{ email: EMAIL, sessionToken: TOKEN, ativo: true }];
      return Object.entries(state[coll] || {}).map(([id, v]) => ({ id, ...v }));
    }
  };
}

function carregar(nome) {
  const p = require.resolve(path.join(FUNCS, nome + '.js'));
  delete require.cache[p];
  return require(p);
}

const ev = (metodo, qs, body) => ({
  httpMethod: metodo,
  headers: { authorization: 'Bearer ' + TOKEN, 'x-nf-client-connection-ip': '10.0.0.9' },
  queryStringParameters: { email: EMAIL, ...qs },
  body: body ? JSON.stringify({ email: EMAIL, ...body }) : null,
});

describe('monetização — ciclo completo nos handlers reais', () => {
  let state, assinaturaFn, exportFn;
  beforeEach(() => {
    process.env.FIREBASE_API_KEY = 'x';
    state = { academy_projetos: { 'acad-sim': projetoPronto() } };
    prepararDb(state);
    assinaturaFn = carregar('academy-assinatura');
    exportFn = carregar('academy-export');
  });

  test('assinar → 3 mensalidades → memória 317,30 → exportar zera → re-download livre', async () => {
    // Sem assinatura: o widget mostra o valor cheio.
    let r = JSON.parse((await assinaturaFn.handler(ev('GET'))).body);
    assert.equal(r.assinatura, null);
    assert.equal(r.memoria.valor_pago, 497.00);
    assert.equal(r.simulacao.length, 3, 'simulação 1/3/6 meses presente');

    // Assina (1ª mensalidade) e o job mensal credita mais 2 meses.
    r = JSON.parse((await assinaturaFn.handler(ev('POST', {}, { acao: 'assinar' }))).body);
    assert.equal(r.ok, true);
    assert.equal(r.credito_acumulado, 59.90);
    for (const m of ['2026-09', '2026-10']) {
      state.academy_assinaturas[EMAIL] = aplicarPagamento(
        state.academy_assinaturas[EMAIL], { academy_mensal: 59.90 }, { id_transacao: `mens-${EMAIL}-${m}` }).assinatura;
    }

    // GET do widget: exemplo exato da spec (3 meses → 179,70 → sai por 317,30).
    r = JSON.parse((await assinaturaFn.handler(ev('GET'))).body);
    assert.equal(r.assinatura.credito_acumulado, 179.70);
    assert.equal(r.memoria.valor_pago, 317.30);

    // Exportação: GET não pago → 402 com a memória completa.
    let res = await exportFn.handler(ev('GET', { id: 'acad-sim' }));
    assert.equal(res.statusCode, 402);
    const memoria = JSON.parse(res.body).memoria;
    assert.deepEqual(
      [memoria.valor_cheio, memoria.credito_aplicado, memoria.valor_pago, memoria.teto_atingido],
      [497.00, 179.70, 317.30, false]);

    // POST sem confirmar → recusa; com confirmar → grava e CONSOME (saldo zera).
    res = await exportFn.handler(ev('POST', {}, { id: 'acad-sim' }));
    assert.equal(res.statusCode, 400);
    res = await exportFn.handler(ev('POST', {}, { id: 'acad-sim', confirmar: true }));
    assert.equal(JSON.parse(res.body).memoria.valor_pago, 317.30);
    assert.equal(state.academy_exportacoes['acad-sim'].id_transacao, 'aguardando-gateway');
    assert.equal(state.academy_assinaturas[EMAIL].credito_acumulado, 0, 'consumo zera o saldo');
    assert.equal(state.academy_assinaturas[EMAIL].meses_pagos, 0, 'acúmulo recomeça');

    // Re-download livre (paga por trabalho, não por download) + POST idempotente.
    res = await exportFn.handler(ev('GET', { id: 'acad-sim' }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Content-Type'], 'application/zip');
    assert.ok(res.isBase64Encoded);
    res = JSON.parse((await exportFn.handler(ev('POST', {}, { id: 'acad-sim', confirmar: true }))).body);
    assert.equal(res.ja_exportado, true);
  });

  test('novo acúmulo pós-exportação segue o exemplo da spec (+2 meses → 377,20)', async () => {
    // Estado: acabou de exportar (saldo zero) e paga mais 2 mensalidades.
    let a = { ativa: true, meses_pagos: 0, credito_acumulado: 0, historico_pagamentos: [] };
    for (const m of ['2026-11', '2026-12']) a = aplicarPagamento(a, { academy_mensal: 59.90 }, { id_transacao: 'mens-x-' + m }).assinatura;
    state.academy_assinaturas = { [EMAIL]: a };
    state.academy_projetos['acad-2'] = { ...projetoPronto(), id: 'acad-2' };

    const res = await exportFn.handler(ev('GET', { id: 'acad-2' }));
    assert.equal(res.statusCode, 402);
    const m = JSON.parse(res.body).memoria;
    assert.equal(m.credito_aplicado, 119.80);
    assert.equal(m.valor_pago, 377.20);
  });

  test('cancelar: prévia com crédito em risco; confirmado marca a carência de 30 dias', async () => {
    let a = { ativa: true, meses_pagos: 2, credito_acumulado: 119.80, historico_pagamentos: [] };
    state.academy_assinaturas = { [EMAIL]: a };

    let r = JSON.parse((await assinaturaFn.handler(ev('POST', {}, { acao: 'cancelar' }))).body);
    assert.equal(r.previa, true);
    assert.equal(r.credito_em_risco, 119.80);
    assert.equal(r.carencia_dias, 30);
    assert.equal(state.academy_assinaturas[EMAIL].ativa, true, 'prévia NÃO cancela nada');

    r = JSON.parse((await assinaturaFn.handler(ev('POST', {}, { acao: 'cancelar', confirmar: true }))).body);
    assert.equal(r.ok, true);
    const doc = state.academy_assinaturas[EMAIL];
    assert.equal(doc.ativa, false);
    const dias = Math.round((new Date(doc.data_expiracao_credito) - new Date(doc.data_cancelamento)) / 86400000);
    assert.equal(dias, 30, 'carência exata da config');
    assert.equal(doc.credito_acumulado, 119.80, 'crédito segue lá durante a carência');
  });
});
