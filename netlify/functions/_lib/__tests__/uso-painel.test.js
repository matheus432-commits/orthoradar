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

// ── 15/08: "coloque também uma métrica para abertura de audio no site" ──────
// Cadeia nova: player ('playing' real, dedupe por faixa) → track-audio
// (sessão do site) → digest_metrics 'audio_play' → get-uso → 4ª série/coluna.
describe('métrica de áudio no site — track-audio.js', () => {
  const code = src(path.join(FUNCS, 'track-audio.js'));
  test('POST com sessão do site: timingSafeEqual + expiração, antes do logEvent', () => {
    assert.ok(code.includes('timingSafeEqual'), 'comparação de token em tempo constante');
    assert.ok(code.includes('sessionExpiry'), 'sessão expirada não registra');
    assert.ok(code.indexOf('tokenEqual(user.sessionToken, token)') < code.indexOf('logEvent('), 'auth antes do registro');
  });
  test('grava audio_play na MESMA fonte do painel (digest_metrics via logEvent)', () => {
    assert.ok(code.includes("require('./_lib/engagement')"), 'reusa o logEvent existente — sem coleção nova');
    assert.match(code, /eventType: 'audio_play'/);
  });
  test('rate limit presente; PRIVACIDADE: email/pmid nunca em console/log', () => {
    assert.ok(code.includes("rateLimited(event, 'track-audio'"));
    assert.ok(!/console\.log/.test(code));
    assert.ok(!/log\.(info|warn|error)\([^)]*(email|pmid)/.test(code), 'nenhum log com email/pmid');
  });
});

describe('métrica de áudio — instrumentação nas 3 páginas', () => {
  test('dashboard: track no primeiro playing REAL, com pmid do card e dedupe', () => {
    const html = src(path.join(RAIZ, 'dashboard.html'));
    assert.ok(html.includes('_trackAudioPlay(a)'), 'chamado no listener de playing');
    assert.match(html, /data-pmid="\$\{safeId\(art\.id\)\}"/, 'pmid no <audio> do card');
    assert.ok(html.includes("dataset.trackedPlay==='1'"), 'dedupe por faixa');
    assert.ok(html.includes("'/.netlify/functions/track-audio'"), 'endpoint certo');
  });
  test('biblioteca: cobre player fixo E nativos; dedupe limpo a cada faixa nova', () => {
    const html = src(path.join(RAIZ, 'biblioteca.html'));
    assert.ok(html.includes('_trackAudioPlay(ev.target)'), 'delegação em captura no playing');
    assert.ok(html.includes("a.dataset.trackedPlay='';a.dataset.pmid='';"), 'mpPrepara zera o dedupe da faixa anterior');
    assert.ok(html.includes('el.dataset.pmid=pmid'), 'pmid do artigo vai no player fixo');
    assert.match(html, /data-pmid="'\+esc\(pmid\)\+'"/, 'pmid no áudio nativo do card expandido');
  });
  test('edição: só com sessão do site (link de e-mail ?e&t e admin não contam)', () => {
    const html = src(path.join(RAIZ, 'edicao.html'));
    assert.ok(html.includes('_trackAudioPlay(ev.target)'), 'delegação em captura no playing');
    assert.match(html, /if \(!email \|\| !token\) return;/, 'sem sessão → sem evento');
    assert.match(html, /startsWith\('audio-'\) \? a\.id\.slice\(6\)/, 'pmid extraído do id do player');
  });
});

describe('métrica de áudio — agregação e painel', () => {
  test('get-uso classifica audio_play e devolve o campo nas duas visões', () => {
    const code = src(path.join(FUNCS, 'get-uso.js'));
    assert.match(code, /t === 'audio_play' \? 'audio'/, 'tipoDe conhece o evento novo');
    assert.match(code, /d, open: v\.open, click: v\.click, resumo: v\.resumo, audio: v\.audio/, 'série diária com audio');
    assert.match(code, /resumo: v\.resumo, audio: v\.audio, outros: v\.outros,\n/, 'linha do dentista com audio');
  });
  test('painel: 4ª série com paleta validada, legenda, KPI, coluna ordenável e CSV', () => {
    const html = src(path.join(RAIZ, 'admin-uso.html'));
    assert.ok(html.includes('#eda100'), '4ª cor da paleta validada (validate_palette PASS)');
    assert.ok(html.includes('Áudios no site'), 'legenda + série de linhas');
    assert.ok(html.includes('k-audios'), 'KPI de áudios tocados');
    assert.ok(html.includes("ordenar('audio')"), 'coluna ordenável na tabela (alívio do WARN de contraste)');
    assert.ok(html.includes("'Áudios'"), 'coluna no CSV');
    assert.match(html, /\['audio','Áudios no site'\]/, 'série no gráfico de linhas');
  });
  test('painel tolera resposta de servidor antigo sem o campo audio', () => {
    const html = src(path.join(RAIZ, 'admin-uso.html'));
    assert.ok(html.includes('Number(x&&x.audio)||0'), 'normalização au() na entrada');
  });
});
