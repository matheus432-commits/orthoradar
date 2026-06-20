import { Decimal } from '@orthofollow/shared'
import type { KnowledgeRecord } from '../ckl/types'

export const P01_KNOWLEDGE: KnowledgeRecord[] = [
  {
    id: 'kr-facial-vertical-symmetry', version: '1.0.0',
    formulaSlug: 'facial-vertical-symmetry',
    displayName: 'Simetria Facial Vertical',
    rules: [
      { when: r => r.classification === 'SYMMETRIC',           severity: 'NORMAL',   classification: 'SYMMETRIC',           priority: 10, referralRequired: false },
      { when: r => r.classification === 'ASYMMETRIC_MILD',     severity: 'MILD',     classification: 'ASYMMETRIC_MILD',     priority: 30, referralRequired: false },
      { when: r => r.classification === 'ASYMMETRIC_MODERATE', severity: 'MODERATE', classification: 'ASYMMETRIC_MODERATE', priority: 50, referralRequired: false },
      { when: r => r.classification === 'ASYMMETRIC_SEVERE',   severity: 'SEVERE',   classification: 'ASYMMETRIC_SEVERE',   priority: 70, referralRequired: true, referralSpecialty: 'CIRURGIA_ORTOGNATICA' },
    ],
    templates: [
      { id: 'tpl-sym-normal',   severity: 'NORMAL',   classification: 'SYMMETRIC',           text: 'A face apresenta simetria vertical adequada, sem desvios clinicamente relevantes.' },
      { id: 'tpl-sym-mild',     severity: 'MILD',     classification: 'ASYMMETRIC_MILD',     text: 'Observa-se leve assimetria facial vertical, dentro dos limites de aceitabilidade clínica.' },
      { id: 'tpl-sym-moderate', severity: 'MODERATE', classification: 'ASYMMETRIC_MODERATE', text: 'Assimetria facial vertical moderada identificada. Monitoramento e planejamento de tratamento são indicados.' },
      { id: 'tpl-sym-severe',   severity: 'SEVERE',   classification: 'ASYMMETRIC_SEVERE',   text: 'Assimetria facial vertical severa. Avaliação por cirurgião bucomaxilofacial é recomendada.' },
    ],
  },
  {
    id: 'kr-midline-deviation', version: '1.0.0',
    formulaSlug: 'midline-deviation',
    displayName: 'Desvio de Linha Média',
    rules: [
      { when: r => r.value !== null && r.value.abs().lte(new Decimal('1')), severity: 'NORMAL',   classification: 'NO_DEVIATION',    priority: 10, referralRequired: false },
      { when: r => r.value !== null && r.value.abs().lte(new Decimal('3')), severity: 'MILD',     classification: 'MILD_DEVIATION',  priority: 30, referralRequired: false },
      { when: r => r.value !== null && r.value.abs().gt(new Decimal('3')),  severity: 'MODERATE', classification: 'MARKED_DEVIATION', priority: 50, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-mid-normal',   severity: 'NORMAL',   classification: 'NO_DEVIATION',    text: 'Linha média dental coincide com a linha média facial. Sem desvio relevante.' },
      { id: 'tpl-mid-mild',     severity: 'MILD',     classification: 'MILD_DEVIATION',  text: 'Desvio leve de linha média identificado. Considerar no planejamento do tratamento ortodôntico.' },
      { id: 'tpl-mid-moderate', severity: 'MODERATE', classification: 'MARKED_DEVIATION', text: 'Desvio marcado de linha média. Investigação etiológica e planejamento integrado são recomendados.' },
    ],
  },
  {
    id: 'kr-facial-thirds-upper', version: '1.0.0',
    formulaSlug: 'facial-thirds-upper',
    displayName: 'Proporção do Terço Superior',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('28')) && r.value.lte(new Decimal('38')), severity: 'NORMAL', classification: 'PROPORTIONAL',    priority: 10, referralRequired: false },
      { when: r => r.value !== null,                                                                      severity: 'MILD',   classification: 'DISPROPORTIONAL', priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-tu-normal', severity: 'NORMAL', classification: 'PROPORTIONAL',    text: 'Terço superior facial dentro das proporções esperadas.' },
      { id: 'tpl-tu-mild',   severity: 'MILD',   classification: 'DISPROPORTIONAL', text: 'Leve desproporção no terço superior facial observada.' },
    ],
  },
  {
    id: 'kr-facial-thirds-middle', version: '1.0.0',
    formulaSlug: 'facial-thirds-middle',
    displayName: 'Proporção do Terço Médio',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('28')) && r.value.lte(new Decimal('38')), severity: 'NORMAL', classification: 'PROPORTIONAL',    priority: 10, referralRequired: false },
      { when: r => r.value !== null,                                                                      severity: 'MILD',   classification: 'DISPROPORTIONAL', priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-tm-normal', severity: 'NORMAL', classification: 'PROPORTIONAL',    text: 'Terço médio facial dentro das proporções esperadas.' },
      { id: 'tpl-tm-mild',   severity: 'MILD',   classification: 'DISPROPORTIONAL', text: 'Leve desproporção no terço médio facial observada.' },
    ],
  },
  {
    id: 'kr-facial-thirds-lower', version: '1.0.0',
    formulaSlug: 'facial-thirds-lower',
    displayName: 'Proporção do Terço Inferior',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('28')) && r.value.lte(new Decimal('38')), severity: 'NORMAL', classification: 'PROPORTIONAL',    priority: 10, referralRequired: false },
      { when: r => r.value !== null,                                                                      severity: 'MILD',   classification: 'DISPROPORTIONAL', priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-tl-normal', severity: 'NORMAL', classification: 'PROPORTIONAL',    text: 'Terço inferior facial dentro das proporções esperadas.' },
      { id: 'tpl-tl-mild',   severity: 'MILD',   classification: 'DISPROPORTIONAL', text: 'Leve desproporção no terço inferior facial observada.' },
    ],
  },
  {
    id: 'kr-facial-profile', version: '1.0.0',
    formulaSlug: 'facial-profile',
    displayName: 'Perfil Facial',
    rules: [
      { when: r => r.classification === 'STRAIGHT', severity: 'NORMAL',   classification: 'STRAIGHT', priority: 10, referralRequired: false },
      { when: r => r.classification === 'CONVEX',   severity: 'MILD',     classification: 'CONVEX',   priority: 30, referralRequired: false },
      { when: r => r.classification === 'CONCAVE',  severity: 'MODERATE', classification: 'CONCAVE',  priority: 50, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-prof-normal',  severity: 'NORMAL',   classification: 'STRAIGHT', text: 'Perfil facial reto, dentro do padrão de normalidade.' },
      { id: 'tpl-prof-convex',  severity: 'MILD',     classification: 'CONVEX',   text: 'Perfil facial convexo identificado. Avaliação do padrão esquelético é indicada.' },
      { id: 'tpl-prof-concave', severity: 'MODERATE', classification: 'CONCAVE',  text: 'Perfil facial côncavo identificado. Avaliação ortodôntica e ortopédica é recomendada.' },
    ],
  },
  {
    id: 'kr-nasolabial-angle', version: '1.0.0',
    formulaSlug: 'nasolabial-angle',
    displayName: 'Ângulo Nasolabial',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('90')) && r.value.lte(new Decimal('120')), severity: 'NORMAL', classification: 'IDEAL',   priority: 10, referralRequired: false },
      { when: r => r.value !== null,                                                                       severity: 'MILD',   classification: 'ALTERED', priority: 30, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-naso-normal', severity: 'NORMAL', classification: 'IDEAL',   text: 'Ângulo nasolabial dentro do intervalo ideal (90°–120°).' },
      { id: 'tpl-naso-mild',   severity: 'MILD',   classification: 'ALTERED', text: 'Ângulo nasolabial fora do intervalo ideal. Avaliar relação com posição labial e dentária.' },
    ],
  },
  {
    id: 'kr-chin-projection', version: '1.0.0',
    formulaSlug: 'chin-projection',
    displayName: 'Projeção do Mento',
    rules: [
      { when: r => r.classification === 'NORMAL',    severity: 'NORMAL', classification: 'NORMAL',    priority: 10, referralRequired: false },
      { when: r => r.classification === 'RETRUDED',  severity: 'MILD',   classification: 'RETRUDED',  priority: 30, referralRequired: false },
      { when: r => r.classification === 'PROTRUDED', severity: 'MILD',   classification: 'PROTRUDED', priority: 30, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-chin-normal',    severity: 'NORMAL', classification: 'NORMAL',    text: 'Projeção do mento adequada, em equilíbrio com os demais terços faciais.' },
      { id: 'tpl-chin-retruded',  severity: 'MILD',   classification: 'RETRUDED',  text: 'Mento retraído identificado. Considerar no diagnóstico e planejamento do tratamento.' },
      { id: 'tpl-chin-protruded', severity: 'MILD',   classification: 'PROTRUDED', text: 'Mento projetado identificado. Considerar no diagnóstico e planejamento do tratamento.' },
    ],
  },
  {
    id: 'kr-nasal-symmetry', version: '1.0.0',
    formulaSlug: 'nasal-symmetry',
    displayName: 'Simetria Nasal',
    rules: [
      { when: r => r.classification === 'NORMAL',         severity: 'NORMAL', classification: 'NORMAL',         priority: 10, referralRequired: false },
      { when: r => r.classification === 'DEVIATED_LEFT',  severity: 'MILD',   classification: 'DEVIATED_LEFT',  priority: 25, referralRequired: false },
      { when: r => r.classification === 'DEVIATED_RIGHT', severity: 'MILD',   classification: 'DEVIATED_RIGHT', priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-nose-normal', severity: 'NORMAL', classification: 'NORMAL',         text: 'Nariz simétrico, sem desvio significativo.' },
      { id: 'tpl-nose-left',   severity: 'MILD',   classification: 'DEVIATED_LEFT',  text: 'Desvio nasal para a esquerda observado. Avaliação por otorrinolaringologista pode ser indicada.' },
      { id: 'tpl-nose-right',  severity: 'MILD',   classification: 'DEVIATED_RIGHT', text: 'Desvio nasal para a direita observado. Avaliação por otorrinolaringologista pode ser indicada.' },
    ],
  },
  {
    id: 'kr-lip-ratio', version: '1.0.0',
    formulaSlug: 'lip-ratio',
    displayName: 'Razão Labial',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('0.6')) && r.value.lte(new Decimal('0.9')), severity: 'NORMAL', classification: 'IDEAL',   priority: 10, referralRequired: false },
      { when: r => r.value !== null,                                                                        severity: 'MILD',   classification: 'ALTERED', priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-lipr-normal', severity: 'NORMAL', classification: 'IDEAL',   text: 'Proporção entre lábio superior e inferior dentro da normalidade.' },
      { id: 'tpl-lipr-mild',   severity: 'MILD',   classification: 'ALTERED', text: 'Proporção labial alterada. Avaliar impacto no equilíbrio facial.' },
    ],
  },
  {
    id: 'kr-lip-competence', version: '1.0.0',
    formulaSlug: 'lip-competence',
    displayName: 'Competência Labial',
    rules: [
      { when: r => r.classification === 'COMPETENT',               severity: 'NORMAL',   classification: 'COMPETENT',               priority: 10, referralRequired: false },
      { when: r => r.classification === 'POTENTIALLY_INCOMPETENT', severity: 'MILD',     classification: 'POTENTIALLY_INCOMPETENT', priority: 30, referralRequired: false },
      { when: r => r.classification === 'INCOMPETENT',             severity: 'MODERATE', classification: 'INCOMPETENT',             priority: 50, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-lipc-normal',   severity: 'NORMAL',   classification: 'COMPETENT',               text: 'Selamento labial adequado em repouso. Função labial preservada.' },
      { id: 'tpl-lipc-mild',     severity: 'MILD',     classification: 'POTENTIALLY_INCOMPETENT', text: 'Potencial incompetência labial identificada. Monitoramento do selamento labial é recomendado.' },
      { id: 'tpl-lipc-moderate', severity: 'MODERATE', classification: 'INCOMPETENT',             text: 'Incompetência labial presente. Avaliar padrão respiratório e terapia miofuncional.' },
    ],
  },
  {
    id: 'kr-smile-exposure', version: '1.0.0',
    formulaSlug: 'smile-exposure',
    displayName: 'Exposição Dentária no Sorriso',
    rules: [
      { when: r => r.value !== null && r.value.gte(new Decimal('1')) && r.value.lte(new Decimal('4')), severity: 'NORMAL', classification: 'IDEAL',     priority: 10, referralRequired: false },
      { when: r => r.value !== null && r.value.gt(new Decimal('4')),                                   severity: 'MILD',   classification: 'EXCESSIVE', priority: 25, referralRequired: false },
      { when: r => r.value !== null,                                                                    severity: 'MILD',   classification: 'REDUCED',   priority: 25, referralRequired: false },
    ],
    templates: [
      { id: 'tpl-smile-normal',  severity: 'NORMAL', classification: 'IDEAL',     text: 'Exposição dentária no sorriso dentro do padrão estético esperado.' },
      { id: 'tpl-smile-excess',  severity: 'MILD',   classification: 'EXCESSIVE', text: 'Sorriso gengival identificado. Avaliar causas e tratamento.' },
      { id: 'tpl-smile-reduced', severity: 'MILD',   classification: 'REDUCED',   text: 'Baixa exposição dentária no sorriso. Avaliar causas estruturais.' },
    ],
  },
]
