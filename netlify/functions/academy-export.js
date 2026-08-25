// ACADEMY — pacote de entrega COM PAYWALL DE EXPORTAÇÃO (spec 25/08).
//
// REGRA DE OURO: todo o fluxo de construção é LIVRE — a cobrança existe SÓ
// aqui, na exportação do pacote final. Nunca antes.
//
// GET  ?email&id                    → exportação já paga: devolve o ZIP
//                                     (re-download livre, sem nova cobrança);
//                                     não paga: 402 com a MEMÓRIA DE CÁLCULO
//                                     completa (valor cheio, crédito, teto,
//                                     valor final) para a tela de confirmação.
// POST { email, id, confirmar:true } → registra a exportação, CONSOME o
//                                     crédito aplicado (saldo zera) e libera
//                                     o download. Idempotente por projeto.
//
// GATEWAY: a cobrança efetiva do valor_pago será plugada no gateway (o doc
// exportacao guarda id_transacao 'aguardando-gateway' até lá) — o desenho do
// consumo/registro já é o final. Nenhum preço hardcoded: config/precos.

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { montarPacote } = require('./_lib/academy/pacote');
const { carregarPrecos } = require('./_lib/academy/precos');
const { calcularExportacao, consumirCredito } = require('./_lib/academy/credito');
const log = require('./_lib/logger');

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' }, body: '' };
  }
  const _rl = rateLimited(event, 'academy-export', { max: 15, windowMs: 60000 }); if (_rl) return _rl;

  const qs = event.queryStringParameters || {};
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const email = String(qs.email || body.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };
    const id = String(qs.id || body.id || '');
    const p = await db.getDoc('academy_projetos', id).catch(() => null);
    if (!p || p.usuario_email !== email) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };
    if (!p.periodico_alvo) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'pacote_indisponivel', message: 'O pacote fecha depois que você escolher o periódico — é ele que define formato e exigências.' }) };
    }

    const precos = await carregarPrecos(db);
    const exportacao = await db.getDoc('academy_exportacoes', id).catch(() => null);

    const entregarZip = () => ({
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="odontofeed-academy-pacote.zip"',
        'Cache-Control': 'private, no-store',
      },
      body: montarPacote(p).toString('base64'),
      isBase64Encoded: true,
    });

    if (event.httpMethod === 'GET') {
      // Já exportado e pago → re-download livre (regra 3: a cobrança é por
      // trabalho, não por download).
      if (exportacao && exportacao.usuario_email === email) return entregarZip();
      const assinatura = await db.getDoc('academy_assinaturas', email).catch(() => null);
      const memoria = calcularExportacao(assinatura, precos);
      // 402: a UI mostra a memória de cálculo e pede a confirmação explícita.
      return { statusCode: 402, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({
        error: 'pagamento_necessario',
        memoria,
        mensagem: 'A exportação é o único momento pago do Academy. Confira a memória de cálculo e confirme para liberar o pacote.',
      }) };
    }

    // POST — confirmação da exportação.
    if (body.confirmar !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: 'confirmacao_obrigatoria' }) };
    if (exportacao) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, ja_exportado: true, memoria: exportacao }) };

    const assinatura = await db.getDoc('academy_assinaturas', email).catch(() => null);
    const memoria = calcularExportacao(assinatura, precos);
    const doc = {
      usuario_email: email,
      projeto_id: id,
      valor_cheio: memoria.valor_cheio,
      credito_aplicado: memoria.credito_aplicado,
      teto_atingido: memoria.teto_atingido,
      valor_pago: memoria.valor_pago,
      data_exportacao: new Date().toISOString(),
      id_transacao: 'aguardando-gateway', // o gateway substitui pela id real
    };
    await db.setDoc('academy_exportacoes', id, doc);
    // CONSUMO (regra 3): o crédito aplicado zera o saldo — o próximo trabalho
    // recomeça o acúmulo do zero.
    if (assinatura && memoria.credito_aplicado > 0) {
      await db.setDoc('academy_assinaturas', email, consumirCredito(assinatura));
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, memoria: doc }) };
  } catch (err) {
    log.error('[academy-export] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
