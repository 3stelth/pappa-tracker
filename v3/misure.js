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
  CORTO,
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

// L'icona del titolo di ogni gruppo, nello stesso stile degli altri SVG dell'app:
// 24×24, solo contorno. Le emoji di TIPI restano ai pulsanti della tendina.
export const ICONE = {
  peso: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/>' +
    '<path d="M8 14a4 4 0 0 1 8 0"/><path d="M12 14 10.2 10.6"/>',
  lunghezza: '<path d="M3 15.5 15.5 3 21 8.5 8.5 21z"/>' +
    '<path d="M6 12.5 8 14.5"/><path d="M9.5 9 11.5 11"/><path d="M13 5.5 15 7.5"/>',
  temperatura: '<path d="M14 13.6V5a2 2 0 0 0-4 0v8.6a4 4 0 1 0 4 0z"/><path d="M12 9v5"/>',
};

// Quante cifre decimali si scrivono almeno: 8,29 kg, 70 cm, 37,0 °C.
const DECIMALI_MINIMI = { peso: 2, lunghezza: 0, temperatura: 1 };

// Tenere premuto − o +: dopo ATTESA_MS il passo si ripete ogni GIRO_MS. Dopo
// GIRI_LENTI ripetizioni il passo diventa FATTORE volte più grande.
const ATTESA_MS = 500;
const GIRO_MS = 120;
const GIRI_LENTI = 8;
const FATTORE = 5;

// Da qui in su la temperatura si scrive in arancione. Soglia scelta da Andrea.
export const FEBBRE = 37.5;

// I quattro tasti del periodo, gli stessi di Crescita, con i giorni che coprono.
const PERIODI = [['1m', '1 mese'], ['3m', '3 mesi'], ['6m', '6 mesi'], ['tutto', 'Tutto']];
const GIORNI_PERIODO = { '1m': 30, '3m': 91, '6m': 183 };

const GIORNO_MS = 86400000;

// ── funzioni pure ──────────────────────────────────────────────────────────

function aMs(iso) { return Date.parse(iso + 'T00:00:00Z'); }

/** Quanti giorni separano due date. Conta in UTC: l'ora legale non toglie un giorno. */
function giorniFra(isoDa, isoA) {
  return Math.round((aMs(isoA) - aMs(isoDa)) / GIORNO_MS);
}

function isoMeno(iso, giorni) {
  return new Date(aMs(iso) - giorni * GIORNO_MS).toISOString().slice(0, 10);
}

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

/** Tutte le misure dei tre tipi e dei due bambini, dalla più recente. Ha ancora l'ora, che serve a ordinare. */
function tutteLeMisure() {
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
  return tutte;
}

function senzaOra({ ora, ...m }) { return m; }

/** Le `quante` misure più recenti, dei tre tipi e dei due bambini mescolati. */
export function ultimeMisure(quante) {
  return tutteLeMisure().slice(0, quante).map(senzaOra);
}

/** Le `quante` misure più recenti di ogni tipo, sempre mescolate in ordine di data. */
export function ultimePerTipo(quante) {
  const contate = {};
  return tutteLeMisure()
    .filter((m) => (contate[m.tipo] = (contate[m.tipo] || 0) + 1) <= quante)
    .map(senzaOra);
}

/**
 * Le misure di un tipo, messe in righe affiancate: una colonna per bambino, nello
 * stesso ordine di BAMBINI. Così il nome e la data non si ripetono a ogni riga.
 * La riga è il giorno per peso e lunghezza, il giorno più l'ora per la temperatura:
 * di temperature ce ne sono tante in un giorno. Se la cella è già occupata, la misura
 * apre una riga in più invece di sparire.
 *
 * Ogni riga porta anche `giorni`, i giorni che la separano dalla riga sotto, e
 * `delta`, una differenza per colonna.
 *
 * La differenza si scrive solo se la misura prima di quel bambino sta nella riga
 * sotto. Se la sua misura prima è più lontana, `giorni` non è il suo intervallo e il
 * numero mentirebbe: lì `delta` resta null. Capita quando i due sono stati pesati in
 * giorni diversi.
 *
 * Giorni e differenze si contano sulla lista intera, prima del taglio: se no la riga
 * più vecchia di un periodo perderebbe il confronto con la misura di prima.
 */
export function righeAffiancate(tipo, quante) {
  const righe = [];
  for (const m of tutteLeMisure()) {
    if (m.tipo !== tipo) continue;
    const chiave = tipo === 'temperatura' ? m.iso + ' ' + m.ora : m.iso;
    const colonna = BAMBINI.indexOf(m.bambino);
    let riga = righe.find((r) => r.chiave === chiave && !r.celle[colonna]);
    if (!riga) {
      riga = { chiave, iso: m.iso, ora: m.ora, celle: BAMBINI.map(() => null) };
      righe.push(riga);
    }
    riga.celle[colonna] = m;
  }
  righe.forEach((r, i) => {
    const sotto = righe[i + 1];
    r.giorni = sotto ? giorniFra(sotto.iso, r.iso) : null;
    r.delta = r.celle.map((m, colonna) => {
      const prima = sotto ? sotto.celle[colonna] : null;
      return m && prima ? m.valore - prima.valore : null;
    });
  });
  return righe.slice(0, quante);
}

/** Le righe che stanno nel periodo scelto, contato dalla riga più recente. */
export function dentroPeriodo(righe, periodo) {
  const quanti = GIORNI_PERIODO[periodo];
  if (!quanti || !righe.length) return righe;
  const limite = isoMeno(righe[0].iso, quanti);
  return righe.filter((r) => r.iso >= limite);
}

/**
 * Le temperature a giorni, dal più recente: per ogni giorno il massimo di ogni
 * bambino, il conto di tutte le misure e le letture ora per ora.
 */
export function giorniTemperatura() {
  const giorni = [];
  for (const r of righeAffiancate('temperatura')) {
    let g = giorni.find((x) => x.iso === r.iso);
    if (!g) {
      g = { iso: r.iso, quante: 0, massimi: BAMBINI.map(() => null), letture: [] };
      giorni.push(g);
    }
    g.letture.push(r);
    r.celle.forEach((m, colonna) => {
      if (!m) return;
      g.quante += 1;
      if (g.massimi[colonna] === null || m.valore > g.massimi[colonna]) g.massimi[colonna] = m.valore;
    });
  }
  return giorni;
}

/**
 * Le misure che un nuovo salvataggio sostituirebbe. Peso e lunghezza sono una per
 * bambino e per giorno: scriverne una nuova cancella la vecchia. Le temperature sono
 * una lista, si aggiungono e non sostituiscono mai niente.
 */
export function misureDaSostituire(tipo, bambini, iso) {
  if (tipo === 'temperatura') return [];
  const out = [];
  for (const bambino of bambini) {
    const trovata = ultimeMisureDi(bambino, tipo).find((m) => m.iso === iso);
    if (trovata) out.push({ bambino, valore: trovata.valore });
  }
  return out;
}

/** La domanda che si fa prima di sostituire, con il valore che sparirebbe. */
export function testoSostituzione(tipo, iso, sostituite) {
  const t = TIPI[tipo];
  const frasi = sostituite.map(
    (m) => m.bambino + ' ha già ' + testoValore(tipo, m.valore) + ' ' + t.unita + ' il ' + dataCorta(iso) + '.'
  );
  return frasi.join(' ') + (sostituite.length > 1 ? ' Li sostituisco?' : ' Lo sostituisco?');
}

/** L'avviso dopo il salvataggio: che cosa è stato scritto e per chi. */
export function testoSalvato(tipo, valore, bambini, iso, sostituite) {
  const t = TIPI[tipo];
  return 'Salvato: ' + t.nome.toLowerCase() + ' ' + testoValore(tipo, valore) + ' ' + t.unita +
    ' per ' + bambini.join(' e ') + ', ' + dataCorta(iso) + '.' +
    (sostituite ? ' Ha sostituito il valore di prima.' : '');
}

/** Il valore scritto per lo schermo: virgola decimale, zeri inutili tolti. */
export function testoValore(tipo, valore) {
  const n = Number(valore);
  if (!Number.isFinite(n)) return '—';
  const [intera, dec = ''] = n.toFixed(TIPI[tipo].decimali).split('.');
  let d = dec;
  while (d.length > DECIMALI_MINIMI[tipo] && d.endsWith('0')) d = d.slice(0, -1);
  return d ? intera + ',' + d : intera;
}

/**
 * La differenza dalla misura prima: grammi interi per il peso, l'unita' del tipo per
 * gli altri. `=` se non è cambiata, stringa vuota se non si può scrivere.
 */
export function testoDelta(tipo, delta) {
  if (delta === null || delta === undefined) return '';
  if (tipo === 'peso') {
    const g = Math.round(delta * 1000);
    return g === 0 ? '=' : (g > 0 ? '+' : '−') + Math.abs(g);
  }
  const v = arrotonda(tipo, delta);
  return v === 0 ? '=' : (v > 0 ? '+' : '−') + testoValore(tipo, Math.abs(v));
}

function esc(testo) {
  return String(testo).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * HTML di una cella dell'elenco. I dati per riaprirla stanno negli attributi data-.
 * Senza misura resta un trattino, che non si tocca: non ha gli attributi data-.
 * `dentro` aggiunge HTML dopo il valore (la differenza); `classi` e `attributi`
 * servono alle letture del giorno aperto, nella temperatura.
 */
export function cellaMisura(m, { dentro = '', classi = '', attributi = '' } = {}) {
  const piu = classi ? ' ' + classi : '';
  if (!m) return '<div class="mcel vuota' + piu + '"' + attributi + '>—</div>';
  return (
    '<div class="mcel' + piu + '" data-bambino="' + esc(m.bambino) + '" data-tipo="' + esc(m.tipo) +
    '" data-iso="' + esc(m.iso) + '" data-id="' + esc(m.id || '') + '"' + attributi + '>' +
    // Nome, data e tipo non si ripetono nella cella: li portano l'intestazione,
    // l'etichetta della riga e il titolo del gruppo.
    testoValore(m.tipo, m.valore) + '<span class="u">' + TIPI[m.tipo].unita + '</span>' + dentro +
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
          '<div class="mbtn' + (k === f.tipo ? ' on' : '') + '" data-t="' + k + '">' +
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
    '<div class="src conferma" hidden></div>' +
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
    sostituzione: null, // la domanda già fatta e confermata dal secondo tocco
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
  const elSalva = radice.querySelector('.save');
  const elConferma = radice.querySelector('.conferma');
  let orologio = null;
  let orologioConferma = null;

  ferma = () => { clearTimeout(orologio); orologio = null; };

  function mostraValore() { elN.textContent = testoValore(f.tipo, f.valore); }

  function cambiaValore(delta) {
    f.valore = passoSicuro(f.tipo, f.valore, delta);
    f.toccato = true;
    mostraValore();
  }

  // Cambiando bambino, tipo o data la domanda di prima non vale più.
  function azzeraSostituzione() {
    if (f.sostituzione === null) return;
    f.sostituzione = null;
    elConferma.hidden = true;
    elSalva.textContent = 'Salva';
  }

  function scegliBambino(b) {
    azzeraSostituzione();
    f.bambino = b;
    for (const c of chipBambini) c.classList.toggle('on', c.dataset.b === b);
    if (!f.toccato) { f.valore = valorePartenza(f.tipo, b); mostraValore(); }
  }

  function scegliTipo(k) {
    azzeraSostituzione();
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
    const bambini = f.bambino === TUTTI ? BAMBINI : [f.bambino];
    const sostituite = f.modifica ? [] : misureDaSostituire(f.tipo, bambini, f.iso);
    // Una misura già scritta non sparisce in silenzio: il primo tocco chiede, il secondo sostituisce.
    if (sostituite.length) {
      const chiave = JSON.stringify(sostituite);
      if (f.sostituzione !== chiave) {
        f.sostituzione = chiave;
        elConferma.textContent = testoSostituzione(f.tipo, f.iso, sostituite);
        elConferma.hidden = false;
        elSalva.textContent = 'Sostituisci';
        return;
      }
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
      for (const b of bambini) scriviMisura(b, f.tipo, f.valore, f.iso);
      avviso(testoSalvato(f.tipo, f.valore, bambini, f.iso, sostituite.length > 0));
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
      azzeraSostituzione();
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

// L'intestazione delle due colonne: il nome di ogni bambino, una volta sola per gruppo.
const INTESTAZIONE =
  '<div class="mlab mtit"></div>' +
  BAMBINI.map((b) =>
    '<div class="mcol"><span class="chip ' + SIGLA[b] + '">' + CORTO[b] + '</span></div>'
  ).join('');

// Il periodo scelto in ogni gruppo di valori, come i quattro tasti di Crescita.
const periodo = { peso: 'tutto', lunghezza: 'tutto' };

// I giorni di temperatura aperti, per data: riempi() li ridisegna aperti.
const aperti = new Set();

const FRECCIA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

/**
 * La casella della differenza. Si scrive sempre, vuota quando non c'è niente da dire:
 * se no la colonna dei valori si disallinea. Il verde è solo di chi è cresciuto.
 */
function htmlDelta(tipo, delta) {
  const classe = delta === null ? '' : delta === 0 ? ' pari' : delta > 0 ? ' su' : '';
  return '<span class="dl' + classe + '">' + testoDelta(tipo, delta) + '</span>';
}

function meseDi(iso) {
  const [anno, mese] = iso.split('-');
  return MESI[Number(mese) - 1] + ' ' + anno;
}

function htmlPeriodo(tipo) {
  return '<div class="seg" data-gruppo-di="' + tipo + '">' +
    PERIODI.map(([chiave, nome]) =>
      '<b class="' + (periodo[tipo] === chiave ? 'on' : '') + '" data-periodo="' + chiave + '">' + nome + '</b>'
    ).join('') + '</div>';
}

/** Peso e lunghezza: una riga per giorno, i giorni dalla riga sotto, i grammi nella cella. */
function htmlValori(tipo, righe) {
  let mese = '';
  const corpo = righe.map((r) => {
    // La sotto-intestazione del mese dà un appoggio dentro l'elenco lungo.
    let testa = '';
    const suo = meseDi(r.iso);
    if (suo !== mese) { mese = suo; testa = '<div class="mmese">' + esc(suo) + '</div>'; }
    return testa +
      '<div class="mlab">' + esc(dataCorta(r.iso)) +
      (r.giorni === null ? '' : '<span class="q">' + r.giorni + ' gg</span>') + '</div>' +
      r.celle.map((m, i) => cellaMisura(m, { dentro: htmlDelta(tipo, r.delta[i]) })).join('');
  }).join('');
  return '<div class="mtab">' + INTESTAZIONE + corpo + '</div>';
}

/**
 * Il numero grande di un giorno di temperatura: il massimo di quel bambino. Non porta
 * gli attributi data-: il tocco apre il giorno, e la singola misura si cambia dentro.
 */
function cellaMassimo(valore, classi, attributi) {
  if (valore === null) return '<div class="mcel vuota' + classi + '"' + attributi + '>—</div>';
  return '<div class="mcel' + classi + (valore >= FEBBRE ? ' cal' : '') + '"' + attributi + '>' +
    testoValore('temperatura', valore) + '<span class="u">' + TIPI.temperatura.unita + '</span></div>';
}

/** Temperatura: una riga per giorno, che si apre sulle ore. */
function htmlTemperatura(giorni) {
  const corpo = giorni.map((g) => {
    const ap = aperti.has(g.iso);
    const cl = ap ? ' aperto' : '';
    const attr = ' data-g="' + g.iso + '"';
    const attrDet = (ap ? '' : ' hidden') + ' data-det="' + g.iso + '"';
    const riga =
      '<div class="mlab' + cl + '"' + attr + '>' + esc(dataCorta(g.iso)) +
        '<span class="q">' + g.quante + (g.quante === 1 ? ' misura' : ' misure') + '</span></div>' +
      g.massimi.map((v) => cellaMassimo(v, cl, attr)).join('') +
      '<div class="tfre' + cl + '"' + attr + '>' + FRECCIA + '</div>';
    const letture = g.letture.map((r) =>
      '<div class="det mlab"' + attrDet + '>' + esc(r.ora) + '</div>' +
      r.celle.map((m) =>
        cellaMisura(m, { classi: 'det' + (m && m.valore >= FEBBRE ? ' cal' : ''), attributi: attrDet })
      ).join('') +
      '<div class="det tfre"' + attrDet + '></div>'
    ).join('');
    return riga + letture;
  }).join('');
  return '<div class="mtab ttab">' + INTESTAZIONE + '<div class="tfre mtit"></div>' + corpo + '</div>';
}

/** Un gruppo intero: titolo, i tasti del periodo dove servono, la scheda. */
function htmlGruppo(tipo) {
  const titolo = '<div class="sect"><svg viewBox="0 0 24 24" aria-hidden="true">' + ICONE[tipo] + '</svg>' +
    TIPI[tipo].nome + '</div>';
  const scheda = (dentro) => '<div class="card">' + dentro + '</div>';
  let corpo;
  if (tipo === 'temperatura') {
    const giorni = giorniTemperatura();
    corpo = giorni.length ? scheda(htmlTemperatura(giorni)) : scheda('<div class="vuoto">Nessuna misura ancora.</div>');
  } else {
    // Niente tetto di righe: si vedono tutte le date, e i quattro tasti scelgono quante.
    const tutte = righeAffiancate(tipo);
    corpo = tutte.length
      ? htmlPeriodo(tipo) + scheda(htmlValori(tipo, dentroPeriodo(tutte, periodo[tipo])))
      : scheda('<div class="vuoto">Nessuna misura ancora.</div>');
  }
  return '<div data-gruppo="' + tipo + '">' + titolo + corpo + '</div>';
}

function riempi() {
  if (!ORDINE_TIPI.some((tipo) => righeAffiancate(tipo, 1).length)) {
    radiceSezione.innerHTML =
      '<div class="card vuoto">Non c’è ancora nessuna misura.<br>Tocca + in alto per aggiungerne una.</div>';
    return;
  }
  // Un gruppo per tipo, sempre tutti e tre e sempre nello stesso ordine: così il peso
  // non finisce mescolato alle temperature, e si vede subito quale tipo manca.
  radiceSezione.innerHTML = ORDINE_TIPI.map(htmlGruppo).join('');
}

function scegliPeriodo(tasto) {
  const tipo = tasto.parentElement.dataset.gruppoDi;
  if (!tipo || periodo[tipo] === tasto.dataset.periodo) return;
  periodo[tipo] = tasto.dataset.periodo;
  // Si rifà solo questo gruppo: gli altri due non devono sfarfallare.
  const gruppo = radiceSezione.querySelector('[data-gruppo="' + tipo + '"]');
  if (gruppo) gruppo.outerHTML = htmlGruppo(tipo);
}

/** Apre o chiude un giorno di temperatura, sul posto: niente elenco rifatto. */
function apriChiudi(iso) {
  const ap = !aperti.has(iso);
  if (ap) aperti.add(iso); else aperti.delete(iso);
  for (const el of radiceSezione.querySelectorAll('[data-g="' + iso + '"]')) el.classList.toggle('aperto', ap);
  for (const el of radiceSezione.querySelectorAll('[data-det="' + iso + '"]')) el.hidden = !ap;
}

function riapri(cella) {
  const { bambino, tipo, iso, id } = cella.dataset;
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

  // Una cella si apre al rilascio e solo se il dito non si è mosso: sul telefono il
  // primo contatto può essere l'inizio di uno scorrimento dell'elenco.
  // Il bersaglio è la cella, non la riga: su una riga ci sono due misure. Nella
  // temperatura invece si tocca la riga del giorno, e si apre sulle ore.
  // I tasti del periodo rispondono subito, come in Crescita: non aprono niente.
  let giu = null;
  radiceSezione.addEventListener('pointerdown', (e) => {
    const tasto = e.target.closest('[data-periodo]');
    if (tasto) { giu = null; scegliPeriodo(tasto); return; }
    const cella = e.target.closest('.mcel[data-tipo]');
    const giorno = cella ? null : e.target.closest('[data-g]');
    giu = cella || giorno ? { cella, giorno, x: e.clientX, y: e.clientY } : null;
  });
  radiceSezione.addEventListener('pointerup', (e) => {
    const g = giu;
    giu = null;
    if (!g) return;
    if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) return;
    if (g.cella) {
      if (e.target.closest('.mcel[data-tipo]') === g.cella) riapri(g.cella);
      return;
    }
    const su = e.target.closest('[data-g]');
    if (su && su.dataset.g === g.giorno.dataset.g) apriChiudi(su.dataset.g);
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
