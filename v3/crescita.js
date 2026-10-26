// Percentili di crescita sull'età corretta.
//
// Curve: WHO Child Growth Standards 2006, maschi, tabelle per giorno di età.
// Si usa l'età corretta, cioè i giorni dalla data del termine, non dalla nascita.
// L'età si tiene sempre in giorni: i mesi servono solo a scriverla sullo schermo.
//
// Le tabelle sono quelle per giorno, mai quelle per mese: l'interpolazione lineare
// fra i mesi interi sbaglia fino a 0,197 in punteggio z, cioè quasi 90 grammi.
//
// Il punteggio z non si tronca mai: l'OMS tronca a ±3 solo in alcuni indicatori
// ponderali, non in peso per età né in lunghezza per età.

export const NASCITA = '2025-12-08'; // due gemelli maschi, a 27 settimane + 4 giorni
export const TERMINE = '2026-03-05'; // 87 giorni dopo la nascita
export const GIORNO_MAX = 1856; // le tabelle coprono 0-1856 giorni, circa 5 anni

export const MOTIVO_FUORI_TABELLA =
  'Le curve OMS partono dalla data del termine: prima non esistono.';

const FILE = { peso: 'oms-peso-giorni.json', lunghezza: 'oms-lunghezza-giorni.json' };

let tabelle = null;

/** Il lettore di default: prende i JSON accanto al modulo. */
async function leggiAccanto(file) {
  const risposta = await fetch(new URL(`./dati/${file}`, import.meta.url));
  if (!risposta.ok) throw new Error(`non riesco a leggere ${file}: ${risposta.status}`);
  return risposta.json();
}

/**
 * Carica le due tabelle e le tiene in memoria. `leggi(file)` serve ai test, che girano
 * anche senza browser; senza argomento legge i JSON accanto al modulo.
 */
export async function caricaTabelle(leggi = leggiAccanto) {
  if (tabelle) return tabelle;
  const [peso, lunghezza] = await Promise.all([leggi(FILE.peso), leggi(FILE.lunghezza)]);
  tabelle = { peso, lunghezza };
  return tabelle;
}

/** La terna L, M, S di una misura a un giorno di età. Fuori dalle tabelle torna null. */
export function lms(misura, giorni) {
  if (!tabelle || !tabelle[misura]) return null;
  if (!Number.isInteger(giorni) || giorni < 0 || giorni > GIORNO_MAX) return null;
  return tabelle[misura].giorni[giorni] || null;
}

/** L'unità di una misura: 'kg' oppure 'cm'. */
export function unita(misura) {
  return tabelle && tabelle[misura] ? tabelle[misura].unita : '';
}

/** Il punteggio z di un valore, dalla terna L, M, S. */
export function zDa(valore, terna) {
  const [L, M, S] = terna;
  return Math.abs(L) < 1e-9
    ? Math.log(valore / M) / S
    : (Math.pow(valore / M, L) - 1) / (L * S);
}

/** Il valore atteso a un dato punteggio z, dalla terna L, M, S. */
export function valoreA(terna, z) {
  const [L, M, S] = terna;
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

// Abramowitz e Stegun 7.1.26: errore massimo 1,5e-7, più che abbastanza per un
// percentile che si scrive senza decimali.
function erf(x) {
  const segno = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return segno * y;
}

/** Il percentile di un punteggio z, da 0 a 100. */
export function percentile(z) {
  return 100 * 0.5 * (1 + erf(z / Math.SQRT2));
}

// Le date si compongono sempre a mano in orario locale: `new Date('2026-03-05')` è
// mezzanotte UTC, e in Italia torna indietro di un giorno.
function data(iso) {
  return new Date(iso + 'T00:00:00');
}

/** I giorni interi fra due date. Può essere negativo. */
export function giorniDa(isoPartenza, isoMisura) {
  return Math.round((data(isoMisura) - data(isoPartenza)) / 86400000);
}

/** La data di oggi, in orario locale, come 'AAAA-MM-GG'. */
export function isoDi(d) {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

/**
 * L'età scritta per esteso: '7 mesi e 20 gg', '1 mese', '14 gg'. Conta i mesi di
 * calendario e poi i giorni che restano, come fa un pediatra.
 */
export function etaScritta(isoPartenza, isoMisura) {
  const da = data(isoPartenza);
  const a = data(isoMisura);
  if (a < da) return 'non ancora al termine';

  let mesi = (a.getFullYear() - da.getFullYear()) * 12 + (a.getMonth() - da.getMonth());
  const pietra = new Date(da);
  pietra.setMonth(da.getMonth() + mesi);
  if (pietra > a) {
    mesi -= 1;
    pietra.setMonth(pietra.getMonth() - 1);
  }
  const giorni = Math.round((a - pietra) / 86400000);

  if (mesi === 0) return `${giorni} gg`;
  const parteMesi = mesi === 1 ? '1 mese' : `${mesi} mesi`;
  return giorni ? `${parteMesi} e ${giorni} gg` : parteMesi;
}

/**
 * Il percentile come ordinale. Sotto il primo scrive '<1°' e non un numero con i
 * decimali: sarebbe una precisione finta. Sopra il novantanovesimo, '>99°'.
 */
export function percentileScritto(p) {
  if (!Number.isFinite(p)) return '—';
  if (p < 1) return '<1°';
  if (p > 99) return '>99°';
  return `${Math.round(p)}°`;
}

/** Il punteggio z chiamato per nome, col meno tipografico e la virgola decimale. */
export function zScritto(z) {
  if (!Number.isFinite(z)) return 'z —';
  const segno = z < 0 ? '−' : '+';
  return `z ${segno}${Math.abs(z).toFixed(2).replace('.', ',')}`;
}
