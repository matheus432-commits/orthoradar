// Painel de AFILIADOS — exclusivo do admin (mesma autenticação do painel).
//
// GET  ?secret=ADMIN_SECRET&action=list
//        → afiliados (todo usuário cujo link converteu ≥1 cadastro) com
//          código, link copiável, status ativo/inativo e nº de indicações.
// GET  ?secret=...&action=detalhe&codigo=REFCODE
//        → card de desempenho + tabela de indicações (cores por status).
// GET  ?secret=...&action=relatorio[&mes=YYYY-MM][&format=csv]
//        → planilha mensal de pagamento (só afiliados ATIVOS; CSV p/ Excel).
// POST { secret, action:'ativar'|'desativar', codigo }
//        → seleção manual do fundador: quem entra na planilha de pagamento.
// POST { secret, action:'ativar_premium', email, plano:'mensal'|'anual' }
//        → registra a ativação PAGA (inicia os 12 meses) com o plano escolhido
//          — é ESTE o hook que o checkout chama ao assinar.
// POST { secret, action:'migrar_plano', email, plano }
//        → migração mensal↔anual na janela: comissão ajusta a partir do mês
//          da mudança; os 12 meses NÃO reiniciam.
// POST { secret, action:'cancelar_premium', email }
//        → registra o cancelamento (comissão para naquele mês).
//          IMPORTANTE (fundador, 07/08): o Premium de CORTESIA desta fase NÃO
//          conta — este endpoint só será chamado quando o Premium pago existir
//          (pelo fluxo de pagamento ou manualmente pelo admin).
//
// Persistência: Firestore (o "KV" de todo o sistema) —
//   • cadastros: já tem refCode/referredBy; a ativação grava comissaoStatus,
//     dataAtivacaoPremium e dataExpiracaoComissao no doc do INDICADO;
//   • afiliados_config/{refCode}: { ativo, atualizadoEm } (toggle do fundador;
//     sem doc = ativo por padrão).

const { Firestore } = require('./_lib/firestore');
const { checkAdmin } = require('./_lib/admin-guard');
const { linkDe, normalizeRefCode } = require('./_lib/referral');
const {
  COMISSAO_POR_PLANO, PREMIUM_PRECO, PREMIUM_PRECO_ANUAL,
  normalizePlanoPremium, comissaoDe,
  statusIndicacao, mesesRestantes, valorMesAtual,
  camposAtivacaoPremium, camposCancelamentoPremium, camposMigracaoPlano,
  desempenhoAfiliado, relatorioMensal, relatorioCSV,
} = require('./_lib/afiliados');
const log = require('./_lib/logger');

// Uma passada por todos os cadastros → { porCodigo: Map(refCode → indicados[]),
// donos: Map(refCode → cadastro do dono) }. Mesma paginação do get-painel.
async function varrerCadastros(db) {
  const porCodigo = new Map();
  const donos = new Map();
  let pageToken = null;
  do {
    const { docs, nextPageToken } = await db.listDocs('cadastros', { pageSize: 300, pageToken });
    for (const u of docs) {
      if (!u.email) continue;
      if (u.refCode) donos.set(u.refCode, u);
      const ref = String(u.referredBy || '');
      if (ref) {
        if (!porCodigo.has(ref)) porCodigo.set(ref, []);
        porCodigo.get(ref).push(u);
      }
    }
    pageToken = nextPageToken;
  } while (pageToken);
  return { porCodigo, donos };
}

// Config de ativo/inativo dos afiliados (docs pequenos, ≤ nº de afiliados).
async function lerConfigs(db) {
  const cfg = new Map();
  const docs = await db.query('afiliados_config', { limit: 1000 }).catch(() => []);
  for (const d of docs) if (d.id) cfg.set(d.id, d);
  return cfg;
}

// Afiliado = dono de código com ≥1 indicação. Ordena por conversões.
function montarAfiliados(porCodigo, donos, cfg) {
  const lista = [];
  for (const [codigo, indicados] of porCodigo) {
    const dono = donos.get(codigo);
    if (!dono) continue; // código órfão (dono removido) — não é afiliado
    lista.push({
      codigo,
      nome: dono.nome || '',
      email: dono.email || '',
      link: linkDe(codigo),
      ativo: cfg.get(codigo)?.ativo !== false, // sem doc = ativo
      indicados,
    });
  }
  lista.sort((a, b) => b.indicados.length - a.indicados.length ||
    String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  return lista;
}

function publicIndicado(u, hoje) {
  const st = statusIndicacao(u, hoje);
  return {
    nome: u.nome || '',
    email: u.email || '',
    cadastradoEm: String(u.criadoEm || '').slice(0, 10),
    status: st.status,
    cor: st.cor,
    // Plano só é exibido quando há comissão em jogo (gratuito não tem plano).
    plano: st.status === 'gratuito' ? '' : normalizePlanoPremium(u.planoPremium),
    comissaoMensal: st.status === 'gratuito' ? 0 : comissaoDe(u),
    dataAtivacaoPremium: String(u.dataAtivacaoPremium || '').slice(0, 10),
    dataExpiracaoComissao: String(u.dataExpiracaoComissao || '').slice(0, 10),
    mesesRestantes: mesesRestantes(u, hoje),
    valorMesAtual: valorMesAtual(u, hoje),
  };
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  if (!checkAdmin(event)) return { statusCode: 401, headers, body: JSON.stringify({ error: 'unauthorized' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'missing FIREBASE_API_KEY' }) };
  const db = new Firestore(projectId, apiKey);
  const hoje = new Date().toISOString().slice(0, 10);

  try {
    // ── POST: toggles e ativação/cancelamento do Premium pago ────────────────
    if (event.httpMethod === 'POST') {
      let body;
      try { body = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalido' }) }; }
      const action = String(body.action || '');

      if (action === 'ativar' || action === 'desativar') {
        const codigo = normalizeRefCode(body.codigo);
        if (!codigo) return { statusCode: 400, headers, body: JSON.stringify({ error: 'codigo invalido' }) };
        await db.setDoc('afiliados_config', codigo, {
          ativo: action === 'ativar',
          atualizadoEm: new Date().toISOString(),
        });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, codigo, ativo: action === 'ativar' }) };
      }

      if (action === 'ativar_premium' || action === 'cancelar_premium' || action === 'migrar_plano') {
        const email = String(body.email || '').trim().toLowerCase();
        if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'email obrigatorio' }) };
        const found = await db.query('cadastros', {
          where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: email } } },
          limit: 1,
        });
        const u = found[0];
        if (!u) return { statusCode: 404, headers, body: JSON.stringify({ error: 'usuario nao encontrado' }) };
        // migrar_plano: mensal↔anual DENTRO da janela — a comissão passa a
        // valer o novo valor a partir deste mês; os 12 meses NÃO reiniciam.
        if (action === 'migrar_plano' && String(u.comissaoStatus || '') !== 'premium_ativo') {
          return { statusCode: 409, headers, body: JSON.stringify({ error: 'sem_comissao_ativa', message: 'Migração só se aplica a indicado com comissão ativa.' }) };
        }
        const campos = action === 'ativar_premium' ? camposAtivacaoPremium(hoje, body.plano)
          : action === 'migrar_plano' ? camposMigracaoPlano(body.plano)
          : camposCancelamentoPremium();
        await db.updateDoc('cadastros', u.id, campos);
        log.info('[afiliados] comissao atualizada', { email, action, campos });
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, email, ...campos }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: 'action desconhecida' }) };
    }

    if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    const qs = event.queryStringParameters || {};
    const action = String(qs.action || 'list');
    const { porCodigo, donos } = await varrerCadastros(db);
    const cfg = await lerConfigs(db);
    const afiliados = montarAfiliados(porCodigo, donos, cfg);

    // ── Lista de afiliados ───────────────────────────────────────────────────
    if (action === 'list') {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          comissaoPorPlano: COMISSAO_POR_PLANO,
          premiumPreco: PREMIUM_PRECO,
          premiumPrecoAnual: PREMIUM_PRECO_ANUAL,
          afiliados: afiliados.map(a => {
            const d = desempenhoAfiliado(a.indicados, hoje);
            return { codigo: a.codigo, nome: a.nome, email: a.email, link: a.link, ativo: a.ativo,
                     totalCadastros: d.totalCadastros, premiumAtivos: d.premiumAtivos,
                     comissaoMesAtual: d.comissaoMesAtual };
          }),
        }),
      };
    }

    // ── Card de desempenho + tabela de indicações de um afiliado ────────────
    if (action === 'detalhe') {
      const codigo = normalizeRefCode(qs.codigo);
      const a = afiliados.find(x => x.codigo === codigo);
      if (!a) return { statusCode: 404, headers, body: JSON.stringify({ error: 'afiliado nao encontrado' }) };
      const indicacoes = a.indicados
        .map(u => publicIndicado(u, hoje))
        .sort((x, y) => (y.cadastradoEm || '').localeCompare(x.cadastradoEm || ''));
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          afiliado: { codigo: a.codigo, nome: a.nome, email: a.email, link: a.link, ativo: a.ativo },
          desempenho: desempenhoAfiliado(a.indicados, hoje),
          indicacoes,
        }),
      };
    }

    // ── Planilha mensal de pagamento (tabela ou CSV) ─────────────────────────
    if (action === 'relatorio') {
      const mes = /^\d{4}-\d{2}$/.test(String(qs.mes || '')) ? qs.mes : hoje.slice(0, 7);
      const rel = relatorioMensal(afiliados, hoje);
      if (qs.format === 'csv') {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="comissoes-${mes}.csv"`,
            'Cache-Control': 'no-store',
          },
          // BOM p/ o Excel abrir com acentuação correta.
          body: '﻿' + relatorioCSV(rel, mes),
        };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ mes, ...rel }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action desconhecida' }) };
  } catch (err) {
    log.error('[afiliados] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
