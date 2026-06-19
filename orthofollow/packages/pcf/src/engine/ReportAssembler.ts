import { newUUID, sha256 } from '@orthofollow/shared'
import type { ResolvedFinding } from '@orthofollow/knw'
import type {
  AssembledReport, ReportContext, ReportSectionContent,
  ReportFindingEntry, ReportSection
} from './types'

const PROTOCOL_NAMES: Record<string, string> = {
  P01: 'Análise Facial Frontal e de Perfil',
  P02: 'Análise Cefalométrica',
  P03: 'Análise de Modelos',
}

export class ReportAssembler {

  assemble(
    context: Omit<ReportContext, 'generatedAt' | 'protocolName'>,
    findings: ResolvedFinding[]
  ): AssembledReport {
    const generatedAt   = new Date().toISOString()
    const protocolName  = PROTOCOL_NAMES[context.protocolId] ?? context.protocolId
    const fullContext: ReportContext = { ...context, protocolName, generatedAt }

    const sorted = [...findings].sort((a, b) => b.priority - a.priority)

    const sections: ReportSectionContent[] = [
      this.buildSummarySection(fullContext, sorted),
      this.buildFindingsSection(sorted),
      this.buildReferralsSection(sorted),
      this.buildNextStepsSection(sorted),
    ].filter(s => s.findings.length > 0 || s.paragraphs.length > 0)

    const criticalCount  = sorted.filter(f => f.severity === 'CRITICAL' || f.severity === 'SEVERE').length
    const referralCount  = sorted.filter(f => f.referralRequired).length

    const contentHash = sha256(JSON.stringify({ context: fullContext, sections }))

    return {
      reportId:      newUUID(),
      context:       fullContext,
      sections,
      contentHash,
      totalFindings: sorted.length,
      criticalCount,
      referralCount,
      generatedAt
    }
  }

  private buildSummarySection(
    ctx: ReportContext,
    findings: ResolvedFinding[]
  ): ReportSectionContent {
    const normalCount    = findings.filter(f => f.severity === 'NORMAL').length
    const abnormalCount  = findings.length - normalCount
    const referralCount  = findings.filter(f => f.referralRequired).length

    const intro = `Esta é a análise ortodôntica de ${ctx.patientName}, ` +
      `paciente de ${ctx.patientAge} anos, referente à sessão ${ctx.sessionLabel} ` +
      `do protocolo ${ctx.protocolName}. ` +
      `A avaliação foi conduzida pelo Dr(a). ${ctx.orthodontistName}.`

    const overview = abnormalCount === 0
      ? 'Todos os parâmetros avaliados estão dentro dos padrões de normalidade esperados para o seu perfil.'
      : `Foram identificados ${abnormalCount} achado${abnormalCount > 1 ? 's' : ''} que merecem atenção, ` +
        `sendo ${normalCount} parâmetro${normalCount !== 1 ? 's' : ''} dentro da normalidade.` +
        (referralCount > 0 ? ` ${referralCount} item${referralCount > 1 ? 'ns requerem' : ' requer'} encaminhamento especializado.` : '')

    return {
      key:        'SUMMARY',
      title:      'Resumo da Avaliação',
      paragraphs: [intro, overview],
      findings:   []
    }
  }

  private buildFindingsSection(findings: ResolvedFinding[]): ReportSectionContent {
    const relevant = findings.filter(f => f.severity !== 'NORMAL')

    return {
      key:        'FINDINGS',
      title:      'Achados Clínicos',
      paragraphs: relevant.length === 0
        ? ['Todos os parâmetros avaliados estão dentro dos padrões de normalidade.']
        : [],
      findings:   relevant.map(f => this.toEntry(f))
    }
  }

  private buildReferralsSection(findings: ResolvedFinding[]): ReportSectionContent {
    const referrals = findings.filter(f => f.referralRequired)

    return {
      key:        'REFERRALS',
      title:      'Encaminhamentos',
      paragraphs: referrals.length === 0 ? [] : [
        'Os achados abaixo indicam a necessidade de avaliação especializada. ' +
        'O seu ortodontista entrará em contato para agendar os encaminhamentos necessários.'
      ],
      findings: referrals.map(f => this.toEntry(f))
    }
  }

  private buildNextStepsSection(findings: ResolvedFinding[]): ReportSectionContent {
    const hasSevere   = findings.some(f => f.severity === 'SEVERE' || f.severity === 'CRITICAL')
    const hasModerate = findings.some(f => f.severity === 'MODERATE')

    const paragraphs: string[] = []

    if (hasSevere) {
      paragraphs.push(
        'Com base nos achados desta avaliação, recomenda-se consulta de retorno em breve para ' +
        'discutir o plano de tratamento detalhado e os próximos passos.'
      )
    } else if (hasModerate) {
      paragraphs.push(
        'Os achados indicam que o início do tratamento ortodôntico está indicado. ' +
        'Agende uma consulta para discussão do plano de tratamento.'
      )
    } else {
      paragraphs.push(
        'Continue com as consultas de acompanhamento conforme orientação do seu ortodontista.'
      )
    }

    return {
      key:        'NEXT_STEPS',
      title:      'Próximos Passos',
      paragraphs,
      findings:   []
    }
  }

  private toEntry(f: ResolvedFinding): ReportFindingEntry {
    return {
      findingId:      f.id,
      classification: f.classification,
      severity:       f.severity,
      priority:       f.priority,
      text:           f.selectedTemplate.resolvedText,
      referral:       f.referralRequired
    }
  }
}
