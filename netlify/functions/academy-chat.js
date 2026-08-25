// ACADEMY — um turno da entrevista adaptativa (sessão obrigatória).
//
// POST { email, id, mensagem }  (Authorization: Bearer <token>)
//   → { fala, projeto, progresso }
//
// Fluxo do turno: carrega projeto+histórico → monta prompt com o CONTEXTO
// INTEIRO → Claude (ACADEMY_MODEL, padrão Sonnet — a entrevista é o produto)
// → valida a saída (lista branca de ações POR ETAPA) → aplica as ações COM as
// regras da máquina de etapas → persiste projeto e mensagens.
// O modelo conversa; as TRAVAS moram aqui (conformidade bloqueante, aprovação
// humana de seção, referências só verificadas).

const { Firestore } = require('./_lib/firestore');
const { rateLimited } = require('./_lib/rate-limit');
const { sessaoValida } = require('./_lib/academy/auth');
const { SECOES, podeAvancar, progresso, ETAPAS } = require('./_lib/academy/estado');
const { construirTurno, interpretarResposta } = require('./_lib/academy/entrevista');
const { avaliarConformidade } = require('./_lib/academy/conformidade');
const { CATALOGO } = require('./_lib/academy/periodicos');
const log = require('./_lib/logger');

const ACADEMY_MODEL = process.env.ACADEMY_MODEL || 'claude-sonnet-5';

// Seção corrente da etapa manuscrito: a primeira, na ordem oficial, ainda
// não aprovada pelo autor.
const secaoCorrente = (p) => SECOES.find(s => !(p.secoes && p.secoes[s] && p.secoes[s].aprovada)) || 'titulo';

function conformidadeCompleta(c) {
  if (c.paciente_identificavel === null) return false;
  if (c.paciente_identificavel && c.tcle_disponivel === null) return false;
  if (c.envolve_alem_do_relato === null) return false;
  if (c.envolve_alem_do_relato && c.coleta_pre_aprovacao === null) return false;
  return true;
}

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  const _rl = rateLimited(event, 'academy-chat', { max: 30, windowMs: 60000 }); if (_rl) return _rl;

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* segue */ }
  const email = String(body.email || '').trim().toLowerCase();
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const mensagem = String(body.mensagem || '').slice(0, 6000).trim();
  if (!mensagem) return { statusCode: 400, headers, body: JSON.stringify({ error: 'mensagem vazia' }) };

  const projectId = process.env.FIREBASE_PROJECT_ID || 'orthoradar';
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey || !process.env.ANTHROPIC_API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'config' }) };
  const db = new Firestore(projectId, apiKey);

  try {
    const sess = await sessaoValida(db, email, token);
    if (!sess.ok) return { statusCode: sess.status, headers, body: JSON.stringify({ error: sess.erro }) };

    const p = await db.getDoc('academy_projetos', String(body.id || '')).catch(() => null);
    if (!p || p.usuario_email !== email) return { statusCode: 404, headers, body: JSON.stringify({ error: 'nao_encontrado' }) };

    const msgs = await db.query('academy_mensagens', {
      where: { fieldFilter: { field: { fieldPath: 'projetoId' }, op: 'EQUAL', value: { stringValue: String(p.id) } } },
      limit: 400,
    }).catch(() => []);
    msgs.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

    // Na entrada livre, o que o dentista digita JÁ é material do projeto.
    if (p.etapa_atual === 'entrada') {
      p.entrada_livre = ((p.entrada_livre || '') + '\n' + mensagem).trim().slice(0, 8000);
    }

    const extras = { secaoAtual: p.etapa_atual === 'manuscrito' ? secaoCorrente(p) : undefined };
    const { system, prompt } = construirTurno(p, msgs, mensagem, extras);

    const { callClaude } = require('./_lib/claude');
    const raw = await callClaude(`${system}\n\n${prompt}`, 0, ACADEMY_MODEL, 1800, 'academy');
    const r = interpretarResposta(raw.text, p.etapa_atual, extras);
    if (r.descartadas.length) log.warn('[academy-chat] ações fora do contrato descartadas', { id: p.id, descartadas: r.descartadas });

    // ── Aplicação das ações COM as regras do servidor ────────────────────────
    const notas = [];
    for (const a of r.acoes) {
      if (a.tipo === 'definir_tipo_trabalho') p.tipo_trabalho = a.valor;
      if (a.tipo === 'responder_conformidade') p.conformidade[a.campo] = a.valor;
      if (a.tipo === 'definir_pergunta') p.pergunta_pesquisa = { texto_simples: String(a.texto_simples).slice(0, 600), pico: a.pico, confirmada: false };
      if (a.tipo === 'confirmar_pergunta' && p.pergunta_pesquisa) p.pergunta_pesquisa.confirmada = true;
      if (a.tipo === 'rascunho_secao') {
        // Rascunho NUNCA nasce aprovado (guardrail 7) — aprovação só pelo botão.
        p.secoes = p.secoes || {};
        p.secoes[a.secao] = { texto: String(a.texto).slice(0, 20000), aprovada: false, rascunhoEm: new Date().toISOString() };
        notas.push('Rascunho da seção pronto — revise no painel ao lado e aprove (ou edite) antes de seguirmos.');
      }
      if (a.tipo === 'definir_periodico') {
        if (CATALOGO.periodicos.some(x => x.id === a.valor)) p.periodico_alvo = a.valor;
        else notas.push('O periódico sugerido não está no catálogo verificado — escolha um da lista.');
      }
    }

    // Conformidade: com todas as respostas, o SERVIDOR dá o veredito (o modelo
    // só comunica) — e o bloqueio é aplicado aqui, não na conversa.
    if (p.etapa_atual === 'conformidade' && conformidadeCompleta(p.conformidade)) {
      const v = avaliarConformidade({
        pacienteIdentificavel: p.conformidade.paciente_identificavel,
        tcleDisponivel: p.conformidade.tcle_disponivel,
        envolveAlemDoRelato: p.conformidade.envolve_alem_do_relato,
        coletaPreAprovacao: p.conformidade.coleta_pre_aprovacao,
      });
      p.conformidade.avaliada = true;
      p.conformidade.liberado = v.liberado;
      p.conformidade.pendencias = v.pendencias;
      if (v.liberado) notas.push('Parte ética resolvida ✓ — podemos seguir para a sua pergunta de pesquisa.');
      else notas.push(['Sendo franco: ainda não dá para escrever.', ...v.pendencias, 'Caminhos possíveis:', ...v.caminhos, v.avisoNormas].join('\n'));
    }

    // Avanço de etapa: SEMPRE pela máquina (o modelo pede, o servidor decide).
    if (r.acoes.some(a => a.tipo === 'pronto_para_avancar')) {
      const proxima = ETAPAS[ETAPAS.indexOf(p.etapa_atual) + 1];
      const pendencia = proxima ? podeAvancar(p, proxima) : 'já estamos na última etapa';
      if (!pendencia) {
        p.etapa_atual = proxima;
        if (proxima === 'busca') notas.push('Pergunta fechada ✓ — use o botão "Buscar literatura" para eu trazer só estudos reais e verificáveis (com PMID/DOI).');
      } else {
        notas.push('Antes de avançar: ' + pendencia + '.');
      }
    }

    p.atualizado_em = new Date().toISOString();
    await db.setDoc('academy_projetos', String(p.id), (({ id, ...resto }) => resto)(p));

    const falaFinal = [r.fala, ...notas].filter(Boolean).join('\n\n');
    const ts = new Date().toISOString();
    await db.addDoc('academy_mensagens', { projetoId: String(p.id), de: 'dentista', texto: mensagem, ts });
    await db.addDoc('academy_mensagens', { projetoId: String(p.id), de: 'academy', texto: falaFinal, ts: new Date(Date.now() + 1).toISOString() });

    return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'private, no-store' }, body: JSON.stringify({ fala: falaFinal, projeto: p, progresso: progresso(p) }) };
  } catch (err) {
    log.error('[academy-chat] erro', { err: err.message });
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'erro_interno' }) };
  }
};
