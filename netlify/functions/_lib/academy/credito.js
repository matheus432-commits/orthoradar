// ACADEMY — motor de CRÉDITO de exportação (funções puras; sem I/O).
//
// Modelo de cobrança (diretriz 08/2026): construir o trabalho é GRATUITO;
// paga-se apenas na EXPORTAÇÃO (config: exportacao_valor). Cada mensalidade
// efetivamente PAGA da assinatura Academy vira crédito no valor pago, que
// abate a exportação até um TETO PERCENTUAL (teto_credito_pct — nunca um
// valor fixo: se o preço da exportação mudar, o teto acompanha).
//
// Regras implementadas aqui, na ordem da spec:
//   1. ACÚMULO   — crédito += valor de cada pagamento confirmado (idempotente).
//   2. TETO      — abatimento ≤ exportacao_valor × teto_credito_pct%.
//   3. CONSUMO   — exportar consome o crédito aplicado e ZERA o saldo.
//   4. VALIDADE  — benefício de assinante ativo; ao cancelar, carência de
//                  carencia_credito_dias; depois disso o saldo expira e a
//                  reativação NÃO restaura (acúmulo recomeça do zero).
//   5. NÃO ASSINANTE — exporta pagando o valor integral.
//
// Toda a aritmética é em CENTAVOS (inteiros) para nunca sofrer com float.

const { centavos, reais, tetoCredito } = require('../precos');

// ── Documento de assinatura (coleção academy_assinaturas, id = email) ────────
function novaAssinatura(email, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  return {
    usuario_email:          String(email || '').toLowerCase(),
    ativa:                  true,
    data_inicio:            agora,
    data_cancelamento:      null,   // null enquanto ativa
    data_expiracao_credito: null,   // data_cancelamento + carência
    meses_pagos:            0,      // desde o último consumo de crédito
    credito_acumulado:      0,      // R$ (espelho; fonte = histórico desde último consumo)
    ultimo_consumo:         null,   // ISO da última exportação que consumiu crédito
    historico_pagamentos:   [],     // [{ data, valor, id_transacao }]
    criadoEm:               agora,
    atualizadoEm:           agora,
  };
}

// ── 4. VALIDADE ──────────────────────────────────────────────────────────────
// Devolve o crédito UTILIZÁVEL da assinatura em `hoje` (Date/ISO), aplicando
// carência e expiração. Não muta o doc.
function creditoDisponivel(assinatura, precos, hoje) {
  if (!assinatura) return { credito: 0, motivo: 'sem_assinatura' };
  const agora = hoje ? new Date(hoje) : new Date();
  const saldo = Number(assinatura.credito_acumulado) || 0;
  if (saldo <= 0) return { credito: 0, motivo: 'sem_saldo' };
  if (assinatura.ativa) return { credito: saldo, motivo: 'assinante_ativo' };
  // Cancelada: vale durante a carência
  const limite = assinatura.data_expiracao_credito
    ? new Date(assinatura.data_expiracao_credito)
    : (assinatura.data_cancelamento
        ? new Date(new Date(assinatura.data_cancelamento).getTime() + precos.carencia_credito_dias * 86400000)
        : null);
  if (limite && agora <= limite) return { credito: saldo, motivo: 'carencia', expira_em: limite.toISOString() };
  return { credito: 0, motivo: 'expirado' };
}

// ── 2. TETO + memória de cálculo da exportação ───────────────────────────────
// Calcula quanto a exportação custa para este usuário AGORA. Núcleo puro:
// recebe o crédito já validado (ou a assinatura, e valida por dentro).
function calcularExportacao({ assinatura = null, credito = null, precos, hoje = null }) {
  const disp = credito != null
    ? { credito: Number(credito) || 0, motivo: 'informado' }
    : creditoDisponivel(assinatura, precos, hoje);

  const valorCheioCent = centavos(precos.exportacao_valor);
  const tetoCent       = centavos(tetoCredito(precos));
  const saldoCent      = centavos(disp.credito);
  const aplicadoCent   = Math.min(saldoCent, tetoCent, valorCheioCent);
  const finalCent      = valorCheioCent - aplicadoCent;

  return {
    valor_cheio:       reais(valorCheioCent),
    credito_acumulado: reais(saldoCent),
    teto_credito:      reais(tetoCent),
    teto_credito_pct:  precos.teto_credito_pct,
    credito_aplicado:  reais(aplicadoCent),
    teto_atingido:     saldoCent > tetoCent,
    valor_final:       reais(finalCent),
    motivo_credito:    disp.motivo,
  };
}

// ── 1. ACÚMULO (idempotente por id_transacao) ────────────────────────────────
// Registra um pagamento CONFIRMADO da mensalidade. Devolve o doc atualizado;
// se a transação já foi registrada, devolve o doc intacto (aplicado=false).
function aplicarPagamento(assinatura, { valor, id_transacao, data }, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  const id = String(id_transacao || '').trim();
  if (!id) return { assinatura, aplicado: false, motivo: 'sem_id_transacao' };
  const hist = Array.isArray(assinatura.historico_pagamentos) ? assinatura.historico_pagamentos : [];
  if (hist.some(p => p.id_transacao === id)) return { assinatura, aplicado: false, motivo: 'duplicado' };

  const valorCent = centavos(valor);
  if (!(valorCent > 0)) return { assinatura, aplicado: false, motivo: 'valor_invalido' };

  const atualizado = {
    ...assinatura,
    meses_pagos:          (Number(assinatura.meses_pagos) || 0) + 1,
    credito_acumulado:    reais(centavos(assinatura.credito_acumulado || 0) + valorCent),
    historico_pagamentos: [...hist, { data: data || agora, valor: reais(valorCent), id_transacao: id }],
    atualizadoEm:         agora,
  };
  return { assinatura: atualizado, aplicado: true };
}

// ── 3. CONSUMO ───────────────────────────────────────────────────────────────
// Ao exportar: consome o crédito aplicado e ZERA o saldo (o acúmulo do
// próximo trabalho recomeça do zero).
function consumirCredito(assinatura, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  return {
    ...assinatura,
    meses_pagos:       0,
    credito_acumulado: 0,
    ultimo_consumo:    agora,
    atualizadoEm:      agora,
  };
}

// ── 4. Cancelamento / expiração / reativação ─────────────────────────────────
function cancelarAssinatura(assinatura, precos, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  const expira = new Date(new Date(agora).getTime() + precos.carencia_credito_dias * 86400000).toISOString();
  return {
    ...assinatura,
    ativa:                  false,
    data_cancelamento:      agora,
    data_expiracao_credito: expira,
    atualizadoEm:           agora,
  };
}

// Job diário: expira o saldo de assinatura cancelada além da carência.
// Devolve { assinatura, expirou } — expirou=true quando zerou saldo agora.
// IMPORTANTE: além de zerar o espelho, move o corte (`ultimo_consumo`) para
// AGORA — os pagamentos anteriores à expiração saem da base da reconciliação.
// Sem isso, o reconciliar do mesmo job restauraria o saldo expirado a partir
// do histórico e o par expira/reconcilia entraria em flip-flop diário.
function expirarSeVencido(assinatura, precos, hoje) {
  if (!assinatura || assinatura.ativa) return { assinatura, expirou: false };
  if (!(Number(assinatura.credito_acumulado) > 0)) return { assinatura, expirou: false };
  const disp = creditoDisponivel(assinatura, precos, hoje);
  if (disp.motivo !== 'expirado') return { assinatura, expirou: false };
  const agora = (hoje ? new Date(hoje) : new Date()).toISOString();
  return {
    assinatura: { ...assinatura, meses_pagos: 0, credito_acumulado: 0, ultimo_consumo: agora, atualizadoEm: agora },
    expirou: true,
  };
}

// Reativar NÃO restaura crédito expirado: expira primeiro (se vencido) e só
// então religa — carência limpa, saldo mantido apenas se ainda era válido.
function reativarAssinatura(assinatura, precos, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  const { assinatura: pos } = expirarSeVencido(assinatura, precos, agora);
  return {
    ...pos,
    ativa:                  true,
    data_cancelamento:      null,
    data_expiracao_credito: null,
    atualizadoEm:           agora,
  };
}

// ── Job mensal: reconciliação ────────────────────────────────────────────────
// Recomputa meses_pagos/credito_acumulado a partir do HISTÓRICO de pagamentos
// posteriores ao último consumo — corrige qualquer drift do espelho. Devolve
// { assinatura, corrigiu }.
function reconciliar(assinatura, agoraISO) {
  const agora = agoraISO || new Date().toISOString();
  const corte = assinatura.ultimo_consumo || '';
  const hist  = Array.isArray(assinatura.historico_pagamentos) ? assinatura.historico_pagamentos : [];
  const pos   = hist.filter(p => String(p.data || '') > corte);
  const cent  = pos.reduce((s, p) => s + centavos(p.valor), 0);
  const meses = pos.length;
  const credito = reais(cent);
  if (meses === (Number(assinatura.meses_pagos) || 0) && credito === (Number(assinatura.credito_acumulado) || 0)) {
    return { assinatura, corrigiu: false };
  }
  return {
    assinatura: { ...assinatura, meses_pagos: meses, credito_acumulado: credito, atualizadoEm: agora },
    corrigiu: true,
  };
}

// ── Transparência: simulação "quanto custará em N meses" ─────────────────────
// Para a tela de assinatura: projeta o custo da exportação após pagar N
// mensalidades (partindo do crédito atual).
function simularExportacao(mesesFuturos, precos, creditoAtual = 0) {
  const credito = reais(centavos(creditoAtual) + centavos(precos.academy_mensal) * mesesFuturos);
  return { meses: mesesFuturos, ...calcularExportacao({ credito, precos }) };
}

module.exports = {
  novaAssinatura, creditoDisponivel, calcularExportacao, aplicarPagamento,
  consumirCredito, cancelarAssinatura, expirarSeVencido, reativarAssinatura,
  reconciliar, simularExportacao,
};
