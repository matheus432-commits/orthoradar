// BIBLIOTECA /biblioteca (deploy 07/08) — regressões estáticas da cadeia:
// autenticação de sessão, regra "só artigo COM podcast" (fundador), URL de
// áudio SEMPRE a persistida, tracking de lidos integrado ao existente, rotas
// e link no dashboard. As regras de dados são testadas aqui de forma estática
// porque o endpoint depende do Firestore em produção.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const FUNCS = path.join(__dirname, '..', '..');
const RAIZ  = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

describe('acervo.js — backend da biblioteca', () => {
  const code = src(path.join(FUNCS, 'acervo.js'));

  test('exige sessão válida (tokenEqual + expiração + conta ativa) e rate limit', () => {
    assert.ok(code.includes('timingSafeEqual'), 'comparação de token constante');
    assert.ok(code.includes('sessionExpiry'), 'sessão expirada é rejeitada');
    assert.ok(code.includes("ativo === false"), 'conta inativa é rejeitada');
    assert.ok(code.includes('rateLimited(event'), 'endpoint tem rate limit');
  });

  test('EXCLUSIVO do Premium (diretriz 07/08): sem isPremium → 403 premium_required', () => {
    assert.ok(code.includes('isPremium(user)'), 'gate de plano no servidor');
    assert.ok(code.includes("'premium_required'"), 'erro estruturado p/ o convite de upgrade');
    // O gate precisa vir ANTES de qualquer entrega de dados do acervo (a
    // comparação mira a CHAMADA no handler, não a definição da função).
    assert.ok(code.indexOf('premium_required') < code.indexOf('Promise.all([mapaDeAudios('), 'gate antes do catálogo');
  });

  test('data do card é só a DATA (docs com timestamp ISO não quebram o badge)', () => {
    assert.match(code, /data:\s*String\(a\.data \|\| au\.date \|\| ''\)\.slice\(0, 10\)/);
  });

  test('regra do fundador: só artigo ATIVO com PODCAST e título PT vira card', () => {
    assert.ok(code.includes("!au || a.status !== 'active'"), 'sem áudio ou inativo → fora');
    assert.match(code, /titulo_pt[\s\S]{0,40}length < 10/, 'artigo cru nunca vira card');
  });

  test('áudio SEMPRE pela URL persistida (audioUrlDe) e lidos via tracking existente', () => {
    assert.ok(code.includes('audioUrlDe('), 'URLs de áudio via helper persistido');
    assert.ok(!/firebaseDownloadUrl\(/.test(code), 'nunca remonta URL por env');
    assert.ok(code.includes('digest_metrics'), 'lidos vêm do tracking de cliques existente');
    assert.match(code, /click.*context_opened|context_opened.*click/s, 'click do e-mail + abertura no site contam como lido');
    assert.ok(code.includes("logEvent(") && code.includes("'context_opened'"), 'abrir resumo no acervo registra no MESMO tracking');
  });

  test('episódios "completo" ficam fora da listagem (são do feed mestre)', () => {
    assert.ok(code.includes("e.tipo === 'completo'"), 'edição completa não é episódio individual');
  });
});

describe('biblioteca.html — página do acervo', () => {
  const html = src(path.join(RAIZ, 'biblioteca.html'));

  test('usa a sessão do dashboard (of_email/of_token) e o endpoint acervo', () => {
    assert.ok(html.includes("localStorage.getItem('of_email')"));
    assert.ok(html.includes("localStorage.getItem('of_token')"));
    assert.ok(html.includes('/.netlify/functions/acervo'));
  });

  test('tem os filtros pedidos (especialidade, nível, data, tema) + busca', () => {
    for (const id of ['f-esp', 'f-nivel', 'f-data', 'f-tema', 'f-busca']) {
      assert.ok(html.includes('id="' + id + '"'), 'filtro ausente: ' + id);
    }
    assert.match(html, /titulo\+' '\+a\.resumo/, 'busca cobre título E resumo');
  });

  test('temas DEPENDEM da especialidade escolhida (bug 08/08: lista global só de Prótese)', () => {
    assert.ok(html.includes('function encherTemas()'), 'recalcula temas por especialidade');
    assert.match(html, /esp&&a\.especialidade!==esp/, 'temas vêm só da especialidade filtrada');
    assert.ok(html.includes("onchange=\"encherTemas();render()\""), 'trocar especialidade refaz os temas');
    // Feedback do fundador 08/08: o seletor NUNCA some — sem temas ele fica
    // visível porém desabilitado, com o aviso "em breve".
    assert.ok(html.includes('sel.disabled=true'), 'sem temas → desabilitado, não oculto');
    assert.ok(html.includes('Temas — em breve nesta especialidade'), 'aviso explica a ausência');
    assert.ok(!html.includes("style.display=temas.length"), 'o comportamento de esconder foi removido');
  });

  test('403 premium_required → tela de convite Premium (não tela de erro)', () => {
    assert.ok(html.includes("b.error==='premium_required'"), 'front trata o 403 estruturado');
    assert.ok(html.includes('id="premium"'), 'tela de convite existe');
  });

  test('player de áudio HTML5 nativo inline + seção separada de podcasts + indicação de lido', () => {
    assert.match(html, /<audio controls preload="none"/, 'player nativo com preload=none (mobile)');
    assert.ok(html.includes('vista-podcasts'), 'seção separada de podcasts');
    assert.ok(html.includes('✓ lido'), 'indicação visual de já lido');
    assert.ok(html.includes('escapeHtml') || html.includes('esc('), 'saída escapada');
  });

  // ── Layout REVISTA (aprovado 10/08, protótipo v2) ─────────────────────────
  test('destaque automático determinístico: maior nível de evidência mais recente (sem IA)', () => {
    assert.ok(html.includes('function rankNivel'), 'ranking de nível de evidência');
    assert.ok(html.includes('function escolherDestaque'), 'seleção determinística do destaque');
    assert.match(html, /meta[\s\S]{0,40}4/, 'meta-análise no topo do ranking');
  });
  test('especialidades como chips que escrevem no select f-esp (fonte da verdade preservada)', () => {
    assert.ok(html.includes('id="chips-esp"'), 'fila de chips presente');
    assert.ok(html.includes("$('f-esp').value=e"), 'chip seleciona via f-esp — temas/filtros continuam funcionando');
    assert.ok(html.includes('<select id="f-esp" hidden'), 'select segue existindo (lógica de temas depende dele)');
  });
  test('ícones sérios: SVGs da home em vez de emojis (diretriz 10/08)', () => {
    assert.ok(html.includes("'Ortodontia':'<svg") && html.includes("'Radiologia':'<svg"), 'mapa de SVGs por especialidade');
    assert.ok(html.includes("'default':'<svg"), 'especialidade fora do mapa ganha ícone genérico, nunca quebra');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html.replace(/✓/g, '')), 'nenhum emoji na página');
  });
  test('player fixo: UM <audio> reaproveitado; faixa nova limpa o estado do fallback de rota', () => {
    assert.ok(html.includes('id="mp-audio"'), 'áudio único do player fixo');
    assert.match(html, /dataset\.proxied='';a\.dataset\.srcOriginal='';a\.dataset\.retry=''/, 'sem estado de proxy preso entre faixas');
    assert.ok(html.includes('playbackRate'), 'controle de velocidade');
  });
  test('continue ouvindo: progresso salvo no aparelho, com piso/teto e limpeza ao concluir', () => {
    assert.ok(html.includes("PROG_KEY='of_bib_prog'"), 'chave própria no localStorage');
    assert.match(html, /t<5\|\|t\/d>0\.95/, 'menos de 5s ou mais de 95% não fica na trilha');
    assert.ok(html.includes("progSalvar(MP_ATUAL.pmid,0,1)"), 'episódio concluído sai da trilha');
  });
  test('acervo completo paginado (lista densa) — vitrine em cima, produtividade embaixo', () => {
    assert.ok(html.includes('POR_PAGINA=30'), 'paginação da lista densa');
    assert.ok(html.includes('id="vermais"'), 'carregar mais');
    assert.ok(html.includes('id="c-novidades"') && html.includes('id="hero"'), 'prateleiras e destaque presentes');
  });
});

describe('rotas e integração', () => {
  test('/precos redireciona para os planos; /biblioteca via pretty URL', () => {
    const toml = src(path.join(RAIZ, 'netlify.toml'));
    assert.match(toml, /from = "\/precos"\s*\n\s*to = "\/#planos"/);
  });
  test('dashboard tem o atalho para /biblioteca', () => {
    const dash = src(path.join(RAIZ, 'dashboard.html'));
    assert.ok(dash.includes("location.href='/biblioteca'"), 'aba/link Biblioteca no dashboard');
  });
});
