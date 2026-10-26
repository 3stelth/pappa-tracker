// Sezione Misure: inserimento, elenco, modifica e cancellazione di peso, lunghezza e
// temperatura.
//
// Al caricamento il modulo non tocca `document`: così i test girano con Node.
// Il DOM si usa solo dentro `disegna`, dentro `piu` e dentro i gestori degli eventi.
//
// Regola della tendina: non si ricostruisce mai a ogni tocco. Chip e pulsanti si
// accendono sul posto con classList.toggle, i numeri cambiano con textContent.

import {
  BAMBINI,
  SIGLA,
  MESI,
  isoOggi,
  dataLunga,
  dataCorta,
  registraSezione,
  registraInserimento,
  apriTendina,
  chiudiTendina,
  avviso,
} from './app.js';
import { pesate, lunghezze, temperature, scriviMisura, cancellaMisura, onCambio } from './dati.js';

export const TIPI = {
  peso:        { nome: 'Peso',        unita: 'kg', emoji: '⚖️', passo: 0.005, scorciatoie: [-0.05, -0.01, 0.01, 0.05], decimali: 3, min: 1,  max: 40 },
  lunghezza:   { nome: 'Lunghezza',   unita: 'cm', emoji: '📏', passo: 0.5,   scorciatoie: [-2, -1, 1, 2],             decimali: 1, min: 30, max: 150 },
  temperatura: { nome: 'Temperatura', unita: '°C', emoji: '🌡️', passo: 0.1,   scorciatoie: [-0.5, -0.1, 0.1, 0.5],     decimali: 1, min: 32, max: 43 },
};

const TUTTI = 'Tutti e due';
const ORDINE_TIPI = ['peso', 'lunghezza', 'temperatura'];

// Quante cifre decimali si scrivono almeno: 8,29 kg, 70 cm, 37,0 °C.
const DECIMALI_MINIMI = { peso: 2, lunghezza: 0, temperatura: 1 };

// Tenere premuto − o +: dopo ATTESA_MS il passo si ripete ogni GIRO_MS. Dopo
// GIRI_LENTI ripetizioni il passo diventa FATTORE volte più grande.
const ATTESA_MS = 500;
const GIRO_MS = 120;
const GIRI_LENTI = 8;
const FATTORE = 5;

const ELENCO_RIGHE = 40;

// ── funzioni pure ──────────────────────────────────────────────────────────

function arrotonda(tipo, valore) {
  const f = 10 ** TIPI[tipo].decimali;
  return Math.round(valore * f) / f;
}

/** Il valore da cui parte il selettore: l'ultima misura di quel tipo, o il centro dell'intervallo. */
export function valorePartenza(tipo, bambino) {
  const t = TIPI[tipo];
  // Con «Tutti e due» si parte dalla misura di Gabriel; se non ne ha, da quella di Vittorio.
  const ordine = bambino === TUTTI || !BAMBINI.includes(bambino) ? BAMBINI : [bambino];
  for (const b of ordine) {
    let ultima;
    if (tipo === 'peso') {
      const l = pesate(b);
      ultima = l.length ? l[l.length - 1].kg : undefined;
    } else if (tipo === 'lunghezza') {
      const l = lunghezze(b);
      ultima = l.length ? l[l.length - 1].cm : undefined;
    } else {
      const l = temperature(b); // dalla più recente
      ultima = l.length ? l[0].temp : undefined;
    }
    if (Number.isFinite(ultima)) return arrotonda(tipo, ultima);
  }
  return arrotonda(tipo, (t.min + t.max) / 2);
}

export function entroLimiti(tipo, valore) {
  const t = TIPI[tipo];
  return Number.isFinite(valore) && valore >= t.min && valore <= t.max;
}

/** Il valore dopo il passo, arrotondato (niente 8,299999) e fermato ai limiti. */
export function passoSicuro(tipo, valore, delta) {
  const t = TIPI[tipo];
  return Math.min(t.max, Math.max(t.min, arrotonda(tipo, valore + delta)));
}

/** Le `quante` misure più recenti, dei tre tipi e dei due bambini mescolati. */
export function ultimeMisure(quante) {
  const tutte = [];
  for (const bambino of BAMBINI) {
    for (const p of pesate(bambino)) {
      tutte.push({ bambino, tipo: 'peso', iso: p.iso, valore: p.kg, id: '', ora: '' });
    }
    for (const l of lunghezze(bambino)) {
      tutte.push({ bambino, tipo: 'lunghezza', iso: l.iso, valore: l.cm, id: '', ora: '' });
    }
    for (const t of temperature(bambino)) {
      tutte.push({ bambino, tipo: 'temperatura', iso: t.iso, valore: t.temp, id: t.id, ora: t.ora });
    }
  }
  tutte.sort(
    (a, b) =>
      b.iso.localeCompare(a.iso) ||
      b.ora.localeCompare(a.ora) ||
      ORDINE_TIPI.indexOf(a.tipo) - ORDINE_TIPI.indexOf(b.tipo) ||
      BAMBINI.indexOf(a.bambino) - BAMBINI.indexOf(b.bambino)
  );
  return tutte.slice(0, quante).map(({ ora, ...m }) => m);
}

/** Il valore scritto per lo schermo: virgola decimale, zeri inutili tolti. */
function testoValore(tipo, valore) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return '—';
  const [intera, dec = ''] = n.toFixed(TIPI[tipo].decimali).split('.');
  let d = dec;
  while (d.length > DECIMALI_MINIMI[tipo] && d.endsWith('0')) d = d.slice(0, -1);
  return d ? intera + ',' + d : intera;
}

function esc(testo) {
  return String(testo).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/** HTML di una riga dell'elenco. I dati per riaprirla stanno negli attributi data-. */
export function rigaMisura(m) {
  const t = TIPI[m.tipo];
  return (
    '<div class="wrow" data-bambino="' + esc(m.bambino) + '" data-tipo="' + esc(m.tipo) +
    '" data-iso="' + esc(m.iso) + '" data-id="' + esc(m.id || '') + '">' +
    '<span class="chip ' + (SIGLA[m.bambino] || '') + '">' + esc(String(m.bambino).charAt(0).toUpperCase()) + '</span>' +
    '<span class="d">' + esc(t.nome) + ' · ' + esc(dataCorta(m.iso)) + '</span>' +
    '<span class="kg">' + testoValore(m.tipo, m.valore) + ' ' + t.unita + '</span>' +
    '</div>'
  );
}

// ── testi ──────────────────────────────────────────────────────────────────

function etichettaScorciatoia(tipo, delta) {
  const segno = delta < 0 ? '−' : '+';
  const t = TIPI[tipo];
  const quanto = Math.abs(delta);
  if (tipo === 'peso') return segno + Math.round(quanto * 1000) + ' g';
  return segno + testoValore(tipo, quanto) + ' ' + t.unita;
}

function testoData(iso) {
  const [, m, g] = iso.split('-');
  const giorno = Number(g) + ' ' + MESI[Number(m) - 1];
  return (iso === isoOggi() ? 'Oggi, ' + giorno : dataLunga(iso)) + ' ›';
}

// ── tendina di inserimento e modifica ──────────────────────────────────────

let ferma = () => {};

function htmlInserimento(f) {
  const scelta = f.modifica
    ? ''
    : '<div class="who-pick">' +
        [...BAMBINI, TUTTI]
          .map((b) => '<b class="' + (SIGLA[b] || '') + (b === f.bambino ? ' on' : '') + '" data-b="' + b + '">' + b + '</b>')
          .join('') +
      '</div>' +
      '<div class="mbtns">' +
        ORDINE_TIPI.map((k) =>
          '<div class="mbtn card' + (k === f.tipo ? ' on' : '') + '" data-t="' + k + '">' +
          '<span class="e">' + TIPI[k].emoji + '</span><span class="t">' + TIPI[k].nome + '</span></div>'
        ).join('') +
      '</div>';
  const t = TIPI[f.tipo];
  return (
    '<div class="ins">' + scelta +
    '<div class="stepper">' +
      '<div class="step-b" data-passo="-1" role="button" aria-label="Meno">−</div>' +
      '<div class="val"><div class="n">' + testoValore(f.tipo, f.valore) + '</div><div class="u">' + t.unita + '</div></div>' +
      '<div class="step-b" data-passo="1" role="button" aria-label="Più">+</div>' +
    '</div>' +
    '<div class="quick">' +
      t.scorciatoie.map((d, i) => '<b data-q="' + i + '">' + etichettaScorciatoia(f.tipo, d) + '</b>').join('') +
    '</div>' +
    '<div class="rowline card">' +
      '<span class="k">Quando</span><span class="v">' + testoData(f.iso) + '</span>' +
      (f.modifica ? '' : '<input class="data" type="date" value="' + esc(f.iso) + '" max="' + isoOggi() + '" aria-label="Data della misura">') +
    '</div>' +
    '<div class="save" role="button">Salva</div>' +
    (f.modifica ? '<div class="elimina" role="button">Cancella</div>' : '') +
    '</div>'
  );
}

/**
 * Apre la tendina. Tutti i campi sono facoltativi:
 * - senza `bambino` vale «Tutti e due», senza `tipo` vale «peso»;
 * - con `iso` e un `bambino` preciso si modifica quella misura (per la temperatura serve anche `id`);
 * - con `iso` e basta, si inserisce in quel giorno.
 */
export function apriInserimento({ tipo, bambino, iso, id } = {}) {
  ferma();
  const f = {
    tipo: TIPI[tipo] ? tipo : 'peso',
    bambino: BAMBINI.includes(bambino) ? bambino : TUTTI,
    iso: iso || isoOggi(),
    id: id || '',
    modifica: !!iso && BAMBINI.includes(bambino),
    toccato: false,
    fatto: false,
    conferma: false,
  };

  if (f.modifica) {
    const trovata = ultimeMisureDi(f.bambino, f.tipo).find(
      (m) => m.iso === f.iso && (f.tipo !== 'temperatura' || m.id === f.id)
    );
    f.valore = trovata ? trovata.valore : valorePartenza(f.tipo, f.bambino);
    f.originale = trovata ? trovata.valore : null;
  } else {
    f.valore = valorePartenza(f.tipo, f.bambino);
  }

  const tendina = apriTendina(htmlInserimento(f), f.modifica
    ? { titolo: 'Modifica misura', sotto: f.bambino + ' · ' + TIPI[f.tipo].nome.toLowerCase() + ' · ' + dataLunga(f.iso) }
    : { titolo: 'Nuova misura' });

  const radice = tendina.querySelector('.ins');
  const elN = radice.querySelector('.val .n');
  const elU = radice.querySelector('.val .u');
  const elData = radice.querySelector('.rowline .v');
  const rapide = [...radice.querySelectorAll('.quick b')];
  const chipBambini = [...radice.querySelectorAll('.who-pick b')];
  const chipTipi = [...radice.querySelectorAll('.mbtn')];
  const elElimina = radice.querySelector('.elimina');
  let orologio = null;
  let orologioConferma = null;

  ferma = () => { clearTimeout(orologio); orologio = null; };

  function mostraValore() { elN.textContent = testoValore(f.tipo, f.valore); }

  function cambiaValore(delta) {
    f.valore = passoSicuro(f.tipo, f.valore, delta);
    f.toccato = true;
    mostraValore();
  }

  function scegliBambino(b) {
    f.bambino = b;
    for (const c of chipBambini) c.classList.toggle('on', c.dataset.b === b);
    if (!f.toccato) { f.valore = valorePartenza(f.tipo, b); mostraValore(); }
  }

  function scegliTipo(k) {
    f.tipo = k;
    f.toccato = false;
    for (const c of chipTipi) c.classList.toggle('on', c.dataset.t === k);
    elU.textContent = TIPI[k].unita;
    TIPI[k].scorciatoie.forEach((d, i) => { rapide[i].textContent = etichettaScorciatoia(k, d); });
    f.valore = valorePartenza(k, f.bambino);
    mostraValore();
  }

  // Un passo subito; se il dito resta giù, dopo ATTESA_MS il passo si ripete e accelera.
  function inizioRipetizione(verso) {
    ferma();
    const passo = TIPI[f.tipo].passo * verso;
    cambiaValore(passo);
    let giri = 0;
    const giro = () => {
      if (!radice.isConnected) { ferma(); return; }
      cambiaValore(passo * (giri >= GIRI_LENTI ? FATTORE : 1));
      giri += 1;
      orologio = setTimeout(giro, GIRO_MS);
    };
    orologio = setTimeout(giro, ATTESA_MS);
  }

  function salva() {
    if (f.fatto) return;
    if (!entroLimiti(f.tipo, f.valore)) {
      const t = TIPI[f.tipo];
      avviso('Il valore deve stare fra ' + testoValore(f.tipo, t.min) + ' e ' + testoValore(f.tipo, t.max) + ' ' + t.unita + '.');
      return;
    }
    f.fatto = true;
    if (f.modifica) {
      // Una misura che non è cambiata non si riscrive: la temperatura perderebbe l'ora.
      if (f.originale !== f.valore) {
        // La temperatura è una lista: riscriverla la aggiungerebbe, quindi si toglie la vecchia.
        if (f.tipo === 'temperatura') cancellaMisura(f.bambino, 'temperatura', f.iso, f.id);
        scriviMisura(f.bambino, f.tipo, f.valore, f.iso);
      }
      avviso('Misura aggiornata.');
    } else {
      for (const b of f.bambino === TUTTI ? BAMBINI : [f.bambino]) scriviMisura(b, f.tipo, f.valore, f.iso);
      avviso('Misura salvata.');
    }
    ferma();
    chiudiTendina();
  }

  function cancella() {
    if (f.fatto) return;
    // Una sola conferma: il primo tocco cambia il pulsante, il secondo cancella.
    if (!f.conferma) {
      f.conferma = true;
      elElimina.classList.add('chiede');
      elElimina.textContent = 'Tocca ancora per cancellare';
      orologioConferma = setTimeout(() => {
        f.conferma = false;
        elElimina.classList.remove('chiede');
        elElimina.textContent = 'Cancella';
      }, 3000);
      return;
    }
    clearTimeout(orologioConferma);
    f.fatto = true;
    cancellaMisura(f.bambino, f.tipo, f.iso, f.id);
    avviso('Misura cancellata.');
    chiudiTendina();
  }

  radice.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-b], [data-t], [data-passo], [data-q], .save, .elimina');
    if (!el || !radice.contains(el)) return;
    if (el.dataset.b) scegliBambino(el.dataset.b);
    else if (el.dataset.t) scegliTipo(el.dataset.t);
    else if (el.dataset.passo) {
      try { el.setPointerCapture(e.pointerId); } catch (errore) { /* il puntatore e gia finito */ }
      inizioRipetizione(Number(el.dataset.passo));
    } else if (el.dataset.q) cambiaValore(TIPI[f.tipo].scorciatoie[Number(el.dataset.q)]);
    else if (el.classList.contains('save')) salva();
    else if (el.classList.contains('elimina')) cancella();
  });
  for (const nomeEvento of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    radice.addEventListener(nomeEvento, ferma);
  }
  // Il tocco lungo sul − o sul + non deve aprire il menu del sistema.
  radice.addEventListener('contextmenu', (e) => e.preventDefault());

  const elInputData = radice.querySelector('input.data');
  if (elInputData) {
    elInputData.addEventListener('change', () => {
      if (!elInputData.value) return;
      f.iso = elInputData.value;
      elData.textContent = testoData(f.iso);
    });
    // Su computer il clic sul campo trasparente non apre da solo il calendario.
    elInputData.addEventListener('click', () => {
      try { elInputData.showPicker(); } catch (errore) { /* il browser lo apre da solo */ }
    });
  }
}

/** Le misure di un bambino e di un tipo, nella stessa forma di ultimeMisure. */
function ultimeMisureDi(bambino, tipo) {
  if (tipo === 'peso') return pesate(bambino).map((p) => ({ iso: p.iso, valore: p.kg, id: '' }));
  if (tipo === 'lunghezza') return lunghezze(bambino).map((l) => ({ iso: l.iso, valore: l.cm, id: '' }));
  return temperature(bambino).map((t) => ({ iso: t.iso, valore: t.temp, id: t.id }));
}

// ── sezione ────────────────────────────────────────────────────────────────

let radiceSezione = null;

function riempi() {
  const misure = ultimeMisure(ELENCO_RIGHE);
  radiceSezione.innerHTML = misure.length
    ? '<div class="sect">Ultime misure</div><div class="card">' + misure.map(rigaMisura).join('') + '</div>'
    : '<div class="card vuoto">Non c’è ancora nessuna misura.<br>Tocca + in alto per aggiungerne una.</div>';
}

function riapri(riga) {
  const { bambino, tipo, iso, id } = riga.dataset;
  if (tipo === 'temperatura' && !id) {
    avviso('Questa temperatura viene dal registro vecchio: non si può modificare.');
    return;
  }
  apriInserimento({ tipo, bambino, iso, id });
}

function disegna(contenitore) {
  radiceSezione = document.createElement('div');
  radiceSezione.className = 'misure';
  contenitore.append(radiceSezione);
  riempi();

  // Una riga si apre al rilascio e solo se il dito non si è mosso: sul telefono il
  // primo contatto può essere l'inizio di uno scorrimento dell'elenco.
  let giu = null;
  radiceSezione.addEventListener('pointerdown', (e) => {
    const riga = e.target.closest('.wrow');
    giu = riga ? { riga, x: e.clientX, y: e.clientY } : null;
  });
  radiceSezione.addEventListener('pointerup', (e) => {
    const g = giu;
    giu = null;
    if (!g || e.target.closest('.wrow') !== g.riga) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) return;
    riapri(g.riga);
  });
  radiceSezione.addEventListener('pointercancel', () => { giu = null; });
}

registraSezione('misure', {
  titolo: 'Misure',
  sotto: 'peso · lunghezza · temperatura',
  disegna,
  piu: () => apriInserimento({}),
});
registraInserimento(apriInserimento);

// I dati arrivano dopo il disegno: se la sezione è in pagina, l'elenco si aggiorna.
onCambio(() => {
  if (radiceSezione && radiceSezione.isConnected) riempi();
});
