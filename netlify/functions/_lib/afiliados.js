// Programa de AFILIADOS — regras de comissão (diretriz do fundador, 07/08).
//
// Modelo de negócio:
//   • Premium: R$ 59,90/mês; comissão de R$ 10,00/mês por assinante Premium
//     ATIVO indicado, durante 12 meses A PARTIR DA ATIVAÇÃO PAGA (não do
//     cadastro gratuito).
//   • Enquanto o Premium pago não existe, indicações ficam "pendentes"
//     (cinza) — o relógio de 12 meses SÓ inicia na ativação paga. O Premium
//     de CORTESIA desta fase NUNCA conta (planoOrigem 'cortesia').
//   • Cancelou antes dos 12 meses → comissão para naquele mês (vermelho).
//   • Afiliado = qualquer usuário cujo link converteu ≥1 cadastro; o fundador
//     escolhe manualmente quem aborda/paga (toggle ativo/inativo no admin).
//
// Campos no doc `cadastros` do INDICADO (gravados na ativação/cancelamento):
//   comissaoStatus        '' | 'premium_ativo' | 'premium_cancelado' | 'comissao_encerrada'
//   planoPremium          'mensal' | 'anual' (define o VALOR da comissão)
//   dataAtivacaoPremium   ISO da ativação PAGA
//   dataExpiracaoComissao ISO = ativação + 365 dias
// A ligação com o afiliado é o `referredBy` (refCode) que o cadastro já grava.
//
// PLANO ANUAL (07/08): R$ 574,08 à vista (R$ 47,84/mês equivalente — "2 meses
// grátis" na comunicação). Comissão por regra de 3 sobre o mensal equivalente:
// 47,84 × 10 ÷ 59,90 = 7,99/mês. O pagamento ao afiliado é SEMPRE mensal por
// 12 meses; migração de plano ajusta o valor a partir do mês da mudança (o
// relatório calcula sobre o plano VIGENTE, nunca sobre o histórico).

const COMISSAO_POR_PLANO = { mensal: 10.00, anual: 7.99 }; // R$/mês ao afiliado
const COMISSAO_MENSAL = COMISSAO_POR_PLANO.mensal;         // compat (plano mensal)
const PREMIUM_PRECO        = 59.90;   // R$/mês do plano mensal
const PREMIUM_PRECO_ANUAL  = 574.08;  // R$/ano à vista (= 47,84/mês)
const DIAS_COMISSAO   = 365;          // 12 meses a partir da ativação paga

// 'mensal' | 'anual' — qualquer valor desconhecido/vazio cai em 'mensal'
// (docs de antes do plano anual não têm o campo).
function normalizePlanoPremium(p) {
  return String(p || '').toLowerCase() === 'anual' ? 'anual' : 'mensal';
}

// Valor da comissão mensal desta indicação, pelo plano VIGENTE do dentista.
function comissaoDe(u) {
  return COMISSAO_POR_PLANO[normalizePlanoPremium(u?.planoPremium)];
}

// ── Status de uma indicação (a cor do admin) ─────────────────────────────────
// cinza    gratuito           sem ativação paga (inclui cortesia — não conta)
// verde    premium_ativo      comissão correndo
// amarelo  comissao_encerrada 12 meses cumpridos
// vermelho premium_cancelado  cancelou antes do fim
function statusIndicacao(u, hojeISO) {
  const hoje = String(hojeISO || new Date().toISOString()).slice(0, 10);
  const st = String(u?.comissaoStatus || '');
  if (st === 'premium_cancelado') return { status: 'premium_cancelado', cor: 'vermelho' };
  if (st === 'comissao_encerrada') return { status: 'comissao_encerrada', cor: 'amarelo' };
  if (st === 'premium_ativo') {
    // Expirou mas o job mensal ainda não rebaixou → já conta como encerrada
    // (o relatório de pagamento NUNCA pode pagar mês 13).
    const exp = String(u.dataExpiracaoComissao || '').slice(0, 10);
    if (exp && exp <= hoje) return { status: 'comissao_encerrada', cor: 'amarelo' };
    return { status: 'premium_ativo', cor: 'verde' };
  }
  return { status: 'gratuito', cor: 'cinza' };
}

// Meses de comissão restantes (0..12). Só indicações verdes têm restante.
function mesesRestantes(u, hojeISO) {
  if (statusIndicacao(u, hojeISO).status !== 'premium_ativo') return 0;
  const hoje = new Date(String(hojeISO || new Date().toISOString()).slice(0, 10) + 'T00:00:00Z');
  const exp = new Date(String(u.dataExpiracaoComissao).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(exp.getTime())) return 0;
  const dias = Math.max(0, (exp - hoje) / 86400000);
  return Math.min(12, Math.ceil(dias / 30.44));
}

// Valor a pagar POR esta indicação no mês corrente (pelo plano vigente).
function valorMesAtual(u, hojeISO) {
  return statusIndicacao(u, hojeISO).status === 'premium_ativo' ? comissaoDe(u) : 0;
}

// Campos a gravar no INDICADO quando ele ativar o Premium PAGO.
// Regra do fundador: cortesia NÃO conta — quem chama já deve garantir que é
// uma ativação com forma de pagamento (planoOrigem 'assinatura').
function camposAtivacaoPremium(hojeISO, plano) {
  const hoje = String(hojeISO || new Date().toISOString()).slice(0, 10);
  const exp = new Date(hoje + 'T00:00:00Z');
  exp.setUTCDate(exp.getUTCDate() + DIAS_COMISSAO);
  return {
    comissaoStatus:        'premium_ativo',
    planoPremium:          normalizePlanoPremium(plano),
    dataAtivacaoPremium:   hoje,
    dataExpiracaoComissao: exp.toISOString().slice(0, 10),
  };
}

// Migração mensal↔anual DURANTE a janela: só o plano muda — a comissão passa
// a valer o novo valor a partir do mês corrente; a data de expiração dos 12
// meses NÃO reinicia (o relógio é da ativação original).
function camposMigracaoPlano(plano) {
  return { planoPremium: normalizePlanoPremium(plano) };
}

// Campos a gravar quando o indicado CANCELAR o Premium pago.
function camposCancelamentoPremium() {
  return { comissaoStatus: 'premium_cancelado' };
}

// Agrega as indicações de um afiliado no card de desempenho do admin.
function desempenhoAfiliado(indicados, hojeISO) {
  const r = {
    totalCadastros: indicados.length,
    premiumAtivos: 0,
    comissaoEncerrada: 0,
    cancelados: 0,
    comissaoMesAtual: 0,       // R$ a pagar este mês
    comissaoAcumuladaPaga: 0,  // R$ estimados já pagos (meses decorridos × R$10)
  };
  const hoje = new Date(String(hojeISO || new Date().toISOString()).slice(0, 10) + 'T00:00:00Z');
  for (const u of indicados) {
    const st = statusIndicacao(u, hojeISO).status;
    if (st === 'premium_ativo') { r.premiumAtivos++; r.comissaoMesAtual += comissaoDe(u); }
    else if (st === 'comissao_encerrada') r.comissaoEncerrada++;
    else if (st === 'premium_cancelado') r.cancelados++;
    // Acumulado: meses completos desde a ativação até hoje (teto 12), para
    // qualquer indicação que já teve comissão (ativa, encerrada ou cancelada
    // — cancelada conta só até o cancelamento não rastreado; aproximamos pelo
    // teto do status: cancelada usa os meses até hoje como estimativa). O
    // valor usa o plano VIGENTE (histórico de migrações não é rastreado).
    const ini = new Date(String(u.dataAtivacaoPremium || '').slice(0, 10) + 'T00:00:00Z');
    if (!isNaN(ini.getTime()) && st !== 'gratuito') {
      const meses = Math.min(12, Math.floor(Math.max(0, (hoje - ini) / 86400000) / 30.44));
      r.comissaoAcumuladaPaga += meses * comissaoDe(u);
    }
  }
  r.comissaoMesAtual = Number(r.comissaoMesAtual.toFixed(2));
  r.comissaoAcumuladaPaga = Number(r.comissaoAcumuladaPaga.toFixed(2));
  return r;
}

// Planilha mensal de pagamento: uma linha por afiliado ATIVO com o nº de
// Premiums ativos indicados e o valor do mês; total geral no rodapé.
// `afiliados` = [{codigo, nome, email, ativo, indicados: [cadastros…]}].
function relatorioMensal(afiliados, hojeISO) {
  const linhas = [];
  let totalGeral = 0, totalPremiums = 0, totalMensais = 0, totalAnuais = 0;
  for (const a of afiliados) {
    if (a.ativo === false) continue; // pagamento é só para quem o fundador ativou
    const ativos = (a.indicados || []).filter(u => statusIndicacao(u, hojeISO).status === 'premium_ativo');
    if (!ativos.length) continue; // planilha só lista quem tem algo a receber
    const mensais = ativos.filter(u => normalizePlanoPremium(u.planoPremium) === 'mensal').length;
    const anuais  = ativos.length - mensais;
    // Soma indicação a indicação — mistura de planos fecha no centavo.
    const valor = Number(ativos.reduce((s, u) => s + comissaoDe(u), 0).toFixed(2));
    linhas.push({ codigo: a.codigo, nome: a.nome || '', email: a.email || '',
                  premiumsAtivos: ativos.length, premiumsMensais: mensais, premiumsAnuais: anuais, valor });
    totalGeral += valor; totalPremiums += ativos.length; totalMensais += mensais; totalAnuais += anuais;
  }
  linhas.sort((x, y) => y.valor - x.valor || String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
  return { linhas, totalPremiums, totalMensais, totalAnuais, totalGeral: Number(totalGeral.toFixed(2)) };
}

// CSV da planilha (separador ';' — Excel pt-BR abre direto; vírgula decimal).
function relatorioCSV(rel, mes) {
  const money = (v) => v.toFixed(2).replace('.', ',');
  const esc = (s) => { const t = String(s ?? ''); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const out = [`Relatório de comissões — ${mes}`,
    'Afiliado;E-mail;Código;Premiums mensais (R$ 10,00);Premiums anuais (R$ 7,99);Total ativos;Valor a pagar (R$)'];
  for (const l of rel.linhas) {
    out.push([esc(l.nome), esc(l.email), l.codigo, l.premiumsMensais, l.premiumsAnuais, l.premiumsAtivos, money(l.valor)].join(';'));
  }
  out.push(`TOTAL GERAL;;;${rel.totalMensais};${rel.totalAnuais};${rel.totalPremiums};${money(rel.totalGeral)}`);
  return out.join('\r\n');
}

module.exports = {
  COMISSAO_MENSAL, COMISSAO_POR_PLANO, PREMIUM_PRECO, PREMIUM_PRECO_ANUAL, DIAS_COMISSAO,
  normalizePlanoPremium, comissaoDe,
  statusIndicacao, mesesRestantes, valorMesAtual,
  camposAtivacaoPremium, camposCancelamentoPremium, camposMigracaoPlano,
  desempenhoAfiliado, relatorioMensal, relatorioCSV,
};
