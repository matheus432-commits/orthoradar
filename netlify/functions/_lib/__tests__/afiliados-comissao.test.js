// Programa de AFILIADOS (07/08) — regras de comissão que mexem em DINHEIRO,
// então cada regra do fundador vira teste:
//   • R$10/mês por Premium ativo indicado, 12 meses a partir da ATIVAÇÃO PAGA;
//   • cortesia NUNCA conta; cancelou → comissão para no mês; mês 13 não existe
//     (mesmo se o job mensal atrasar o rebaixamento);
//   • planilha mensal: só afiliados ATIVOS, total geral no rodapé, CSV pt-BR.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  COMISSAO_MENSAL, statusIndicacao, mesesRestantes, valorMesAtual,
  camposAtivacaoPremium, camposCancelamentoPremium, desempenhoAfiliado,
  relatorioMensal, relatorioCSV,
} = require('../afiliados');

const HOJE = '2026-08-07';

describe('statusIndicacao — as 4 cores do painel', () => {
  test('cadastro gratuito (sem ativação paga) → cinza', () => {
    assert.deepEqual(statusIndicacao({}, HOJE), { status: 'gratuito', cor: 'cinza' });
  });
  test('Premium de CORTESIA não conta (regra do fundador) → cinza', () => {
    // Todo mundo hoje está plano=premium/planoOrigem=cortesia — sem
    // comissaoStatus gravado, a indicação continua pendente.
    const u = { plano: 'premium', planoOrigem: 'cortesia' };
    assert.equal(statusIndicacao(u, HOJE).cor, 'cinza');
    assert.equal(valorMesAtual(u, HOJE), 0);
  });
  test('premium_ativo dentro da janela → verde', () => {
    const u = { comissaoStatus: 'premium_ativo', dataExpiracaoComissao: '2027-01-01' };
    assert.deepEqual(statusIndicacao(u, HOJE), { status: 'premium_ativo', cor: 'verde' });
  });
  test('premium_ativo mas JÁ EXPIRADO (job mensal atrasado) → amarelo — mês 13 nunca é pago', () => {
    const u = { comissaoStatus: 'premium_ativo', dataExpiracaoComissao: '2026-08-01' };
    assert.equal(statusIndicacao(u, HOJE).status, 'comissao_encerrada');
    assert.equal(valorMesAtual(u, HOJE), 0);
  });
  test('comissao_encerrada → amarelo; premium_cancelado → vermelho', () => {
    assert.equal(statusIndicacao({ comissaoStatus: 'comissao_encerrada' }, HOJE).cor, 'amarelo');
    assert.equal(statusIndicacao({ comissaoStatus: 'premium_cancelado' }, HOJE).cor, 'vermelho');
  });
});

describe('janela de 12 meses', () => {
  test('ativação grava hoje + 365 dias', () => {
    const c = camposAtivacaoPremium('2026-08-07');
    assert.equal(c.comissaoStatus, 'premium_ativo');
    assert.equal(c.dataAtivacaoPremium, '2026-08-07');
    assert.equal(c.dataExpiracaoComissao, '2027-08-07');
  });
  test('mesesRestantes: recém-ativado ≈ 12; meio da janela conta certo; expirado/cancelado = 0', () => {
    assert.equal(mesesRestantes({ comissaoStatus: 'premium_ativo', dataExpiracaoComissao: '2027-08-07' }, HOJE), 12);
    assert.equal(mesesRestantes({ comissaoStatus: 'premium_ativo', dataExpiracaoComissao: '2027-02-07' }, HOJE), 7);
    assert.equal(mesesRestantes({ comissaoStatus: 'premium_ativo', dataExpiracaoComissao: '2026-08-01' }, HOJE), 0);
    assert.equal(mesesRestantes({ comissaoStatus: 'premium_cancelado', dataExpiracaoComissao: '2027-08-07' }, HOJE), 0);
  });
  test('cancelamento grava premium_cancelado', () => {
    assert.deepEqual(camposCancelamentoPremium(), { comissaoStatus: 'premium_cancelado' });
  });
});

describe('desempenhoAfiliado — card do admin', () => {
  const indicados = [
    {}, // gratuito
    { comissaoStatus: 'premium_ativo', dataAtivacaoPremium: '2026-06-07', dataExpiracaoComissao: '2027-06-07' }, // verde, 2 meses corridos
    { comissaoStatus: 'premium_ativo', dataAtivacaoPremium: '2026-08-01', dataExpiracaoComissao: '2027-08-01' }, // verde, 0 meses completos
    { comissaoStatus: 'comissao_encerrada', dataAtivacaoPremium: '2025-05-01' }, // amarelo — 12 meses (teto)
    { comissaoStatus: 'premium_cancelado', dataAtivacaoPremium: '2026-07-01' },  // vermelho — 1 mês pago
  ];
  test('conta cada status e soma a comissão do mês (2 verdes × R$10)', () => {
    const d = desempenhoAfiliado(indicados, HOJE);
    assert.equal(d.totalCadastros, 5);
    assert.equal(d.premiumAtivos, 2);
    assert.equal(d.comissaoEncerrada, 1);
    assert.equal(d.cancelados, 1);
    assert.equal(d.comissaoMesAtual, 2 * COMISSAO_MENSAL);
  });
  test('acumulada paga: meses completos por indicação, teto 12', () => {
    const d = desempenhoAfiliado(indicados, HOJE);
    // verde 2 meses (jun→ago) + verde 0 + encerrada 12 (teto) + cancelada 1 = 15 meses
    assert.equal(d.comissaoAcumuladaPaga, 15 * COMISSAO_MENSAL);
  });
});

describe('relatorioMensal — planilha de pagamento', () => {
  const verde = { comissaoStatus: 'premium_ativo', dataAtivacaoPremium: '2026-06-01', dataExpiracaoComissao: '2027-06-01' };
  const afiliados = [
    { codigo: 'AAAAAAA', nome: 'Ana',   email: 'ana@x.com',   ativo: true,  indicados: [verde, verde, {}] },
    { codigo: 'BBBBBBB', nome: 'Bruno', email: 'bruno@x.com', ativo: false, indicados: [verde] },           // INATIVO — fora
    { codigo: 'CCCCCCC', nome: 'Caio',  email: 'caio@x.com',  ativo: true,  indicados: [{}] },              // sem premium — fora
    { codigo: 'DDDDDDD', nome: 'Duda',  email: 'duda@x.com',  ativo: true,  indicados: [verde, { comissaoStatus: 'premium_cancelado' }] },
  ];
  test('só afiliados ATIVOS com Premium ativo entram; total geral confere', () => {
    const rel = relatorioMensal(afiliados, HOJE);
    assert.deepEqual(rel.linhas.map(l => l.codigo), ['AAAAAAA', 'DDDDDDD']);
    assert.equal(rel.linhas[0].premiumsAtivos, 2);
    assert.equal(rel.linhas[0].valor, 20);
    assert.equal(rel.totalPremiums, 3);
    assert.equal(rel.totalGeral, 30);
  });
  test('CSV: cabeçalho, vírgula decimal pt-BR, escaping e TOTAL GERAL no rodapé', () => {
    const rel = relatorioMensal([
      { codigo: 'AAAAAAA', nome: 'Clínica; "Sorriso"', email: 'c@x.com', ativo: true, indicados: [verde] },
    ], HOJE);
    const csv = relatorioCSV(rel, '2026-08');
    const linhas = csv.split('\r\n');
    assert.equal(linhas[0], 'Relatório de comissões — 2026-08');
    assert.match(linhas[1], /^Afiliado;E-mail;Código;Premiums ativos indicados;Valor a pagar/);
    assert.ok(linhas[2].startsWith('"Clínica; ""Sorriso"""'), 'campo com ; e aspas deve ser escapado');
    assert.ok(linhas[2].endsWith(';1;10,00'), 'valor com vírgula decimal');
    assert.equal(linhas[3], 'TOTAL GERAL;;;1;10,00');
  });
});

describe('job mensal de expiração', () => {
  test('rebaixa SÓ o premium_ativo vencido; ativo na janela fica intocado', async () => {
    const { expirarComissoes } = require('../../afiliados-expiracao');
    const updates = [];
    const db = {
      query: async (coll, q) => {
        // Filtro por IGUALDADE simples (índice automático) — igualdade+range
        // exigiria índice composto e quebraria em silêncio.
        assert.equal(coll, 'cadastros');
        assert.equal(q.where.fieldFilter.value.stringValue, 'premium_ativo');
        return [
          { id: 'u1', email: 'a@x.com', dataExpiracaoComissao: '2026-08-01' }, // vencido
          { id: 'u2', email: 'b@x.com', dataExpiracaoComissao: '2027-01-01' }, // na janela
          { id: 'u3', email: 'c@x.com' },                                     // sem data — não mexe
        ];
      },
      updateDoc: async (coll, id, campos) => updates.push({ id, campos }),
    };
    const r = await expirarComissoes(db, HOJE);
    assert.equal(r.comissoesAtivas, 3);
    assert.equal(r.vencidas, 1);
    assert.equal(r.encerradas, 1);
    assert.equal(r.falhas, 0);
    assert.deepEqual(updates, [{ id: 'u1', campos: { comissaoStatus: 'comissao_encerrada' } }]);
  });
  test('falha num doc não derruba o job e a resposta NÃO vaza e-mails', async () => {
    const { expirarComissoes } = require('../../afiliados-expiracao');
    const db = {
      query: async () => [
        { id: 'u1', email: 'a@x.com', dataExpiracaoComissao: '2026-01-01' },
        { id: 'u2', email: 'b@x.com', dataExpiracaoComissao: '2026-01-01' },
      ],
      updateDoc: async (c, id) => { if (id === 'u1') throw new Error('boom'); },
    };
    const r = await expirarComissoes(db, HOJE);
    assert.equal(r.encerradas, 1);
    assert.equal(r.falhas, 1);
    assert.ok(!JSON.stringify(r).includes('@x.com'), 'resposta pública não pode conter e-mails');
  });
});

// ── Regressão ESTÁTICA: proteção e fiação ────────────────────────────────────
describe('proteção e fiação do painel', () => {
  const FUNCS = path.join(__dirname, '..', '..');
  const src = (f) => fs.readFileSync(path.join(FUNCS, f), 'utf8');

  test('endpoint afiliados exige checkAdmin ANTES de qualquer leitura', () => {
    const code = src('afiliados.js');
    assert.ok(code.indexOf('checkAdmin(event)') < code.indexOf('await varrerCadastros(db)'),
      'o gate do admin deve vir antes do acesso aos dados');
  });
  test('job de expiração agendado no netlify.toml (mensal)', () => {
    const toml = fs.readFileSync(path.join(FUNCS, '..', '..', 'netlify.toml'), 'utf8');
    assert.match(toml, /\[functions\."afiliados-expiracao"\]\s*\n\s*schedule = "0 6 1 \* \*"/);
  });
  test('index.html persiste o ?ref= também em cookie de 30 dias', () => {
    const html = fs.readFileSync(path.join(FUNCS, '..', '..', 'index.html'), 'utf8');
    assert.match(html, /of_ref=.*max-age.*30\*86400/s);
    assert.ok(html.includes('refCookie()'), 'cadastro deve cair no cookie quando o localStorage não tem o código');
  });
});
