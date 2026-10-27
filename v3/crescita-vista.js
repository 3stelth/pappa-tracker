// La sezione Crescita: le due età, gli interruttori, il grafico, i percentili, le
// spiegazioni.
//
// Tre regole guidano tutto questo file.
//
// 1. Finché le tabelle dell'OMS non sono caricate non si scrive nessun percentile.
//    Un numero calcolato senza tabella sarebbe il danno peggiore che questa app può
//    fare: al suo posto va un segnaposto.
// 2. **Lo schermo e lo stato non possono dire due cose diverse.** Le classi `on` degli
//    interruttori nascono sempre dallo stato, nel markup e in `aggiorna()`. Lo stato
//    sopravvive all'uscita dalla sezione, perché `app.js` svuota `#vista` e richiama
//    `disegna()` a ogni ritorno: un `class="on"` scritto fisso nel markup mostrerebbe
//    «Età corretta» acceso sopra percentili contati dalla nascita.
// 3. Al tocco di un interruttore la schermata non si rifà. Cambiano le classi degli
//    interruttori, il contenuto del grafico e quello dei percentili. Il resto sta fermo.
//
// Le decisioni pure stanno in funzioni esportate: da quale data si conta l'età, quale
// interruttore è accesso, quale percentile va in quale carta. Così si provano con Node,
// senza DOM, in test/grafico.test.js.

import {
  BAMBINI,
  COLORE,
  CORTO,
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

export const TESTO_ATTESA = 'Sto caricando le curve dell’OMS.';
export const TESTO_ERRORE =
  'Non riesco a caricare le curve dell’OMS. Senza le curve non mostro percentili: ' +
  'controlla la rete e riapri la sezione.';

const PREMATURITA = giorniDa(NASCITA, TERMINE);
const SETTIMANE = Math.floor(PREMATURITA / 7);
const GIORNI_IN_PIU = PREMATURITA % 7;

// ── stato della sezione ────────────────────────────────────────────────────
// Sopravvive all'uscita dalla sezione. Lo schermo lo rilegge sempre da qui.

const stato = { misura: 'peso', periodo: 'tutto', eta: 'corretta', tabelle: 'attesa' };

// I riferimenti agli elementi, riempiti da disegna(). Il DOM si tocca solo lì dentro
// e dentro i gestori: questo modulo si importa anche con Node, dove non c'è.
const el = {};

// La richiesta delle tabelle in corso, se ce n'è una. Serve a non lanciarne due in
// parallelo quando si entra e si esce dalla sezione.
let richiesta = null;

/**
 * Se serve chiedere le tabelle. Con le tabelle pronte non serve; con una richiesta già
 * in volo non si chiede due volte. Dopo un errore si riprova: il testo dell'errore dice
 * di riaprire la sezione, e riaprendola una richiesta nuova parte davvero.
 */
export function deveChiedere(tabelle, inCorso) {
  return tabelle !== 'pronte' && !inCorso;
}

// Nessun altro carica le tabelle. Se non le chiedessimo qui, lms() tornerebbe sempre
// null e la sezione non mostrerebbe mai un percentile.
function chiediTabelle() {
  if (!deveChiedere(stato.tabelle, richiesta)) return;
  // Mentre la richiesta è in volo torna il testo di attesa, anche dopo un errore.
  stato.tabelle = 'attesa';
  richiesta = caricaTabelle()
    .then(() => {
      stato.tabelle = 'pronte';
    })
    .catch(() => {
      // Non è più un'attesa: è un errore, e si scrive in modo diverso. Altrimenti chi è
      // senza rete legge «sto caricando» per sempre.
      stato.tabelle = 'errore';
    })
    .then(() => {
      richiesta = null;
      aggiorna();
    });
}

chiediTabelle();

onCambio(() => aggiorna());

// ── decisioni pure ─────────────────────────────────────────────────────────

/** Da quale data si contano i giorni di età. */
export function partenzaDi(eta) {
  return eta === 'corretta' ? TERMINE : NASCITA;
}

/** L'unità di una misura, come chiave delle righe di dati.js. */
export function chiaveDi(misura) {
  return misura === 'peso' ? 'kg' : 'cm';
}

/** Punteggio z e percentile di una misura. Torna null fuori dalle tabelle. */
export function pctDi(misura, eta, valore, iso) {
  const terna = lms(misura, giorniDa(partenzaDi(eta), iso));
  if (!terna) return null;
  const z = zDa(valore, terna);
  return { z, p: percentile(z) };
}

/**
 * Perché le bande potrebbero mancare dal grafico. Con le tabelle pronte il motivo non è
 * questo: torna `undefined`, e il grafico scrive il suo `SENZA_BANDE`.
 */
export function messaggioDelGrafico(tabelle) {
  if (tabelle === 'pronte') return undefined;
  return tabelle === 'errore' ? TESTO_ERRORE : TESTO_ATTESA;
}

/** Il testo del riquadro che prende il posto del grafico della lunghezza. */
export function invitoLunghezza(quante) {
  const quante0 = quante === 1;
  return (
    `<b>${quante0 ? 'Una sola lunghezza nel registro.' : 'Nessuna lunghezza nel registro.'}</b><br>` +
    `Con due misure compare la curva. Tocca qui per inserire ` +
    `${quante0 ? 'la seconda' : 'la prima'}.`
  );
}

/**
 * Che cosa va scritto nella carta di un bambino. Torna dati, non HTML: così si prova
 * senza DOM. `righe` sono quelle di dati.js, in ordine di data crescente.
 *
 * Il campo `eta` esce insieme ai numeri: chi disegna non può etichettare un percentile
 * contato dalla nascita come «età corretta».
 */
export function cartaPercentile({ bambino, righe, misura, eta, tabelle }) {
  if (tabelle !== 'pronte') {
    return { bambino, eta, nota: tabelle === 'errore' ? TESTO_ERRORE : TESTO_ATTESA };
  }
  if (!righe || !righe.length) {
    return { bambino, eta, nota: `Nessuna misura di ${misura}.` };
  }

  const k = chiaveDi(misura);
  const ultima = righe[righe.length - 1];
  const quanto = `${numero(ultima[k], misura === 'peso' ? 3 : 1)} ${k} il ${dataCorta(ultima.iso)}`;

  const ora = pctDi(misura, eta, ultima[k], ultima.iso);
  if (!ora) {
    return { bambino, eta, quanto, fuori: 'fuori dalle tabelle OMS', motivo: MOTIVO_FUORI_TABELLA };
  }

  const carta = {
    bambino,
    eta,
    quanto,
    percentile: percentileScritto(ora.p),
    z: zScritto(ora.z),
    // Il numero porta addosso la data da cui è contato. Così non basta un interruttore
    // sbagliato per far leggere un percentile anagrafico come se fosse corretto.
    etaNota: eta === 'corretta' ? undefined : 'contato dall’età anagrafica',
  };

  // Il percentile di partenza si mostra solo con almeno due misure: con una sola non
  // c'è nessun «prima» da confrontare.
  if (righe.length > 1) {
    const q = pctDi(misura, eta, righe[0][k], righe[0].iso);
    carta.prima = q
      ? `alla prima misura ${percentileScritto(q.p)}, ${zScritto(q.z)}`
      : 'la prima misura è fuori dalle tabelle OMS';
  }
  return carta;
}

/** Il markup della sezione. Le classi `on` nascono dallo stato, mai fisse. */
export function markup({ eta, misura, periodo } = {}) {
  const on = (atteso, valore) => (atteso === valore ? ' on' : '');
  return `
<div class="agebox" data-cr="eta">
  <div class="card${on(eta, 'corretta')}" data-eta="corretta" role="button" tabindex="0">
    <div class="lbl">Età corretta</div><div class="n" data-n="corretta">—</div>
  </div>
  <div class="card${on(eta, 'anagrafica')}" data-eta="anagrafica" role="button" tabindex="0">
    <div class="lbl">Età anagrafica</div><div class="n" data-n="anagrafica">—</div>
  </div>
</div>

<div class="seg" data-cr="misura">
  <b class="${on(misura, 'peso').trim()}" data-misura="peso">Peso</b><b class="${on(misura, 'lunghezza').trim()}" data-misura="lunghezza">Lunghezza</b>
</div>

<div class="seg" data-cr="periodo">
  <b class="${on(periodo, '1m').trim()}" data-periodo="1m">1 mese</b><b class="${on(periodo, '3m').trim()}" data-periodo="3m">3 mesi</b><b class="${on(periodo, '6m').trim()}" data-periodo="6m">6 mesi</b><b class="${on(periodo, 'tutto').trim()}" data-periodo="tutto">Tutto</b>
</div>

<div class="cr-nota" data-cr="nota" hidden>
  Stai guardando l’età anagrafica. Le curve dell’OMS partono dal termine: i percentili
  qui sotto sono contati dalla nascita.
</div>

<div class="card chart" data-cr="grafico"></div>

<div class="cr-legenda">
  ${BAMBINI.map((b) => `<span><i class="li ${SIGLA[b]}"></i>${CORTO[b]}</span>`).join('')}
  <span><i class="li med"></i>Metà dei bambini</span>
  <span><i class="li banda"></i>Zona normale</span>
</div>

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

// ── lettura dei dati ───────────────────────────────────────────────────────

function righeDi(bambino) {
  return stato.misura === 'peso' ? pesate(bambino) : lunghezze(bambino);
}

/** Le serie per il grafico: i giorni di età contati dalla partenza scelta. */
function serieDi() {
  const k = chiaveDi(stato.misura);
  const da = partenzaDi(stato.eta);
  const out = {};
  for (const bambino of BAMBINI) {
    out[bambino] = righeDi(bambino).map((r) => ({
      giorni: giorniDa(da, r.iso),
      valore: r[k],
    }));
  }
  return out;
}

// ── disegno dei percentili ─────────────────────────────────────────────────

function cartaHtml(carta) {
  const sigla = SIGLA[carta.bambino];
  const testa = `<span class="chip ${sigla}">${CORTO[carta.bambino]}</span>`;

  if (carta.nota) {
    return `<div class="card">${testa}<div class="cr-fuori">—</div>
      <div class="t">${carta.nota}</div></div>`;
  }
  if (carta.fuori) {
    return `<div class="card">${testa}<div class="cr-fuori">${carta.fuori}</div>
      <div class="t">${carta.quanto}<br>${carta.motivo}</div></div>`;
  }
  const prima = carta.prima ? `<br>${carta.prima}` : '';
  const quale = carta.etaNota ? `<br>${carta.etaNota}` : '';
  return `<div class="card">${testa}
    <div class="p" style="color:${COLORE[carta.bambino]}">${carta.percentile}</div>
    <div class="t">${carta.z}<br>${carta.quanto}${prima}${quale}</div></div>`;
}

function percentiliHtml() {
  if (stato.tabelle !== 'pronte') {
    const testo = stato.tabelle === 'errore' ? TESTO_ERRORE : TESTO_ATTESA;
    return `<div class="card cr-attesa">${testo}</div>`;
  }
  return BAMBINI.map((bambino) =>
    cartaHtml(
      cartaPercentile({
        bambino,
        righe: righeDi(bambino),
        misura: stato.misura,
        eta: stato.eta,
        tabelle: stato.tabelle,
      })
    )
  ).join('');
}

// ── disegno del grafico ────────────────────────────────────────────────────

function quanteMisure() {
  return BAMBINI.reduce((somma, bambino) => somma + righeDi(bambino).length, 0);
}

function aggiornaGrafico() {
  const quante = quanteMisure();
  const invito = stato.misura === 'lunghezza' && quante < 2;
  el.grafico.classList.toggle('card', !invito);
  el.grafico.classList.toggle('chart', !invito);
  el.grafico.classList.toggle('cr-invito', invito);
  if (invito) {
    el.grafico.innerHTML = invitoLunghezza(quante);
    return;
  }
  const serie = serieDi();
  const { giorniDa: da, giorniA: a } = finestra(stato.periodo, serie);
  el.grafico.innerHTML = disegnaGrafico({
    misura: stato.misura,
    serie,
    giorniDa: da,
    giorniA: a,
    // Senza bande il grafico non si disegna. Qui si dice perché mancano: chi disegna
    // non lo sa, lo sa questa sezione.
    messaggio: messaggioDelGrafico(stato.tabelle),
  });
}

// ── aggiornamento sul posto ────────────────────────────────────────────────

function accendi(contenitore, chiave, valore) {
  for (const figlio of contenitore.children) {
    figlio.classList.toggle('on', figlio.dataset[chiave] === valore);
  }
}

function aggiorna() {
  if (!el.grafico || !el.grafico.isConnected) return;

  // L'ordine conta. Prima i numeri, poi le etichette che li spiegano, poi il grafico.
  // Se un passo lancia un errore, quello che resta sullo schermo è coerente: non si
  // vede mai un percentile vecchio sotto un'etichetta nuova.
  el.percentili.innerHTML = percentiliHtml();

  const oggi = isoOggi();
  el.nCorretta.textContent = etaScritta(TERMINE, oggi);
  el.nAnagrafica.textContent = etaScritta(NASCITA, oggi);
  accendi(el.eta, 'eta', stato.eta);
  accendi(el.segMisura, 'misura', stato.misura);
  accendi(el.segPeriodo, 'periodo', stato.periodo);
  el.nota.hidden = stato.eta === 'corretta';

  aggiornaGrafico();
}

// ── costruzione e tocchi ───────────────────────────────────────────────────

function disegna(contenitore) {
  // Riaprire la sezione dopo un errore riprova davvero: è quello che promette il testo
  // dell'errore. `chiediTabelle` rimette il testo di attesa e non lancia due richieste.
  chiediTabelle();

  contenitore.innerHTML = markup(stato);

  const q = (sel) => contenitore.querySelector(sel);
  el.eta = q('[data-cr="eta"]');
  el.nCorretta = q('[data-n="corretta"]');
  el.nAnagrafica = q('[data-n="anagrafica"]');
  el.segMisura = q('[data-cr="misura"]');
  el.segPeriodo = q('[data-cr="periodo"]');
  el.nota = q('[data-cr="nota"]');
  el.grafico = q('[data-cr="grafico"]');
  el.percentili = q('[data-cr="percentili"]');

  // I tocchi rispondono su pointerdown, non al rilascio. Nessun gestore tocca le classi
  // `on`: cambiano lo stato e chiamano aggiorna(), che le rilegge da lì.
  const interruttore = (contenitore2, chiave) => {
    contenitore2.addEventListener('pointerdown', (e) => {
      const b = e.target.closest(`[data-${chiave}]`);
      if (!b || b.dataset[chiave] === stato[chiave]) return;
      stato[chiave] = b.dataset[chiave];
      aggiorna();
    });
  };
  interruttore(el.eta, 'eta');
  interruttore(el.segMisura, 'misura');
  interruttore(el.segPeriodo, 'periodo');

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
