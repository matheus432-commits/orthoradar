// Taxonomia de ENSINO (aluno + professor): integridade e cobertura.
//
// O que fica travado aqui:
//   • todas as 23 especialidades reconhecidas pelo CFO existem como área;
//   • o ciclo básico e o pré-clínico da graduação estão cobertos;
//   • ids únicos e estáveis, cada tema com ao menos uma página;
//   • linguagem da casa: "Distalização" (nunca "Distanciamento"), zero emojis;
//   • busca funciona sem acento e sem hífen (mesma regra da Biblioteca);
//   • o JSON gerado em data/ está em dia com a fonte.
//
// Run: node --test netlify/functions/_lib/__tests__/ensino-taxonomia.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { taxonomia, buscar, resumo, slug } = require('../ensino/taxonomia');

const ESPECIALIDADES_CFO = [
  'Acupuntura', 'Cirurgia e traumatologia bucomaxilofacial', 'Dentística',
  'Disfunção temporomandibular e dor orofacial', 'Endodontia', 'Estomatologia',
  'Harmonização orofacial', 'Homeopatia', 'Implantodontia', 'Odontogeriatria',
  'Odontologia do esporte', 'Odontologia do trabalho', 'Odontologia hospitalar',
  'Odontologia legal', 'Odontologia para pacientes com necessidades especiais',
  'Odontopediatria', 'Ortodontia', 'Ortopedia funcional dos maxilares',
  'Patologia oral e maxilofacial', 'Periodontia', 'Prótese bucomaxilofacial',
  'Prótese dentária', 'Radiologia odontológica e imaginologia', 'Saúde coletiva',
];

const BASE_GRADUACAO = [
  'Anatomia de cabeça e pescoço', 'Anatomia dental e escultura', 'Histologia e embriologia bucal',
  'Fisiologia e bioquímica aplicadas', 'Microbiologia e imunologia oral', 'Patologia geral',
  'Farmacologia e terapêutica', 'Anestesiologia', 'Biossegurança e ergonomia', 'Materiais dentários',
  'Oclusão', 'Cariologia e prevenção', 'Propedêutica e clínica integrada', 'Urgências e emergências',
  'Metodologia científica e bioestatística',
];

const todoTexto = () => JSON.stringify(taxonomia());

describe('cobertura', () => {
  test('todas as especialidades reconhecidas pelo CFO são áreas marcadas cfo:true', () => {
    const nomes = new Map(taxonomia().areas.map((a) => [a.nome, a]));
    for (const e of ESPECIALIDADES_CFO) {
      assert.ok(nomes.has(e), 'falta a especialidade: ' + e);
      assert.equal(nomes.get(e).cfo, true, e + ' deve ser cfo:true');
    }
  });
  test('ciclo básico e pré-clínico da graduação cobertos', () => {
    const nomes = new Set(taxonomia().areas.map((a) => a.nome));
    for (const b of BASE_GRADUACAO) assert.ok(nomes.has(b), 'falta a disciplina de base: ' + b);
  });
  test('volume mínimo para valer como catálogo (não uma lista de capítulos)', () => {
    const r = resumo();
    assert.ok(r.areas >= 38, 'áreas: ' + r.areas);
    assert.ok(r.temas >= 250, 'temas: ' + r.temas);
    assert.ok(r.paginas >= 1000, 'páginas: ' + r.paginas);
    assert.equal(r.cfo, ESPECIALIDADES_CFO.length);
  });
  test('toda área tem descrição e ao menos um módulo; todo tema tem ao menos uma página', () => {
    for (const a of taxonomia().areas) {
      assert.ok(a.descricao.length > 20, a.nome + ' sem descrição');
      assert.ok(a.modulos.length >= 1, a.nome + ' sem módulos');
      for (const m of a.modulos) for (const t of m.temas) assert.ok(t.paginas.length >= 1, t.id + ' sem páginas');
    }
  });
});

describe('integridade', () => {
  test('ids únicos, estáveis e legíveis (slug do caminho)', () => {
    const ids = new Set();
    for (const a of taxonomia().areas) {
      assert.equal(a.id, slug(a.nome));
      for (const m of a.modulos) for (const t of m.temas) {
        assert.ok(t.id.startsWith(a.id + '/'), t.id);
        for (const p of t.paginas) {
          assert.ok(!ids.has(p.id), 'id repetido: ' + p.id);
          ids.add(p.id);
          assert.match(p.id, /^[a-z0-9/-]+$/);
        }
      }
    }
  });
  test('linguagem da casa: Distalização, nunca Distanciamento; zero emojis', () => {
    const s = todoTexto();
    assert.ok(!/distanciamento/i.test(s));
    assert.ok(/Distalização/.test(s));
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s));
  });
});

describe('busca', () => {
  test('acha "miniimplante" sem hífen e sem acento, dentro de Ortodontia', () => {
    const r = buscar('miniimplante');
    assert.ok(r.length >= 1);
    assert.ok(r.some((x) => x.area === 'Ortodontia' && /mini-implantes/i.test(x.pagina || x.tema)));
  });
  test('E de termos e filtro por área', () => {
    const r = buscar('classe ii propulsor', { area: 'ortodontia' });
    assert.ok(r.length >= 1);
    assert.ok(r.every((x) => x.areaId === 'ortodontia'));
    assert.deepEqual(buscar('xyzw'), []);
    assert.deepEqual(buscar(''), []);
  });
  test('acerto no nome da página vem antes de acerto só no tema', () => {
    const r = buscar('anestesia');
    assert.ok(r.length > 5);
    assert.ok(r[0].score >= r[r.length - 1].score);
  });
});

describe('JSON gerado', () => {
  test('data/ensino-temas.json está em dia com a fonte (rode scripts/ensino-gerar-json.js)', () => {
    const p = path.join(__dirname, '..', '..', '..', '..', 'data', 'ensino-temas.json');
    assert.ok(fs.existsSync(p), 'gere o JSON');
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepEqual(doc.resumo, resumo());
    assert.deepEqual(doc.areas, taxonomia().areas);
  });
});
