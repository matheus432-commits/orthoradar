// SPEC DE TEMAS (24/08) — fiação das Fases 1, 3, 4 e 5 (a taxonomia em si é
// testada em taxonomia-v2.test.js; a lógica de migração roda em runtime nas
// simulações e aqui nas checagens estáticas de segurança).
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const FUNCS = path.join(__dirname, '..', '..');
const RAIZ = path.join(FUNCS, '..', '..');
const src = (p) => fs.readFileSync(p, 'utf8');

const { validarRespostaIA, montarPromptClassificacao } = require('../migracao-temas');

describe('Fase 1 — diagnóstico de temas (só leitura)', () => {
  test('função admin-gated antes de qualquer dado; CSV disponível', () => {
    const f = src(path.join(FUNCS, 'diagnostico-temas.js'));
    assert.ok(f.indexOf('checkAdmin(event)') < f.indexOf('construirDiagnostico(new'), 'gate antes da consulta');
    assert.ok(f.includes("format === 'csv'"));
  });
  test('núcleo NUNCA escreve (sem updateDoc/setDoc/addDoc)', () => {
    const n = src(path.join(FUNCS, '_lib', 'diagnostico-temas.js'));
    assert.ok(!/updateDoc|setDoc|addDoc/.test(n), 'diagnóstico é 100% leitura');
  });
  test('cobre os 6 itens da spec: totais, vazios, distribuição bruta, variantes (Levenshtein ≤ 3), formato, amostra alinhadores', () => {
    const n = src(path.join(FUNCS, '_lib', 'diagnostico-temas.js'));
    for (const marca of ['temaVazio', 'distribuicaoBruta', 'levenshtein', 'formatoArray', 'amostraAlinhadores', 'd <= 3']) {
      assert.ok(n.includes(marca), marca);
    }
  });
  test('workflow é dispatch-only, sem chaves de IA/TTS, com artifacts', () => {
    const wf = src(path.join(RAIZ, '.github', 'workflows', 'diagnostico-temas.yml'));
    assert.ok(wf.includes('workflow_dispatch') && !wf.includes('push:'));
    assert.ok(!wf.includes('ANTHROPIC_API_KEY') && !wf.includes('GOOGLE_TTS_API_KEY'), 'leitura custa zero');
    assert.ok(wf.includes('upload-artifact'));
  });
});

describe('Fase 3 — migração (segurança)', () => {
  test('prompt EXATO da spec', () => {
    const p = montarPromptClassificacao({ especialidade: 'Ortodontia', titulo_pt: 'T', resumo_pt: 'R' });
    assert.ok(p.startsWith('Classifique o artigo odontológico abaixo em 1 a 3 temas clínicos.'));
    assert.ok(p.includes('Se nenhum se aplicar bem, responda: sem-tema'));
  });
  test('validação ESTRITA: só id exato entra; label/livre é descartado', () => {
    const v = validarRespostaIA('Alinhadores invisíveis, alinhadores-invisiveis, qualquer-coisa', 'Ortodontia');
    assert.deepEqual(v.ids, ['alinhadores-invisiveis']);
    assert.equal(v.descartados.length, 2);
  });
  test('script: dry-run padrão com parser tolerante + eco do input', () => {
    const s = src(path.join(RAIZ, 'scripts', 'migrar-temas.js'));
    assert.match(s, /DRY_RUN = !\/\^\(false\|0\|n\[a\ã\]o\|no\)\$\/i/);
    assert.ok(s.includes('input recebido'));
  });
  test('workflow só manual; lotes de 10 com 1s no núcleo', () => {
    const wf = src(path.join(RAIZ, '.github', 'workflows', 'migrar-temas.yml'));
    assert.ok(wf.includes('workflow_dispatch') && !wf.includes('push:'));
    const n = src(path.join(FUNCS, '_lib', 'migracao-temas.js'));
    assert.ok(n.includes('TAMANHO_DO_LOTE = 10') && n.includes('PAUSA_ENTRE_LOTES_MS = 1000'));
  });
  test('idempotência por versao_taxonomia e temas_raw preservado', () => {
    const n = src(path.join(FUNCS, '_lib', 'migracao-temas.js'));
    assert.ok(n.includes('a.versao_taxonomia === TAXONOMIA_VERSAO'));
    assert.match(n, /temas_raw !== undefined\n?\s*\? artigo\.temas_raw/, 'primeiro contato preservado');
  });
});

describe('Fase 4 — prevenção no pipeline', () => {
  test('pipeline usa a MESMA taxonomia e o MESMO prompt, com fallback determinístico', () => {
    const n = src(path.join(FUNCS, '_lib', 'temas-pipeline.js'));
    assert.ok(n.includes("require('./migracao-temas')"), 'mesmo prompt/validação da migração');
    assert.ok(n.includes('DESCARTADO, nunca gravado'), 'rejeição logada');
    assert.ok(n.includes("require('./temas-classificador')"), 'fallback sem custo');
  });
  test('teste de integridade do acervo existe e FALHA em violação (exit 1)', () => {
    const s = src(path.join(RAIZ, 'scripts', 'validar-temas-acervo.js'));
    assert.ok(s.includes('ehIdValido') && s.includes('process.exit(1)'));
    assert.ok(src(path.join(RAIZ, '.github', 'workflows', 'validar-temas.yml')).includes('workflow_dispatch'));
  });
});

describe('Fase 5 — acervo/biblioteca por id canônico', () => {
  test('acervo devolve ids com fallback por sinônimo do legado + catálogo id→label', () => {
    const a = src(path.join(FUNCS, 'acervo.js'));
    assert.ok(a.includes("require('./_lib/taxonomia')"));
    assert.match(a, /mapearLista\(a\.tema/, 'legado mapeado na hora — filtro funciona pré-migração');
    assert.ok(a.includes('temasCatalogo'));
  });
  test('card da biblioteca exibe TODOS os temas do artigo', () => {
    const html = src(path.join(RAIZ, 'biblioteca.html'));
    assert.match(html, /a\.temas\.map\(t=>.*rotuloTema\(t\)/, 'todos os temas no card, não só o primeiro');
  });
  test('rotas /api/admin/* das duas specs no netlify.toml', () => {
    const toml = src(path.join(RAIZ, 'netlify.toml'));
    for (const rota of ['/api/admin/diagnostico-temas', '/api/admin/migrar-temas', '/api/admin/diagnostico-pipeline', '/api/admin/backfill-biblioteca']) {
      assert.ok(toml.includes(rota), rota);
    }
  });
});
