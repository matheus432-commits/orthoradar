// Anti-repetição da especialidade no Instagram (incidente 25/07: Odontopediatria
// 2 dias seguidos). Regras: pula a especialidade dos últimos dias; nunca deixa
// o dia sem post (libera se todas as com conteúdo forem recentes).
// Run: node --test netlify/functions/_lib/__tests__/instagram-rodizio.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { escolherEspecialidadeComConteudo, especialidadesRecentes } = require('../especialidade-identidade');

describe('escolherEspecialidadeComConteudo — anti-repetição', () => {
  // conteúdo disponível: todas menos as sem edição
  const comConteudo = (setSemConteudo = new Set()) =>
    async (esp) => (setSemConteudo.has(esp) ? null : { arts: esp });

  test('sem nada a evitar → pega a 1ª com conteúdo', async () => {
    const r = await escolherEspecialidadeComConteudo(
      ['Bucomaxilofacial', 'Odontopediatria', 'DTM e Dor Orofacial'],
      comConteudo(new Set(['Bucomaxilofacial'])), new Set());
    assert.equal(r.especialidade, 'Odontopediatria');
  });

  test('INCIDENTE 25/07: principal do dia é a de ontem → PULA para a próxima', async () => {
    // Jul 25: prioridade começa em Odontopediatria, mas ela saiu ontem (fallback)
    const r = await escolherEspecialidadeComConteudo(
      ['Odontopediatria', 'DTM e Dor Orofacial', 'Radiologia'],
      comConteudo(new Set()), new Set(['Odontopediatria']));
    assert.equal(r.especialidade, 'DTM e Dor Orofacial', 'não pode repetir a de ontem');
  });

  test('pula várias evitadas seguidas até achar uma nova', async () => {
    const r = await escolherEspecialidadeComConteudo(
      ['Odontopediatria', 'DTM e Dor Orofacial', 'Radiologia'],
      comConteudo(new Set()), new Set(['Odontopediatria', 'DTM e Dor Orofacial']));
    assert.equal(r.especialidade, 'Radiologia');
  });

  test('nunca deixa o dia sem post: se as com conteúdo estão todas evitadas, libera', async () => {
    // só Odontopediatria tem conteúdo, mas ela está na lista de evitar
    const r = await escolherEspecialidadeComConteudo(
      ['DTM e Dor Orofacial', 'Odontopediatria', 'Radiologia'],
      comConteudo(new Set(['DTM e Dor Orofacial', 'Radiologia'])), new Set(['Odontopediatria']));
    assert.equal(r.especialidade, 'Odontopediatria', 'melhor repetir do que ficar sem post');
  });

  test('ninguém com conteúdo → null', async () => {
    const r = await escolherEspecialidadeComConteudo(
      ['A', 'B'], async () => null, new Set());
    assert.equal(r, null);
  });
});

describe('especialidadesRecentes', () => {
  test('junta as especialidades dos últimos N dias (doc id = data)', async () => {
    const hist = { '2026-07-24': { especialidade: 'Bucomaxilofacial' }, '2026-07-23': { especialidade: 'Prótese' } };
    const db = { getDoc: async (_c, id) => hist[id] || null };
    const set = await especialidadesRecentes(db, 'instagram_posts', '2026-07-25', 2);
    assert.deepEqual([...set].sort(), ['Bucomaxilofacial', 'Prótese']);
  });
  test('data inválida → conjunto vazio (best-effort)', async () => {
    const db = { getDoc: async () => null };
    assert.equal((await especialidadesRecentes(db, 'x', 'lixo', 2)).size, 0);
  });
});
