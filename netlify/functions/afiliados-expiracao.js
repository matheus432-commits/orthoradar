// JOB MENSAL de comissões de afiliados (Netlify Scheduled Function — agendado
// no netlify.toml, dia 1 de cada mês). Percorre os indicados com comissão
// ATIVA e, quando dataExpiracaoComissao já passou (12 meses cumpridos),
// rebaixa para 'comissao_encerrada' — a indicação fica amarela no painel e
// sai da planilha de pagamento.
//
// Defesa em profundidade: o relatório mensal (_lib/afiliados.statusIndicacao)
// já trata "ativo porém expirado" como encerrada na LEITURA — este job apenas
// materializa o estado no banco. Se ele falhar num mês, nenhum pagamento a
// mais acontece.
//
// Sem gate de admin (mesmo precedente do cleanup-articles agendado): a
// operação é idempotente e sempre produz o estado CORRETO — disparo externo
// só anteciparia o que o cron faria. A resposta HTTP devolve apenas
// CONTADORES (nenhum e-mail); os detalhes ficam no log.

const { Firestore } = require('./_lib/firestore');
const log = require('./_lib/logger');

async function expirarComissoes(db, hojeISO) {
  const hoje = String(hojeISO || new Date().toISOString()).slice(0, 10);
  // Filtro simples por igualdade (índice automático do Firestore); a data é
  // comparada em código — igualdade+range exigiria índice COMPOSTO e o job
  // quebraria em silêncio no primeiro run.
  const ativos = await db.query('cadastros', {
    where: { fieldFilter: { field: { fieldPath: 'comissaoStatus' }, op: 'EQUAL', value: { stringValue: 'premium_ativo' } } },
    limit: 1000,
  });
  const vencidos = ativos.filter(u => {
    const exp = String(u.dataExpiracaoComissao || '').slice(0, 10);
    return exp && exp <= hoje;
  });
  let encerradas = 0, falhas = 0;
  for (const u of vencidos) {
    try {
      await db.updateDoc('cadastros', u.id, { comissaoStatus: 'comissao_encerrada' });
      encerradas++;
      log.info('[afiliados] comissão encerrada (12 meses cumpridos)', { email: u.email, expirou: u.dataExpiracaoComissao });
    } catch (e) {
      falhas++;
      log.warn('[afiliados] falha ao encerrar comissão — fica p/ o próximo run', { email: u.email, err: e.message });
    }
  }
  return { hoje, comissoesAtivas: ativos.length, vencidas: vencidos.length, encerradas, falhas };
}

exports.handler = async () => {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };

  try {
    const r = await expirarComissoes(new Firestore(projectId, apiKey));
    log.info('[afiliados] expiração mensal concluída', r);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    log.error('[afiliados] expiração falhou', { err: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.expirarComissoes = expirarComissoes;
