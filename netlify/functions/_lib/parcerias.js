// SISTEMA DE PARCERIAS (spec do fundador 12/08) — lógica PURA e testável.
//
// Modelo: um PARCEIRO (produtor de curso/produto por especialidade) recebe um
// cupom e um link (/parceria/{slug}). O aluno resgata 3 MESES de OdontoFeed
// Premium SEM cartão. Como a plataforma ainda não cobra, o benefício só
// começa a CONTAR quando a cobrança global for ativada:
//
//   REGRA CENTRAL: inicio_beneficio = MAX(data_resgate, data_inicio_cobranca)
//   fim_beneficio  = inicio + 90 dias
//
// Persistência (Firestore — o "KV" de todo o sistema):
//   parceiros/{id}            cadastro do parceiro + cupom + slug + validade
//   parcerias_resgates/{id}   um por (parceiro, aluno) — status do benefício
//   parcerias_config/global   { cobranca_ativa, data_inicio_cobranca }
//
// Statuses do resgate (spec):
//   aguardando_inicio_cobranca → beneficio_ativo → beneficio_encerrado
//                                               ↘ convertido_pago
// NUNCA cobrar automaticamente: expirar = rebaixar para o Gratuito, só isso.

const BENEFICIO_DIAS = 90;
const VALIDADE_PADRAO_MESES = 6;

const STATUS = {
  AGUARDANDO: 'aguardando_inicio_cobranca',
  ATIVO: 'beneficio_ativo',
  ENCERRADO: 'beneficio_encerrado',
  CONVERTIDO: 'convertido_pago',
};

const STATUS_LABEL = {
  aguardando_inicio_cobranca: 'Aguardando início da cobrança',
  beneficio_ativo: 'Benefício ativo',
  beneficio_encerrado: 'Benefício encerrado',
  convertido_pago: 'Convertido em plano pago',
};

const hojeISO = () => new Date().toISOString().slice(0, 10);

// ── Normalizações ────────────────────────────────────────────────────────────
function normalizarCupom(s) {
  return String(s || '').trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '').slice(0, 40);
}
function normalizarSlug(s) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

// Validade padrão do cupom: 6 meses a partir da criação (spec).
function validadePadrao(criadoEm) {
  const d = new Date((criadoEm || hojeISO()) + 'T12:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + VALIDADE_PADRAO_MESES);
  return d.toISOString().slice(0, 10);
}

// ── Validação de resgate (cupom existe/ativo/válido/dentro do limite) ────────
function validarResgate(parceiro, totalResgates, hoje = hojeISO()) {
  if (!parceiro) return { ok: false, motivo: 'cupom_inexistente' };
  if (parceiro.ativo === false) return { ok: false, motivo: 'cupom_inativo' };
  if (parceiro.validade_cupom && String(hoje) > String(parceiro.validade_cupom)) {
    return { ok: false, motivo: 'cupom_expirado' };
  }
  const limite = parceiro.limite_resgates;
  if (limite !== null && limite !== undefined && limite !== '' && Number(totalResgates) >= Number(limite)) {
    return { ok: false, motivo: 'limite_esgotado' };
  }
  return { ok: true };
}

const MOTIVO_MSG = {
  cupom_inexistente: 'Este link de parceria não existe ou foi removido.',
  cupom_inativo: 'Esta parceria não está mais ativa.',
  cupom_expirado: 'O prazo de resgate desta parceria já terminou.',
  limite_esgotado: 'Os resgates desta parceria já foram todos utilizados.',
};

// ── REGRA CENTRAL: MAX(data_resgate, data_inicio_cobranca) ───────────────────
function inicioBeneficio(dataResgate, dataInicioCobranca) {
  if (!dataInicioCobranca) return null; // cobrança ainda não ativada
  const r = String(dataResgate).slice(0, 10);
  const c = String(dataInicioCobranca).slice(0, 10);
  return r > c ? r : c;
}
function fimBeneficio(inicio) {
  if (!inicio) return null;
  const d = new Date(inicio + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + BENEFICIO_DIAS);
  return d.toISOString().slice(0, 10);
}

// Campos do resgate NOVO, conforme a cobrança já esteja ativa ou não.
function camposNovoResgate({ parceiroId, cupom, email, nome, cobrancaAtiva, dataInicioCobranca, hoje = hojeISO() }) {
  const inicio = cobrancaAtiva ? inicioBeneficio(hoje, dataInicioCobranca || hoje) : null;
  return {
    parceiro_id: String(parceiroId),
    cupom_id: normalizarCupom(cupom),
    usuario_email: String(email || '').trim().toLowerCase(),
    usuario_nome: String(nome || '').trim(),
    data_resgate: hoje,
    data_inicio_beneficio: inicio,
    data_fim_beneficio: fimBeneficio(inicio),
    status: cobrancaAtiva ? STATUS.ATIVO : STATUS.AGUARDANDO,
  };
}

// Campos da ATIVAÇÃO EM LOTE (job de ativação da cobrança): aplica a regra
// MAX a um resgate que aguardava. Devolve null se o resgate não aguarda.
function camposAtivacaoLote(resgate, dataInicioCobranca) {
  if (!resgate || resgate.status !== STATUS.AGUARDANDO) return null;
  const inicio = inicioBeneficio(resgate.data_resgate, dataInicioCobranca);
  return {
    data_inicio_beneficio: inicio,
    data_fim_beneficio: fimBeneficio(inicio),
    status: STATUS.ATIVO,
  };
}

function diasRestantes(fim, hoje = hojeISO()) {
  if (!fim) return null;
  const ms = new Date(String(fim) + 'T12:00:00Z') - new Date(String(hoje) + 'T12:00:00Z');
  return Math.max(0, Math.round(ms / 86400000));
}

// ── Avisos e expiração (scheduled diária) ────────────────────────────────────
// 7 dias antes: um único e-mail (flag aviso7EnviadoEm evita repetição).
function precisaAviso7(resgate, hoje = hojeISO()) {
  if (!resgate || resgate.status !== STATUS.ATIVO || !resgate.data_fim_beneficio) return false;
  if (resgate.aviso7EnviadoEm) return false;
  const dias = diasRestantes(resgate.data_fim_beneficio, hoje);
  return dias !== null && dias <= 7 && dias > 0;
}
function precisaEncerrar(resgate, hoje = hojeISO()) {
  if (!resgate || resgate.status !== STATUS.ATIVO || !resgate.data_fim_beneficio) return false;
  return String(hoje) >= String(resgate.data_fim_beneficio);
}
// PROTEÇÃO (regra do fundador desde 25/07 — downgrade seletivo): quem tem
// assinatura PAGA registrada nunca é rebaixado pelo fim da cortesia; o
// resgate vira "convertido_pago".
function converteuParaPago(user) {
  return Boolean(user && (user.dataAtivacaoPremium || user.planoPremium));
}

// ── Painel do parceiro ───────────────────────────────────────────────────────
function resumoParceiro(resgates, hoje = hojeISO()) {
  const r = { total: 0, aguardando: 0, ativos: 0, encerrados: 0, convertidos: 0 };
  for (const x of resgates || []) {
    r.total++;
    if (x.status === STATUS.AGUARDANDO) r.aguardando++;
    else if (x.status === STATUS.ATIVO) r.ativos++;
    else if (x.status === STATUS.ENCERRADO) r.encerrados++;
    else if (x.status === STATUS.CONVERTIDO) r.convertidos++;
  }
  return r;
}

// CSV pt-BR (mesmo padrão da planilha de afiliados: ; como separador e BOM
// para o Excel brasileiro abrir com acentos corretos).
function relatorioCSV(parceiro, resgates, hoje = hojeISO()) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const fmt = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—');
  const linhas = [
    ['Parceiro', parceiro?.nome_parceiro || '', 'Produto', parceiro?.nome_produto || '', 'Cupom', parceiro?.codigo_cupom || ''].map(esc).join(';'),
    '',
    ['Aluno', 'E-mail', 'Data do resgate', 'Status', 'Início do benefício', 'Fim do benefício', 'Dias restantes'].join(';'),
  ];
  for (const x of resgates || []) {
    const dias = x.status === STATUS.ATIVO ? diasRestantes(x.data_fim_beneficio, hoje) : '';
    linhas.push([
      esc(x.usuario_nome), esc(x.usuario_email), fmt(x.data_resgate),
      esc(STATUS_LABEL[x.status] || x.status), fmt(x.data_inicio_beneficio), fmt(x.data_fim_beneficio),
      dias === '' || dias === null ? '—' : String(dias),
    ].join(';'));
  }
  return '﻿' + linhas.join('\n');
}

module.exports = {
  BENEFICIO_DIAS, VALIDADE_PADRAO_MESES, STATUS, STATUS_LABEL, MOTIVO_MSG,
  normalizarCupom, normalizarSlug, validadePadrao,
  validarResgate, inicioBeneficio, fimBeneficio,
  camposNovoResgate, camposAtivacaoLote, diasRestantes,
  precisaAviso7, precisaEncerrar, converteuParaPago,
  resumoParceiro, relatorioCSV,
};
