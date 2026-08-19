// PAINEL DE USO (pedido do fundador 15/08): frequência de uso/abertura/clicks
// por dentista desde 20/07/26, em gráficos. Regressões da cadeia: gate de
// admin, atribuição via digests, privacidade (PII nunca em log público) e os
// requisitos do método de visualização (legenda, rótulos diretos, tabela).
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

describe('get-uso.js — agregador de uso (admin)', () => {
  const code = src(path.join(FUNCS, 'get-uso.js'));
  test('exclusivo do admin, ANTES de qualquer dado', () => {
    assert.ok(code.indexOf('checkAdmin(event)') < code.indexOf("db.query('digest_metrics'"));
  });
  test('período padrão 20/07/26 e range de campo único (sem índice composto)', () => {
    assert.ok(code.includes("DESDE_PADRAO = '2026-07-20'"));
    assert.ok(code.includes("GREATER_THAN_OR_EQUAL"));
    assert.ok(!code.includes('compositeFilter'), 'sem filtro composto — range simples em ts');
  });
  test('aberturas/cliques de e-mail atribuídos via digests (eventos chegam sem email)', () => {
    assert.ok(code.includes('emailDoDigest'), 'mapa digestId→email');
    assert.match(code, /ev\.email \|\| emailDoDigest\.get/, 'email direto vence; digest é o fallback');
  });
  test('PRIVACIDADE: nome/e-mail nunca em console/log (só na resposta atrás do segredo)', () => {
    assert.ok(!/console\.log/.test(code), 'sem console.log na função');
    assert.ok(!/log\.(info|warn|error)\([^)]*email/.test(code), 'nenhum log com email');
  });
});

describe('admin-uso.html — página de gráficos', () => {
  const html = src(path.join(RAIZ, 'admin-uso.html'));
  test('série de 3 cores VALIDADA + legenda + rótulos diretos (alívio do WARN de contraste)', () => {
    for (const c of ['#2a78d6', '#eb6834', '#1baf7a']) assert.ok(html.includes(c), 'cor da paleta validada: ' + c);
    assert.ok(html.includes('class="legenda"'), 'legenda presente (3 séries)');
    assert.ok(html.includes('rótulo direto') || html.includes('rotulo direto') || html.includes('fmtCurto'), 'rótulos no gráfico');
    assert.ok(html.includes('tb-dentistas'), 'visão-tabela existe');
  });
  test('camada de hover: crosshair na linha e tooltip por marca nas barras', () => {
    assert.ok(html.includes('ln-cross'), 'crosshair no gráfico de linhas');
    assert.ok(html.includes("addEventListener('mousemove'"), 'tooltip acompanha o mouse');
    assert.ok(html.includes('tipOff'), 'tooltip some ao sair');
  });
  test('filtros numa linha acima dos gráficos; período REFAZ a consulta no servidor', () => {
    assert.ok(html.includes('mudarPeriodo'), 'chips de período');
    assert.match(html, /get-uso\?secret=.*&desde=/, 'recorte reagrega no backend');
    assert.ok(html.includes("piso='2026-07-20'"), 'piso do período é 20/07');
  });
  test('tabela ordenável + busca + CSV pt-BR com BOM', () => {
    assert.ok(html.includes("ordenar('total')"));
    assert.ok(html.includes('baixarCSV'));
    assert.ok(html.includes("'\\ufeff'") || html.includes('﻿'), 'BOM p/ Excel BR');
  });
  test('um eixo só por gráfico (nunca eixo duplo)', () => {
    assert.equal((html.match(/text-anchor="end"/g) || []).length >= 1, true);
    assert.ok(!html.includes('eixo2') && !html.includes('axis2') && !html.includes('yRight'), 'sem segundo eixo Y');
  });
  test('hub do admin linka o painel', () => {
    assert.ok(src(path.join(RAIZ, 'admin.html')).includes('/admin-uso.html'));
  });
});
