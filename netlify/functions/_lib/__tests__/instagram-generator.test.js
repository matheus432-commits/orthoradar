// Tests do gerador de posts do Instagram
// Run: node --test netlify/functions/_lib/__tests__/instagram-generator.test.js

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCarouselPost,
  buildStoryPost,
  buildReelCaption,
  generateDailyPostsPlan,
  getGreetingByHour,
  formatEvidenceLevel,
  truncateText,
  getThemeColor,
} = require('../instagram-generator');

describe('instagram-generator', () => {
  test('getGreetingByHour retorna saudação apropriada por hora BRT', () => {
    assert.ok(getGreetingByHour(5).includes('Madrugada'));
    assert.ok(getGreetingByHour(8).includes('Bom dia'));
    assert.ok(getGreetingByHour(12).includes('Odontológica'));
    assert.ok(getGreetingByHour(18).includes('Estudos'));
    assert.ok(getGreetingByHour(22).includes('Leitura'));
  });

  test('formatEvidenceLevel mapeia níveis em emoji+texto descritivo', () => {
    assert.ok(formatEvidenceLevel('RCT').includes('Ensaio'));
    assert.ok(formatEvidenceLevel('Meta-análise').includes('Meta'));
    assert.ok(formatEvidenceLevel('Desconhecido').includes('Desconhecido'));
  });

  test('truncateText respeita limite de caracteres', () => {
    const long = 'a'.repeat(150);
    const truncated = truncateText(long, 100);
    assert.equal(truncated.length, 100);
    assert.ok(truncated.endsWith('…'));
  });

  test('truncateText retorna texto inteiro se menor que limite', () => {
    const short = 'Artigo importante';
    assert.equal(truncateText(short, 100), short);
  });

  test('getThemeColor retorna emoji apropriado por tema', () => {
    assert.ok(getThemeColor('Estética', '').includes('✨'));
    assert.ok(getThemeColor('', 'Implantodontia').includes('🔧'));
    assert.ok(getThemeColor('', 'Desconhecido').includes('🦷'));
  });

  test('buildCarouselPost gera caption com CTA correto', () => {
    const articles = [
      {
        titulo_pt: 'Efetividade de protocolos de clareamento',
        journal: 'J Esthet Dent',
        year: '2026',
        nivel_evidencia: 'RCT',
        tema: 'Estética',
        especialidade: 'Dentística',
        resumo_pt: 'Estudo com 50 pacientes avaliando tempo de tratamento',
        pmid: '12345'
      },
      {
        titulo_pt: 'Prótese sobre implante imediata',
        journal: 'Implant Dent',
        year: '2026',
        nivel_evidencia: 'Estudo Coorte',
        tema: 'Implante',
        especialidade: 'Implantodontia',
        resumo_pt: 'Análise de 6 meses pós-carga',
        pmid: '12346'
      }
    ];

    const post = buildCarouselPost(articles, { dateStr: '2026-07-20' });
    assert.equal(post.type, 'carousel');
    assert.ok(post.caption.includes('OdontoFeed'));
    assert.ok(post.caption.includes('2 estudos'));
    assert.ok(post.caption.includes('2026-07-20'));
    assert.ok(post.caption.includes('#OdontoFeed'));
    assert.equal(post.slides.length, 2);
  });

  test('buildCarouselPost limita ao máximo de slides solicitado', () => {
    const articles = Array.from({ length: 10 }, (_, i) => ({
      titulo_pt: `Artigo ${i}`,
      journal: 'Journal',
      year: '2026',
      nivel_evidencia: 'RCT',
      tema: 'Tema',
      especialidade: 'Esp',
      resumo_pt: 'Resumo',
      pmid: String(i)
    }));

    const post = buildCarouselPost(articles, { maxSlides: 3 });
    assert.equal(post.slides.length, 3);
  });

  test('buildStoryPost gera texto conciso para story', () => {
    const article = {
      titulo_pt: 'Breakthrough no tratamento de DTM com terapia comportamental',
      tema: 'Dor orofacial',
      especialidade: 'DTM e Dor Orofacial',
      nivel_evidencia: 'RCT'
    };

    const post = buildStoryPost(article);
    assert.equal(post.type, 'story');
    assert.ok(post.text.includes('Breakthrough'));
    assert.ok(post.text.includes('Ensaio'));
    assert.ok(post.cta.includes('Ver'));
  });

  test('buildReelCaption gera descrição para áudio compilado do dia', () => {
    const caption = buildReelCaption('Ortodontia', '2026-07-20', {
      reelDurationSecs: 480,
      audioMb: 1.75
    });

    assert.equal(caption.type, 'reel');
    assert.ok(caption.caption.includes('Ortodontia'));
    assert.ok(caption.caption.includes('8m'));
    assert.ok(caption.caption.includes('2026-07-20'));
    assert.ok(caption.caption.includes('#Ortodontia'));
    assert.equal(caption.durationSecs, 480);
  });

  test('generateDailyPostsPlan monta plano completo de posts do dia', () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({
      titulo_pt: `Artigo ${i}`,
      journal: 'J',
      year: '2026',
      nivel_evidencia: 'RCT',
      tema: 'Tema',
      especialidade: 'Esp',
      resumo_pt: 'R',
      pmid: String(i)
    }));

    const plan = generateDailyPostsPlan(articles, {
      dateStr: '2026-07-20',
      hourBrt: 8,
      specialties: ['Ortodontia', 'Implantodontia']
    });

    assert.equal(plan.dateStr, '2026-07-20');
    assert.equal(plan.totalPosts, 3); // carousel + story + reel
    assert.equal(plan.posts[0].post.type, 'carousel');
    assert.equal(plan.posts[1].post.type, 'story');
    assert.equal(plan.posts[2].post.type, 'reel');
  });

  test('carousel slide contém todos os metadados principais do artigo', () => {
    const articles = [{
      titulo_pt: 'Estudo A',
      titulo: 'Study A',
      journal: 'Nature',
      year: '2026',
      nivel_evidencia: 'RCT',
      tema: 'Estética',
      especialidade: 'Dentística',
      resumo_pt: 'Resumo curto do artigo',
      pmid: '99999',
      doi: '10.1234/test'
    }];

    const post = buildCarouselPost(articles);
    const slide = post.slides[0];

    assert.ok(slide.text.includes('Estudo A'));
    assert.ok(slide.text.includes('RCT') || slide.text.includes('Ensaio'));
    assert.ok(slide.text.includes('Nature'));
    assert.ok(slide.text.includes('2026'));
    assert.ok(slide.text.includes('Estética'));
    assert.ok(slide.text.includes('Dentística'));
  });
});
