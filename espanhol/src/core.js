/* ---------- Español 90 · núcleo ---------- */
const DB = window.DB; // injetado no build

/* ---------- utilidades ---------- */
const $ = (s, r=document) => r.querySelector(s);
const el = (t, a={}, ...kids) => {
  const n = document.createElement(t);
  for (const [k,v] of Object.entries(a)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false)
    n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
};
const hoje = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
const diaISO = (d) => d.toLocaleDateString('sv-SE');
const addDias = (iso, n) => { const d = new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return diaISO(d); };
const diffDias = (a, b) => Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00'))/864e5);
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z ]/g,'');
const fmtData = (iso) => new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});

/* semelhança PT/ES — Levenshtein normalizado */
function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({length:n+1}, (_,i)=>i), cur = new Array(n+1);
  for (let i=1;i<=m;i++){
    cur[0]=i;
    for (let j=1;j<=n;j++)
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1]===b[j-1]?0:1));
    [prev,cur] = [cur,prev];
  }
  return prev[n];
}
function semelhanca(es, pt) {
  const a = norm(es), b = norm(pt.split(/[,/(]/)[0].trim());
  if (!a || !b) return 0;
  return 1 - lev(a,b) / Math.max(a.length, b.length);
}
const CLASSES_SEM = [
  {id:'identica', label:'Idêntica',   min:.95, dica:'Palavra de graça — só cuidado com a pronúncia.'},
  {id:'quase',    label:'Quase igual',min:.75, dica:'Muda pouco: atenção à letra que troca.'},
  {id:'parecida', label:'Parecida',   min:.50, dica:'Dá para deduzir, mas erre uma vez e vira vício.'},
  {id:'diferente',label:'Diferente',  min:0,   dica:'Prioridade máxima: não dá para adivinhar.'},
];
const classeSem = (v) => CLASSES_SEM.find(c => v >= c.min);

/* ---------- carga dos dados ---------- */
function parseLinhas(txt, campos) {
  return txt.trim().split('\n').filter(Boolean).map(l => {
    const p = l.split('|');
    const o = {};
    campos.forEach((c,i) => o[c] = (p[i]||'').trim());
    return o;
  });
}
const FREQ = parseLinhas(DB.frequencia, ['es','pt','classe']).map((w,i) => {
  const sim = semelhanca(w.es, w.pt);
  return {...w, rank:i+1, id:'f'+i, sim, simClasse: classeSem(sim).id};
});
const FALSOS = parseLinhas(DB.falsos, ['es','parece','significa','comoDizer','exES','exPT','tema'])
  .map((f,i) => ({...f, id:'x'+i}));
const TEMATICO = parseLinhas(DB.tematico, ['es','pt','tema','sub','exES','exPT']).map((t,i) => {
  const sim = semelhanca(t.es, t.pt);
  return {...t, id:'t'+i, sim, simClasse: classeSem(sim).id};
});
const LECTURAS = DB.lecturas.slice().sort((a,b) => a.id.localeCompare(b.id));
const CONVERSA = DB.conversa;
const TEMAS = {odonto:'Odontologia', negocios:'Negócios', viajes:'Viagens', rutina:'Rotina', geral:'Geral'};

/* índice palavra -> objeto, usado para marcar vocabulário */
const VOCAB_ALL = [
  ...FREQ.map(w => ({...w, fonte:'freq'})),
  ...TEMATICO.map(w => ({...w, fonte:'tema'})),
];

/* ---------- estado ---------- */
const clonar = (o) => JSON.parse(JSON.stringify(o));
const CHAVE = 'esp90.v1';
const ESTADO_PADRAO = {
  inicio: hoje(),
  meta: 60,                 // minutos/dia
  novasPorDia: 15,          // palavras da lista de 1000 por dia
  vocab: {},                // es -> {s:0|1|2, v:vistas, u:ultimaISO}
  cards: {},                // id -> card SRS
  dias: {},                 // ISO -> {min, blocos:{}, revisados, novas, cardsNovos}
  lecturasFeitas: {},       // idLeitura -> ISO
  ultimoAcesso: hoje(),
  tema: 'auto',
  v: 1,
};
let S = carregar();

function carregar() {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return clonar(ESTADO_PADRAO);
    const s = JSON.parse(raw);
    return {...clonar(ESTADO_PADRAO), ...s};
  } catch (e) { return clonar(ESTADO_PADRAO); }
}
let salvarPend = null;
function salvar() {
  clearTimeout(salvarPend);
  salvarPend = setTimeout(() => {
    try { localStorage.setItem(CHAVE, JSON.stringify(S)); } catch (e) {}
  }, 120);
}
function dia(iso = hoje()) {
  if (!S.dias[iso]) S.dias[iso] = {min:0, blocos:{}, revisados:0, novas:0, cardsNovos:0};
  return S.dias[iso];
}

/* ---------- vocabulário ---------- */
function vStat(es) { return S.vocab[es]?.s ?? 0; }
function verVocab(es) {
  const v = S.vocab[es] || (S.vocab[es] = {s:0, v:0, u:''});
  if (v.u !== hoje()) { v.v++; v.u = hoje(); if (v.s === 0) { v.s = 1; dia().novas++; } }
  salvar();
}
function setVocab(es, s) {
  const v = S.vocab[es] || (S.vocab[es] = {s:0, v:0, u:''});
  v.s = s; v.u = hoje(); salvar();
}
const contaVocab = (lista, s) => lista.filter(w => vStat(w.es) === s).length;

/* ---------- SRS (SM-2 adaptado) ---------- */
const INTERVALOS_NOVOS = [0, 1, 3];   // aprendendo: hoje -> +1d -> +3d
function novoCard({front, back, tags=[], fonte='', extra=''}) {
  const id = 'c' + (front + '|' + back).split('').reduce((h,c)=>((h<<5)-h+c.charCodeAt(0))|0, 0);
  if (S.cards[id]) return S.cards[id];
  S.cards[id] = {id, front, back, tags, fonte, extra,
    ef:2.5, int:0, passo:0, due:hoje(), reps:0, lapsos:0, criado:hoje()};
  dia().cardsNovos++;
  salvar();
  return S.cards[id];
}
function temCard(front) {
  return Object.values(S.cards).some(c => c.front === front);
}
function avaliar(card, nota) { // 0 de novo, 1 difícil, 2 bom, 3 fácil
  const c = card;
  c.reps++;
  if (nota === 0) {
    c.lapsos++; c.passo = 0; c.int = 0; c.ef = Math.max(1.3, c.ef - 0.2);
    c.due = hoje();
  } else if (c.passo < INTERVALOS_NOVOS.length - 1 && c.int === 0) {
    c.passo++;
    const d = INTERVALOS_NOVOS[c.passo] || 1;
    c.due = addDias(hoje(), nota === 3 ? Math.max(d,2) : d);
    if (c.passo >= INTERVALOS_NOVOS.length - 1) c.int = INTERVALOS_NOVOS[c.passo];
  } else {
    const q = [0, 3, 4, 5][nota];
    c.ef = Math.max(1.3, c.ef + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)));
    const base = c.int || 3;
    let f = nota === 1 ? 1.25 : nota === 3 ? c.ef * 1.35 : c.ef;
    c.int = Math.max(1, Math.round(base * f));
    c.due = addDias(hoje(), c.int);
  }
  dia().revisados++;
  salvar();
}
const cardsDevidos = () => Object.values(S.cards)
  .filter(c => c.due <= hoje())
  .sort((a,b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.reps - b.reps));
const estagio = (c) => c.int >= 21 ? 'maduro' : c.int > 0 ? 'jovem' : c.reps ? 'aprendendo' : 'novo';

/* ---------- plano do dia (determinístico) ---------- */
function indiceDia(iso = hoje()) { return Math.max(0, diffDias(S.inicio, iso)); }
function planoDoDia(iso = hoje()) {
  const d = indiceDia(iso);
  const n = S.novasPorDia;
  const ini = (d * n) % FREQ.length;
  const mil = [];
  for (let i = 0; i < n; i++) mil.push(FREQ[(ini + i) % FREQ.length]);
  const temaDoDia = ['odonto','negocios','odonto','viajes','odonto','rutina','negocios'][d % 7];
  const pool = TEMATICO.filter(t => t.tema === temaDoDia);
  const tem = [];
  for (let i = 0; i < 8; i++) tem.push(pool[(d * 8 + i) % pool.length]);
  const fal = [FALSOS[(d*3) % FALSOS.length], FALSOS[(d*3+1) % FALSOS.length], FALSOS[(d*3+2) % FALSOS.length]];
  const lec = LECTURAS[d % LECTURAS.length];
  return {d, mil, tem, fal, lec, temaDoDia, ciclo: Math.floor((d*n)/FREQ.length) + 1};
}
const BLOCOS = [
  {id:'anki',  min:12, titulo:'Revisão Anki',           desc:'Frases devidas hoje. Fale em voz alta antes de virar a carta.', aba:'anki'},
  {id:'lect',  min:15, titulo:'Leitura do dia',          desc:'Leia em voz alta, traduza mentalmente e mande 4–8 frases para o Anki.', aba:'lectura'},
  {id:'mil',   min:12, titulo:'Lote das 1000 palavras',  desc:'Passe pelas palavras novas do dia e marque o que já domina.', aba:'mil'},
  {id:'falso', min:8,  titulo:'Falsos amigos',           desc:'3 armadilhas do dia. Diga a frase-exemplo em voz alta.', aba:'falsos'},
  {id:'tema',  min:8,  titulo:'Vocabulário temático',    desc:'Bloco do dia: odontologia, negócios, viagens ou rotina.', aba:'tema'},
  {id:'fala',  min:5,  titulo:'Produção oral',           desc:'Grave 60–90 s falando sobre o tema do dia. Sem consultar nada.', aba:'conversa'},
];
