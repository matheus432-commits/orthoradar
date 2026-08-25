/* ---------- Español 90 · interface ---------- */
const ABAS = [
  {id:'hoy',      nome:'Hoje'},
  {id:'lectura',  nome:'Leitura'},
  {id:'anki',     nome:'Anki'},
  {id:'mil',      nome:'1000 palavras'},
  {id:'falsos',   nome:'Falsos amigos'},
  {id:'tema',     nome:'Temático'},
  {id:'conversa', nome:'Conversa'},
  {id:'progreso', nome:'Progresso'},
];
let abaAtual = 'hoy';

function irPara(id) {
  abaAtual = id;
  for (const a of ABAS) {
    $('#tab-'+a.id).hidden = a.id !== id;
    $('#nav-'+a.id).setAttribute('aria-selected', a.id === id);
  }
  location.hash = id;
  window.scrollTo({top:0});
  RENDER[id]();
}
function montarNav() {
  const nav = $('#nav');
  nav.replaceChildren(...ABAS.map(a =>
    el('button', {id:'nav-'+a.id, role:'tab', 'aria-selected':a.id===abaAtual, onclick:()=>irPara(a.id)}, a.nome)));
}

/* ---------- áudio ---------- */
let vozES = null;
function carregarVoz() {
  const vs = speechSynthesis?.getVoices?.() || [];
  vozES = vs.find(v => /^es[-_]ES/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { carregarVoz(); speechSynthesis.onvoiceschanged = carregarVoz; }
function falar(texto) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-ES'; u.rate = .92; if (vozES) u.voice = vozES;
  speechSynthesis.speak(u);
}
const btnSom = (txt) => el('button', {class:'spk', title:'Ouvir em espanhol',
  'aria-label':'Ouvir', onclick:(e)=>{e.stopPropagation(); falar(txt);}}, '🔊');

/* ---------- componentes ---------- */
function barra(pct, ok=false) {
  return el('div', {class:'bar'+(ok?' ok':'')}, el('i', {style:`width:${Math.max(0,Math.min(100,pct))}%`}));
}
function stat(valor, rotulo) { return el('div', {class:'stat'}, el('b', {}, String(valor)), el('span', {}, rotulo)); }
function tagTema(t) { return el('span', {class:'tag '+t}, TEMAS[t] || t); }
function cabecalho(sec, titulo, sub) {
  sec.replaceChildren();
  return el('div', {}, el('h2', {}, titulo), sub && el('p', {class:'sub'}, sub));
}
function linhaVocab(w, {mostrarSim=true} = {}) {
  const st = vStat(w.es);
  const item = el('div', {class:'item'},
    el('span', {class:'dot s'+st, title:['não vista','aprendendo','dominada'][st]}),
    el('div', {class:'main'},
      el('span', {class:'es'}, w.es, w.classe ? el('span',{class:'pt'},'') : ''),
      el('span', {class:'pt'}, w.pt)),
    mostrarSim ? el('span', {class:'tag', title:classeSem(w.sim).dica}, classeSem(w.sim).label) : null,
    btnSom(w.es),
    el('button', {class:'btn sm', onclick:(e)=>{
      const novo = (vStat(w.es)+1) % 3; setVocab(w.es, novo);
      e.target.textContent = ['marcar','aprendendo','dominada'][novo];
      item.querySelector('.dot').className = 'dot s'+novo;
    }}, ['marcar','aprendendo','dominada'][st]));
  return item;
}

/* ---------- ABA: HOJE ---------- */
function renderHoy() {
  const sec = $('#tab-hoy'); const p = planoDoDia(); const d = dia();
  const devidos = cardsDevidos().length;
  sec.replaceChildren();

  const feitos = BLOCOS.filter(b => d.blocos[b.id]).length;
  const head = el('div', {class:'card'},
    el('h2', {}, `Dia ${p.d+1} de 90 · ${fmtData(hoje())}`),
    el('p', {class:'sub'}, `Bloco temático de hoje: ${TEMAS[p.temaDoDia]} · lote ${p.ciclo}ª passada nas 1000 palavras`),
    barra(feitos/BLOCOS.length*100, feitos===BLOCOS.length),
    el('div', {class:'row', style:'margin-top:10px;justify-content:space-between'},
      el('span', {class:'pt'}, `${feitos}/${BLOCOS.length} blocos · ${d.min} de ${S.meta} min`),
      el('span', {class:'pt'}, devidos ? `${plural(devidos,'card devido','cards devidos')}` : 'Anki em dia ✓')));
  sec.append(head);

  const lista = el('div', {class:'card'}, el('h2', {}, 'Plano de 60 minutos'),
    el('p', {class:'sub'}, 'Toque no bloco para ir direto. Marque o quadrado ao terminar.'));
  for (const b of BLOCOS) {
    const done = !!d.blocos[b.id];
    const bl = el('div', {class:'block'+(done?' done':'')},
      el('span', {class:'mins'}, b.min+"'"),
      el('div', {class:'body', onclick:()=>irPara(b.aba)},
        el('b', {}, b.titulo + (b.id==='anki' && devidos ? ` · ${devidos}` : '')),
        el('span', {}, b.desc)),
      el('button', {class:'check', 'aria-pressed':done, 'aria-label':'Concluir bloco', onclick:(e)=>{
        const agora = !d.blocos[b.id];
        d.blocos[b.id] = agora;
        if (agora) d.min = Math.min(180, d.min + b.min); else d.min = Math.max(0, d.min - b.min);
        salvar(); renderHoy(); atualizarPills();
      }}, done ? '✓' : ''));
    lista.append(bl);
  }
  sec.append(lista);

  sec.append(cronometro());

  const prev = el('div', {class:'card'},
    el('h2', {}, 'Prévia do dia'),
    el('p', {class:'sub'}, 'O que você vai encontrar em cada bloco.'),
    el('div', {class:'grid g2'},
      el('div', {},
        el('h3', {}, 'Leitura'),
        el('div', {class:'row'}, tagTema(p.lec.tema), el('span', {class:'tag'}, p.lec.nivel)),
        el('p', {style:'margin:6px 0 2px'}, el('b', {}, p.lec.titulo)),
        el('p', {class:'pt', style:'font-size:14px;margin:0'}, p.lec.resumen),
        el('button', {class:'btn sm', style:'margin-top:8px', onclick:()=>irPara('lectura')}, 'Abrir leitura →')),
      el('div', {},
        el('h3', {}, 'Falsos amigos de hoje'),
        ...p.fal.map(f => el('p', {style:'margin:4px 0;font-size:14px'},
          el('b', {}, f.es), ' — ', f.significa,
          el('span', {class:'trap', style:'color:var(--accent);font-size:12px'}, ` (≠ ${f.parece})`))))));
  sec.append(prev);

  const palavras = el('div', {class:'card'},
    el('h2', {}, `Lote de hoje · ${p.mil.length} palavras frequentes`),
    el('p', {class:'sub'}, 'Leia em voz alta. As "diferentes" são as que exigem trabalho real.'),
    el('div', {class:'list'}, ...p.mil.map(w => { verVocabSilencioso(w.es); return linhaVocab(w); })),
    el('button', {class:'btn', style:'margin-top:10px', onclick:()=>{
      let n=0; for (const w of p.mil) if (!temCard(w.es)) { novoCard({front:w.es, back:w.pt, tags:['1000'], fonte:'Lista de frequência'}); n++; }
      alert(n ? `${n} palavras adicionadas ao Anki.` : 'Todas já estavam no Anki.'); renderHoy();
    }}, '+ Mandar lote para o Anki'));
  sec.append(palavras);
}
function verVocabSilencioso(es) {
  const v = S.vocab[es] || (S.vocab[es] = {s:0, v:0, u:''});
  if (v.u !== hoje()) { v.v++; v.u = hoje(); if (v.s === 0) v.s = 1; }
  salvar();
}

/* cronômetro de sessão */
let cronId = null, cronSeg = 0, cronRodando = false;
function cronometro() {
  const disp = el('div', {class:'timer'}, '00:00');
  const pinta = () => disp.textContent =
    `${String(Math.floor(cronSeg/60)).padStart(2,'0')}:${String(cronSeg%60).padStart(2,'0')}`;
  pinta();
  const btn = el('button', {class:'btn primary', onclick:()=>{
    cronRodando = !cronRodando;
    btn.textContent = cronRodando ? 'Pausar' : 'Iniciar';
    clearInterval(cronId);
    if (cronRodando) cronId = setInterval(()=>{ cronSeg++; pinta(); }, 1000);
  }}, cronRodando ? 'Pausar' : 'Iniciar');
  return el('div', {class:'card'},
    el('h2', {}, 'Cronômetro da sessão'),
    el('p', {class:'sub'}, 'Opcional. Ao parar, os minutos entram no seu registro do dia.'),
    el('div', {class:'row'}, disp, btn,
      el('button', {class:'btn', onclick:()=>{
        const m = Math.round(cronSeg/60);
        if (m > 0) { dia().min += m; salvar(); }
        cronSeg = 0; cronRodando = false; clearInterval(cronId); renderHoy(); atualizarPills();
      }}, 'Registrar e zerar')));
}

/* ---------- ABA: LEITURA ---------- */
let lecturaAtual = null;
function renderLectura() {
  const sec = $('#tab-lectura');
  const p = planoDoDia();
  const lec = lecturaAtual ? LECTURAS.find(l => l.id === lecturaAtual) || p.lec : p.lec;
  sec.replaceChildren();

  const sel = el('select', {onchange:(e)=>{ lecturaAtual = e.target.value; renderLectura(); }},
    ...LECTURAS.map(l => el('option', {value:l.id, selected:l.id===lec.id},
      `${l.id} · ${l.titulo} (${TEMAS[l.tema]}, ${l.nivel})`)));

  sec.append(el('div', {class:'card'},
    el('h2', {}, lec.titulo),
    el('div', {class:'row', style:'margin-bottom:8px'}, tagTema(lec.tema), el('span',{class:'tag'},lec.nivel),
      el('span', {class:'tag'}, S.lecturasFeitas[lec.id] ? 'lida ✓' : 'não lida')),
    el('p', {class:'sub'}, lec.resumen),
    lec.fuente ? el('p', {class:'notice'},
      'Fonte: ' + lec.fuente + (lec.url ? ' — ' : ''),
      lec.url ? el('a', {href:lec.url, target:'_blank', rel:'noopener'}, lec.url) : '') : null,
    el('div', {style:'margin-top:12px'}, el('label', {class:'fld'}, 'Trocar de texto'), sel)));

  const bloco = el('div', {class:'card'},
    el('h2', {}, 'Texto'),
    el('p', {class:'sub'}, 'Toque na frase para ver a tradução. Toque em "+ Anki" para virar card.'));
  for (const f of lec.frases) {
    const jaTem = temCard(f.es);
    const linha = el('div', {class:'frase'+(jaTem?' added':''), onclick:(e)=>{ if(!e.target.closest('button')) linha.classList.toggle('open'); }},
      el('div', {class:'row', style:'justify-content:space-between;align-items:flex-start;gap:8px'},
        el('span', {class:'es', style:'flex:1'}, f.es),
        el('span', {class:'row', style:'gap:2px;flex:0 0 auto'},
          btnSom(f.es),
          el('button', {class:'btn sm', onclick:()=>{
            novoCard({front:f.es, back:f.pt, tags:['leitura', lec.tema], fonte:lec.titulo});
            linha.classList.add('added'); renderLectura();
          }}, jaTem ? 'no Anki ✓' : '+ Anki'))),
      el('div', {class:'pt'}, f.pt));
    bloco.append(linha);
  }
  bloco.append(el('div', {class:'row', style:'margin-top:12px'},
    el('button', {class:'btn primary', onclick:()=>{
      let n=0; for (const f of lec.frases) if (!temCard(f.es)) { novoCard({front:f.es, back:f.pt, tags:['leitura', lec.tema], fonte:lec.titulo}); n++; }
      S.lecturasFeitas[lec.id] = hoje(); salvar();
      alert(n ? `${n} frases adicionadas ao Anki.` : 'Todas as frases já estavam no Anki.'); renderLectura();
    }}, '+ Todas as frases para o Anki'),
    el('button', {class:'btn', onclick:()=>{ falar(lec.frases.map(f=>f.es).join(' ')); }}, '🔊 Ouvir o texto'),
    el('button', {class:'btn ghost', onclick:()=>{ S.lecturasFeitas[lec.id]=hoje(); salvar(); renderLectura(); }}, 'Marcar como lida')));
  sec.append(bloco);

  if (lec.glosario?.length) sec.append(el('div', {class:'card'},
    el('h2', {}, 'Glossário'),
    el('div', {class:'list'}, ...lec.glosario.map(g =>
      el('div', {class:'item'}, el('div', {class:'main'},
        el('span', {class:'es'}, g.es), el('span', {class:'pt'}, g.pt)), btnSom(g.es))))));

  if (lec.preguntas?.length) sec.append(el('div', {class:'card'},
    el('h2', {}, 'Para responder em voz alta'),
    el('p', {class:'sub'}, 'Responda sem escrever. É este bloco que vira conversa na aula presencial.'),
    el('ol', {style:'margin:0;padding-left:20px'}, ...lec.preguntas.map(q => el('li', {style:'margin:6px 0'}, q)))));
}

/* ---------- ABA: ANKI ---------- */
let cardAtual = null, mostrandoResposta = false, filaSessao = [];
function renderAnki() {
  const sec = $('#tab-anki');
  sec.replaceChildren();
  const todos = Object.values(S.cards);
  const devidos = cardsDevidos();

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Revisão espaçada'),
    el('p', {class:'sub'}, 'Algoritmo SM-2. Fale a frase em voz alta antes de virar a carta.'),
    el('div', {class:'grid g3'},
      stat(devidos.length, 'devidos hoje'),
      stat(todos.filter(c => estagio(c)==='maduro').length, 'maduros (21d+)'),
      stat(todos.length, 'total de cards'))));

  if (!todos.length) {
    sec.append(el('div', {class:'card'}, el('div', {class:'empty'},
      'Nenhum card ainda. Vá à aba Leitura e mande as frases do texto do dia para cá.'),
      el('div', {class:'row', style:'justify-content:center'},
        el('button', {class:'btn primary', onclick:()=>irPara('lectura')}, 'Ir para a leitura'))));
    sec.append(formCard());
    return;
  }
  if (!devidos.length) {
    sec.append(el('div', {class:'card'}, el('div', {class:'empty'},
      '✓ Revisão do dia concluída. Volte amanhã — ou adicione frases novas.')));
    sec.append(formCard()); sec.append(listaCards()); return;
  }
  if (!cardAtual || !S.cards[cardAtual.id] || cardAtual.due > hoje()) { cardAtual = devidos[0]; mostrandoResposta = false; }

  const c = cardAtual;
  const face = el('div', {class:'flash'},
    el('div', {class:'q'}, c.front),
    el('div', {class:'row'}, btnSom(c.front),
      c.fonte ? el('span', {class:'tag'}, c.fonte) : null,
      ...c.tags.map(t => el('span', {class:'tag'}, t))),
    mostrandoResposta ? el('div', {class:'a'}, c.back) : null);
  sec.append(face);

  if (!mostrandoResposta) {
    sec.append(el('div', {class:'row', style:'margin-top:12px;justify-content:center'},
      el('button', {class:'btn primary', style:'width:100%;padding:14px', onclick:()=>{ mostrandoResposta = true; renderAnki(); }},
        'Mostrar resposta  (espaço)')));
  } else {
    const g = el('div', {class:'grades'});
    [['De novo','< 1 min',0], ['Difícil','1–2 d',1], ['Bom', proximoTexto(c,2), 2], ['Fácil', proximoTexto(c,3), 3]]
      .forEach(([nome, sub, nota]) => g.append(el('button', {onclick:()=>{
        avaliar(c, nota); cardAtual = null; mostrandoResposta = false; renderAnki(); atualizarPills();
      }}, nome, el('small', {}, sub))));
    sec.append(g);
    sec.append(el('p', {class:'sub', style:'text-align:center;margin-top:10px'}, 'Atalhos: 1 · 2 · 3 · 4'));
  }
  sec.append(el('p', {class:'sub', style:'text-align:center'},
    `${devidos.length} restantes hoje · ${plural(dia().revisados,'revisão feita','revisões feitas')}`));
  sec.append(formCard());
  sec.append(listaCards());
}
function proximoTexto(c, nota) {
  const sim = JSON.parse(JSON.stringify(c));
  const guarda = dia().revisados;
  avaliar(sim, nota);
  dia().revisados = guarda;
  const d = diffDias(hoje(), sim.due);
  return d <= 0 ? 'hoje' : d === 1 ? '1 dia' : d < 30 ? d+' dias' : Math.round(d/30)+' meses';
}
function formCard() {
  const f = el('input', {placeholder:'Frase em espanhol'});
  const b = el('input', {placeholder:'Tradução em português'});
  return el('div', {class:'card'},
    el('h2', {}, 'Adicionar frase manualmente'),
    el('p', {class:'sub'}, 'Ouviu algo na aula presencial? Registre aqui na hora.'),
    el('div', {class:'grid g2'},
      el('div', {}, el('label', {class:'fld'}, 'Frente (ES)'), f),
      el('div', {}, el('label', {class:'fld'}, 'Verso (PT)'), b)),
    el('button', {class:'btn primary', style:'margin-top:10px', onclick:()=>{
      if (!f.value.trim() || !b.value.trim()) return alert('Preencha os dois campos.');
      novoCard({front:f.value.trim(), back:b.value.trim(), tags:['manual'], fonte:'Aula/anotação'});
      f.value = b.value = ''; renderAnki();
    }}, '+ Criar card'));
}
let filtroCards = 'todos';
function listaCards() {
  const todos = Object.values(S.cards).sort((a,b) => a.due.localeCompare(b.due));
  const filtrados = filtroCards === 'todos' ? todos : todos.filter(c => estagio(c) === filtroCards);
  const box = el('div', {class:'card'},
    el('h2', {}, 'Todos os cards'),
    el('div', {class:'chips'}, ...['todos','novo','aprendendo','jovem','maduro'].map(k =>
      el('button', {class:'chip', 'aria-pressed':filtroCards===k, onclick:()=>{ filtroCards=k; renderAnki(); }},
        k === 'todos' ? 'todos' : k))),
    el('div', {class:'list'}, ...filtrados.slice(0,120).map(c =>
      el('div', {class:'item'},
        el('div', {class:'main'}, el('span', {class:'es'}, c.front), el('span', {class:'pt'}, c.back)),
        el('span', {class:'tag'}, estagio(c)),
        el('span', {class:'tag'}, c.due <= hoje() ? 'hoje' : fmtData(c.due)),
        btnSom(c.front),
        el('button', {class:'btn sm ghost', title:'Excluir', onclick:()=>{
          if (confirm('Excluir este card?')) { delete S.cards[c.id]; salvar(); renderAnki(); }
        }}, '✕')))));
  if (filtrados.length > 120) box.append(el('p', {class:'sub', style:'margin-top:8px'},
    `mostrando 120 de ${filtrados.length}`));
  return box;
}

/* ---------- ABA: 1000 PALAVRAS ---------- */
let milFiltro = {sim:'todas', st:'todos', q:'', lote:0};
function renderMil() {
  const sec = $('#tab-mil'); sec.replaceChildren();
  const p = planoDoDia();
  const vistas = FREQ.filter(w => vStat(w.es) > 0).length;
  const dom = FREQ.filter(w => vStat(w.es) === 2).length;

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'As 1000 palavras mais faladas'),
    el('p', {class:'sub'}, `${FREQ.length} palavras em ordem de frequência. No ritmo de ${S.novasPorDia}/dia você passa por todas em ${Math.ceil(FREQ.length/S.novasPorDia)} dias — e recomeça.`),
    barra(vistas/FREQ.length*100),
    el('div', {class:'grid g3', style:'margin-top:12px'},
      stat(vistas, 'já vistas'), stat(dom, 'dominadas'),
      stat(FREQ.length - vistas, 'ainda intocadas'))));

  const busca = el('input', {placeholder:'Buscar em espanhol ou português…', value:milFiltro.q,
    oninput:(e)=>{ milFiltro.q = e.target.value; pintarLista(); }});
  const chipsSim = el('div', {class:'chips'},
    ...[['todas','Todas'],...CLASSES_SEM.map(c=>[c.id,c.label])].map(([k,rot]) =>
      el('button', {class:'chip', 'aria-pressed':milFiltro.sim===k, onclick:()=>{ milFiltro.sim=k; renderMil(); }}, rot)));
  const chipsSt = el('div', {class:'chips'},
    ...[['todos','Qualquer status'],['0','Não vistas'],['1','Aprendendo'],['2','Dominadas']].map(([k,rot]) =>
      el('button', {class:'chip', 'aria-pressed':milFiltro.st===k, onclick:()=>{ milFiltro.st=k; renderMil(); }}, rot)));

  const listaBox = el('div', {class:'list'});
  const contador = el('p', {class:'sub'});
  function filtrar() {
    const q = norm(milFiltro.q);
    return FREQ.filter(w =>
      (milFiltro.sim === 'todas' || w.simClasse === milFiltro.sim) &&
      (milFiltro.st === 'todos' || String(vStat(w.es)) === milFiltro.st) &&
      (!q || norm(w.es).includes(q) || norm(w.pt).includes(q)));
  }
  function pintarLista() {
    const r = filtrar();
    contador.textContent = `${r.length} palavras — mostrando até 200`;
    listaBox.replaceChildren(...r.slice(0,200).map(w => linhaVocab(w)));
  }
  const card = el('div', {class:'card'},
    el('h2', {}, 'Explorar'),
    el('p', {class:'sub'}, 'O filtro "Diferente" mostra o que realmente precisa ser decorado — o resto o português já te deu.'),
    busca, chipsSim, chipsSt, contador, listaBox,
    el('button', {class:'btn', style:'margin-top:10px', onclick:()=>{
      const r = filtrar().filter(w => !temCard(w.es)).slice(0,30);
      r.forEach(w => novoCard({front:w.es, back:w.pt, tags:['1000'], fonte:'Lista de frequência'}));
      alert(`${r.length} palavras enviadas ao Anki.`);
    }}, '+ Mandar 30 do filtro atual para o Anki'));
  sec.append(card); pintarLista();

  sec.append(quizBox('mil', () => {
    const pool = FREQ.filter(w => vStat(w.es) > 0);
    return (pool.length >= 4 ? pool : FREQ).slice();
  }));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Lote de hoje'),
    el('p', {class:'sub'}, `Palavras ${(p.d*S.novasPorDia)%FREQ.length+1}–${(p.d*S.novasPorDia)%FREQ.length+S.novasPorDia} da lista.`),
    el('div', {class:'list'}, ...p.mil.map(w => linhaVocab(w)))));
}

/* ---------- ABA: FALSOS AMIGOS ---------- */
let falsoTema = 'todos';
function renderFalsos() {
  const sec = $('#tab-falsos'); sec.replaceChildren();
  const p = planoDoDia();

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Falsos amigos e armadilhas'),
    el('p', {class:'sub'}, `${FALSOS.length} palavras que parecem português e não são. É aqui que o brasileiro escorrega falando espanhol — e é aqui que você ganha credibilidade.`)));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'As 3 de hoje'),
    ...p.fal.map(f => cartaoFalso(f))));

  const chips = el('div', {class:'chips'},
    ...[['todos','Todos'],['odonto','Odontologia'],['negocios','Negócios'],['viajes','Viagens'],['rutina','Rotina'],['geral','Geral']]
      .map(([k,rot]) => el('button', {class:'chip', 'aria-pressed':falsoTema===k,
        onclick:()=>{ falsoTema=k; renderFalsos(); }}, rot)));
  const lista = FALSOS.filter(f => falsoTema==='todos' || f.tema===falsoTema);
  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Lista completa'), chips,
    el('p', {class:'sub'}, `${lista.length} armadilhas`),
    ...lista.map(f => cartaoFalso(f))));

  sec.append(quizFalsos());
}
function cartaoFalso(f) {
  return el('div', {class:'fa'},
    el('div', {class:'row', style:'justify-content:space-between'},
      el('span', {class:'w'}, f.es), el('span', {class:'row'}, tagTema(f.tema), btnSom(f.es))),
    f.parece !== '—' ? el('div', {class:'trap'}, `parece "${f.parece}" — mas NÃO é`) : null,
    el('div', {class:'def'}, el('b', {}, 'significa: '), f.significa),
    f.comoDizer !== '—' ? el('div', {class:'fix'}, f.comoDizer) : null,
    f.exES !== '—' ? el('div', {style:'margin-top:8px'},
      el('div', {class:'es'}, f.exES), el('div', {class:'pt', style:'font-size:14px'}, f.exPT)) : null,
    el('div', {class:'row', style:'margin-top:8px'},
      btnSom(f.exES),
      el('button', {class:'btn sm', onclick:()=>{
        novoCard({front:f.exES, back:f.exPT, tags:['falso amigo'], fonte:f.es+' ≠ '+f.parece});
        novoCard({front:f.es, back:f.significa+'  (≠ '+f.parece+')', tags:['falso amigo'], fonte:'Falsos amigos'});
        alert('Adicionado ao Anki (palavra + frase).');
      }}, '+ Anki')));
}

/* ---------- ABA: TEMÁTICO ---------- */
let temaSel = 'odonto', subSel = 'todos';
function renderTema() {
  const sec = $('#tab-tema'); sec.replaceChildren();
  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Vocabulário temático'),
    el('p', {class:'sub'}, `${TEMATICO.length} termos com frase de exemplo, divididos nos quatro mundos que você vai usar.`),
    el('div', {class:'chips'}, ...['odonto','negocios','viajes','rutina'].map(t =>
      el('button', {class:'chip', 'aria-pressed':temaSel===t, onclick:()=>{ temaSel=t; subSel='todos'; renderTema(); }}, TEMAS[t])))));

  const doTema = TEMATICO.filter(t => t.tema === temaSel);
  const subs = [...new Set(doTema.map(t => t.sub))];
  const lista = doTema.filter(t => subSel === 'todos' || t.sub === subSel);
  const dom = doTema.filter(t => vStat(t.es) === 2).length;

  const box = el('div', {class:'card'},
    el('h2', {}, TEMAS[temaSel]),
    barra(dom/doTema.length*100, dom===doTema.length),
    el('p', {class:'sub', style:'margin-top:8px'}, `${dom} de ${doTema.length} marcadas como dominadas`),
    el('div', {class:'chips'}, ...[['todos','Tudo'],...subs.map(s=>[s,s])].map(([k,rot]) =>
      el('button', {class:'chip', 'aria-pressed':subSel===k, onclick:()=>{ subSel=k; renderTema(); }}, rot))));
  for (const t of lista) {
    box.append(el('div', {class:'fa'},
      el('div', {class:'row', style:'justify-content:space-between'},
        el('span', {}, el('span', {class:'es', style:'font-size:17px'}, t.es), ' ',
          el('span', {class:'pt'}, '· '+t.pt)),
        el('span', {class:'row'},
          el('span', {class:'tag', title:classeSem(t.sim).dica}, classeSem(t.sim).label), btnSom(t.es))),
      t.exES ? el('div', {style:'margin-top:6px'},
        el('div', {}, t.exES), el('div', {class:'pt', style:'font-size:14px'}, t.exPT)) : null,
      el('div', {class:'row', style:'margin-top:8px'},
        el('button', {class:'btn sm', onclick:(e)=>{
          const novo = (vStat(t.es)+1)%3; setVocab(t.es, novo); e.target.textContent = ['marcar','aprendendo','dominada'][novo];
        }}, ['marcar','aprendendo','dominada'][vStat(t.es)]),
        t.exES ? el('button', {class:'btn sm', onclick:()=>{
          novoCard({front:t.exES, back:t.exPT, tags:[temaSel], fonte:t.es}); alert('Frase adicionada ao Anki.');
        }}, '+ Anki') : null,
        t.exES ? btnSom(t.exES) : null)));
  }
  sec.append(box);
  sec.append(el('div', {class:'card'},
    el('button', {class:'btn primary', onclick:()=>{
      const r = lista.filter(t => t.exES && !temCard(t.exES)).slice(0,25);
      r.forEach(t => novoCard({front:t.exES, back:t.exPT, tags:[temaSel], fonte:t.es}));
      alert(`${r.length} frases enviadas ao Anki.`);
    }}, `+ Mandar 25 frases de ${TEMAS[temaSel]} para o Anki`)));
}

/* ---------- QUIZ genérico ---------- */
function embaralhar(a) { const b=a.slice(); for (let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
const quizEstado = {};
function quizBox(chave, poolFn) {
  const q = quizEstado[chave] || (quizEstado[chave] = {acertos:0, erros:0, atual:null, dir:'es-pt'});
  const box = el('div', {class:'card'});
  function novaPergunta() {
    const pool = poolFn();
    if (pool.length < 4) { box.replaceChildren(el('div',{class:'empty'},'Poucas palavras para o quiz.')); return; }
    const certo = pool[Math.floor(Math.random()*pool.length)];
    const opcoes = embaralhar([certo, ...embaralhar(pool.filter(w=>w!==certo)).slice(0,3)]);
    q.atual = certo;
    const pergunta = q.dir === 'es-pt' ? certo.es : certo.pt;
    box.replaceChildren(
      el('h2', {}, 'Quiz relâmpago'),
      el('div', {class:'row', style:'justify-content:space-between'},
        el('p', {class:'sub', style:'margin:0'}, `✓ ${q.acertos} · ✕ ${q.erros}`),
        el('button', {class:'btn sm ghost', onclick:()=>{ q.dir = q.dir==='es-pt'?'pt-es':'es-pt'; novaPergunta(); }},
          q.dir==='es-pt' ? 'ES → PT' : 'PT → ES')),
      el('div', {class:'flash', style:'min-height:90px'},
        el('div', {class:'q'}, pergunta),
        q.dir==='es-pt' ? btnSom(certo.es) : null),
      el('div', {class:'grid g2', style:'margin-top:10px'},
        ...opcoes.map(o => el('button', {class:'btn', style:'text-align:left', onclick:(e)=>{
          const acertou = o === certo;
          if (acertou) { q.acertos++; if (vStat(certo.es)<2) setVocab(certo.es, 2); }
          else { q.erros++; setVocab(certo.es, 1);
            novoCard({front:certo.es, back:certo.pt, tags:['errei'], fonte:'Quiz'}); }
          e.target.style.borderColor = acertou ? 'var(--ok)' : 'var(--accent)';
          setTimeout(novaPergunta, acertou ? 380 : 1400);
          if (!acertou) box.append(el('p', {class:'sub', style:'text-align:center'},
            `Era: ${certo.es} = ${certo.pt} — card criado no Anki.`));
        }}, q.dir==='es-pt' ? o.pt : o.es))));
  }
  novaPergunta();
  return box;
}
function quizFalsos() {
  const q = quizEstado.falsos || (quizEstado.falsos = {acertos:0, erros:0});
  const box = el('div', {class:'card'});
  function nova() {
    const certo = FALSOS[Math.floor(Math.random()*FALSOS.length)];
    const distratores = embaralhar(FALSOS.filter(f=>f!==certo)).slice(0,3);
    const opcoes = embaralhar([certo.significa, ...distratores.map(d=>d.significa)]);
    box.replaceChildren(
      el('h2', {}, 'Quiz: o que significa de verdade?'),
      el('p', {class:'sub'}, `✓ ${q.acertos} · ✕ ${q.erros}`),
      el('div', {class:'flash', style:'min-height:90px'}, el('div', {class:'q'}, certo.es), btnSom(certo.es)),
      el('div', {class:'grid g2', style:'margin-top:10px'},
        ...opcoes.map(o => el('button', {class:'btn', style:'text-align:left', onclick:(e)=>{
          const ok = o === certo.significa;
          ok ? q.acertos++ : q.erros++;
          e.target.style.borderColor = ok ? 'var(--ok)' : 'var(--accent)';
          if (!ok) {
            novoCard({front:certo.es, back:certo.significa+'  (≠ '+certo.parece+')', tags:['falso amigo','errei'], fonte:'Quiz'});
            box.append(el('p', {class:'sub', style:'text-align:center'},
              `${certo.es} = ${certo.significa}. Parece "${certo.parece}", mas não é.`));
          }
          setTimeout(nova, ok ? 400 : 1800);
        }}, o))));
  }
  nova();
  return box;
}

/* ---------- ABA: CONVERSA ---------- */
function renderConversa() {
  const sec = $('#tab-conversa'); sec.replaceChildren();
  const p = planoDoDia();
  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Conduzir a conversa'),
    el('p', {class:'sub'}, 'Não é vocabulário: é o esqueleto que segura uma conversa de pé enquanto você procura a palavra.')));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Tarefa oral de hoje'),
    el('p', {class:'sub'}, 'Grave 60–90 segundos no celular, sem consultar nada. Depois ouça e anote o que faltou.'),
    el('div', {class:'notice'},
      el('b', {}, `Tema: ${TEMAS[p.temaDoDia]}`), el('br'),
      tarefaOral(p))));

  for (const g of CONVERSA.guiones) {
    sec.append(el('div', {class:'card'},
      el('div', {class:'row', style:'justify-content:space-between'},
        el('h2', {style:'margin:0'}, g.titulo), tagTema(g.tema)),
      el('h3', {}, 'Roteiro'),
      ...g.lineas.map(l => el('div', {class:'frase', onclick:()=>falar(l)},
        el('div', {class:'row', style:'justify-content:space-between'},
          el('span', {class:'es'}, l), btnSom(l)))),
      el('h3', {}, 'Perguntas que você faz (para o outro falar)'),
      el('ul', {style:'margin:0;padding-left:20px'}, ...g.preguntas.map(q => el('li', {}, q))),
      el('button', {class:'btn sm', style:'margin-top:10px', onclick:()=>{
        g.lineas.forEach(l => novoCard({front:l, back:'(roteiro: '+g.titulo+')', tags:['roteiro'], fonte:g.titulo}));
        alert('Roteiro adicionado ao Anki.');
      }}, '+ Roteiro para o Anki')));
  }

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Muletas para ganhar tempo'),
    el('p', {class:'sub'}, 'Quem tem estas na ponta da língua nunca trava — e soa fluente mesmo errando.'),
    el('div', {class:'list'}, ...CONVERSA.muletas.map(m =>
      el('div', {class:'item'},
        el('div', {class:'main'}, el('span', {class:'es'}, m.es),
          el('span', {class:'pt'}, m.pt + ' · ' + m.uso)),
        btnSom(m.es))))));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Conectores'),
    el('p', {class:'sub'}, 'Ligam duas ideias e transformam frases soltas em argumento.'),
    el('div', {class:'list'}, ...CONVERSA.conectores.map(c =>
      el('div', {class:'item'}, el('div', {class:'main'},
        el('span', {class:'es'}, c.es), el('span', {class:'pt'}, c.pt)), btnSom(c.es))))));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Erros que denunciam o brasileiro'),
    el('p', {class:'sub'}, 'Corrigir estes dez pontos vale mais que decorar cem palavras.'),
    ...CONVERSA.armadilhas.map(a => el('div', {class:'fa'},
      el('div', {class:'w', style:'font-size:15px'}, a.regra),
      el('div', {class:'es', style:'margin-top:6px'}, a.es),
      el('div', {class:'pt', style:'font-size:14px'}, a.pt)))));
}
function tarefaOral(p) {
  const tarefas = {
    odonto: 'Explique, em espanhol, um plano de tratamento completo para um paciente que chegou com dor. Diga o diagnóstico, o que vai fazer, quanto tempo leva e o que ele deve fazer em casa.',
    negocios: 'Apresente os números do seu mês e defenda uma decisão: um preço, uma contratação ou um investimento. Use pelo menos três conectores.',
    viajes: 'Conte uma viagem: o que deu errado, como você resolveu e o que faria diferente. Sem consultar o texto.',
    rutina: 'Descreva sua semana real, do acordar ao dormir, e termine dizendo o que você mudaria nela.',
  };
  return tarefas[p.temaDoDia];
}

/* ---------- ABA: PROGRESSO ---------- */
function renderProgreso() {
  const sec = $('#tab-progreso'); sec.replaceChildren();
  const d = indiceDia();
  const dias = Object.entries(S.dias).sort();
  const totalMin = dias.reduce((a,[,v]) => a + (v.min||0), 0);
  const totalRev = dias.reduce((a,[,v]) => a + (v.revisados||0), 0);
  const diasAtivos = dias.filter(([,v]) => v.min > 0 || v.revisados > 0).length;
  const vistas = FREQ.filter(w => vStat(w.es) > 0).length;
  const dom = FREQ.filter(w => vStat(w.es) === 2).length;
  const temDom = TEMATICO.filter(w => vStat(w.es) === 2).length;
  const cards = Object.values(S.cards);
  const maduros = cards.filter(c => estagio(c) === 'maduro').length;

  sec.append(el('div', {class:'card'},
    el('h2', {}, `Dia ${d+1} de 90`),
    barra((d+1)/90*100),
    el('p', {class:'sub', style:'margin-top:10px'},
      `Início em ${fmtData(S.inicio)} · meta em ${fmtData(addDias(S.inicio, 89))}`),
    el('div', {class:'grid g3', style:'margin-top:8px'},
      stat(streak(), 'dias seguidos'),
      stat(diasAtivos, 'dias estudados'),
      stat(Math.round(totalMin/60*10)/10 + 'h', 'tempo total'))));

  /* termômetro de prontidão */
  const notas = prontidao({vistas, dom, temDom, maduros, diasAtivos, totalRev});
  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Termômetro de conversa'),
    el('p', {class:'sub'}, 'Estimativa de quão perto você está de conduzir uma conversa com confiança nos quatro temas.'),
    el('div', {class:'timer', style:'font-size:44px'}, notas.total + '%'),
    barra(notas.total, notas.total >= 80),
    el('p', {class:'sub', style:'margin-top:12px'}, notas.veredito),
    el('div', {class:'overflow'}, el('table', {},
      el('tr', {}, el('th', {}, 'Componente'), el('th', {}, 'Onde você está'), el('th', {}, 'Peso')),
      ...notas.itens.map(i => el('tr', {},
        el('td', {}, i.nome), el('td', {}, i.valor), el('td', {}, i.peso+'%')))))));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Vocabulário'),
    el('div', {class:'grid g2'},
      el('div', {},
        el('h3', {}, `1000 palavras · ${vistas}/${FREQ.length}`), barra(vistas/FREQ.length*100),
        el('p', {class:'sub', style:'margin-top:6px'}, `${dom} dominadas`)),
      el('div', {},
        el('h3', {}, `Temático · ${temDom}/${TEMATICO.length}`), barra(temDom/TEMATICO.length*100),
        el('p', {class:'sub', style:'margin-top:6px'}, 'odonto + negócios + viagens + rotina'))),
    el('h3', {}, 'Por grau de semelhança com o português'),
    el('div', {class:'overflow'}, el('table', {},
      el('tr', {}, el('th', {}, 'Tipo'), el('th', {}, 'Total'), el('th', {}, 'Vistas'), el('th', {}, 'Dominadas')),
      ...CLASSES_SEM.map(c => {
        const g = FREQ.filter(w => w.simClasse === c.id);
        return el('tr', {}, el('td', {}, c.label), el('td', {}, g.length),
          el('td', {}, g.filter(w=>vStat(w.es)>0).length), el('td', {}, g.filter(w=>vStat(w.es)===2).length));
      })))));

  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Anki'),
    el('div', {class:'grid g3'},
      stat(cards.length, 'cards'), stat(maduros, 'maduros'), stat(totalRev, 'revisões totais')),
    el('h3', {}, 'Distribuição'),
    el('div', {class:'overflow'}, el('table', {},
      el('tr', {}, el('th', {}, 'Estágio'), el('th', {}, 'Cards'), el('th', {}, 'Significado')),
      ...[['novo','nunca revisado'],['aprendendo','em ciclo curto'],['jovem','1 a 20 dias'],['maduro','21 dias ou mais']]
        .map(([k,expl]) => el('tr', {}, el('td', {}, k),
          el('td', {}, cards.filter(c=>estagio(c)===k).length), el('td', {class:'pt'}, expl)))))));

  /* histórico 30 dias */
  const ult = [];
  for (let i = 29; i >= 0; i--) { const iso = addDias(hoje(), -i); ult.push([iso, S.dias[iso]?.min || 0]); }
  const max = Math.max(S.meta, ...ult.map(([,m]) => m));
  sec.append(el('div', {class:'card'},
    el('h2', {}, 'Últimos 30 dias'),
    el('p', {class:'sub'}, 'Minutos registrados por dia. Constância vale mais que maratona.'),
    el('div', {class:'spark'}, ...ult.map(([iso,m]) =>
      el('i', {class: m ? '' : 'z', style:`height:${m ? Math.max(6, m/max*100) : 4}%`, title:`${fmtData(iso)}: ${m} min`}))),
    el('div', {class:'row', style:'justify-content:space-between;margin-top:6px'},
      el('span', {class:'sub'}, fmtData(ult[0][0])), el('span', {class:'sub'}, 'hoje'))));

  sec.append(configBox());
}
function streak() {
  let n = 0, iso = hoje();
  const ativo = (i) => { const v = S.dias[i]; return v && (v.min > 0 || v.revisados > 0); };
  if (!ativo(iso)) iso = addDias(iso, -1);
  while (ativo(iso)) { n++; iso = addDias(iso, -1); }
  return n;
}
function prontidao({vistas, dom, temDom, maduros, diasAtivos, totalRev}) {
  const itens = [
    {nome:'Núcleo das 1000 palavras', peso:25, p: Math.min(1, vistas/FREQ.length), valor:`${vistas}/${FREQ.length} vistas`},
    {nome:'Vocabulário temático dominado', peso:20, p: Math.min(1, temDom/200), valor:`${temDom} termos`},
    {nome:'Frases maduras no Anki', peso:25, p: Math.min(1, maduros/250), valor:`${maduros} de 250`},
    {nome:'Volume de revisão', peso:15, p: Math.min(1, totalRev/2000), valor:`${totalRev} revisões`},
    {nome:'Constância', peso:15, p: Math.min(1, diasAtivos/75), valor:`${diasAtivos} de 75 dias`},
  ];
  const total = Math.round(itens.reduce((a,i) => a + i.p * i.peso, 0));
  const veredito =
    total >= 85 ? 'Você já sustenta uma conversa longa nos quatro temas. Foque em nuance e velocidade.' :
    total >= 65 ? 'Você conduz uma conversa com apoio das muletas. Aumente as frases maduras no Anki.' :
    total >= 40 ? 'Base montada. O gargalo agora é volume de frases revisadas, não vocabulário novo.' :
    total >= 15 ? 'Começo consistente. Não pule a revisão do Anki — é ela que fixa.' :
    'Fase inicial. Mantenha os 60 minutos e o número sobe sozinho.';
  return {itens, total, veredito};
}
function configBox() {
  const inicio = el('input', {type:'date', value:S.inicio, onchange:(e)=>{ S.inicio = e.target.value; salvar(); renderProgreso(); atualizarPills(); }});
  const novas = el('input', {type:'number', min:5, max:40, value:S.novasPorDia,
    onchange:(e)=>{ S.novasPorDia = Math.max(5, Math.min(40, +e.target.value||15)); salvar(); }});
  return el('div', {class:'card'},
    el('h2', {}, 'Configuração e backup'),
    el('p', {class:'sub'}, 'Seus dados ficam só neste navegador. Exporte de vez em quando — se você limpar o Safari, tudo se perde.'),
    el('div', {class:'grid g2'},
      el('div', {}, el('label', {class:'fld'}, 'Data de início'), inicio),
      el('div', {}, el('label', {class:'fld'}, 'Palavras novas por dia'), novas)),
    el('div', {class:'row', style:'margin-top:12px'},
      el('button', {class:'btn primary', onclick:exportar}, '⬇︎ Exportar backup'),
      el('button', {class:'btn', onclick:importar}, '⬆︎ Importar backup'),
      el('button', {class:'btn ghost', onclick:()=>{
        if (confirm('Apagar TODO o progresso e recomeçar? Isto não tem volta.')) {
          localStorage.removeItem(CHAVE); location.reload();
        }
      }}, 'Zerar tudo')),
    el('p', {class:'sub', style:'margin-top:12px'},
      'Dica: no Safari do iPhone, toque em Compartilhar → "Adicionar à Tela de Início" para abrir como app.'));
}
function exportar() {
  const blob = new Blob([JSON.stringify(S, null, 1)], {type:'application/json'});
  const a = el('a', {href:URL.createObjectURL(blob), download:`espanol90-${hoje()}.json`});
  document.body.append(a); a.click(); a.remove();
}
function importar() {
  const inp = el('input', {type:'file', accept:'.json', style:'display:none'});
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const novo = JSON.parse(r.result);
        if (!novo.cards || !novo.vocab) throw new Error('formato');
        S = {...clonar(ESTADO_PADRAO), ...novo};
        salvar(); alert('Backup restaurado.'); location.reload();
      } catch (e) { alert('Arquivo inválido.'); }
    };
    r.readAsText(f);
  });
  document.body.append(inp); inp.click(); inp.remove();
}

/* ---------- roteador e boot ---------- */
const RENDER = {hoy:renderHoy, lectura:renderLectura, anki:renderAnki, mil:renderMil,
  falsos:renderFalsos, tema:renderTema, conversa:renderConversa, progreso:renderProgreso};

function atualizarPills() {
  $('#pill-streak').textContent = `🔥 ${plural(streak(),'dia','dias')}`;
  const dev = cardsDevidos().length;
  $('#pill-dia').textContent = dev ? `${dev} p/ revisar` : 'revisão em dia';
}
document.addEventListener('keydown', (e) => {
  if (abaAtual !== 'anki' || e.target.matches('input,textarea,select')) return;
  if (e.key === ' ' && !mostrandoResposta) { e.preventDefault(); mostrandoResposta = true; renderAnki(); }
  else if (mostrandoResposta && ['1','2','3','4'].includes(e.key) && cardAtual) {
    e.preventDefault(); avaliar(cardAtual, +e.key - 1);
    cardAtual = null; mostrandoResposta = false; renderAnki(); atualizarPills();
  }
});
(function boot() {
  if (S.ultimoAcesso !== hoje()) { S.ultimoAcesso = hoje(); salvar(); }
  montarNav();
  const h = location.hash.replace('#','');
  irPara(ABAS.some(a => a.id === h) ? h : 'hoy');
  atualizarPills();
})();
