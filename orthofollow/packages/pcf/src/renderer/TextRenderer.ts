import type { AssembledReport, ReportSectionContent } from '../engine/types'

// Renders assembled report as plain text (UTF-8).
// A PDF renderer wraps this or renders directly from AssembledReport.
export class TextRenderer {

  render(report: AssembledReport): string {
    const lines: string[] = []

    lines.push('═'.repeat(60))
    lines.push(`RELATÓRIO ORTODÔNTICO — ${report.context.protocolName}`)
    lines.push('═'.repeat(60))
    lines.push(`Paciente:     ${report.context.patientName}`)
    lines.push(`Idade:        ${report.context.patientAge} anos`)
    lines.push(`Sessão:       ${report.context.sessionLabel}`)
    lines.push(`Ortodontista: ${report.context.orthodontistName}`)
    lines.push(`Gerado em:    ${new Date(report.context.generatedAt).toLocaleString('pt-BR')}`)
    lines.push(`ID do relatório: ${report.reportId}`)
    lines.push('')

    for (const section of report.sections) {
      lines.push(...this.renderSection(section))
      lines.push('')
    }

    lines.push('─'.repeat(60))
    lines.push(`Total de achados: ${report.totalFindings} | Graves/Críticos: ${report.criticalCount} | Encaminhamentos: ${report.referralCount}`)
    lines.push(`Hash de integridade: ${report.contentHash}`)

    return lines.join('\n')
  }

  private renderSection(section: ReportSectionContent): string[] {
    const lines: string[] = []
    lines.push(`── ${section.title.toUpperCase()} ──`)

    for (const p of section.paragraphs) {
      lines.push(p)
    }

    for (const entry of section.findings) {
      const badge = this.severityBadge(entry.severity)
      lines.push(`${badge} ${entry.text}`)
      if (entry.referral) {
        lines.push('  ⚑ Encaminhamento especializado indicado.')
      }
    }

    return lines
  }

  private severityBadge(severity: string): string {
    const badges: Record<string, string> = {
      NORMAL:     '[✓]',
      BORDERLINE: '[~]',
      MILD:       '[!]',
      MODERATE:   '[!!]',
      SEVERE:     '[!!!]',
      CRITICAL:   '[CRÍTICO]'
    }
    return badges[severity] ?? `[${severity}]`
  }
}
