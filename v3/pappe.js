// Pappa Tracker v3 — sezione Pappe: il gradimento della pappa intera.
//
// Una «pappa» qui è una combinazione di alimenti (pastina + zucchina + grana). Lo storico
// la raggruppa per alimenti, senza guardare l'ordine, e conta i giudizi di ogni bambino.
// Niente quantità, niente grammature, niente orari: solo cosa c'era e se è piaciuta.
//
// Il DOM si tocca solo dentro disegna(), piu() e i gestori degli eventi:
// con Node il modulo si importa e le funzioni pure si provano.

import { registraSezione, apriTendina, chiudiTendina, avviso, BAMBINI, SIGLA, isoOggi } from './app.js';
import { stato, pappe, scriviGiudizio, onCambio } from './dati.js';

// ─── catalogo ───────────────────────────────────────────────────────────────

export const CATEGORIE = [
  { id: 'carb',  nome: 'Carboidrati', emoji: '🍚' },
  { id: 'prot',  nome: 'Proteine',    emoji: '🐟' },
  { id: 'veg',   nome: 'Verdure',     emoji: '🥦' },
  { id: 'fat',   nome: 'Grassi',      emoji: '🫒' },
  { id: 'fruit', nome: 'Frutta',      emoji: '🍎' },
];

// Gli alimenti della v2: FOOD_PRESETS più FRUIT_PRESETS (v2/index.html righe 476-543),
// stessi id, nomi ed emoji. I `customFruits` dello storico NON entrano qui: sono frasi
// che descrivono pappe intere («30 g di zucchine e patate»), non alimenti.
export const ALIMENTI = [
  { id: 'riso',         cat: 'carb',  nome: 'Riso',               emoji: '🍚' },
  { id: 'pastina',      cat: 'carb',  nome: 'Pastina',            emoji: '🍝' },
  { id: 'semolino',     cat: 'carb',  nome: 'Semolino',           emoji: '🥣' },
  { id: 'mais_tapioca', cat: 'carb',  nome: 'Mais e tapioca',     emoji: '🌽' },
  { id: 'pane',         cat: 'carb',  nome: 'Pane',               emoji: '🍞' },
  { id: 'cous_cous',    cat: 'carb',  nome: 'Cous cous',          emoji: '🌾' },
  { id: 'orzo',         cat: 'carb',  nome: 'Orzo',               emoji: '🌾' },
  { id: 'miglio',       cat: 'carb',  nome: 'Miglio',             emoji: '🌾' },
  { id: 'avena',        cat: 'carb',  nome: 'Avena',              emoji: '🥣' },
  { id: 'orata',        cat: 'prot',  nome: 'Orata',              emoji: '🐟' },
  { id: 'merluzzo',     cat: 'prot',  nome: 'Merluzzo',           emoji: '🐟' },
  { id: 'sogliola',     cat: 'prot',  nome: 'Sogliola',           emoji: '🐟' },
  { id: 'sgombro',      cat: 'prot',  nome: 'Sgombro',            emoji: '🐟' },
  { id: 'salmone',      cat: 'prot',  nome: 'Salmone',            emoji: '🍣' },
  { id: 'tonno',        cat: 'prot',  nome: 'Tonno',              emoji: '🐟' },
  { id: 'pollo',        cat: 'prot',  nome: 'Pollo',              emoji: '🍗' },
  { id: 'tacchino',     cat: 'prot',  nome: 'Tacchino',           emoji: '🦃' },
  { id: 'manzo',        cat: 'prot',  nome: 'Manzo',              emoji: '🥩' },
  { id: 'coniglio',     cat: 'prot',  nome: 'Coniglio',           emoji: '🐰' },
  { id: 'agnello',      cat: 'prot',  nome: 'Agnello',            emoji: '🐑' },
  { id: 'lenticchie',   cat: 'prot',  nome: 'Lenticchie',         emoji: '🫘' },
  { id: 'ceci',         cat: 'prot',  nome: 'Ceci',               emoji: '🫛' },
  { id: 'tuorlo',       cat: 'prot',  nome: 'Tuorlo',             emoji: '🥚' },
  { id: 'ricotta',      cat: 'prot',  nome: 'Ricotta',            emoji: '🧀' },
  { id: 'yogurt',       cat: 'prot',  nome: 'Yogurt',             emoji: '🥛' },
  { id: 'grana',        cat: 'prot',  nome: 'Grana / Parmigiano', emoji: '🧀' },
  { id: 'zucchina',     cat: 'veg',   nome: 'Zucchina',           emoji: '🥒' },
  { id: 'carota',       cat: 'veg',   nome: 'Carota',             emoji: '🥕' },
  { id: 'patata',       cat: 'veg',   nome: 'Patata',             emoji: '🥔' },
  { id: 'zucca',        cat: 'veg',   nome: 'Zucca',              emoji: '🎃' },
  { id: 'fagiolini',    cat: 'veg',   nome: 'Fagiolini',          emoji: '🫛' },
  { id: 'piselli',      cat: 'veg',   nome: 'Piselli',            emoji: '🟢' },
  { id: 'spinaci',      cat: 'veg',   nome: 'Spinaci',            emoji: '🥬' },
  { id: 'bietola',      cat: 'veg',   nome: 'Bietola',            emoji: '🥬' },
  { id: 'finocchio',    cat: 'veg',   nome: 'Finocchio',          emoji: '🌿' },
  { id: 'broccolo',     cat: 'veg',   nome: 'Broccolo',           emoji: '🥦' },
  { id: 'cavolfiore',   cat: 'veg',   nome: 'Cavolfiore',         emoji: '🥦' },
  { id: 'pomodoro',     cat: 'veg',   nome: 'Pomodoro',           emoji: '🍅' },
  { id: 'sedano',       cat: 'veg',   nome: 'Sedano',             emoji: '🌿' },
  { id: 'porro',        cat: 'veg',   nome: 'Porro',              emoji: '🧅' },
  { id: 'olio_evo',     cat: 'fat',   nome: 'Olio EVO',           emoji: '🫒' },
  { id: 'banana',       cat: 'fruit', nome: 'Banana',             emoji: '🍌' },
  { id: 'pera',         cat: 'fruit', nome: 'Pera',               emoji: '🍐' },
  { id: 'mela',         cat: 'fruit', nome: 'Mela',               emoji: '🍎' },
  { id: 'pesca',        cat: 'fruit', nome: 'Pesca',              emoji: '🍑' },
  { id: 'albicocca',    cat: 'fruit', nome: 'Albicocca',          emoji: '🟠' },
  { id: 'kiwi',         cat: 'fruit', nome: 'Kiwi',               emoji: '🥝' },
  { id: 'uva',          cat: 'fruit', nome: 'Uva',                emoji: '🍇' },
  { id: 'fragola',      cat: 'fruit', nome: 'Fragola',            emoji: '🍓' },
  { id: 'mirtilli',     cat: 'fruit', nome: 'Mirtilli',           emoji: '🫐' },
  { id: 'arancia',      cat: 'fruit', nome: 'Arancia',            emoji: '🍊' },
  { id: 'melone',       cat: 'fruit', nome: 'Melone',             emoji: '🍈' },
  { id: 'mango',        cat: 'fruit', nome: 'Mango',              emoji: '🥭' },
  { id: 'avocado',      cat: 'fruit', nome: 'Avocado',            emoji: '🥑' },
];

export const GIUDIZI = {
  good: { e: '👍', l: 'Piaciuta' },
  ok:   { e: '😐', l: 'Così così' },
  bad:  { e: '👎', l: 'No' },
};

const PER_ID = new Map(ALIMENTI.map((a, i) => [a.id, { ...a, posto: i }]));

/** Gli alimenti personalizzati dello storico (stato.data.customFoods): solo da leggere. */
function personalizzato(id) {
  const lista = stato.data && Array.isArray(stato.data.customFoods) ? stato.data.customFoods : [];
  return lista.find((c) => c && typeof c === 'object' && c.id === id && c.name);
}

/**
 * Un alimento dal suo id: prima i preset, poi i personalizzati dello storico, in lettura.
 * Un id che non è né l'uno né l'altro (testo libero del vecchio registro frutta) torna col
 * nome uguale all'id e l'emoji generica. I personalizzati NON entrano in ALIMENTI.
 */
export function alimento(id) {
  const a = PER_ID.get(id);
  if (a) return { id: a.id, nome: a.nome, emoji: a.emoji, cat: a.cat };
  const c = personalizzato(id);
  if (c) return { id, nome: String(c.name), emoji: c.emoji || '🍽️', cat: c.cat };
  return { id, nome: id, emoji: '🍽️' };
}

/** Vero se l'id è un alimento vero (preset o personalizzato) e non una frase libera. */
function alimentoNoto(id) {
  return PER_ID.has(id) || !!personalizzato(id);
}

// ─── pappe, chiavi e nomi ───────────────────────────────────────────────────

/** La chiave di una combinazione: gli id ordinati, uniti da '+'. L'ordine non conta. */
export function chiavePappa(alimenti) {
  return [...new Set(alimenti)].sort().join('+');
}

/** Il nome di una combinazione, nell'ordine in cui arrivano gli alimenti. */
export function nomePappa(alimenti) {
  return alimenti.map((id) => alimento(id).nome).join(' + ');
}

// Per mostrare una riga sempre uguale, gli alimenti vanno in ordine di catalogo:
// carboidrati, proteine, verdure, grassi, frutta. Gli sconosciuti vanno in fondo.
function inOrdineDiCatalogo(alimenti) {
  const posto = (id) => (PER_ID.has(id) ? PER_ID.get(id).posto : Infinity);
  return [...new Set(alimenti)].sort((a, b) => posto(a) - posto(b) || a.localeCompare(b));
}

/** Il punteggio di una pappa: good +1, ok 0, bad −1, diviso il numero dei giudizi. */
export function punteggio(conteggi) {
  const n = conteggi.good + conteggi.ok + conteggi.bad;
  if (n === 0) return 0;
  return (conteggi.good - conteggi.bad) / n;
}

/**
 * Dove sta una pappa: con meno di due giudizi è «poche»; poi «gradite» se il punteggio
 * è sopra zero, «rivedere» se è sotto zero, «neutre» se è zero (tutti così così,
 * oppure pareri che si annullano). Un esito neutro non è un giudizio negativo.
 */
export function gruppo(conteggi) {
  const n = conteggi.good + conteggi.ok + conteggi.bad;
  if (n < 2) return 'poche';
  const p = punteggio(conteggi);
  if (p > 0) return 'gradite';
  return p < 0 ? 'rivedere' : 'neutre';
}

function conteggiVuoti() {
  return { good: 0, ok: 0, bad: 0 };
}

/**
 * Tutte le pappe dello storico, una riga per combinazione di alimenti, dalla più gradita.
 * `conteggi` ha una voce per bambino e una `totale`; punteggio e gruppo guardano il totale.
 * `soloLettura` è vero se la riga contiene id che non sono alimenti (frasi libere dello storico).
 */
export function elenco() {
  const righe = new Map();
  for (const p of pappe()) {
    if (!p.alimenti.length) continue;
    const chiave = chiavePappa(p.alimenti);
    let r = righe.get(chiave);
    if (!r) {
      const alimenti = inOrdineDiCatalogo(p.alimenti);
      r = {
        chiave, alimenti, nome: nomePappa(alimenti), conteggi: { totale: conteggiVuoti() },
        // Una frase libera del vecchio registro frutta non è un alimento: la riga si legge e basta.
        soloLettura: !alimenti.every(alimentoNoto),
      };
      for (const b of BAMBINI) r.conteggi[b] = conteggiVuoti();
      righe.set(chiave, r);
    }
    if (GIUDIZI[p.giudizio] && r.conteggi[p.bambino]) {
      r.conteggi[p.bambino][p.giudizio] += 1;
      r.conteggi.totale[p.giudizio] += 1;
    }
  }
  const lista = [...righe.values()];
  for (const r of lista) {
    r.punteggio = punteggio(r.conteggi.totale);
    r.gruppo = gruppo(r.conteggi.totale);
  }
  const quanti = (r) => r.conteggi.totale.good + r.conteggi.totale.ok + r.conteggi.totale.bad;
  return lista.sort(
    (a, b) => b.punteggio - a.punteggio || quanti(b) - quanti(a) || a.nome.localeCompare(b.nome, 'it')
  );
}

// ─── disegno ────────────────────────────────────────────────────────────────

const BLOCCHI = [
  { gruppo: 'gradite',  titolo: 'Le più gradite' },
  { gruppo: 'rivedere', titolo: 'Da rivedere' },
  { gruppo: 'neutre',   titolo: 'Così così' },
  { gruppo: 'poche',    titolo: 'Ancora poche prove' },
];

function esc(testo) {
  return String(testo).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function iniziale(bambino) {
  return bambino.charAt(0).toUpperCase();
}

/** Il giudizio che un bambino ha già dato a questa combinazione in un giorno, o ''. */
function giudizioDelGiorno(bambino, iso, chiave) {
  let trovato = '';
  for (const p of pappe()) {
    if (p.iso === iso && p.bambino === bambino && p.giudizio && chiavePappa(p.alimenti) === chiave) trovato = p.giudizio;
  }
  return trovato;
}

/** Il giudizio più frequente di un bambino su una pappa, con quante volte: {giudizio, n} o null. */
function dominante(c) {
  let meglio = null;
  for (const g of ['good', 'ok', 'bad']) {
    if (c[g] > 0 && (!meglio || c[g] > meglio.n)) meglio = { giudizio: g, n: c[g] };
  }
  return meglio;
}

function rigaHtml(r) {
  const emoji = r.alimenti.slice(0, 4).map((id) => alimento(id).emoji).join('');
  const pillole = BAMBINI.map((b) => {
    const d = dominante(r.conteggi[b]);
    return d ? `<span class="pill-like ${SIGLA[b]}">${GIUDIZI[d.giudizio].e} ${d.n}</span>` : '';
  }).join('');
  const tocca = r.soloLettura ? ' sola-lettura' : '';
  return `<div class="meal card${tocca}"${r.soloLettura ? '' : ' role="button"'} data-chiave="${esc(r.chiave)}">` +
    `<span class="em">${esc(emoji)}</span><span class="nm">${esc(r.nome)}</span>` +
    `<span class="st">${pillole}</span></div>`;
}

function facceHtml(bambino, scelto) {
  const facce = Object.entries(GIUDIZI).map(([g, v]) =>
    `<div class="face${g === scelto ? ' sel' : ''}" data-giudizio="${g}">` +
    `<span class="e">${v.e}</span><span class="t">${esc(v.l)}</span></div>`
  ).join('');
  return `<div class="judge ${SIGLA[bambino]}" data-bambino="${esc(bambino)}">` +
    `<span class="who ${SIGLA[bambino]}">${iniziale(bambino)}</span><div class="faces">${facce}</div></div>`;
}

// Un tocco che parte e finisce sullo stesso elemento, senza trascinare: serve per le righe
// e per le icone, che stanno in liste che scorrono. Un pointerdown secco aprirebbe la
// tendina a ogni scorrimento.
function sulTocco(radice, selettore, f) {
  let giu = null;
  radice.addEventListener('pointerdown', (e) => {
    const t = e.target.closest(selettore);
    giu = t ? { t, x: e.clientX, y: e.clientY } : null;
  });
  radice.addEventListener('pointerup', (e) => {
    const g = giu;
    giu = null;
    if (!g || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) return;
    if (e.target.closest(selettore) === g.t) f(g.t);
  });
  radice.addEventListener('pointercancel', () => { giu = null; });
}

let radiceAttiva = null;
let righeAttive = new Map();

function riempi(radice) {
  const righe = elenco();
  righeAttive = new Map(righe.map((r) => [r.chiave, r]));
  radice.textContent = '';
  if (!righe.length) {
    const invito = document.createElement('div');
    invito.className = 'card vuoto';
    invito.textContent = 'Ancora nessuna pappa. Tocca + per aggiungerne una.';
    radice.append(invito);
    return;
  }
  let html = '';
  for (const b of BLOCCHI) {
    const dentro = righe.filter((r) => r.gruppo === b.gruppo);
    if (dentro.length) html += `<div class="sect">${b.titolo}</div>` + dentro.map(rigaHtml).join('');
  }
  radice.innerHTML = html;
}

function disegna(contenitore) {
  const radice = document.createElement('div');
  radice.className = 'pp';
  riempi(radice);
  sulTocco(radice, '.meal:not(.sola-lettura)', (riga) => apriGiudizio(righeAttive.get(riga.dataset.chiave)));
  contenitore.textContent = '';
  contenitore.append(radice);
  radiceAttiva = radice;
  daRidisegnare = false;
  osservaTendina();
}

// I dati arrivano dopo il disegno e ogni scrittura li cambia. Si ridisegna solo la lista,
// mai la tendina. Finché la tendina è aperta la lista non si tocca: le righe non cambiano
// posto sotto le dita e niente sfarfalla. Il ridisegno rimandato parte alla chiusura.
let daRidisegnare = false;
let osservatore = null;

function elTendina() {
  return typeof document !== 'undefined' ? document.getElementById('tendina') : null;
}

function osservaTendina() {
  const t = elTendina();
  if (!t || osservatore) return;
  osservatore = new MutationObserver(() => {
    if (!t.hidden || !daRidisegnare) return;
    daRidisegnare = false;
    if (radiceAttiva && radiceAttiva.isConnected) riempi(radiceAttiva);
  });
  osservatore.observe(t, { attributes: true, attributeFilter: ['hidden'] });
}

onCambio(() => {
  if (!radiceAttiva || !radiceAttiva.isConnected) return;
  const t = elTendina();
  if (t && !t.hidden) {
    daRidisegnare = true;
    return;
  }
  riempi(radiceAttiva);
});

// ─── tendina del giudizio ───────────────────────────────────────────────────

// Accende la faccina toccata e spegne le altre della stessa fila. Niente ricostruzione.
function accendi(faccia) {
  const fila = faccia.closest('.judge');
  for (const f of fila.querySelectorAll('.face')) f.classList.toggle('sel', f === faccia);
}

function tuttiHannoRisposto(radice) {
  return BAMBINI.every((b) => radice.querySelector(`.judge[data-bambino="${b}"] .face.sel`));
}

function chiudiSeFinito(radice) {
  if (!tuttiHannoRisposto(radice)) return;
  setTimeout(() => { if (radice.isConnected) chiudiTendina(); }, 240);
}

function apriGiudizio(riga) {
  if (!riga || riga.soloLettura) return;
  const oggi = isoOggi();
  const html = `<div class="pp pp-giudizio">` +
    BAMBINI.map((b) => facceHtml(b, giudizioDelGiorno(b, oggi, riga.chiave))).join('') + `</div>`;
  const tendina = apriTendina(html, { titolo: riga.nome, sotto: "Com'è andata oggi?" });
  const radice = tendina.querySelector('.pp-giudizio');
  radice.addEventListener('pointerdown', (e) => {
    const faccia = e.target.closest('.face');
    if (!faccia || faccia.classList.contains('sel')) return;
    accendi(faccia);
    scriviGiudizio(faccia.closest('.judge').dataset.bambino, isoOggi(), riga.alimenti, faccia.dataset.giudizio);
    chiudiSeFinito(radice);
  });
}

// ─── pappa nuova (il + dell'intestazione) ───────────────────────────────────

function composizioneHtml() {
  const gruppi = CATEGORIE.map((c) => {
    const icone = ALIMENTI.filter((a) => a.cat === c.id).map((a) =>
      `<div class="ico" role="button" data-id="${esc(a.id)}"><span class="e">${a.emoji}</span><span class="t">${esc(a.nome)}</span></div>`
    ).join('');
    return `<div class="cat-t">${c.emoji} ${esc(c.nome)}</div><div class="icone">${icone}</div>`;
  }).join('');
  return `<div class="pp pp-nuova">` +
    `<div class="comp-nome vuoto-nome">Tocca gli alimenti della pappa</div>` +
    `<div class="griglia">${gruppi}</div>` +
    BAMBINI.map((b) => facceHtml(b, '')).join('') + `</div>`;
}

function apriNuova() {
  const tendina = apriTendina(composizioneHtml(), { titolo: 'Pappa nuova', sotto: "Scegli cosa c'era, poi com'è andata" });
  const radice = tendina.querySelector('.pp-nuova');
  const nome = radice.querySelector('.comp-nome');
  const scelti = () => [...radice.querySelectorAll('.ico.on')].map((i) => i.dataset.id);
  let bloccata = false;

  sulTocco(radice, '.ico', (icona) => {
    if (bloccata) {
      avviso('Gli alimenti sono già salvati. Chiudi e tocca + per una pappa nuova.');
      return;
    }
    icona.classList.toggle('on');
    const ids = scelti();
    nome.textContent = ids.length ? nomePappa(ids) : 'Tocca gli alimenti della pappa';
    nome.classList.toggle('vuoto-nome', !ids.length);
  });

  radice.addEventListener('pointerdown', (e) => {
    const faccia = e.target.closest('.face');
    if (!faccia || faccia.classList.contains('sel')) return;
    const ids = scelti();
    if (!ids.length) {
      avviso('Scegli prima gli alimenti.');
      return;
    }
    bloccata = true;
    radice.classList.add('fermo');
    accendi(faccia);
    scriviGiudizio(faccia.closest('.judge').dataset.bambino, isoOggi(), ids, faccia.dataset.giudizio);
    chiudiSeFinito(radice);
  });
}

registraSezione('pappe', {
  titolo: 'Pappe',
  sotto: 'cosa gli piace',
  disegna,
  piu: apriNuova,
});
