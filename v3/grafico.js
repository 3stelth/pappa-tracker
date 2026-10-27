// Il grafico della crescita: le bande dell'OMS dietro, le linee dei due bambini davanti.
//
// Qui non si tocca il DOM e non si importa nessuna libreria: ogni funzione torna
// numeri o una stringa SVG. Così il disegno si prova con Node, senza browser.
//
// L'asse x è in giorni di età. Le etichette si scrivono in mesi perché un genitore
// legge i mesi, ma i giorni non si arrotondano mai: le tabelle OMS sono per giorno.
//
// Un valore non finito non deve mai finire in un attributo SVG: il browser non dà
// errore, disegna e basta. Ogni punto passa da un controllo prima di entrare.

import { GIORNO_MAX, lms, unita, valoreA } from './crescita.js';
import { BAMBINI, COLORE, numero } from './app.js';

export const Z_BANDE = [
  [-1.881, 'P3'],
  [-1.036, 'P15'],
  [0, 'P50'],
  [1.036, 'P85'],
  [1.881, 'P97'],
];

// Misure del disegno, dal mockup approvato.
const LARG = 330;
const ALT = 252;
const SX = 32; // spazio a sinistra per le etichette dei kg
const DX = 10;
const SU = 12;
const GIU = 30; // spazio in basso per i mesi

const GIORNI_MESE = 365.25 / 12;

// Quanti giorni fra due punti di una banda: poche decine di punti bastano, le curve
// OMS sono lisce e un path più fitto non si vede.
const PUNTI_BANDA = 40;

// Riempimenti fra le bande, dal più chiaro fuori al più scuro verso il centro.
const RIEMPIMENTI = [0.05, 0.09, 0.09, 0.05];
const COLORE_BANDA = 'rgba(60,60,67,0.45)';
const COLORE_RIEMPIMENTO = '#007AFF';

// Passi dell'asse y fra cui scegliere, per misura. Il primo che lascia al massimo
// sei righe vince: con i kg si arriva a 2, con i cm a 5 o 10.
const PASSI_Y = { peso: [0.5, 1, 2, 5], lunghezza: [2, 5, 10, 20] };

const GIORNI_PERIODO = { '1m': 30, '3m': 91, '6m': 183 };

export const SENZA_BANDE = 'Le bande dell’OMS non sono disponibili: il grafico non si può leggere.';

function n1(x) {
  return x.toFixed(1);
}

/**
 * Le cinque bande dell'OMS fra due giorni di età.
 * Torna sempre cinque voci; `punti` resta vuoto se le tabelle non sono caricate o se
 * l'intervallo cade fuori dalle tabelle.
 */
export function bande(misura, giorniDa, giorniA, passo = 1) {
  const da = Math.max(0, Math.ceil(giorniDa));
  const a = Math.min(GIORNO_MAX, Math.floor(giorniA));
  const p = Math.max(1, Math.round(passo));

  const giorni = [];
  for (let g = da; g <= a; g += p) giorni.push(g);
  if (giorni.length && giorni[giorni.length - 1] !== a) giorni.push(a);

  return Z_BANDE.map(([z, etichetta]) => {
    const punti = [];
    for (const g of giorni) {
      const terna = lms(misura, g);
      if (!terna) continue;
      const valore = valoreA(terna, z);
      if (Number.isFinite(valore)) punti.push([g, valore]);
    }
    return { z, etichetta, punti };
  });
}

/**
 * I giorni coperti da un periodo. `serie` serve solo a sapere dov'è l'ultima misura:
 * la finestra finisce lì, non sul giorno di oggi.
 */
export function finestra(periodo, serie) {
  let fine = 0;
  for (const nome of Object.keys(serie || {})) {
    for (const m of serie[nome] || []) {
      if (Number.isFinite(m.giorni) && m.giorni > fine) fine = m.giorni;
    }
  }
  if (periodo === 'tutto') return { giorniDa: 0, giorniA: Math.max(fine, 30) };
  const quanti = GIORNI_PERIODO[periodo] || GIORNI_PERIODO['3m'];
  const giorniA = Math.max(fine, quanti);
  return { giorniDa: Math.max(0, giorniA - quanti), giorniA };
}

/** I punti di un bambino che stanno davvero nella finestra. */
function puntiDentro(righe, giorniDa, giorniA) {
  return (righe || [])
    .filter(
      (m) =>
        Number.isFinite(m.giorni) &&
        Number.isFinite(m.valore) &&
        m.giorni >= 0 &&
        m.giorni >= giorniDa &&
        m.giorni <= giorniA
    )
    .map((m) => [m.giorni, m.valore])
    .sort((a, b) => a[0] - b[0]);
}

/** Il passo dell'asse y: il primo che lascia al massimo sei righe. */
function passoY(misura, min, max) {
  const candidati = PASSI_Y[misura] || PASSI_Y.peso;
  for (const p of candidati) if ((max - min) / p <= 6) return p;
  return candidati[candidati.length - 1];
}

/** L'etichetta di una riga dell'asse y, con la virgola decimale. */
function scrittoY(valore, passo) {
  return numero(valore, passo < 1 ? 1 : 0);
}

/** I mesi da scrivere sull'asse x: al massimo sei etichette. */
function mesiAsse(giorniDa, giorniA) {
  const mesiTotali = (giorniA - giorniDa) / GIORNI_MESE;
  const passo = [1, 2, 3, 6, 12].find((p) => mesiTotali / p <= 6) || 12;
  const out = [];
  const primo = Math.ceil(giorniDa / GIORNI_MESE / passo) * passo;
  for (let m = primo; m * GIORNI_MESE <= giorniA; m += passo) out.push(m);
  return out;
}

/**
 * Il grafico intero, come stringa SVG.
 * `serie` è `{Gabriel:[{giorni,valore}], Vittorio:[…]}`; i punti fuori dalla finestra
 * e quelli prima del termine non entrano nel disegno.
 * `messaggio` è il testo da scrivere quando le bande mancano: chi chiama sa perché.
 */
export function disegnaGrafico({ misura, serie, giorniDa, giorniA, messaggio }) {
  const da = Number.isFinite(giorniDa) ? giorniDa : 0;
  const a = Number.isFinite(giorniA) && giorniA > da ? giorniA : da + 30;

  const passo = Math.max(1, Math.round((a - da) / PUNTI_BANDA));
  const curve = bande(misura, da, a, passo).filter((b) => b.punti.length > 1);

  // Senza le bande il grafico non si può leggere: tutto il suo senso è dove passa la
  // linea del bambino rispetto alle bande. Con la sola linea l'asse y si scalerebbe
  // sui pesi del bambino, la linea finirebbe in alto nel riquadro e sembrerebbe alta.
  // Meglio dirlo che disegnare una posizione che non vuol dire niente.
  if (!curve.length) return vuoto(messaggio || SENZA_BANDE);

  const linee = BAMBINI.map((nome) => ({
    nome,
    punti: puntiDentro(serie && serie[nome], da, a),
  }));

  const valori = [];
  for (const b of curve) for (const [, v] of b.punti) valori.push(v);
  for (const l of linee) for (const [, v] of l.punti) valori.push(v);

  const p = passoY(misura, Math.min(...valori), Math.max(...valori));
  const yMin = Math.floor(Math.min(...valori) / p) * p;
  const yMax = Math.ceil(Math.max(...valori) / p) * p;
  const altezzaY = yMax - yMin || p;

  const X = (g) => SX + ((g - da) / (a - da)) * (LARG - SX - DX);
  const Y = (v) => ALT - GIU - ((v - yMin) / altezzaY) * (ALT - GIU - SU);
  const linea = (punti) => 'M' + punti.map(([g, v]) => n1(X(g)) + ' ' + n1(Y(v))).join(' L');

  let g = '';

  // riempimenti fra una banda e l'altra
  for (let i = 0; i < curve.length - 1; i += 1) {
    const sopra = curve[i + 1].punti.slice().reverse();
    g +=
      `<path d="${linea(curve[i].punti)} L` +
      sopra.map(([gg, v]) => n1(X(gg)) + ' ' + n1(Y(v))).join(' L') +
      ` Z" fill="${COLORE_RIEMPIMENTO}" opacity="${RIEMPIMENTI[i] ?? 0.05}"/>`;
  }

  // le cinque curve, con la mediana piena e le altre tratteggiate
  for (const b of curve) {
    const mezzo = b.z === 0;
    g +=
      `<path class="banda" d="${linea(b.punti)}" fill="none" stroke="${COLORE_BANDA}"` +
      ` stroke-width="${mezzo ? 1.5 : 1}" stroke-opacity="${mezzo ? 0.55 : 0.33}"` +
      `${mezzo ? '' : ' stroke-dasharray="3 3"'}/>`;
    const [gg, v] = b.punti[b.punti.length - 1];
    g +=
      `<text x="${n1(X(gg) + 3)}" y="${n1(Y(v) + 3)}" font-size="10" font-weight="400"` +
      ` fill="${COLORE_BANDA}" opacity=".8">${b.etichetta}</text>`;
  }

  // righe e etichette dell'asse y
  for (let v = yMin; v <= yMax + 1e-9; v += p) {
    g +=
      `<line x1="${SX}" y1="${n1(Y(v))}" x2="${LARG - DX - 14}" y2="${n1(Y(v))}"` +
      ` stroke="#E9E9ED"/>`;
    g +=
      `<text class="asse-y" x="${SX - 6}" y="${n1(Y(v) + 3.5)}" text-anchor="end"` +
      ` font-size="10" font-weight="400" fill="rgba(60,60,67,0.42)">${scrittoY(v, p)}</text>`;
  }

  // etichette dell'asse x, in mesi
  for (const m of mesiAsse(da, a)) {
    g +=
      `<text class="asse-x" x="${n1(X(m * GIORNI_MESE))}" y="${ALT - GIU + 14}"` +
      ` text-anchor="middle" font-size="10" font-weight="400" fill="rgba(60,60,67,0.42)">${m}m</text>`;
  }

  // le linee dei bambini e il pallino sull'ultima misura
  for (const l of linee) {
    if (!l.punti.length) continue;
    const col = COLORE[l.nome];
    if (l.punti.length > 1) {
      g +=
        `<path class="serie" d="${linea(l.punti)}" fill="none" stroke="${col}"` +
        ` stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    const [gg, v] = l.punti[l.punti.length - 1];
    g +=
      `<circle class="punto" cx="${n1(X(gg))}" cy="${n1(Y(v))}" r="4.6" fill="#fff"` +
      ` stroke="${col}" stroke-width="2.4"/>`;
  }

  const u = unita(misura);
  g +=
    `<text x="${SX}" y="${ALT - 4}" font-size="10" font-weight="400" fill="rgba(60,60,67,0.42)">` +
    `età in mesi${u ? ' · ' + u : ''}</text>`;

  return cornice(g);
}

function cornice(dentro) {
  return (
    `<svg viewBox="0 0 ${LARG} ${ALT}" role="img" aria-label="Grafico della crescita">` +
    dentro +
    '</svg>'
  );
}

/** Spezza un messaggio in righe corte: nell'SVG il testo non va a capo da sé. */
function righe(testo, quanti = 38) {
  const out = [''];
  for (const parola of String(testo).split(' ')) {
    const ultima = out[out.length - 1];
    if (!ultima) out[out.length - 1] = parola;
    else if ((ultima + ' ' + parola).length <= quanti) out[out.length - 1] = ultima + ' ' + parola;
    else out.push(parola);
  }
  return out;
}

function vuoto(testo) {
  const r = righe(testo);
  const primo = ALT / 2 - ((r.length - 1) * 15) / 2;
  return cornice(
    `<text class="messaggio" x="${LARG / 2}" y="${n1(primo)}" text-anchor="middle"` +
      ` font-size="15" font-weight="400" fill="rgba(60,60,67,0.60)">` +
      r.map((t, i) => `<tspan x="${LARG / 2}" dy="${i ? 15 : 0}">${t}</tspan>`).join('') +
      '</text>'
  );
}
