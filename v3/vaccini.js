// Pappa Tracker v3 — sezione Vaccini: cronologia, ricerca, aggiunta a mano.
//
// Una iniezione, una voce: l'esavalente è una riga con sotto le sei malattie.
// I dati vengono da dati.js (vaccini()) e si scrivono solo con scriviVaccini().
// Questo modulo non tocca `document` al caricamento: solo dentro disegna(), piu()
// e i gestori degli eventi. Così il suo test gira anche con Node.

import {
  BAMBINI, SIGLA, registraSezione, apriTendina, chiudiTendina, avviso, dataLunga, isoOggi,
} from './app.js';
import { vaccini, scriviVaccini, onCambio } from './dati.js';
import { NASCITA, TERMINE, etaScritta, isoDi } from './crescita.js';

// ── testo sicuro ───────────────────────────────────────────────────────────
// Le voci aggiunte a mano contengono testo libero: ogni pezzo scritto in pagina
// passa da esc(). Per questo evidenzia() non cerca dentro il testo già escapato.

function esc(testo) {
  return String(testo == null ? '' : testo)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;

// ── dati puri: nessun DOM ──────────────────────────────────────────────────

function elenco(sedute) { return Array.isArray(sedute) ? sedute : []; }
function vociDi(seduta) { return seduta && Array.isArray(seduta.voci) ? seduta.voci : []; }

/** I pezzi di testo che si leggono sotto il nome della voce, senza l'etichetta «lotto». */
function partiVoce(v) {
  const p = [];
  if (v.tipo === 'profilassi') p.push('profilassi');
  if (v.prodotto && v.prodotto !== v.nome) p.push(v.prodotto);
  if (v.sigla) p.push(v.sigla);
  if (v.via === 'bocca') p.push('per bocca');
  return p;
}

/** Le malattie da mostrare come etichette: nessuna se è solo il nome ripetuto. */
function copreVisibile(v) {
  const c = Array.isArray(v.copre) ? v.copre.filter(Boolean) : [];
  if (c.length === 1 && String(c[0]).toLowerCase() === String(v.nome || '').toLowerCase()) return [];
  return c;
}

function pagliaio(v) {
  const c = Array.isArray(v.copre) ? v.copre : [];
  // L'etichetta «lotto» non si cerca: la parola «lotto» le troverebbe tutte.
  return [v.nome, ...partiVoce(v), v.lotto, ...c].filter(Boolean).join(' ').toLowerCase();
}

export function contaVoci(sedute) {
  const s = elenco(sedute);
  return { sedute: s.length, somministrazioni: s.reduce((n, x) => n + vociDi(x).length, 0) };
}

/** Le sedute che hanno almeno una voce che corrisponde, con dentro solo quelle voci. */
export function cerca(sedute, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  const tutte = elenco(sedute);
  if (!q) return tutte.map((s) => ({ ...s, voci: vociDi(s).slice() }));
  const trovate = [];
  for (const s of tutte) {
    const voci = vociDi(s).filter((v) => pagliaio(v).includes(q));
    if (voci.length) trovate.push({ ...s, voci });
  }
  return trovate;
}

/** Testo pronto per la pagina, con <mark> sulle parti che corrispondono alla query. */
export function evidenzia(testo, query) {
  const t = String(testo == null ? '' : testo);
  const q = String(query == null ? '' : query).trim();
  if (!q) return esc(t);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let fuori = '';
  let fine = 0;
  let m;
  while ((m = re.exec(t)) !== null) {
    if (m[0].length === 0) { re.lastIndex += 1; continue; }
    fuori += esc(t.slice(fine, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
    fine = m.index + m[0].length;
  }
  return fuori + esc(t.slice(fine));
}

function rigaVoce(v, q) {
  const icona = v.tipo === 'profilassi' ? '🛡️' : v.via === 'bocca' ? '💧' : '💉';
  const parti = partiVoce(v).map((p) => evidenzia(p, q));
  if (v.lotto) parti.push('lotto ' + evidenzia(v.lotto, q));
  const sotto = parti.length ? `<div class="sub">${parti.join(' · ')}</div>` : '';
  const copre = copreVisibile(v);
  const chip = copre.length
    ? `<div class="covers">${copre.map((c) => `<i>${evidenzia(c, q)}</i>`).join('')}</div>` : '';
  const dose = v.dose != null && v.dose !== '' ? `<div class="dose">${esc(v.dose)}ª</div>` : '';
  // `vax` resta il gancio della somministrazione; `vx-riga` dice che è una riga
  // dentro la scheda della giornata, non una scheda per conto suo.
  return `<div class="vax vx-riga"><div class="ic">${icona}</div>`
    + `<div class="nm">${evidenzia(v.nome, q)}${sotto}${chip}</div>${dose}</div>`;
}

/** HTML di una seduta intera: data, età anagrafica e corretta, una riga per voce. */
export function rigaSeduta(seduta, query) {
  const q = query || '';
  const dataBuona = DATA_OK.test(String(seduta.data));
  const data = dataBuona ? dataLunga(seduta.data) : esc(seduta.data);
  let eta = '';
  if (dataBuona) {
    eta = `${esc(etaScritta(NASCITA, seduta.data))} · corretta: ${esc(etaScritta(TERMINE, seduta.data))}`;
  }
  const chi = Array.isArray(seduta.bambini) ? seduta.bambini : [];
  if (chi.length && chi.length < BAMBINI.length) {
    eta += (eta ? ' · ' : '') + 'solo ' + chi.map(esc).join(' e ');
  }
  const righe = vociDi(seduta).map((v) => rigaVoce(v, q)).join('');
  return `<div class="tl-day"><div class="tl-rail"><div class="tl-pin"></div><div class="tl-line"></div></div>`
    + `<div class="tl-body"><div class="tl-date">${data}</div><div class="tl-age">${eta}</div>`
    + (righe ? `<div class="card vx-voci">${righe}</div>` : '')
    + `</div></div>`;
}

/** La cronologia dalla seduta più recente. Con dati vuoti o ricerca senza risultati, dice perché. */
export function cronologia(dati, query) {
  const q = String(query == null ? '' : query).trim();
  const sedute = dati ? elenco(dati.sedute) : [];
  if (!sedute.length) {
    return `<div class="card vuoto">Nessun vaccino ancora.<br>Tocca + per aggiungerne uno.</div>`;
  }
  const trovate = cerca(sedute, q).sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (!trovate.length) {
    return `<div class="card vuoto">Nessun risultato per «${esc(q)}»</div>`;
  }
  return trovate.map((s) => rigaSeduta(s, q)).join('');
}

function testa(dati) {
  const c = contaVoci(dati && dati.sedute);
  if (!c.sedute) return '';
  const tutti = BAMBINI.every((b) => elenco(dati.sedute).some((s) => (s.bambini || []).includes(b)));
  let badge = '';
  if (dati.stato) {
    const pezzi = [];
    if (dati.emessoDa) pezzi.push('Certificato ' + dati.emessoDa);
    if (dati.aggiornatoAl && DATA_OK.test(dati.aggiornatoAl)) pezzi.push('emesso il ' + dataLunga(dati.aggiornatoAl));
    badge = `<div class="ok-badge"><div class="ic">✓</div><div><b>${esc(dati.stato)}${tutti ? ', tutti e due' : ''}</b>`
      + `<span>${esc(pezzi.join(' · '))}</span></div></div>`;
  }
  const s = c.sedute === 1 ? '1 seduta' : `${c.sedute} sedute`;
  const n = c.somministrazioni === 1 ? '1 somministrazione' : `${c.somministrazioni} somministrazioni`;
  return `${badge}<div class="sect">${s} · ${n}</div>`;
}

/** Controlla la data scelta nel modulo. Torna il testo dell'errore, o '' se va bene. */
export function controllaData(data, oggi) {
  const d = String(data || '');
  if (!DATA_OK.test(d) || isoDi(new Date(d + 'T00:00:00')) !== d) return 'Scegli la data.';
  if (d < NASCITA) return 'La data è prima della nascita.';
  if (d > oggi) return 'La data è nel futuro.';
  return '';
}

/**
 * Compone i dati nuovi con una voce in più, senza toccare l'originale.
 * Una seduta è una data con i suoi bambini: se esiste già, la voce entra lì;
 * altrimenti nasce una seduta nuova. Le sedute restano in ordine di data.
 */
export function aggiungiVoce(dati, data, bambini, voce) {
  const nuovo = dati ? JSON.parse(JSON.stringify(dati)) : {};
  const sedute = elenco(nuovo.sedute);
  const chi = BAMBINI.filter((b) => bambini.includes(b));
  const stessa = sedute.find((s) => s.data === data
    && JSON.stringify(BAMBINI.filter((b) => (s.bambini || []).includes(b))) === JSON.stringify(chi));
  if (stessa) {
    stessa.voci = vociDi(stessa).concat([voce]);
  } else {
    sedute.push({ data, bambini: chi, voci: [voce] });
    sedute.sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }
  nuovo.sedute = sedute;
  return nuovo;
}

/** Aggiunge una voce ai dati sincronizzati: compone con aggiungiVoce e scrive con scriviVaccini. */
export function salvaVoce(data, bambini, voce) {
  scriviVaccini(aggiungiVoce(vaccini(), data, bambini, voce));
}

// ── schermata ──────────────────────────────────────────────────────────────

let attiva = null; // { radice, aggiorna } della schermata in pagina, se c'è

onCambio(() => {
  if (attiva && attiva.radice.isConnected) attiva.aggiorna();
});

function disegna(contenitore) {
  const radice = document.createElement('div');
  radice.innerHTML =
    `<div class="search"><span class="vx-lente" aria-hidden="true">🔍</span>`
    + `<input type="text" class="vx-q" placeholder="Cerca vaccino, malattia, lotto…" autocomplete="off" `
    + `autocapitalize="off" spellcheck="false" enterkeyhint="search" aria-label="Cerca">`
    + `<span class="vx-x" role="button" aria-label="Cancella la ricerca" hidden>✕</span></div>`
    + `<div class="src vx-conto" hidden></div>`
    + `<div class="vx-testa"></div><div class="vx-lista"></div>`
    + `<div class="vx-programma"><div class="sect">In programma</div>`
    + `<div class="card vuoto">Niente in programma.<br>Mandami il foglio degli appuntamenti<br>e li aggiungo qui.</div></div>`;
  const q = radice.querySelector('.vx-q');
  const x = radice.querySelector('.vx-x');
  const conto = radice.querySelector('.vx-conto');
  const elTesta = radice.querySelector('.vx-testa');
  const lista = radice.querySelector('.vx-lista');
  const programma = radice.querySelector('.vx-programma');

  // Aggiorna sul posto le zone che cambiano. La barra di ricerca non si tocca mai:
  // ricostruirla farebbe perdere il fuoco e la tastiera.
  function aggiorna() {
    const dati = vaccini();
    const testoRicerca = q.value.trim();
    elTesta.innerHTML = testoRicerca ? '' : testa(dati);
    lista.innerHTML = cronologia(dati, testoRicerca);
    programma.hidden = !!testoRicerca;
    x.hidden = !q.value;
    // L'intestazione sta nel guscio: all'avvio i dati arrivano dopo il primo disegno.
    const elSotto = document.getElementById('sotto');
    if (elSotto) elSotto.textContent = sotto();
    if (testoRicerca && dati) {
      const n = contaVoci(cerca(dati.sedute, testoRicerca)).somministrazioni;
      conto.textContent = n === 1 ? '1 somministrazione trovata' : `${n} somministrazioni trovate`;
      conto.hidden = false;
    } else {
      conto.hidden = true;
    }
  }

  q.addEventListener('input', aggiorna);
  x.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // il campo tiene il fuoco
    q.value = '';
    aggiorna();
    q.focus();
  });

  attiva = { radice, aggiorna };
  aggiorna();
  contenitore.append(radice);
}

// ── aggiunta a mano ────────────────────────────────────────────────────────

function campo(id, etichetta, attributi) {
  return `<label class="vx-campo"><span class="lbl">${etichetta}</span><input id="${id}" ${attributi || 'type="text"'} autocomplete="off"></label>`;
}

function formAggiunta() {
  return `<div class="vx-form">`
    + `<div class="who-pick vx-chi">`
    + BAMBINI.map((b) => `<b class="${SIGLA[b]}" data-chi="${b}">${b}</b>`).join('')
    + `<b class="on" data-chi="tutti">Tutti e due</b></div>`
    + campo('vx-data', 'Data', `type="date" value="${isoOggi()}" min="${NASCITA}" max="${isoOggi()}"`)
    + campo('vx-nome', 'Nome (per esempio Esavalente)')
    + campo('vx-prodotto', 'Prodotto (facoltativo)')
    + `<div class="vx-due">`
    + campo('vx-dose', 'Dose (facoltativa)', 'type="number" inputmode="numeric" min="1" max="20"')
    + campo('vx-lotto', 'Lotto (facoltativo)')
    + `</div>`
    + campo('vx-copre', 'Malattie coperte, separate da virgola (facoltative)')
    + `<div class="seg vx-tipo"><b class="on" data-tipo="vaccino">Vaccino</b><b data-tipo="profilassi">Profilassi</b></div>`
    + `<div class="save vx-salva" role="button" tabindex="0" style="margin-top:14px">Aggiungi</div>`
    + `</div>`;
}

/** Legge il modulo e compone la voce. Torna un testo d'errore, oppure { data, bambini, voce }. */
function leggiForm(t) {
  const val = (id) => t.querySelector('#' + id).value.trim();
  const data = val('vx-data');
  const erroreData = controllaData(data, isoOggi());
  if (erroreData) return { errore: erroreData };
  const nome = val('vx-nome');
  if (!nome) return { errore: 'Scrivi il nome del vaccino.' };
  const scelto = t.querySelector('.vx-chi b.on').dataset.chi;
  const bambini = scelto === 'tutti' ? BAMBINI.slice() : [scelto];
  const voce = { nome };
  const prodotto = val('vx-prodotto');
  if (prodotto) voce.prodotto = prodotto;
  const dose = parseInt(val('vx-dose'), 10);
  if (Number.isFinite(dose) && dose > 0) voce.dose = dose;
  const lotto = val('vx-lotto');
  if (lotto) voce.lotto = lotto;
  voce.tipo = t.querySelector('.vx-tipo b.on').dataset.tipo;
  voce.via = 'iniezione';
  voce.copre = val('vx-copre').split(/[,;]/).map((c) => c.trim()).filter(Boolean);
  return { data, bambini, voce };
}

function piu() {
  const t = apriTendina(formAggiunta(), {
    titolo: 'Aggiungi un vaccino',
    sotto: 'Si salva nei dati della famiglia, non nel certificato.',
  });
  // Chi e tipo: cambiano sul posto con classList, senza ricostruire il modulo.
  for (const gruppo of ['.vx-chi', '.vx-tipo']) {
    t.querySelector(gruppo).addEventListener('pointerdown', (e) => {
      const b = e.target.closest('b');
      if (!b) return;
      for (const altro of b.parentNode.children) altro.classList.toggle('on', altro === b);
    });
  }
  let fatto = false;
  t.querySelector('.vx-salva').addEventListener('pointerdown', () => {
    if (fatto) return;
    const r = leggiForm(t);
    if (r.errore) { avviso(r.errore); return; }
    fatto = true;
    salvaVoce(r.data, r.bambini, r.voce);
    chiudiTendina();
    avviso('Vaccino aggiunto.');
    if (attiva && attiva.radice.isConnected) attiva.aggiorna();
  });
}

function sotto() {
  const d = vaccini();
  return d && d.aggiornatoAl && DATA_OK.test(d.aggiornatoAl) ? 'aggiornato al ' + dataLunga(d.aggiornatoAl) : '';
}

registraSezione('vaccini', { titolo: 'Vaccini', sotto, disegna, piu });
