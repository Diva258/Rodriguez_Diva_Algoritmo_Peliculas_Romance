// =====================
// 1) Datos (edítalos)
// =====================
// Mantiene la lógica original: lista de items + segmentos + contextos + Elo.

const peliculas = [
  "Pride & Prejudice (2005)",
  "The Notebook (2004)",
  "La La Land (2016)",
  "Before Sunrise (1995)",
  "Titanic (1997)",
  "Me Before You (2016)",
  "Notting Hill (1999)",
  "10 Things I Hate About You (1999)",
  "Crazy Rich Asians (2018)",
  "A Star Is Born (2018)",
  "About Time (2013)",
  "Eternal Sunshine of the Spotless Mind (2004)",
  "The Proposal (2009)",
  "Pretty Woman (1990)",
  "Call Me by Your Name (2017)",
  "500 Days of Summer (2009)",
];

// Segmentos = “tipo de gusto romántico”
const segmentos = {
  "CL": "Romance clásico / elegante",
  "RC": "Rom-com / divertido",
  "DR": "Drama romántico (llorar)",
  "IN": "Indie / reflexivo",
  "CI": "Plan: cita en pareja",
};

// Contextos = “para qué recomendar”
const contextos = {
  "CITA": "¿Cuál recomiendas más para una CITA perfecta?",
  "LLORAR": "¿Cuál recomiendas más para EMOCIONARTE / llorar?",
  "LIGERO": "¿Cuál recomiendas más para reír y pasarla LIGERO?",
  "INOLV": "¿Cuál recomiendas más como historia de amor INOLVIDABLE?",
};

// Elo
const RATING_INICIAL = 1000;
const K = 32;

// =====================
// 2) Estado + storage
// =====================
const STORAGE_KEY = "romancemash_state_v1";

function defaultState(){
  const buckets = {};
  for (const seg of Object.keys(segmentos)){
    for (const ctx of Object.keys(contextos)){
      const key = `${seg}__${ctx}`;
      buckets[key] = {};
      peliculas.forEach(p => buckets[key][p] = RATING_INICIAL);
    }
  }
  return { buckets, votes: [] };
}

function loadState(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try { return JSON.parse(raw); }
  catch { return defaultState(); }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// =====================
// 3) Utilidades Elo
// =====================
function expectedScore(ra, rb){
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

function updateElo(bucket, itemA, itemB, winner){ // winner: "A" o "B"
  const ra = bucket[itemA], rb = bucket[itemB];
  const ea = expectedScore(ra, rb);
  const eb = expectedScore(rb, ra);

  const sa = (winner === "A") ? 1 : 0;
  const sb = (winner === "B") ? 1 : 0;

  bucket[itemA] = ra + K * (sa - ea);
  bucket[itemB] = rb + K * (sb - eb);
}

function randomPair(){
  const a = peliculas[Math.floor(Math.random() * peliculas.length)];
  let b = a;
  while (b === a){
    b = peliculas[Math.floor(Math.random() * peliculas.length)];
  }
  return [a, b];
}

function bucketKey(seg, ctx){ return `${seg}__${ctx}`; }

function topN(bucket, n=10){
  const arr = Object.entries(bucket).map(([pelicula, rating]) => ({pelicula, rating}));
  arr.sort((x,y) => y.rating - x.rating);
  return arr.slice(0, n);
}

// =====================
// 4) UI Wiring
// =====================
const segmentSelect = document.getElementById("segmentSelect");
const contextSelect = document.getElementById("contextSelect");
const questionEl = document.getElementById("question");
const labelA = document.getElementById("labelA");
const labelB = document.getElementById("labelB");
const btnA = document.getElementById("btnA");
const btnB = document.getElementById("btnB");
const btnNewPair = document.getElementById("btnNewPair");
const btnShowTop = document.getElementById("btnShowTop");
const topBox = document.getElementById("topBox");
const btnReset = document.getElementById("btnReset");
const btnExport = document.getElementById("btnExport");

let currentA = null;
let currentB = null;

function fillSelect(selectEl, obj){
  selectEl.innerHTML = "";
  for (const [k, v] of Object.entries(obj)){
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${k} — ${v}`;
    selectEl.appendChild(opt);
  }
}

fillSelect(segmentSelect, segmentos);
fillSelect(contextSelect, contextos);

// defaults
segmentSelect.value = "CL";
contextSelect.value = "CITA";

function refreshQuestion(){
  questionEl.textContent = contextos[contextSelect.value];
}

function newDuel(){
  [currentA, currentB] = randomPair();
  labelA.textContent = currentA;
  labelB.textContent = currentB;
  refreshQuestion();
}

function renderTop(){
  const seg = segmentSelect.value;
  const ctx = contextSelect.value;
  const bucket = state.buckets[bucketKey(seg, ctx)];

  const rows = topN(bucket, 10);
  topBox.innerHTML = rows.map((r, idx) => `
    <div class="toprow">
      <div><b>${idx+1}.</b> ${r.pelicula}</div>
      <div>${r.rating.toFixed(1)}</div>
    </div>
  `).join("");
}

function vote(winner){ // "A" o "B"
  const seg = segmentSelect.value;
  const ctx = contextSelect.value;
  const key = bucketKey(seg, ctx);
  const bucket = state.buckets[key];

  updateElo(bucket, currentA, currentB, winner);

  const ganador = (winner === "A") ? currentA : currentB;
  const perdedor = (winner === "A") ? currentB : currentA;

  state.votes.push({
    ts: new Date().toISOString(),
    segmento: segmentos[seg],
    contexto: contextos[ctx],
    A: currentA,
    B: currentB,
    ganador,
    perdedor
  });

  saveState();
  renderTop();
  newDuel();
}

btnA.addEventListener("click", () => vote("A"));
btnB.addEventListener("click", () => vote("B"));
btnNewPair.addEventListener("click", () => newDuel());
btnShowTop.addEventListener("click", () => renderTop());

segmentSelect.addEventListener("change", () => { renderTop(); refreshQuestion(); });
contextSelect.addEventListener("change", () => { renderTop(); refreshQuestion(); });

btnReset.addEventListener("click", () => {
  if (!confirm("Esto borrará rankings y votos guardados en este navegador. ¿Continuar?")) return;
  state = defaultState();
  saveState();
  renderTop();
  newDuel();
});

btnExport.addEventListener("click", () => {
  if (state.votes.length === 0){
    alert("Aún no hay votos para exportar.");
    return;
  }

  const headers = ["ts","segmento","contexto","A","B","ganador","perdedor"];
  const lines = [headers.join(",")];

  for (const v of state.votes){
    const row = headers.map(h => {
      const val = String(v[h] ?? "").replaceAll('"','""');
      return `"${val}"`;
    }).join(",");
    lines.push(row);
  }

  const blob = new Blob([lines.join("\n")], {type: "text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "romancemash_votos.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
});

// init
newDuel();
renderTop();
refreshQuestion();
