// La sezione Crescita: le due età, gli interruttori, il grafico, i percentili, le
// spiegazioni.
//
// Due regole guidano tutto questo file.
//
// 1. Finché le tabelle dell'OMS non sono caricate non si scrive nessun percentile.
//    Un numero calcolato senza tabella sarebbe il danno peggiore che questa app può
//    fare: al suo posto va un segnaposto.
// 2. Al tocco di un interruttore la schermata non si rifà. Cambiano le classi degli
//    interruttori, il contenuto del grafico e quello dei percentili. Il resto sta fermo.

import {
  BAMBINI,
  COLORE,
  SIGLA,
  apriInserimentoMisura,
  dataCorta,
  isoOggi,
  numero,
  registraSezione,
} from './app.js';
import { lunghezze, onCambio, pesate } from './dati.js';
import {
  MOTIVO_FUORI_TABELLA,
  NASCITA,
  TERMINE,
  caricaTabelle,
  etaScritta,
  giorniDa,
  lms,
  percentile,
  percentileScritto,
  zDa,
  zScritto,
} from './crescita.js';
import { disegnaGrafico, finestra } from './grafico.js';

const PEDIATRA =
  'Percentile e punteggio z sono descrizioni statistiche, da leggere insieme al ' +
  'pediatra. Non sono un voto e non sono una diagnosi.';
const FONTE =
  'Curve: WHO Child Growth Standards 2006, Organizzazione Mondiale della Sanità. ' +
  'CC BY-NC-SA 3.0 IGO.';
const ATTESA = 'Sto caricando le curve dell’OMS.';

const PREMATURITA = giorniDa(NASCITA, TERMINE);
const SETTIMANE = Math.floor(PREMATURITA / 7);
const GIORNI_IN_PIU = PREMATURITA % 7;

// ── stato della sezione ────────────────────────────────────────────────────

let misura = 'peso';
let periodo = 'tutto';
let eta = 'corretta';
let tabellePronte = false;

// I riferimenti agli elementi, riempiti da disegna(). Il DOM si tocca solo lì dentro
// e dentro i gestori: questo modulo si importa anche con Node, dove non c'è.
const el = {};

// Nessun altro carica le tabelle. Se non le chiedessimo qui, lms() tornerebbe sempre
// null e la sezione non mostrerebbe mai un percentile.
caricaTabelle()
  .then(() => {
    tabellePronte = true;
    aggiorna();
  })
  .catch(() => {
    tabellePronte = false;
    aggiorna();
  });

onCambio(() => aggiorna());

// ── lettura dei dati ───────────────────────────────────────────────────────

function chiave() {
  return misura === 'peso' ? 'kg' : 'cm';
}

function righeDi(bambino) {
  return misura === 'peso' ? pesate(bambino) : lunghezze(bambino);
}

function partenza() {
  return eta === 'corretta' ? TERMINE : NASCITA;
}

/** Le serie per il grafico: i giorni di età contati dalla partenza scelta. */
function serieDi() {
  const k = chiave();
  const da = partenza();
  const out = {};
  for (const bambino of BAMBINI) {
    out[bambino] = righeDi(bambino).map((r) => ({
      giorni: giorniDa(da, r.iso),
      valore: r[k],
    }));
  }
  return out;
}

/** Punteggio z e percentile di una misura. Torna null fuori dalle tabelle. */
function pctDi(valore, iso) {
  const terna = lms(misura, giorniDa(partenza(), iso));
  if (!terna) return null;
  const z = zDa(valore, terna);
  return { z, p: percentile(z) };
}

// ── percentili ─────────────────────────────────────────────────────────────

function cartaDi(bambino) {
  const sigla = SIGLA[bambino];
  const testa = `<span class="chip ${sigla}">${sigla.toUpperCase()}</span>`;
  const righe = righeDi(bambino);
  const k = chiave();

  if (!righe.length) {
    return `<div class="card">${testa}<div class="cr-fuori">—</div>
      <div class="t">nessuna misura di ${misura}</div></div>`;
  }

  const ultima = righe[righe.length - 1];
  const ora = pctDi(ultima[k], ultima.iso);
  const quanto = `${numero(ultima[k], misura === 'peso' ? 3 : 1)} ${k} il ${dataCorta(ultima.iso)}`;

  if (!ora) {
    return `<div class="card">${testa}
      <div class="cr-fuori">fuori dalle tabelle OMS</div>
      <div class="t">${quanto}<br>${MOTIVO_FUORI_TABELLA}</div></div>`;
  }

  // Il percentile di partenza si mostra solo con almeno due misure: con una sola non
  // c'è nessun «prima» da confrontare.
  let prima = '';
  if (righe.length > 1) {
    const inizio = righe[0];
    const q = pctDi(inizio[k], inizio.iso);
    prima = q
      ? `<br>alla prima misura ${percentileScritto(q.p)}, ${zScritto(q.z)}`
      : '<br>la prima misura è fuori dalle tabelle OMS';
  }

  return `<div class="card">${testa}
    <div class="p" style="color:${COLORE[bambino]}">${percentileScritto(ora.p)}</div>
    <div class="t">${zScritto(ora.z)}<br>${quanto}${prima}</div></div>`;
}

function percentiliHtml() {
  if (!tabellePronte) return `<div class="card cr-attesa">${ATTESA}</div>`;
  return BAMBINI.map(cartaDi).join('');
}

// ── grafico ────────────────────────────────────────────────────────────────

function quanteMisure() {
  return BAMBINI.reduce((somma, bambino) => somma + righeDi(bambino).length, 0);
}

const INVITO =
  '<b>Nessuna lunghezza nel registro.</b><br>' +
  'Con due misure compare la curva. Tocca qui per inserire la prima.';

function aggiornaGrafico() {
  const invito = misura === 'lunghezza' && quanteMisure() < 2;
  el.grafico.classList.toggle('card', !invito);
  el.grafico.classList.toggle('chart', !invito);
  el.grafico.classList.toggle('cr-invito', invito);
  if (invito) {
    el.grafico.innerHTML = INVITO;
    return;
  }
  const serie = serieDi();
  const { giorniDa: da, giorniA: a } = finestra(periodo, serie);
  el.grafico.innerHTML = disegnaGrafico({ misura, serie, giorniDa: da, giorniA: a });
}

// ── aggiornamento sul posto ────────────────────────────────────────────────

function aggiorna() {
  if (!el.grafico || !el.grafico.isConnected) return;
  const oggi = isoOggi();
  el.nCorretta.textContent = etaScritta(TERMINE, oggi);
  el.nAnagrafica.textContent = etaScritta(NASCITA, oggi);
  el.nota.hidden = eta === 'corretta';
  aggiornaGrafico();
  el.percentili.innerHTML = percentiliHtml();
}

// ── markup ─────────────────────────────────────────────────────────────────

function markup() {
  return `
<div class="agebox" data-cr="eta">
  <div class="card on" data-eta="corretta" role="button" tabindex="0">
    <div class="lbl">Età corretta</div><div class="n" data-n="corretta">—</div>
  </div>
  <div class="card" data-eta="anagrafica" role="button" tabindex="0">
    <div class="lbl">Età anagrafica</div><div class="n" data-n="anagrafica">—</div>
  </div>
</div>

<div class="seg" data-cr="misura">
  <b class="on" data-misura="peso">Peso</b><b data-misura="lunghezza">Lunghezza</b>
</div>

<div class="seg" data-cr="periodo">
  <b data-periodo="1m">1 mese</b><b data-periodo="3m">3 mesi</b>
  <b data-periodo="6m">6 mesi</b><b class="on" data-periodo="tutto">Tutto</b>
</div>

<div class="cr-nota" data-cr="nota" hidden>
  Stai guardando l’età anagrafica. Le curve dell’OMS partono dal termine: i percentili
  qui sotto sono contati dalla nascita.
</div>

<div class="card chart" data-cr="grafico"></div>

<div class="pctbox" data-cr="percentili"></div>

<div class="card cr-pediatra">${PEDIATRA}</div>

<div class="sect">Come si legge</div>
<div class="card explain">
  <span class="q">Le bande</span>
  La banda in mezzo è dove sta <b>la metà dei bambini</b>. P50 è la mediana: metà pesa
  di più, metà di meno. P3 e P97 sono i bordi: sotto P3 sta il 3% dei bambini, sopra
  P97 l’altro 3%.
  <div class="cr-spazio"></div>
  <span class="q">Perché l’età corretta</span>
  Gabriel e Vittorio sono nati <b>${SETTIMANE} settimane e ${GIORNI_IN_PIU} giorni</b>
  prima del termine. Sul grafico conta l’età dal termine, non dalla nascita: le curve
  dell’OMS descrivono bambini nati a termine.
  <div class="cr-spazio"></div>
  <span class="q">Che cosa guardare</span>
  <b>La direzione della linea, non il punto.</b> Una linea che sale in parallelo alle
  bande descrive una crescita regolare, anche se passa in basso. Il percentile dice
  dove sta la misura fra quelle dei bambini dell’OMS, niente altro.
</div>

<div class="src">${FONTE}</div>`;
}

// ── costruzione e tocchi ───────────────────────────────────────────────────

function disegna(contenitore) {
  contenitore.innerHTML = markup();

  const q = (sel) => contenitore.querySelector(sel);
  el.eta = q('[data-cr="eta"]');
  el.nCorretta = q('[data-n="corretta"]');
  el.nAnagrafica = q('[data-n="anagrafica"]');
  el.segMisura = q('[data-cr="misura"]');
  el.segPeriodo = q('[data-cr="periodo"]');
  el.nota = q('[data-cr="nota"]');
  el.grafico = q('[data-cr="grafico"]');
  el.percentili = q('[data-cr="percentili"]');

  // I tocchi rispondono su pointerdown, non al rilascio.
  el.eta.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-eta]');
    if (!b || b.dataset.eta === eta) return;
    eta = b.dataset.eta;
    for (const d of el.eta.children) d.classList.toggle('on', d.dataset.eta === eta);
    aggiorna();
  });

  el.segMisura.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-misura]');
    if (!b || b.dataset.misura === misura) return;
    misura = b.dataset.misura;
    for (const d of el.segMisura.children) d.classList.toggle('on', d.dataset.misura === misura);
    aggiorna();
  });

  el.segPeriodo.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-periodo]');
    if (!b || b.dataset.periodo === periodo) return;
    periodo = b.dataset.periodo;
    for (const d of el.segPeriodo.children) d.classList.toggle('on', d.dataset.periodo === periodo);
    aggiornaGrafico();
  });

  // Al posto del grafico della lunghezza, finché non ci sono due misure, c'è l'invito
  // a inserirne una. Il tocco lo prende l'inserimento di misure.js.
  el.grafico.addEventListener('pointerdown', () => {
    if (el.grafico.classList.contains('cr-invito')) {
      apriInserimentoMisura({ tipo: 'lunghezza' });
    }
  });

  aggiorna();
}

registraSezione('crescita', { sotto: 'curve OMS 2006, maschi', disegna });
