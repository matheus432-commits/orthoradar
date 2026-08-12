// SISTEMA DE PARCERIAS (12/08) — regressões estáticas da CADEIA completa,
// item a item da spec do fundador. A matemática pura está em parcerias.test.js;
// aqui garantimos que cada peça (função admin, resgate público, landing,
// painel, scheduled, rotas) cumpre o combinado e as regras de segurança.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

describe('parcerias.js — admin (CRUD + painel + ativação da cobrança)', () => {
  const code = src(path.join(FUNCS, 'parcerias.js'));
  test('exclusivo do admin (checkAdmin) — nada responde sem o segredo', () => {
    assert.ok(code.includes('checkAdmin(event)'));
    assert.ok(code.indexOf('checkAdmin(event)') < code.indexOf("db.query('parceiros'"), 'gate antes de qualquer dado');
  });
  test('CRUD com unicidade de cupom E slug (409 com o conflito nomeado)', () => {
    for (const a of ["'criar'", "'editar'", "'ativar'", "'desativar'"]) assert.ok(code.includes(a), 'action ausente: ' + a);
    assert.ok(code.includes('cupom_ou_slug_ja_existe'));
    assert.ok(code.includes('normalizarCupom') && code.includes('normalizarSlug'));
  });
  test('validade padrão +6 meses e limite null = ilimitado (spec)', () => {
    assert.ok(code.includes('validadePadrao('));
    assert.match(code, /limite_resgates.*null/s);
  });
  test('ativação da cobrança: dupla confirmação por frase, IRREVERSÍVEL e idempotente', () => {
    assert.ok(code.includes("FRASE_CONFIRMACAO = 'ATIVAR COBRANCA'"), 'frase exigida');
    assert.ok(code.includes('confirmacao_necessaria'), 'sem a frase → recusa');
    assert.ok(code.includes('ja_ativa: true') && code.includes('atualizados: 0'), 'já ativa → não reprocessa nem muda a data');
    assert.ok(code.includes('camposAtivacaoLote(r, hoje)'), 'lote usa a regra MAX');
    assert.ok(code.includes('atualizados++'), 'relatório de quantos foram atualizados');
  });
  test('CSV do parceiro com Content-Disposition (download direto)', () => {
    assert.ok(code.includes('text/csv') && code.includes('Content-Disposition'));
  });
});

describe('parceria.js — resgate público', () => {
  const code = src(path.join(FUNCS, 'parceria.js'));
  test('GET público expõe SÓ nome do parceiro/produto/especialidade — nunca e-mail ou limites', () => {
    const getBloco = code.slice(code.indexOf("httpMethod === 'GET'"), code.indexOf('── POST'));
    assert.ok(getBloco.includes('nome_parceiro') && getBloco.includes('nome_produto'));
    assert.ok(!getBloco.includes('p.email') && !getBloco.includes('limite_resgates'), 'dados sensíveis fora da resposta pública');
  });
  test('resgate exige sessão AUTENTICADA (mesmo padrão do acervo) e tem rate limit', () => {
    assert.ok(code.includes('timingSafeEqual'), 'comparação constante de token');
    assert.ok(code.includes('sessionExpiry'), 'sessão expirada rejeitada');
    assert.ok(code.includes('rateLimited(event'), 'rate limit');
  });
  test('valida cupom (ativo/validade/limite) e é IDEMPOTENTE por aluno+parceria', () => {
    assert.ok(code.includes('validarResgate('));
    assert.ok(code.includes('ja_resgatado: true'), 'repetir não duplica nem consome limite');
    // A ordem importa DENTRO do POST (o GET também valida — por isso o slice).
    const post = code.slice(code.indexOf('── POST'));
    assert.ok(post.indexOf('jaResgatou') < post.indexOf('validarResgate(p, resgates.length'), 'idempotência checada ANTES do limite');
  });
  test('origem do Premium marcada p/ downgrade seletivo — pagante nunca vira "parceria"', () => {
    assert.ok(code.includes("premiumOrigem"), 'origem gravada no cadastro');
    assert.match(code, /dataAtivacaoPremium \|\| user\.planoPremium/, 'quem já paga preserva a origem paga');
  });
});

describe('parceria.html — landing de resgate', () => {
  const html = src(path.join(RAIZ, 'parceria.html'));
  test('identidade do OdontoFeed: creme #F6F1E8, serif nos títulos, verde #2D6A4F', () => {
    assert.ok(html.includes('#F6F1E8'));
    assert.ok(html.includes('#2D6A4F'));
    assert.match(html, /h1\{font-family:Georgia/);
  });
  test('mensagens da spec: cortesia nomeada + produto + texto honesto sobre o início da contagem', () => {
    assert.ok(html.includes('3 meses de OdontoFeed Premium'), 'headline da cortesia');
    assert.ok(html.includes('cortesia de'), 'nome do parceiro na frase');
    assert.ok(html.includes('a partir do início da cobrança da plataforma'), 'texto honesto');
    assert.ok(html.includes('avisaremos com antecedência'));
  });
  test('SEM cartão de crédito: nenhum campo de cartão e aviso explícito', () => {
    assert.ok(!/card.?number|numero.?do.?cartao|cvv|cvc/i.test(html), 'nenhum campo de cartão');
    assert.ok(html.includes('Sem cartão de crédito'));
    assert.ok(html.includes('nenhuma cobrança automática') || html.includes('nada será cobrado automaticamente'));
  });
  test('reusa o cadastro/login EXISTENTES (register + login) — nada de auth paralela', () => {
    assert.ok(html.includes('/.netlify/functions/register'));
    assert.ok(html.includes('/.netlify/functions/login'));
    assert.ok(html.includes('aceiteTermos:true'), 'LGPD preservada no fluxo');
    assert.ok(html.includes("crypto.subtle.digest('SHA-256'"), 'mesmo hash de senha do site');
  });
  test('lê o slug do path /parceria/{slug} com fallback ?slug=', () => {
    assert.match(html, /\\\/parceria\\\/\(\[a-z0-9-\]\+\)/);
    assert.ok(html.includes("get('slug')"));
  });
});

describe('parcerias-expiracao.js — scheduled diária', () => {
  const code = src(path.join(FUNCS, 'parcerias-expiracao.js'));
  const toml = src(path.join(RAIZ, 'netlify.toml'));
  test('agendada DIARIAMENTE no netlify.toml', () => {
    assert.match(toml, /\[functions\."parcerias-expiracao"\]\s*\n\s*schedule = "0 9 \* \* \*"/);
  });
  test('aviso 7 dias antes (único, com flag) e e-mail no dia do término', () => {
    assert.ok(code.includes('precisaAviso7(') && code.includes('aviso7EnviadoEm'));
    assert.ok(code.includes('precisaEncerrar('));
    assert.ok(code.includes('assinar') || code.includes('mensal'), 'e-mail explica as opções');
    assert.ok(code.includes('2 meses grátis'), 'anual SEMPRE comunicado como 2 meses grátis (regra do fundador)');
    assert.ok(!/20% ?off|20% de desconto/i.test(code), 'nunca "20% off"');
  });
  test('expirar = rebaixar ao Gratuito; NUNCA cobrar; pagante vira convertido_pago', () => {
    assert.ok(code.includes("plano: 'gratuito'"), 'downgrade automático');
    assert.ok(code.includes('converteuParaPago(user)'), 'proteção do assinante pago');
    assert.match(code, /premiumOrigem === 'parceria'/, 'só rebaixa quem veio de parceria');
    assert.ok(code.includes('Nada será cobrado automaticamente') || code.includes('nada será cobrado'), 'promessa no e-mail');
  });
  test('resposta HTTP só com contadores (precedente afiliados-expiracao)', () => {
    assert.match(code, /\{ date: hoje, avisos, encerrados, convertidos, rebaixados, falhas \}/);
    assert.ok(!code.includes('JSON.stringify(resgates'), 'nenhum dado pessoal na resposta');
  });
});

describe('rotas e painel', () => {
  test('/parceria/* → parceria.html (rewrite 200, slug fica na URL)', () => {
    const toml = src(path.join(RAIZ, 'netlify.toml'));
    assert.match(toml, /from = "\/parceria\/\*"\s*\n\s*to = "\/parceria\.html"\s*\n\s*status = 200/);
  });
  test('hub do admin linka o painel de Parcerias', () => {
    assert.ok(src(path.join(RAIZ, 'admin.html')).includes('/admin-parcerias.html'));
  });
  test('painel: contadores da spec, filtros (status/período/busca), CSV e dupla confirmação', () => {
    const adm = src(path.join(RAIZ, 'admin-parcerias.html'));
    for (const id of ['d-total', 'd-aguardando', 'd-ativos', 'd-encerrados', 'd-convertidos']) {
      assert.ok(adm.includes('id="' + id + '"'), 'contador ausente: ' + id);
    }
    assert.ok(adm.includes('fd-status') && adm.includes('fd-periodo') && adm.includes('fd-busca'), 'filtros da tabela');
    assert.ok(adm.includes('Exportar CSV'));
    assert.ok(adm.includes('ATIVAR COBRANCA'), 'dupla confirmação digitada');
    assert.ok(adm.includes('copiar(') && adm.includes('copiar link'), 'link copiável');
  });
});
