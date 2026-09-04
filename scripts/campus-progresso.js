#!/usr/bin/env node
'use strict';
// CAMPUS — controle de progresso das apostilas (data/campus-progresso.json).
//
// Lê a árvore inteira (3.387 páginas mapeadas) e as páginas já escritas em
// data/campus/paginas/, mede cada uma (palavras, visuais por formato, quadros,
// imagens clínicas pendentes, marcações [VERIFICAR] com localização) e grava o
// mapa completo: por módulo, na ordem do currículo, com o status de cada
// página. Roda a CADA página concluída — uma interrupção nunca perde trabalho.
//
//   node scripts/campus-progresso.js            # grava e imprime o resumo
//   node scripts/campus-progresso.js --modulo ortodontia/crescimento-e-desenvolvimento
//                                              # relatório do módulo
//
// Idempotente: mesma entrada, mesmo arquivo (a data só muda no dia).

const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..');
const { taxonomia } = require('../netlify/functions/_lib/ensino/taxonomia');
const { problemasDaPagina, metricas } = require('../netlify/functions/_lib/campus/pagina');

// Status do plano (rascunho → revisado → publicado) a partir do estado da página.
const STATUS = { rascunho: 'rascunho', validada: 'revisado', publicada: 'publicado' };

function lerPaginas() {
  const dir = path.join(RAIZ, 'data', 'campus', 'paginas');
  const out = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const problemas = problemasDaPagina(p);
    if (problemas.length) throw new Error(f + ': ' + problemas.join('; '));
    if (out.has(p.id)) throw new Error(f + ': id repetido ' + p.id);
    out.set(p.id, { arquivo: 'data/campus/paginas/' + f, pagina: p });
  }
  return out;
}

function montar() {
  const escritas = lerPaginas();
  const modulos = [];
  const paginas = {};
  const imagensPendentes = [];
  const verificarPendentes = [];
  let total = 0;
  const porStatus = { pendente: 0, rascunho: 0, revisado: 0, publicado: 0 };

  // Ordem da fila: Ortodontia primeiro (especialidade do titular), módulo a
  // módulo na ordem do currículo; depois as demais áreas na ordem da árvore.
  const areas = taxonomia().areas;
  const ordem = [...areas.filter((a) => a.id === 'ortodontia'), ...areas.filter((a) => a.id !== 'ortodontia')];

  for (const a of ordem) {
    for (const m of a.modulos) {
      const mod = { id: m.id, areaId: a.id, area: a.nome, modulo: m.nome, total: 0, concluidas: 0, palavras: 0, visuais: 0, imagensClinicas: 0, verificar: 0, paginas: [] };
      for (const t of m.temas) {
        for (const pg of t.paginas) {
          total++; mod.total++;
          const e = escritas.get(pg.id);
          if (!e) { mod.paginas.push({ id: pg.id, nome: pg.nome, tema: t.nome, status: 'pendente' }); porStatus.pendente++; continue; }
          const met = metricas(e.pagina);
          const status = STATUS[e.pagina.estado] || 'rascunho';
          porStatus[status]++;
          mod.concluidas++; mod.palavras += met.palavras; mod.visuais += met.visuais.length;
          mod.imagensClinicas += met.imagensClinicas.length; mod.verificar += met.verificar.length;
          mod.paginas.push({ id: pg.id, nome: pg.nome, tema: t.nome, status, palavras: met.palavras, visuais: met.visuais.length });
          paginas[pg.id] = {
            titulo: e.pagina.titulo, arquivo: e.arquivo, formato: met.formato, status, estado: e.pagina.estado,
            palavras: met.palavras,
            visuais: met.visuais.map((v) => ({ formato: v.formato, titulo: v.titulo })),
            quadros: met.quadros,
            imagensClinicas: met.imagensClinicas,
            verificar: met.verificar,
          };
          for (const im of met.imagensClinicas) imagensPendentes.push({ pagina: pg.id, modulo: m.nome, ...im });
          for (const v of met.verificar) verificarPendentes.push({ pagina: pg.id, ...v });
        }
      }
      modulos.push(mod);
    }
  }
  const concluidas = total - porStatus.pendente;
  const proximo = modulos.find((m) => m.concluidas < m.total);
  return {
    atualizadoEm: new Date().toISOString().slice(0, 10),
    totalPaginas: total, concluidas, porStatus,
    proximoModulo: proximo ? { id: proximo.id, area: proximo.area, modulo: proximo.modulo, faltam: proximo.total - proximo.concluidas } : null,
    imagensPendentes, verificarPendentes,
    modulos, paginas,
  };
}

function relatorioDoModulo(prog, id) {
  const m = prog.modulos.find((x) => x.id === id);
  if (!m) return 'módulo não encontrado: ' + id;
  const linhas = [];
  linhas.push(`Módulo: ${m.area} — ${m.modulo}`);
  linhas.push(`Páginas escritas: ${m.concluidas} de ${m.total} · ${m.palavras.toLocaleString('pt-BR')} palavras`);
  const fmt = {};
  for (const p of m.paginas) for (const v of ((prog.paginas[p.id] || {}).visuais || [])) fmt[v.formato] = (fmt[v.formato] || 0) + 1;
  linhas.push(`Visuais: ${m.visuais} (${Object.entries(fmt).map(([k, v]) => k + ' ' + v).join(', ') || 'nenhum'})`);
  const imgs = prog.imagensPendentes.filter((i) => i.modulo === m.modulo && prog.paginas[i.pagina] && (prog.paginas[i.pagina].arquivo || '').includes(m.areaId + '--'));
  linhas.push(`Imagens clínicas necessárias: ${imgs.length}`);
  for (const i of imgs) linhas.push(`  - [${i.pagina.split('/').pop()}] ${i.imagem}: ${i.mostrar}`);
  const ver = prog.verificarPendentes.filter((v) => m.paginas.some((p) => p.id === v.pagina));
  linhas.push(`Marcações [VERIFICAR]: ${ver.length}`);
  for (const v of ver) linhas.push(`  - [${v.pagina.split('/').pop()}] ${v.onde}: …${v.trecho}`);
  linhas.push(`Progresso acumulado: ${prog.concluidas} de ${prog.totalPaginas.toLocaleString('pt-BR')} páginas`);
  if (prog.proximoModulo) linhas.push(`Próximo módulo na fila: ${prog.proximoModulo.area} — ${prog.proximoModulo.modulo} (${prog.proximoModulo.faltam} páginas)`);
  return linhas.join('\n');
}

if (require.main === module) {
  const prog = montar();
  const destino = path.join(RAIZ, 'data', 'campus-progresso.json');
  fs.writeFileSync(destino, JSON.stringify(prog, null, 1) + '\n');
  const i = process.argv.indexOf('--modulo');
  if (i > 0) console.log(relatorioDoModulo(prog, process.argv[i + 1]));
  else console.log(`progresso: ${prog.concluidas} de ${prog.totalPaginas} páginas (${prog.porStatus.rascunho} rascunho, ${prog.porStatus.revisado} revisado, ${prog.porStatus.publicado} publicado); ${prog.imagensPendentes.length} imagens clínicas pendentes; ${prog.verificarPendentes.length} [VERIFICAR]; próximo: ${prog.proximoModulo ? prog.proximoModulo.area + ' — ' + prog.proximoModulo.modulo : 'nenhum'}`);
}

module.exports = { montar, relatorioDoModulo };
