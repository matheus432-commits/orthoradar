'use strict';
// CAMPUS — gera o RASCUNHO de uma página de apostila (admin, sob demanda).
//
// POST { secret, paginaId, dryRun? }
//   dryRun:true  → devolve só o prompt (sem custo)
//   dryRun:false → chama Claude, valida o esqueleto e grava
//                  campus_paginas/{id} como 'rascunho'
//
// Regras: ADMIN_SECRET obrigatório; nunca dispara sozinho (sem schedule);
// evidência de contexto vem da Biblioteca (artigos da mesma especialidade
// cujo texto menciona o tema), nunca inventada.

const { Firestore } = require('./_lib/firestore');
const { gerarPagina, localizarPagina } = require('./_lib/campus/gerador');
const { normalizar } = require('./_lib/ensino/taxonomia');
const log = require('./_lib/logger');

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const resp = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

// Artigos reais da Biblioteca que mencionam o tema (título/resumo), até 12.
async function evidenciasDaBiblioteca(db, alvo) {
  const termos = normalizar(alvo.pagina.nome + ' ' + alvo.tema.nome).split(' ').filter((t) => t.length >= 4);
  const artigos = await db.queryAll('artigos', {
    where: [['especialidade', '==', alvo.area.nome]],
    select: ['titulo_pt', 'titulo', 'journal', 'year', 'resumo_pt'],
  }).catch(() => []);
  return artigos
    .map((a) => ({ titulo: a.titulo_pt || a.titulo || '', journal: a.journal || '', year: a.year || '', txt: normalizar([a.titulo_pt, a.titulo, a.resumo_pt].join(' ')) }))
    .filter((a) => a.titulo && termos.some((t) => a.txt.includes(t)))
    .sort((a, b) => String(b.year).localeCompare(String(a.year)))
    .slice(0, 12)
    .map(({ titulo, journal, year }) => ({ titulo, journal, year }));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'JSON inválido' }); }
  if (!process.env.ADMIN_SECRET || body.secret !== process.env.ADMIN_SECRET) return resp(401, { error: 'não autorizado' });
  const paginaId = String(body.paginaId || '');
  const alvo = localizarPagina(paginaId);
  if (!alvo) return resp(404, { error: 'pagina_inexistente', paginaId });
  try {
    if (body.dryRun) return resp(200, await gerarPagina({ paginaId, dryRun: true }));
    const db = new Firestore();
    const evidencias = await evidenciasDaBiblioteca(db, alvo);
    const pagina = await gerarPagina({ paginaId, evidencias });
    await db.setDoc('campus_paginas/' + encodeURIComponent(paginaId), pagina);
    log.info('[campus] rascunho gerado', { paginaId, evidencias: evidencias.length });
    return resp(200, { ok: true, estado: pagina.estado, paginaId, evidencias: evidencias.length, titulo: pagina.titulo });
  } catch (e) {
    log.error('[campus] falha ao gerar', { paginaId, erro: e.message });
    return resp(500, { error: 'falha_geracao', detalhe: e.message });
  }
};
