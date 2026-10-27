// Pappa Tracker v3 — sezione Oggi: le sagome dei due bambini, la barra del tempo,
// le ultime pesate.
//
// Regole che questo modulo rispetta:
// - Al caricamento non tocca `document`: le funzioni pure (sagoma, statoAlGiorno, ...)
//   girano anche con Node, nei test. Il DOM si usa solo dentro `disegna` e dentro i
//   gestori degli eventi.
// - La lunghezza è una misura vera, mai una stima. Senza lunghezza la sagoma resta
//   grigia e invita a misurare. Il peso non entra mai nell'altezza della sagoma.
// - La barra del tempo non ricostruisce il markup: a ogni passo cambiano solo i nodi
//   di testo e la `transform` delle sagome.

import {
  registraSezione, apriInserimentoMisura,
  BAMBINI, COLORE, SIGLA, CORTO, ABBR,
  dataLunga, dataCorta, numero, isoOggi,
} from './app.js';
import { pesate, lunghezze, onCambio } from './dati.js';
import { TERMINE, etaScritta, giorniDa, isoDi } from './crescita.js';

// ── la sagoma ──────────────────────────────────────────────────────────────

// La sagoma del mockup approvato. Le parti del corpo sono le stesse per la versione
// colorata e per quella grigia: cambia solo come si riempiono.
const CORPO = `
    <path d="M58 4c7-3 14 1 15 8 1 5-2 9-6 11-3-7-6-13-9-19z"/>
    <ellipse cx="17" cy="56" rx="8" ry="10"/><ellipse cx="103" cy="56" rx="8" ry="10"/>
    <ellipse cx="60" cy="52" rx="42" ry="44"/>
    <path d="M60 92c-21 0-29 9-31 24l-4 32c-2 15 11 24 35 24s37-9 35-24l-4-32c-2-15-10-24-31-24z"/>
    <rect x="2" y="100" width="24" height="64" rx="12" transform="rotate(11 14 100)"/>
    <rect x="94" y="100" width="24" height="64" rx="12" transform="rotate(-11 106 100)"/>
    <rect x="34" y="162" width="25" height="60" rx="12.5"/>
    <rect x="61" y="162" width="25" height="60" rx="12.5"/>
    <ellipse cx="44" cy="226" rx="17" ry="12"/><ellipse cx="76" cy="226" rx="17" ry="12"/>`;

const FACCIA = (scuro) => `
  <ellipse cx="45" cy="52" rx="5" ry="6.5" style="fill:${scuro}" opacity=".78"/>
  <ellipse cx="75" cy="52" rx="5" ry="6.5" style="fill:${scuro}" opacity=".78"/>
  <path d="M51 68q9 7 18 0" fill="none" style="stroke:${scuro}" stroke-opacity=".6" stroke-width="3.4" stroke-linecap="round"/>
  <circle cx="31" cy="66" r="6.5" fill="#fff" opacity=".3"/><circle cx="89" cy="66" r="6.5" fill="#fff" opacity=".3"/>`;

const FASCIA = 'M29 150h62l-2 14c-1 12-11 20-29 20s-28-8-29-20z';

/** La sagoma colorata di un bambino, come stringa SVG. `id` deve essere unico nella pagina. */
export function sagoma({ colore, colore2, scuro, id }) {
  return `<svg viewBox="0 0 120 240" aria-hidden="true">
  <defs><linearGradient id="${id}" x1=".2" y1="0" x2=".8" y2="1">
    <stop offset="0" stop-color="${colore2}"/><stop offset="1" stop-color="${colore}"/></linearGradient>
    <linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".78"/></linearGradient></defs>
  <g fill="url(#${id})">${CORPO}
  </g>
  <path d="${FASCIA}" fill="url(#${id}n)"/>${FACCIA(scuro)}
  </svg>`;
}

/** La stessa sagoma, grigia, per quando manca la lunghezza. L'opacità la dà il CSS (.fig.vuota). */
export function sagomaVuota() {
  return `<svg viewBox="0 0 120 240" aria-hidden="true">
  <g style="fill:var(--hint)">${CORPO}
  </g>
  <path d="${FASCIA}" fill="#fff" opacity=".7"/>${FACCIA('var(--sub)')}
  </svg>`;
}

// ── calcoli puri ───────────────────────────────────────────────────────────

/**
 * Peso e lunghezza di un bambino a una data: l'ultima misura non successiva a `iso`.
 * I campi che mancano sono null. La lunghezza non si stima mai dal peso.
 * `deltaG` è la differenza in grammi con la pesata precedente, e c'è solo se c'è
 * una pesata precedente.
 */
export function statoAlGiorno(bambino, iso) {
  const fino = (lista) => lista.filter((m) => m.iso <= iso);
  const p = fino(pesate(bambino));
  const l = fino(lunghezze(bambino));
  const ultimoP = p.length ? p[p.length - 1] : null;
  const prima = p.length > 1 ? p[p.length - 2] : null;
  const ultimoL = l.length ? l[l.length - 1] : null;
  return {
    kg: ultimoP ? ultimoP.kg : null,
    isoPeso: ultimoP ? ultimoP.iso : null,
    deltaG: ultimoP && prima ? Math.round((ultimoP.kg - prima.kg) * 1000) : null,
    isoPrecedente: prima ? prima.iso : null,
    cm: ultimoL ? ultimoL.cm : null,
    isoLunghezza: ultimoL ? ultimoL.iso : null,
  };
}

/** L'altezza in px di una sagoma alta `cm`, proporzionale alla lunghezza reale. */
export function altezzaSagoma(cm, cmMax, altezzaScena) {
  if (!(cm > 0) || !(cmMax > 0) || !(altezzaScena > 0)) return 0;
  return Math.min(altezzaScena, (altezzaScena * cm) / cmMax);
}

function aData(iso) {
  return new Date(iso + 'T00:00:00');
}

/**
 * I riferimenti dei mesi per la barra del tempo: uno per ogni mese, nello stesso
 * giorno del mese della data di partenza. `frazione` va da 0 (isoDa) a 1 (isoA).
 */
export function riferimentiMesi(isoDa, isoA) {
  const da = aData(isoDa);
  const a = aData(isoA);
  const durata = a.getTime() - da.getTime();
  if (!(durata > 0)) return [{ frazione: 0, etichetta: ABBR[da.getMonth()] }];
  const out = [];
  for (let n = 0; ; n += 1) {
    const mese = da.getMonth() + n;
    const ultimoDelMese = new Date(da.getFullYear(), mese + 1, 0).getDate();
    const d = new Date(da.getFullYear(), mese, Math.min(da.getDate(), ultimoDelMese));
    if (d > a) break;
    out.push({ frazione: (d.getTime() - da.getTime()) / durata, etichetta: ABBR[d.getMonth()] });
  }
  return out;
}

/**
 * La scritta dell'età corretta a una data. Prima del termine non c'è età corretta:
 * lo si decide confrontando le date, non leggendo la frase di `etaScritta`.
 */
export function etaCorretta(iso) {
  if (giorniDa(TERMINE, iso) < 0) return 'non ancora al termine';
  return `corretta ${etaScritta(TERMINE, iso)}`;
}

/** Quanto può muoversi il dito, in px, fra pressione e rilascio perché sia un tocco e non uno scorrimento. */
export const SOGLIA_TOCCO = 10;

/** Vero se il dito è rimasto quasi fermo fra la pressione (x0, y0) e il rilascio (x1, y1). */
export function eUnTocco(x0, y0, x1, y1, soglia = SOGLIA_TOCCO) {
  return Math.hypot(x1 - x0, y1 - y0) < soglia;
}

// ── la schermata ───────────────────────────────────────────────────────────

const ALTEZZA_SCENA = 176;     // px, come .stage nel CSS
const CM_RIFERIMENTO = 78;     // la scena piena vale questa lunghezza, o quella più alta mai misurata
const ALTEZZA_VUOTA = 0.78;    // frazione fissa della scena: la sagoma grigia non dice niente sull'altezza
const ALTEZZA_SVG = 220;       // px: il viewBox 120x240 largo 110 px
const PASSI = 1000;

const TAVOLOZZA = {
  Gabriel:  { colore2: '#5AA9FF', scuro: '#0B2E63', id: 'og' },
  Vittorio: { colore2: '#4FC2B8', scuro: '#07443D', id: 'ov' },
};

const MENO = '−';

function imposta(el, testo) {
  if (el.textContent !== testo) el.textContent = testo;
}

function scrittoDelta(g) {
  return (g > 0 ? '+' : g < 0 ? MENO : '') + Math.abs(g) + ' g';
}

function markupBambino(b) {
  const t = TAVOLOZZA[b];
  const c = COLORE[b];
  return `<div class="twin card ${SIGLA[b]}" data-bambino="${b}">
    <div class="twin-name"><span class="dot"></span>${b}</div>
    <div class="stage">
      <div class="cmbox" style="color:${c}"><span class="n"></span><span class="d"></span></div>
      <div class="hline" style="color:${c}"></div>
      <div class="fig">${sagoma({ colore: c, colore2: t.colore2, scuro: t.scuro, id: t.id })}</div>
      <div class="fig vuota">${sagomaVuota()}</div>
    </div>
    <div class="kgrow">
      <div class="big"><span class="num"></span><small> kg</small></div>
      <div class="delta"></div>
      <div class="when"></div>
    </div>
  </div>`;
}

const MARKUP = `<div class="oggi">
  <div class="twins">${BAMBINI.map(markupBambino).join('')}</div>
  <div class="timebar card">
    <div class="timebar-top">
      <div class="timebar-date"></div>
      <div class="timebar-age"></div>
    </div>
    <div class="track">
      <div class="ticks"></div>
      <input type="range" min="0" max="${PASSI}" step="1" value="${PASSI}" aria-label="Giorno da mostrare">
    </div>
  </div>
  <div class="sect">Ultime pesate</div>
  <div class="card ultime"></div>
</div>`;

function righeUltimePesate(quante) {
  const righe = [];
  for (const b of BAMBINI) {
    const lista = pesate(b);
    lista.forEach((p, i) => {
      righe.push({
        bambino: b, iso: p.iso, kg: p.kg,
        deltaG: i > 0 ? Math.round((p.kg - lista[i - 1].kg) * 1000) : null,
      });
    });
  }
  righe.sort((x, y) => {
    if (x.iso !== y.iso) return x.iso < y.iso ? 1 : -1;
    return BAMBINI.indexOf(x.bambino) - BAMBINI.indexOf(y.bambino);
  });
  return righe.slice(0, quante);
}

function htmlUltime() {
  const righe = righeUltimePesate(6);
  if (!righe.length) return '<div class="vuoto">Nessuna pesata ancora.</div>';
  return righe.map((r) => `<div class="wrow">
      <span class="chip ${SIGLA[r.bambino]}">${CORTO[r.bambino]}</span>
      <span class="d">${dataCorta(r.iso)}</span>
      <span class="kg">${numero(r.kg)} kg</span>
      <span class="dl ${r.deltaG > 0 ? 'su' : ''}">${r.deltaG === null ? '' : r.deltaG === 0 ? '=' : scrittoDelta(r.deltaG)}</span>
    </div>`).join('');
}

/** Primo e ultimo giorno con una misura, fra pesi e lunghezze dei due bambini. */
function intervalloDati() {
  let primo = null;
  let ultimo = null;
  for (const b of BAMBINI) {
    for (const m of [...pesate(b), ...lunghezze(b)]) {
      if (primo === null || m.iso < primo) primo = m.iso;
      if (ultimo === null || m.iso > ultimo) ultimo = m.iso;
    }
  }
  if (primo === null) primo = ultimo = isoOggi();
  return { primo, ultimo };
}

// L'ultima schermata disegnata. I dati arrivano dopo il disegno e cambiano quando si
// salva una misura: l'ascoltatore aggiorna solo i numeri di questa schermata, e solo
// se è ancora in pagina.
let attuale = null;

onCambio(() => {
  if (!attuale) return;
  if (!attuale.radice.isConnected) { attuale = null; return; }
  attuale.aggiorna();
});

function disegnaOggi(contenitore) {
  contenitore.innerHTML = MARKUP;
  // La radice è il blocco .oggi, non il contenitore: il contenitore (#vista) è sempre lo
  // stesso elemento e resta in pagina anche quando si cambia sezione, il blocco no.
  const radice = contenitore.querySelector('.oggi');

  const schede = {};
  for (const b of BAMBINI) {
    const el = radice.querySelector(`.twin[data-bambino="${b}"]`);
    const scheda = {
      palco: el.querySelector('.stage'),
      cm: el.querySelector('.cmbox .n'),
      cmData: el.querySelector('.cmbox .d'),
      linea: el.querySelector('.hline'),
      fig: el.querySelector('.fig:not(.vuota)'),
      figVuota: el.querySelector('.fig.vuota'),
      kg: el.querySelector('.big .num'),
      delta: el.querySelector('.delta'),
      quando: el.querySelector('.when'),
      haPesate: false,
    };
    schede[b] = scheda;
    // la sagoma grigia ha sempre la stessa altezza: dice solo «qui manca la misura»
    scheda.figVuota.style.transform = `scale(${((ALTEZZA_VUOTA * ALTEZZA_SCENA) / ALTEZZA_SVG).toFixed(4)})`;
    // Si apre al rilascio, e solo se il dito si è mosso poco: chi scorre la pagina con il
    // dito sulla sagoma non deve vedersi aprire la tendina.
    let giu = null;
    scheda.palco.addEventListener('pointerdown', (e) => { giu = { x: e.clientX, y: e.clientY }; });
    scheda.palco.addEventListener('pointerup', (e) => {
      const partenza = giu;
      giu = null;
      if (!partenza || !scheda.palco.classList.contains('manca')) return;
      if (eUnTocco(partenza.x, partenza.y, e.clientX, e.clientY)) {
        apriInserimentoMisura({ tipo: 'lunghezza', bambino: b });
      }
    });
    scheda.palco.addEventListener('pointercancel', () => { giu = null; });
  }

  const elData = radice.querySelector('.timebar-date');
  const elEta = radice.querySelector('.timebar-age');
  const elTacche = radice.querySelector('.ticks');
  const barra = radice.querySelector('input[type=range]');
  const elUltime = radice.querySelector('.ultime');

  let t0 = 0;
  let t1 = 0;
  let cmMax = CM_RIFERIMENTO;
  let isoScelto = null;       // il giorno sulla barra, per tenerlo quando arrivano dati nuovi
  let inFondo = true;
  let trascina = false;
  let rimandato = false;

  function isoDaFrazione(frazione) {
    return isoDi(new Date(Math.round(t0 + (t1 - t0) * frazione)));
  }

  // Aggiorna solo nodi di testo, transform e classi. Niente markup nuovo.
  function mostra(frazione) {
    const iso = isoDaFrazione(frazione);
    isoScelto = iso;
    inFondo = frazione >= 1;

    for (const b of BAMBINI) {
      const s = schede[b];
      const st = statoAlGiorno(b, iso);

      const manca = st.cm === null;
      s.palco.classList.toggle('manca', manca);
      s.fig.hidden = manca;
      s.figVuota.hidden = !manca;
      s.linea.hidden = manca;
      if (manca) {
        imposta(s.cm, 'Manca la lunghezza');
        imposta(s.cmData, 'Aggiungi');
      } else {
        const h = altezzaSagoma(st.cm, cmMax, ALTEZZA_SCENA);
        s.fig.style.transform = `scale(${(h / ALTEZZA_SVG).toFixed(4)})`;
        s.linea.style.bottom = `${h.toFixed(0)}px`;
        imposta(s.cm, `${numero(st.cm)} cm`);
        imposta(s.cmData, `misurato il ${dataCorta(st.isoLunghezza)}`);
      }

      if (st.kg === null) {
        imposta(s.kg, '—');
        imposta(s.delta, '');
        imposta(s.quando, s.haPesate ? 'nessuna pesata a questa data' : 'nessuna pesata ancora');
        s.delta.classList.remove('su');
      } else {
        imposta(s.kg, numero(st.kg));
        if (st.deltaG === null) {
          imposta(s.delta, 'prima pesata');
          s.delta.classList.remove('su');
        } else {
          imposta(s.delta, `${scrittoDelta(st.deltaG)} dal ${dataCorta(st.isoPrecedente)}`);
          s.delta.classList.toggle('su', st.deltaG > 0);
        }
        imposta(s.quando, `pesato il ${dataLunga(st.isoPeso)}`);
      }
    }

    imposta(elData, dataLunga(iso));
    imposta(elEta, etaCorretta(iso));
  }

  // Ricalcola quello che dipende dai dati: l'intervallo della barra, le tacche dei
  // mesi, le ultime pesate. La barra resta sul giorno scelto, o in fondo se era in fondo.
  // Mentre il dito è sulla barra si rimanda al rilascio.
  function aggiorna() {
    if (trascina) { rimandato = true; return; }
    rimandato = false;

    const { primo, ultimo } = intervalloDati();
    t0 = aData(primo).getTime();
    t1 = aData(ultimo).getTime();
    barra.disabled = !(t1 > t0);

    cmMax = CM_RIFERIMENTO;
    for (const b of BAMBINI) {
      schede[b].haPesate = pesate(b).length > 0;
      for (const l of lunghezze(b)) if (l.cm > cmMax) cmMax = l.cm;
    }

    elTacche.innerHTML = riferimentiMesi(primo, ultimo)
      .map((r) => {
        const x = (r.frazione * 100).toFixed(2);
        return `<i style="left:${x}%"></i><b style="left:${x}%">${r.etichetta}</b>`;
      })
      .join('');
    elUltime.innerHTML = htmlUltime();

    let frazione = 1;
    if (!inFondo && isoScelto !== null && t1 > t0) {
      frazione = Math.min(1, Math.max(0, (aData(isoScelto).getTime() - t0) / (t1 - t0)));
    }
    barra.value = String(Math.round(frazione * PASSI));
    mostra(frazione);
  }

  barra.addEventListener('input', () => mostra(Number(barra.value) / PASSI));
  barra.addEventListener('pointerdown', () => { trascina = true; });
  const rilascio = () => {
    if (!trascina) return;
    trascina = false;
    if (rimandato) aggiorna();
  };
  // Il rilascio può avvenire fuori dalla barra: si ascoltano tutti i modi in cui il gesto finisce.
  for (const evento of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    barra.addEventListener(evento, rilascio);
  }

  attuale = { radice, aggiorna };
  aggiorna();
}

registraSezione('oggi', {
  disegna: disegnaOggi,
  piu: () => apriInserimentoMisura({ tipo: 'peso' }),
});
